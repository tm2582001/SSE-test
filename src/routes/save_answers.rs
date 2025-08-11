use actix_web::{HttpResponse, web};

use crate::models::{ConnectedUsers, Shared};
use crate::utils::ConnectionRequest;

pub async fn save_answers(
    connetion_request: web::Query<ConnectionRequest>,
    connected_users: web::Data<Shared<ConnectedUsers>>,
) -> HttpResponse {
    let ConnectionRequest { user_id } = connetion_request.into_inner();

    let users = connected_users.lock().await;

    if !users.has_user(&user_id) {
        return HttpResponse::BadRequest().finish();
    }

    HttpResponse::Ok().finish()
}
