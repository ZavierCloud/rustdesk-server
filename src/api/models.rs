use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::database::User;

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: Option<String>,
    pub password: Option<String>,
    pub id: Option<String>,
    pub uuid: Option<String>,
    #[serde(rename = "autoLogin")]
    pub auto_login: Option<bool>,
    #[serde(rename = "type")]
    pub type_: Option<String>,
    #[serde(rename = "verificationCode")]
    pub verification_code: Option<String>,
    #[serde(rename = "tfaCode")]
    pub tfa_code: Option<String>,
    pub secret: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserPayload {
    pub name: String,
    pub display_name: String,
    pub avatar: String,
    pub email: String,
    pub note: String,
    pub status: i64,
    pub is_admin: bool,
}

impl From<&User> for UserPayload {
    fn from(u: &User) -> Self {
        Self {
            name: u.name.clone(),
            display_name: u.display_name.clone().unwrap_or_default(),
            avatar: String::new(),
            email: u.email.clone().unwrap_or_default(),
            note: u.note.clone().unwrap_or_default(),
            status: u.status,
            is_admin: u.is_admin(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct AuthBody {
    #[serde(skip_serializing_if = "String::is_empty")]
    pub access_token: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub tfa_type: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub secret: String,
    pub user: UserPayload,
}

#[derive(Debug, Serialize)]
pub struct ErrorBody {
    pub error: String,
}

pub enum ApiError {
    Unauthorized(String),
    BadRequest(String),
    NotFound(String),
    Internal(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, msg) = match self {
            ApiError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, m),
            ApiError::BadRequest(m) => (StatusCode::BAD_REQUEST, m),
            ApiError::NotFound(m) => (StatusCode::NOT_FOUND, m),
            ApiError::Internal(m) => (StatusCode::INTERNAL_SERVER_ERROR, m),
        };
        (status, Json(ErrorBody { error: msg })).into_response()
    }
}

impl From<hbb_common::anyhow::Error> for ApiError {
    fn from(e: hbb_common::anyhow::Error) -> Self {
        ApiError::Internal(e.to_string())
    }
}

// The Dart client posts JSON without a JSON content type, so the request body is
// read as a raw string and parsed here instead of via axum's `Json` extractor.
pub fn parse_body<T: serde::de::DeserializeOwned>(body: &str) -> Result<T, ApiError> {
    serde_json::from_str(body)
        .map_err(|e| ApiError::BadRequest(format!("invalid request body: {e}")))
}
