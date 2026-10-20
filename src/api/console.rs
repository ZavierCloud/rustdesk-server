use axum::{
    extract::{Extension, Path, Query},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::auth::{authed_admin, authed_user};
use super::models::{ApiError, UserPayload};
use super::AppState;
use crate::database::{Audit, PeerRow, Setting};

const ISSUER: &str = "RD Server";
const AUDIT_LIMIT_DEFAULT: i64 = 200;
const AUDIT_LIMIT_MAX: i64 = 1000;

fn build_totp(secret: &str, account: &str) -> Result<totp_rs::TOTP, ApiError> {
    let bytes = totp_rs::Secret::Encoded(secret.to_owned())
        .to_bytes()
        .map_err(|e| ApiError::Internal(format!("invalid totp secret: {e}")))?;
    totp_rs::TOTP::new(
        totp_rs::Algorithm::SHA1,
        6,
        1,
        30,
        bytes,
        Some(ISSUER.to_owned()),
        account.to_owned(),
    )
    .map_err(|e| ApiError::Internal(format!("invalid totp params: {e}")))
}

pub fn verify_totp(secret: &str, code: &str) -> bool {
    let code = code.trim();
    if code.is_empty() {
        return false;
    }
    match build_totp(secret, ISSUER) {
        Ok(totp) => totp.check(code, crate::common::now()),
        Err(_) => false,
    }
}

fn new_totp_secret() -> String {
    // `Display` on the raw secret is hex; `to_encoded` yields the base32 form
    // that both the otpauth URL and authenticator apps expect.
    totp_rs::Secret::generate_secret().to_encoded().to_string()
}

pub async fn users_list(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<UserPayload>>, ApiError> {
    authed_admin(&state, &headers).await?;
    let users = state.db.list_users().await?;
    Ok(Json(users.iter().map(UserPayload::from).collect()))
}

#[derive(Debug, Deserialize)]
pub struct CreateUserReq {
    pub name: String,
    pub password: String,
    #[serde(default)]
    pub is_admin: bool,
}

pub async fn user_create(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
    body: String,
) -> Result<Json<Value>, ApiError> {
    authed_admin(&state, &headers).await?;
    let req: CreateUserReq = super::models::parse_body(&body)?;
    if req.name.trim().is_empty() || req.password.is_empty() {
        return Err(ApiError::BadRequest(
            "name and password are required".to_owned(),
        ));
    }
    if state.db.get_user_by_name(&req.name).await?.is_some() {
        return Err(ApiError::BadRequest("user already exists".to_owned()));
    }
    let hash = bcrypt::hash(&req.password, bcrypt::DEFAULT_COST)
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    let id = state.db.create_user(&req.name, &hash, req.is_admin).await?;
    Ok(Json(json!({ "id": id })))
}

// The console identifies users by name (its `UserPayload` carries no id), while
// numeric ids remain accepted for API clients that have them.
async fn resolve_user_id(state: &AppState, key: &str) -> Result<i64, ApiError> {
    if let Ok(id) = key.parse::<i64>() {
        if state.db.get_user_by_id(id).await?.is_some() {
            return Ok(id);
        }
    }
    state
        .db
        .get_user_by_name(key)
        .await?
        .map(|u| u.id)
        .ok_or_else(|| ApiError::NotFound("user not found".to_owned()))
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserReq {
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub note: Option<String>,
    pub status: Option<i64>,
    pub is_admin: Option<bool>,
    pub password: Option<String>,
}

pub async fn user_update(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
    Path(key): Path<String>,
    body: String,
) -> Result<Json<Value>, ApiError> {
    authed_admin(&state, &headers).await?;
    let req: UpdateUserReq = super::models::parse_body(&body)?;
    let id = resolve_user_id(&state, &key).await?;
    let user = state
        .db
        .get_user_by_id(id)
        .await?
        .ok_or_else(|| ApiError::NotFound("user not found".to_owned()))?;
    state
        .db
        .update_user_profile(
            id,
            req.display_name.as_deref().or(user.display_name.as_deref()),
            req.email.as_deref().or(user.email.as_deref()),
            req.note.as_deref().or(user.note.as_deref()),
            req.status.unwrap_or(user.status),
            req.is_admin.unwrap_or_else(|| user.is_admin()),
        )
        .await?;
    if let Some(pw) = req.password.as_deref() {
        if !pw.is_empty() {
            let hash = bcrypt::hash(pw, bcrypt::DEFAULT_COST)
                .map_err(|e| ApiError::Internal(e.to_string()))?;
            state.db.set_user_password(id, &hash).await?;
            state.db.delete_user_tokens(id).await?;
        }
    }
    Ok(Json(json!({})))
}

pub async fn user_delete(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
    Path(key): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let me = authed_admin(&state, &headers).await?;
    let id = resolve_user_id(&state, &key).await?;
    if me.id == id {
        return Err(ApiError::BadRequest("cannot delete yourself".to_owned()));
    }
    state.db.delete_user(id).await?;
    state.db.delete_user_tokens(id).await?;
    Ok(Json(json!({})))
}

#[derive(Debug, Serialize)]
pub struct DevicePayload {
    pub id: String,
    pub info: Value,
    pub status: Option<i64>,
    pub note: String,
    pub user_name: String,
    pub device_group_name: String,
    pub created_at: Option<String>,
    pub last_seen: Option<String>,
}

impl From<PeerRow> for DevicePayload {
    fn from(p: PeerRow) -> Self {
        Self {
            id: p.id,
            info: serde_json::from_str(&p.info).unwrap_or(Value::Null),
            status: p.status,
            note: p.note.unwrap_or_default(),
            user_name: p.user_name.unwrap_or_default(),
            device_group_name: p.device_group_name.unwrap_or_default(),
            created_at: p.created_at,
            last_seen: p.last_seen,
        }
    }
}

pub async fn devices_list(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<DevicePayload>>, ApiError> {
    authed_user(&state, &headers).await?;
    let peers = state.db.list_peers().await?;
    Ok(Json(peers.into_iter().map(DevicePayload::from).collect()))
}

#[derive(Debug, Deserialize)]
pub struct UpdateDeviceReq {
    pub note: Option<String>,
    pub device_group_name: Option<String>,
    pub user_name: Option<String>,
}

pub async fn device_update(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: String,
) -> Result<Json<Value>, ApiError> {
    authed_admin(&state, &headers).await?;
    let req: UpdateDeviceReq = super::models::parse_body(&body)?;
    if state.db.get_peer_row(&id).await?.is_none() {
        return Err(ApiError::NotFound("device not found".to_owned()));
    }
    if let Some(note) = req.note {
        state.db.set_peer_note(&id, &note).await?;
    }
    if let Some(group) = req.device_group_name {
        state.db.set_peer_group(&id, &group).await?;
    }
    if let Some(user_name) = req.user_name {
        state.db.set_peer_user_name(&id, &user_name).await?;
    }
    Ok(Json(json!({})))
}

pub async fn device_delete(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    authed_admin(&state, &headers).await?;
    state.db.delete_peer(&id).await?;
    Ok(Json(json!({})))
}

pub async fn settings_list(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<Setting>>, ApiError> {
    authed_admin(&state, &headers).await?;
    Ok(Json(state.db.list_settings().await?))
}

#[derive(Debug, Deserialize)]
pub struct SettingReq {
    pub key: String,
    pub value: String,
}

pub async fn setting_set(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
    body: String,
) -> Result<Json<Value>, ApiError> {
    authed_admin(&state, &headers).await?;
    let req: SettingReq = super::models::parse_body(&body)?;
    if req.key.trim().is_empty() {
        return Err(ApiError::BadRequest("key is required".to_owned()));
    }
    let modified_at = state.db.set_setting(&req.key, &req.value).await?;
    Ok(Json(json!({ "modified_at": modified_at })))
}

pub async fn setting_delete(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
    Path(key): Path<String>,
) -> Result<Json<Value>, ApiError> {
    authed_admin(&state, &headers).await?;
    state.db.delete_setting(&key).await?;
    Ok(Json(json!({})))
}

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub limit: Option<i64>,
}

fn audit_limit(q: &AuditQuery) -> i64 {
    q.limit
        .unwrap_or(AUDIT_LIMIT_DEFAULT)
        .clamp(1, AUDIT_LIMIT_MAX)
}

pub async fn audit_list(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
    Query(q): Query<AuditQuery>,
) -> Result<Json<Vec<Audit>>, ApiError> {
    authed_admin(&state, &headers).await?;
    Ok(Json(state.db.list_audit(None, audit_limit(&q)).await?))
}

pub async fn audit_list_by_type(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
    Path(type_): Path<String>,
    Query(q): Query<AuditQuery>,
) -> Result<Json<Vec<Audit>>, ApiError> {
    authed_admin(&state, &headers).await?;
    Ok(Json(
        state.db.list_audit(Some(&type_), audit_limit(&q)).await?,
    ))
}

pub async fn me_2fa_status(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let user = authed_user(&state, &headers).await?;
    Ok(Json(json!({ "enabled": user.totp_enabled != 0 })))
}

pub async fn me_2fa_setup(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let user = authed_user(&state, &headers).await?;
    let secret = new_totp_secret();
    let totp = build_totp(&secret, &user.name)?;
    let url = totp.get_url();
    Ok(Json(json!({ "secret": secret, "otpauth_url": url })))
}

#[derive(Debug, Deserialize)]
pub struct Enable2faReq {
    pub secret: String,
    pub code: String,
}

pub async fn me_2fa_enable(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
    body: String,
) -> Result<Json<Value>, ApiError> {
    let user = authed_user(&state, &headers).await?;
    let req: Enable2faReq = super::models::parse_body(&body)?;
    if !verify_totp(&req.secret, &req.code) {
        return Err(ApiError::BadRequest(
            "invalid verification code".to_owned(),
        ));
    }
    state
        .db
        .set_user_totp(user.id, Some(&req.secret), true)
        .await?;
    Ok(Json(json!({ "enabled": true })))
}

pub async fn me_2fa_disable(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let user = authed_user(&state, &headers).await?;
    state.db.set_user_totp(user.id, None, false).await?;
    Ok(Json(json!({ "enabled": false })))
}
