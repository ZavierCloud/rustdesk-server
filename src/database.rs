use async_trait::async_trait;
use hbb_common::{log, ResultType};
use serde_derive::{Deserialize, Serialize};
use sqlx::{
    sqlite::SqliteConnectOptions, ConnectOptions, Connection, Error as SqlxError, SqliteConnection,
};
use std::{ops::DerefMut, str::FromStr};
//use sqlx::postgres::PgPoolOptions;
//use sqlx::mysql::MySqlPoolOptions;

type Pool = deadpool::managed::Pool<DbPool>;

pub struct DbPool {
    url: String,
}

#[async_trait]
impl deadpool::managed::Manager for DbPool {
    type Type = SqliteConnection;
    type Error = SqlxError;
    async fn create(&self) -> Result<SqliteConnection, SqlxError> {
        let mut opt = SqliteConnectOptions::from_str(&self.url).unwrap();
        opt.log_statements(log::LevelFilter::Debug);
        SqliteConnection::connect_with(&opt).await
    }
    async fn recycle(
        &self,
        obj: &mut SqliteConnection,
    ) -> deadpool::managed::RecycleResult<SqlxError> {
        Ok(obj.ping().await?)
    }
}

#[derive(Clone)]
pub struct Database {
    pool: Pool,
}

#[derive(Default)]
pub struct Peer {
    pub guid: Vec<u8>,
    pub id: String,
    pub uuid: Vec<u8>,
    pub pk: Vec<u8>,
    pub user: Option<Vec<u8>>,
    pub info: String,
    pub status: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub display_name: Option<String>,
    pub password_hash: String,
    pub email: Option<String>,
    pub note: Option<String>,
    pub is_admin: i64,
    pub status: i64,
    pub totp_secret: Option<String>,
    pub totp_enabled: i64,
    pub created_at: Option<String>,
}

impl User {
    pub fn is_admin(&self) -> bool {
        self.is_admin != 0
    }

    pub fn is_normal(&self) -> bool {
        self.status == 1
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, sqlx::FromRow)]
pub struct Token {
    pub token: String,
    pub user_id: i64,
    pub device_id: Option<String>,
    pub created_at: Option<String>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, sqlx::FromRow)]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub modified_at: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, sqlx::FromRow)]
pub struct Audit {
    pub id: i64,
    pub r#type: String,
    pub user_id: Option<i64>,
    pub device_id: Option<String>,
    pub peer_id: Option<String>,
    pub ip: Option<String>,
    pub detail: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, sqlx::FromRow)]
pub struct PeerRow {
    pub id: String,
    pub uuid: Vec<u8>,
    pub info: String,
    pub status: Option<i64>,
    pub note: Option<String>,
    pub user_name: Option<String>,
    pub device_group_name: Option<String>,
    pub created_at: Option<String>,
    pub last_seen: Option<String>,
}

impl Database {
    pub async fn new(url: &str) -> ResultType<Database> {
        if !std::path::Path::new(url).exists() {
            std::fs::File::create(url).ok();
        }
        let n: usize = crate::common::get_arg_or("MAX_DATABASE_CONNECTIONS", "1".to_owned())
            .parse()
            .unwrap_or(1);
        log::debug!("MAX_DATABASE_CONNECTIONS={}", n);
        let pool = Pool::new(
            DbPool {
                url: url.to_owned(),
            },
            n,
        );
        let _ = pool.get().await?; // test
        let db = Database { pool };
        db.create_tables().await?;
        Ok(db)
    }

    async fn create_tables(&self) -> ResultType<()> {
        sqlx::query!(
            "
            create table if not exists peer (
                guid blob primary key not null,
                id varchar(100) not null,
                uuid blob not null,
                pk blob not null,
                created_at datetime not null default(current_timestamp),
                user blob,
                status tinyint,
                note varchar(300),
                info text not null
            ) without rowid;
            create unique index if not exists index_peer_id on peer (id);
            create index if not exists index_peer_user on peer (user);
            create index if not exists index_peer_created_at on peer (created_at);
            create index if not exists index_peer_status on peer (status);
        "
        )
        .execute(self.pool.get().await?.deref_mut())
        .await?;
        self.create_console_tables().await?;
        Ok(())
    }

