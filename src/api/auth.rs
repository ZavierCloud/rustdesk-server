use axum::{extract::Extension, http::HeaderMap, Json};
use serde_json::{json, Value};

use super::models::{parse_body, ApiError, AuthBody, LoginRequest, UserPayload};
use super::AppState;
use crate::database::User;

const TOKEN_TTL_DAYS: i64 = 30;

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|v| v.trim().to_owned())
}

pub async fn authed_user(state: &AppState, headers: &HeaderMap) -> Result<User, ApiError> {
    let token =
        bearer_token(headers).ok_or_else(|| ApiError::Unauthorized("No access token".to_owned()))?;
    let row = state
        .db
        .get_token(&token)
        .await?
        .ok_or_else(|| ApiError::Unauthorized("Invalid access token".to_owned()))?;
    let user = state
        .db
        .get_user_by_id(row.user_id)
        .await?
        .ok_or_else(|| ApiError::Unauthorized("User not found".to_owned()))?;
    if !user.is_normal() {
        return Err(ApiError::Unauthorized("Account disabled".to_owned()));
    }
    Ok(user)
}

pub async fn authed_admin(state: &AppState, headers: &HeaderMap) -> Result<User, ApiError> {
    let user = authed_user(state, headers).await?;
    if !user.is_admin() {
        return Err(ApiError::Unauthorized(
            "Admin permission required".to_owned(),
        ));
    }
    Ok(user)
}

async fn issue_token(state: &AppState, user: &User, req: &LoginRequest) -> Result<String, ApiError> {
    let token = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    let expires_at = (chrono::Utc::now() + chrono::Duration::days(TOKEN_TTL_DAYS))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();
    let uuid_bytes = req.uuid.as_ref().map(|u| u.as_bytes().to_vec());
    state
        .db
        .insert_token(
            &token,
            user.id,
            req.id.as_deref(),
            uuid_bytes.as_deref(),
            Some(&expires_at),
        )
        .await?;
    Ok(token)
}

fn token_body(user: &User, token: String) -> AuthBody {
    AuthBody {
        access_token: token,
        r#type: "access_token".to_owned(),
        tfa_type: String::new(),
        secret: String::new(),
        user: UserPayload::from(user),
    }
}

fn tfa_body(user: &User) -> AuthBody {
    AuthBody {
        access_token: String::new(),
        r#type: "email_check".to_owned(),
        tfa_type: "tfa_check".to_owned(),
        secret: String::new(),
        user: UserPayload::from(user),
    }
}

pub async fn login(
    Extension(state): Extension<AppState>,
    body: String,
) -> Result<Json<AuthBody>, ApiError> {
    let req: LoginRequest = parse_body(&body)?;
    let type_ = req.type_.clone().unwrap_or_else(|| "account".to_owned());
    match type_.as_str() {
        "account" => {
            let name = req.username.clone().unwrap_or_default();
            let password = req.password.clone().unwrap_or_default();
            let user = state
                .db
                .get_user_by_name(&name)
                .await?
                .ok_or_else(|| ApiError::Unauthorized("Invalid username or password".to_owned()))?;
            if !user.is_normal() {
                return Err(ApiError::Unauthorized("Account disabled".to_owned()));
            }
            let valid = bcrypt::verify(&password, &user.password_hash)
                .map_err(|e| ApiError::Internal(e.to_string()))?;
            if !valid {
                return Err(ApiError::Unauthorized(
                    "Invalid username or password".to_owned(),
                ));
            }
            if user.totp_enabled != 0 {
                return Ok(Json(tfa_body(&user)));
            }
            let token = issue_token(&state, &user, &req).await?;
            Ok(Json(token_body(&user, token)))
        }
        "email_code" | "tfa_code" => {
            let name = req.username.clone().unwrap_or_default();
            let code = req
                .tfa_code
                .clone()
                .or_else(|| req.verification_code.clone())
                .unwrap_or_default();
            let user = state
                .db
                .get_user_by_name(&name)
                .await?
                .ok_or_else(|| ApiError::Unauthorized("Invalid username".to_owned()))?;
            if user.totp_enabled == 0 {
                return Err(ApiError::Unauthorized("2FA is not enabled".to_owned()));
            }
            let secret = user
                .totp_secret
                .clone()
                .ok_or_else(|| ApiError::Unauthorized("2FA is not configured".to_owned()))?;
            if !super::console::verify_totp(&secret, &code) {
                return Err(ApiError::Unauthorized(
                    "Invalid verification code".to_owned(),
                ));
            }
            let token = issue_token(&state, &user, &req).await?;
            Ok(Json(token_body(&user, token)))
        }
        other => Err(ApiError::BadRequest(format!(
            "Unsupported login type: {other}"
        ))),
    }
}

pub async fn logout(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    if let Some(token) = bearer_token(&headers) {
        state.db.delete_token(&token).await?;
    }
    Ok(Json(json!({})))
}

pub async fn current_user(
    Extension(state): Extension<AppState>,
    headers: HeaderMap,
) -> Result<Json<UserPayload>, ApiError> {
    let user = authed_user(&state, &headers).await?;
    Ok(Json(UserPayload::from(&user)))
}

pub async fn login_options() -> Json<Vec<String>> {
    Json(Vec::new())
}
