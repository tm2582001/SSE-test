use actix_files as fs;
use actix_web::{App, HttpServer, web};
use env_logger::Env;

use test_timer::routes::sync_timer;

#[tokio::main]
async fn main() -> Result<(), std::io::Error> {
    env_logger::init_from_env(Env::default().default_filter_or("debug"));

    HttpServer::new(move || {
        App::new()
        .route("/sync-timer", web::get().to(sync_timer))
            .service(fs::Files::new("/", "./static").index_file("index.html"))
    })
    .bind("127.0.0.1:8000")?
    .run()
    .await?;

    Ok(())
}