    // Console/Pro tables are additive: they are created with runtime queries so
    // that the compile-time checked `peer` statements above stay untouched.
    async fn create_console_tables(&self) -> ResultType<()> {
        let ddl = [
            "create table if not exists users (
                id integer primary key autoincrement,
                name varchar(100) unique not null,
                display_name varchar(100),
                password_hash text not null,
                email varchar(100),
                note varchar(300),
                is_admin integer not null default 0,
                status integer not null default 1,
                totp_secret text,
                totp_enabled integer not null default 0,
                created_at datetime not null default(current_timestamp)
            )",
            "create table if not exists tokens (
                token varchar(200) primary key not null,
                user_id integer not null,
                device_id varchar(100),
                uuid blob,
                created_at datetime not null default(current_timestamp),
                expires_at datetime
            )",
            "create table if not exists settings (
                key varchar(100) primary key not null,
                value text not null,
                modified_at integer not null default 0
            )",
            "create table if not exists audit (
                id integer primary key autoincrement,
                type varchar(50) not null,
                user_id integer,
                device_id varchar(100),
                peer_id varchar(100),
                ip varchar(64),
                detail text,
                created_at datetime not null default(current_timestamp)
            )",
            "create index if not exists index_tokens_user on tokens (user_id)",
            "create index if not exists index_audit_type on audit (type)",
            "create index if not exists index_audit_created_at on audit (created_at)",
        ];
        let mut conn = self.pool.get().await?;
        for sql in ddl {
            sqlx::query(sql).execute(conn.deref_mut()).await?;
        }
        // `peer` predates the console, so its new columns are added in place and
        // an already-migrated database is expected to error here.
        for sql in [
            "alter table peer add column user_name varchar(100)",
            "alter table peer add column device_group_name varchar(100)",
            "alter table peer add column last_seen datetime",
        ] {
            let _ = sqlx::query(sql).execute(conn.deref_mut()).await;
        }
        Ok(())
    }

    pub async fn get_peer(&self, id: &str) -> ResultType<Option<Peer>> {
        Ok(sqlx::query_as!(
            Peer,
            "select guid, id, uuid, pk, user, status, info from peer where id = ?",
            id
        )
        .fetch_optional(self.pool.get().await?.deref_mut())
        .await?)
    }

    pub async fn insert_peer(
        &self,
        id: &str,
        uuid: &[u8],
        pk: &[u8],
        info: &str,
    ) -> ResultType<Vec<u8>> {
        let guid = uuid::Uuid::new_v4().as_bytes().to_vec();
        sqlx::query!(
            "insert into peer(guid, id, uuid, pk, info) values(?, ?, ?, ?, ?)",
            guid,
            id,
            uuid,
            pk,
            info
        )
        .execute(self.pool.get().await?.deref_mut())
        .await?;
        Ok(guid)
    }

    pub async fn update_pk(
        &self,
        guid: &Vec<u8>,
        id: &str,
        pk: &[u8],
        info: &str,
    ) -> ResultType<()> {
        sqlx::query!(
            "update peer set id=?, pk=?, info=? where guid=?",
            id,
            pk,
            info,
            guid
        )
        .execute(self.pool.get().await?.deref_mut())
        .await?;
        Ok(())
    }

    pub async fn count_users(&self) -> ResultType<i64> {
        let row: (i64,) = sqlx::query_as("select count(*) from users")
            .fetch_one(self.pool.get().await?.deref_mut())
            .await?;
        Ok(row.0)
    }

    pub async fn get_user_by_name(&self, name: &str) -> ResultType<Option<User>> {
        Ok(sqlx::query_as::<_, User>(
            "select id, name, display_name, password_hash, email, note, is_admin, status, totp_secret, totp_enabled, created_at from users where name = ?",
        )
        .bind(name)
        .fetch_optional(self.pool.get().await?.deref_mut())
        .await?)
    }

    pub async fn get_user_by_id(&self, id: i64) -> ResultType<Option<User>> {
        Ok(sqlx::query_as::<_, User>(
            "select id, name, display_name, password_hash, email, note, is_admin, status, totp_secret, totp_enabled, created_at from users where id = ?",
        )
        .bind(id)
        .fetch_optional(self.pool.get().await?.deref_mut())
        .await?)
    }

    pub async fn list_users(&self) -> ResultType<Vec<User>> {
        Ok(sqlx::query_as::<_, User>(
            "select id, name, display_name, password_hash, email, note, is_admin, status, totp_secret, totp_enabled, created_at from users order by id",
        )
        .fetch_all(self.pool.get().await?.deref_mut())
        .await?)
    }

    pub async fn create_user(
        &self,
        name: &str,
        password_hash: &str,
        is_admin: bool,
    ) -> ResultType<i64> {
        let res = sqlx::query(
            "insert into users(name, display_name, password_hash, is_admin, status) values(?, ?, ?, ?, 1)",
        )
        .bind(name)
        .bind(name)
        .bind(password_hash)
        .bind(if is_admin { 1 } else { 0 })
        .execute(self.pool.get().await?.deref_mut())
        .await?;
        Ok(res.last_insert_rowid())
    }

    pub async fn update_user_profile(
        &self,
        id: i64,
        display_name: Option<&str>,
        email: Option<&str>,
        note: Option<&str>,
        status: i64,
        is_admin: bool,
    ) -> ResultType<()> {
        sqlx::query(
            "update users set display_name = ?, email = ?, note = ?, status = ?, is_admin = ? where id = ?",
        )
        .bind(display_name)
        .bind(email)
        .bind(note)
        .bind(status)
        .bind(if is_admin { 1 } else { 0 })
        .bind(id)
        .execute(self.pool.get().await?.deref_mut())
        .await?;
        Ok(())
    }

    pub async fn set_user_password(&self, id: i64, password_hash: &str) -> ResultType<()> {
        sqlx::query("update users set password_hash = ? where id = ?")
            .bind(password_hash)
            .bind(id)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(())
    }

    pub async fn set_user_totp(
        &self,
        id: i64,
        secret: Option<&str>,
        enabled: bool,
    ) -> ResultType<()> {
        sqlx::query("update users set totp_secret = ?, totp_enabled = ? where id = ?")
            .bind(secret)
            .bind(if enabled { 1 } else { 0 })
            .bind(id)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(())
    }

    pub async fn delete_user(&self, id: i64) -> ResultType<()> {
        sqlx::query("delete from users where id = ?")
            .bind(id)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(())
    }

    pub async fn insert_token(
        &self,
        token: &str,
        user_id: i64,
        device_id: Option<&str>,
        uuid: Option<&[u8]>,
        expires_at: Option<&str>,
    ) -> ResultType<()> {
        sqlx::query("insert or replace into tokens(token, user_id, device_id, uuid, expires_at) values(?, ?, ?, ?, ?)")
            .bind(token)
            .bind(user_id)
            .bind(device_id)
            .bind(uuid)
            .bind(expires_at)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(())
    }

    pub async fn get_token(&self, token: &str) -> ResultType<Option<Token>> {
        Ok(sqlx::query_as::<_, Token>(
            "select token, user_id, device_id, created_at, expires_at from tokens where token = ?",
        )
        .bind(token)
        .fetch_optional(self.pool.get().await?.deref_mut())
        .await?)
    }

    pub async fn delete_token(&self, token: &str) -> ResultType<()> {
        sqlx::query("delete from tokens where token = ?")
            .bind(token)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(())
    }

    pub async fn delete_user_tokens(&self, user_id: i64) -> ResultType<()> {
        sqlx::query("delete from tokens where user_id = ?")
            .bind(user_id)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(())
    }

    pub async fn list_settings(&self) -> ResultType<Vec<Setting>> {
        Ok(
            sqlx::query_as::<_, Setting>("select key, value, modified_at from settings")
                .fetch_all(self.pool.get().await?.deref_mut())
                .await?,
        )
    }

    pub async fn get_setting(&self, key: &str) -> ResultType<Option<Setting>> {
        Ok(
            sqlx::query_as::<_, Setting>(
                "select key, value, modified_at from settings where key = ?",
            )
            .bind(key)
            .fetch_optional(self.pool.get().await?.deref_mut())
            .await?,
        )
    }

    pub async fn set_setting(&self, key: &str, value: &str) -> ResultType<i64> {
        let modified_at = crate::common::now() as i64;
        sqlx::query("insert or replace into settings(key, value, modified_at) values(?, ?, ?)")
            .bind(key)
            .bind(value)
            .bind(modified_at)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(modified_at)
    }

    pub async fn delete_setting(&self, key: &str) -> ResultType<()> {
        sqlx::query("delete from settings where key = ?")
            .bind(key)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(())
    }

    pub async fn max_setting_modified_at(&self) -> ResultType<i64> {
        let row: (Option<i64>,) = sqlx::query_as("select max(modified_at) from settings")
            .fetch_one(self.pool.get().await?.deref_mut())
            .await?;
        Ok(row.0.unwrap_or(0))
    }

    pub async fn insert_audit(
        &self,
        type_: &str,
        user_id: Option<i64>,
        device_id: Option<&str>,
        peer_id: Option<&str>,
        ip: Option<&str>,
        detail: Option<&str>,
    ) -> ResultType<()> {
        sqlx::query(
            "insert into audit(type, user_id, device_id, peer_id, ip, detail) values(?, ?, ?, ?, ?, ?)",
        )
        .bind(type_)
        .bind(user_id)
        .bind(device_id)
        .bind(peer_id)
        .bind(ip)
        .bind(detail)
        .execute(self.pool.get().await?.deref_mut())
        .await?;
        Ok(())
    }

    pub async fn list_audit(&self, type_: Option<&str>, limit: i64) -> ResultType<Vec<Audit>> {
        Ok(match type_ {
            Some(t) => {
                sqlx::query_as::<_, Audit>(
                    "select id, type, user_id, device_id, peer_id, ip, detail, created_at from audit where type = ? order by id desc limit ?",
                )
                .bind(t)
                .bind(limit)
                .fetch_all(self.pool.get().await?.deref_mut())
                .await?
            }
            None => {
                sqlx::query_as::<_, Audit>(
                    "select id, type, user_id, device_id, peer_id, ip, detail, created_at from audit order by id desc limit ?",
                )
                .bind(limit)
                .fetch_all(self.pool.get().await?.deref_mut())
                .await?
            }
        })
    }

    pub async fn list_peers(&self) -> ResultType<Vec<PeerRow>> {
        Ok(sqlx::query_as::<_, PeerRow>(
            "select id, uuid, info, status, note, user_name, device_group_name, created_at, last_seen from peer order by created_at desc",
        )
        .fetch_all(self.pool.get().await?.deref_mut())
        .await?)
    }

    pub async fn get_peer_row(&self, id: &str) -> ResultType<Option<PeerRow>> {
        Ok(sqlx::query_as::<_, PeerRow>(
            "select id, uuid, info, status, note, user_name, device_group_name, created_at, last_seen from peer where id = ?",
        )
        .bind(id)
        .fetch_optional(self.pool.get().await?.deref_mut())
        .await?)
    }

    pub async fn set_peer_note(&self, id: &str, note: &str) -> ResultType<()> {
        sqlx::query("update peer set note = ? where id = ?")
            .bind(note)
            .bind(id)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(())
    }

    pub async fn set_peer_group(&self, id: &str, group: &str) -> ResultType<()> {
        sqlx::query("update peer set device_group_name = ? where id = ?")
            .bind(group)
            .bind(id)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(())
    }

    pub async fn set_peer_user_name(&self, id: &str, user_name: &str) -> ResultType<()> {
        sqlx::query("update peer set user_name = ? where id = ?")
            .bind(user_name)
            .bind(id)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(())
    }

    pub async fn delete_peer(&self, id: &str) -> ResultType<()> {
        sqlx::query("delete from peer where id = ?")
            .bind(id)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(())
    }

    pub async fn update_peer_info(&self, id: &str, info: &str) -> ResultType<()> {
        sqlx::query("update peer set info = ? where id = ?")
            .bind(info)
            .bind(id)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(())
    }

    pub async fn update_peer_last_seen(&self, id: &str) -> ResultType<()> {
        sqlx::query("update peer set last_seen = current_timestamp where id = ?")
            .bind(id)
            .execute(self.pool.get().await?.deref_mut())
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use hbb_common::tokio;
    #[test]
    fn test_insert() {
        insert();
    }

    #[tokio::main(flavor = "multi_thread")]
    async fn insert() {
        let db = super::Database::new("test.sqlite3").await.unwrap();
        let mut jobs = vec![];
        for i in 0..10000 {
            let cloned = db.clone();
            let id = i.to_string();
            let a = tokio::spawn(async move {
                let empty_vec = Vec::new();
                cloned
                    .insert_peer(&id, &empty_vec, &empty_vec, "")
                    .await
                    .unwrap();
            });
            jobs.push(a);
        }
        for i in 0..10000 {
            let cloned = db.clone();
            let id = i.to_string();
            let a = tokio::spawn(async move {
                cloned.get_peer(&id).await.unwrap();
            });
            jobs.push(a);
        }
        hbb_common::futures::future::join_all(jobs).await;
    }
}
