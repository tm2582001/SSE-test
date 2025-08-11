use std::collections::HashMap;
use std::sync::Mutex;

use actix_web_lab::sse;
use tokio::sync::mpsc;

struct ConnectedUser {
    sender: mpsc::Sender<sse::Event>,
    max_test_time: i16,
    remaining_test_time: i16,
}

struct ConnectedUsersCollection(HashMap<String, ConnectedUser>);

impl ConnectedUsersCollection {
    fn new() -> ConnectedUsersCollection {
        Self(HashMap::<String, ConnectedUser>::new())
    }
}

pub struct BroadCasters {
    users: Mutex<ConnectedUsersCollection>,
}

impl BroadCasters {
    pub fn build() -> BroadCasters {
        Self {
            users: Mutex::new(ConnectedUsersCollection::new()),
        }
    }
}
