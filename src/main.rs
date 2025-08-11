use std::sync::{Arc, Mutex};

use actix_files as fs;
use actix_web::{App, HttpServer, web};
use env_logger::Env;

use test_timer::routes::{save_answers, sync_timer};
use test_timer::models::ConnectedUsers;

#[tokio::main]
async fn main() -> Result<(), std::io::Error> {
    env_logger::init_from_env(Env::default().default_filter_or("debug"));

    let broad_casters_data = Arc::new(Mutex::new(ConnectedUsers::new()));

    HttpServer::new(move || {
        App::new()
        .app_data(web::Data::new(Arc::clone(&broad_casters_data)))
        .route("/sync-timer", web::get().to(sync_timer))
        .route("/save-answers", web::post().to(save_answers))
            .service(fs::Files::new("/", "./static").index_file("index.html"))
    })
    .bind("127.0.0.1:8000")?
    .run()
    .await?;

    Ok(())
}
