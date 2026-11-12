use std::{convert::Infallible, str::FromStr, time::Duration};

use axum::{
    Router,
    response::sse::{Event, Sse},
    routing::get,
};
use eventsource_stream::Eventsource;
use futures::{StreamExt, stream};
use rusqlite::Connection;

#[tokio::test]
async fn reqwest_streams_sse_from_a_real_http_socket() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let app = Router::new().route(
        "/events",
        get(|| async {
            Sse::new(stream::iter([
                Ok::<_, Infallible>(Event::default().data("中文 delta")),
                Ok(Event::default().data("[DONE]")),
            ]))
        }),
    );
    let (shutdown, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
    let server = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await
    });
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap()
        .get(format!("http://{address}/events"))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap();
    let mut events = response.bytes_stream().eventsource();
    assert_eq!(events.next().await.unwrap().unwrap().data, "中文 delta");
    assert_eq!(events.next().await.unwrap().unwrap().data, "[DONE]");
    assert!(events.next().await.is_none());
    shutdown.send(()).unwrap();
    tokio::time::timeout(Duration::from_secs(5), server)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
}

#[test]
fn bundled_sqlite_accepts_the_frozen_tool_record_schema() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("records.sqlite");
    let mut connection = Connection::open(&path).unwrap();
    connection
        .execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .unwrap();
    connection
        .execute_batch(include_str!("../fixtures/c02-stdio/tool-call-records.sql"))
        .unwrap();
    assert_eq!(
        connection
            .query_row("PRAGMA journal_mode", [], |r| r.get::<_, String>(0))
            .unwrap(),
        "wal"
    );
    assert_eq!(
        connection
            .query_row("PRAGMA foreign_keys", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        1
    );
    {
        let transaction = connection.transaction().unwrap();
        transaction.execute("INSERT INTO tool_call_records (id,tool_name,started_at,started_at_ms,status,call_content_json) VALUES ('synthetic','Echo','2026-11-12T00:00:00Z',1794441600000,'running','{}')", []).unwrap();
        assert!(
            transaction
                .execute("INSERT INTO tool_call_records (id) VALUES ('invalid')", [])
                .is_err()
        );
        transaction.rollback().unwrap();
    }
    assert_eq!(
        connection
            .query_row("SELECT count(*) FROM tool_call_records", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
    drop(connection);
    let reopened = Connection::open(path).unwrap();
    assert_eq!(reopened.query_row("SELECT count(*) FROM sqlite_master WHERE type='index' AND name LIKE 'idx_tool_call_records_%'", [], |r| r.get::<_, i64>(0)).unwrap(), 5);
}

#[test]
fn cron_requires_the_seconds_field_before_node_schedule_expressions() {
    // Node-schedule accepts five fields. US-010 must explicitly adapt that input;
    // swapping the parser without an adapter would change the frozen behavior.
    assert!(cron::Schedule::from_str("0 * * * *").is_err());
    assert!(cron::Schedule::from_str("0 0 * * * *").is_ok());
    assert!(cron::Schedule::from_str("0 60 * * * *").is_err());
}
