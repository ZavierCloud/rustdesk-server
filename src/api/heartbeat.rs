use axum::{extract::Extension, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use super::models::ApiError;
use super::AppState;

#[derive(Debug, Deserialize)]
pub struct HeartbeatReq {
    pub id: Option<String>,
    #[allow(dead_code)]
    pub uuid: Option<String>,
    #[allow(dead_code)]
    pub ver: Option<String>,
    #[allow(dead_code)]
    pub conns: Option<Vec<i32>>,
    pub modified_at: Option<i64>,
}

pub async fn heartbeat(
    Extension(state): Extension<AppState>,
    body: String,
) -> Result<Json<Value>, ApiError> {
    let req: HeartbeatReq = super::models::parse_body(&body)?;
    if let Some(id) = req.id.as_deref() {
        if !id.is_empty() {
            let _ = state.db.update_peer_last_seen(id).await;
        }
    }
    let modified_at = state.db.max_setting_modified_at().await?;
    let mut body = json!({ "modified_at": modified_at });
    if req.modified_at.unwrap_or(0) != modified_at {
        let settings = state.db.list_settings().await?;
        let mut options = serde_json::Map::new();
        for s in settings {
            options.insert(s.key, Value::String(s.value));
        }
        body["strategy"] = json!({ "config_options": options });
    }
    Ok(Json(body))
}

pub async fn sysinfo(
    Extension(state): Extension<AppState>,
    body: String,
) -> Result<String, ApiError> {
    let value: Value = serde_json::from_str(&body)
        .map_err(|_| ApiError::BadRequest("invalid sysinfo body".to_owned()))?;
    let id = value
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();
    let Some(peer) = state.db.get_peer_row(&id).await? else {
        return Ok("ID_NOT_FOUND".to_owned());
    };
    let mut merged: serde_json::Map<String, Value> =
        serde_json::from_str(&peer.info).unwrap_or_default();
    if let Value::Object(new) = value {
        for (k, v) in new {
            merged.insert(k, v);
        }
    }
    state
        .db
        .update_peer_info(&id, &Value::Object(merged).to_string())
        .await?;
    Ok("SYSINFO_UPDATED".to_owned())
}

pub async fn sysinfo_ver() -> String {
    "1".to_owned()
}
