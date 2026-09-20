pub mod auth;
pub mod console;
pub mod heartbeat;
pub mod models;

use axum::{
    http::{header, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::{any, delete, get, post},
    Extension, Router,
};
use hbb_common::{log, ResultType};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use tower_http::cors::CorsLayer;

use crate::database::Database;

const CONSOLE_DIST: &str = "console/dist";

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub api_port: i32,
}

fn content_type(path: &std::path::Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") | Some("mjs") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") | Some("map") => "application/json; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        Some("txt") => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

// Serves the built console from `console/dist`, falling back to `index.html` so
// that client-side routes (e.g. `/devices`) work on a hard refresh.
async fn spa_fallback(uri: Uri) -> Response {
    let rel = uri.path().trim_start_matches('/');
    let base = std::path::Path::new(CONSOLE_DIST);
    let candidate = base.join(rel);
    let file = if !rel.is_empty() && hbb_common::tokio::fs::metadata(&candidate).await.is_ok() {
        candidate
    } else {
        base.join("index.html")
    };
    match hbb_common::tokio::fs::read(&file).await {
        Ok(bytes) => {
            let mut res = bytes.into_response();
            if let Ok(value) = HeaderValue::from_str(content_type(&file)) {
                res.headers_mut().insert(header::CONTENT_TYPE, value);
            }
            res
        }
        Err(_) => (StatusCode::NOT_FOUND, "not found").into_response(),
    }
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/login", post(auth::login))
        .route("/api/logout", post(auth::logout))
        .route("/api/currentUser", post(auth::current_user))
        .route("/api/login-options", get(auth::login_options))
        .route("/api/heartbeat", post(heartbeat::heartbeat))
        .route("/api/sysinfo", post(heartbeat::sysinfo))
        .route("/api/sysinfo_ver", post(heartbeat::sysinfo_ver))
        .route("/api/audit", get(console::audit_list))
        .route("/api/audit/:type", get(console::audit_list_by_type))
        .route(
            "/api/users",
            get(console::users_list).post(console::user_create),
        )
        .route(
            "/api/users/:id",
            post(console::user_update).delete(console::user_delete),
        )
        .route("/api/devices", get(console::devices_list))
        .route(
            "/api/devices/:id",
            post(console::device_update).delete(console::device_delete),
        )
        .route(
            "/api/settings",
            get(console::settings_list).post(console::setting_set),
        )
        .route("/api/settings/:key", delete(console::setting_delete))
        .route("/api/me/2fa", get(console::me_2fa_status))
        .route("/api/me/2fa/setup", post(console::me_2fa_setup))
        .route("/api/me/2fa/enable", post(console::me_2fa_enable))
        .route("/api/me/2fa/disable", post(console::me_2fa_disable))
        .fallback(any(spa_fallback))
        .layer(CorsLayer::permissive())
        .layer(Extension(state))
}

// When the console has no account yet, a bootstrap admin is created so that the
// first login is possible. The password is either provided via
// CONSOLE_ADMIN_PASSWORD or generated and logged once.
async fn bootstrap_admin(db: &Database) -> ResultType<()> {
    if db.count_users().await? > 0 {
        return Ok(());
    }
    let password = crate::common::get_arg_opt("CONSOLE_ADMIN_PASSWORD")
        .unwrap_or_else(|| uuid::Uuid::new_v4().simple().to_string());
    let hash = bcrypt::hash(&password, bcrypt::DEFAULT_COST)
        .map_err(|e| hbb_common::anyhow::anyhow!("bcrypt: {e}"))?;
    db.create_user("admin", &hash, true).await?;
    log::warn!(
        "Created bootstrap console admin, username: admin, password: {}",
        password
    );
    Ok(())
}

pub async fn start(db: Database, bind_addr: Option<IpAddr>, port: i32) -> ResultType<()> {
    bootstrap_admin(&db).await?;
    let ip = bind_addr.unwrap_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED));
    let addr = SocketAddr::new(ip, port as u16);
    let state = AppState { db, api_port: port };
    let app = router(state);
    log::info!("API server listening on http://{}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await?;
    Ok(())
}
