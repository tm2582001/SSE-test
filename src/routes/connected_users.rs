use actix_web::{HttpResponse, web};

use crate::models::{ConnectedUsers, Shared};

pub async fn connected_users(
    connected_users_data: web::Data<Shared<ConnectedUsers>>,
) -> HttpResponse {
    let mut users = connected_users_data.lock().await;

    let connected_users_len = users.get_connect_users_count();

    HttpResponse::Ok().body(connected_users_len.to_string())
}
