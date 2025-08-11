use std::{pin::Pin, time::Duration};

use actix_web::{Error, HttpResponse, web};
use actix_web_lab::{sse, util::InfallibleStream};
use futures_util::stream::{self, Stream};
use tokio::sync::mpsc;
use tokio::time::sleep;
use tokio_stream::wrappers::ReceiverStream;

use crate::models::{ConnectedUsers, Shared};
use crate::utils::ConnectionRequest;

pub async fn sync_timer_old() -> HttpResponse {
    let countdown = 360;

    // Create an async stream
    let stream = stream::unfold(countdown, |mut timer| async move {
        if timer == 0 {
            return None;
        }

        sleep(Duration::from_secs(1)).await;
        timer -= 1;

        // Format SSE event
        let msg = format!("data: {}\n\n", timer);

        Some((Ok::<_, Error>(web::Bytes::from(msg)), timer))
    });

    let body: Pin<Box<dyn Stream<Item = Result<web::Bytes, Error>> + Send>> = Box::pin(stream);

    HttpResponse::Ok()
        .append_header(("Content-Type", "text/event-stream"))
        .append_header(("Cache-Control", "no-cache"))
        .append_header(("Connection", "keep-alive"))
        .streaming(body)
}

// async fn sse_handler(clients: web::Data<Clients>) -> impl Responder {
//     let (tx, rx) = mpsc::unbounded_channel();
//     clients.lock().unwrap().push(tx);

//     let stream = UnboundedReceiverStream::new(rx)
//         .map(|msg| Ok::<_, actix_web::Error>(web::Bytes::from(format!("data: {}\n\n", msg))));

//     HttpResponse::Ok()
//         .append_header(("Content-Type", "text/event-stream"))
//         .append_header(("Cache-Control", "no-cache"))
//         .streaming(stream)
// }

// loop {
//     dbg!(countdown);
//     // Create an async stream
//     if countdown == 0 {
//         break;
//     }

//     sleep(Duration::from_secs(1)).await;
//     countdown -= 1;

// tx.send(sse::Data::new( countdown.to_string()).into()).await.unwrap();
// }

// pub async fn sync_timer() -> sse::Sse<tokio::sync::mpsc::Receiver<integer>> {

pub async fn sync_timer(
    connetion_request: web::Query<ConnectionRequest>,
    connected_users: web::Data<Shared<ConnectedUsers>>,
) -> sse::Sse<InfallibleStream<ReceiverStream<sse::Event>>> {
    let (tx, rx) = mpsc::channel(1);

    let ConnectionRequest { user_id } = connetion_request.into_inner();

    let mut users = connected_users.lock().await;
    users.insert_user(&user_id);

    let connected_users_clone = connected_users.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(1));

        for i in (0..=360).rev() {
            tokio::select! {
                // Wait for either the tick or the channel send failing
                _ = interval.tick() => {
                    if tx.send(sse::Data::new(i.to_string()).into()).await.is_err() {
                        // Client disconnected — clean up immediately
                        let mut users = connected_users_clone.lock().await;
                        users.remove_user(&user_id);
                        return; // Exit the task now
                    }
                }
            }
        }

        // Countdown finished — remove user
        let mut users = connected_users_clone.lock().await;
        users.remove_user(&user_id);
    });

    sse::Sse::from_infallible_receiver(rx)
}
