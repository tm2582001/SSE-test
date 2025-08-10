use std::{pin::Pin, time::Duration};

use actix_web::{web, Error, HttpResponse};
use actix_web_lab::{sse, util::InfallibleStream};
use futures_util::stream::{self, Stream};
use tokio::sync::mpsc;
use tokio::time::sleep;
use tokio_stream::wrappers::ReceiverStream;

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
pub async fn sync_timer() -> sse::Sse<InfallibleStream<ReceiverStream<sse::Event>>> {
    let (tx, rx) = mpsc::channel(1);

    tokio::spawn(async move {
        for i in (0..=360).rev() {
            if tx.send(sse::Data::new(i.to_string()).into()).await.is_err() {
                println!("Client disconnected");
                break;
            }
            sleep(Duration::from_secs(1)).await;
        }
    });

    sse::Sse::from_infallible_receiver(rx)
}
