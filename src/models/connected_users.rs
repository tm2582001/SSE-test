use std::{collections::HashSet, sync::{Arc}};

use tokio::sync::Mutex;

pub type Shared<T> = Arc<Mutex<T>>;

pub struct ConnectedUsers{
    users: HashSet<String>
}

impl ConnectedUsers {
    pub fn new()-> ConnectedUsers{
        Self { users: HashSet::<String>::new() }
    }

    pub fn insert_user(&mut self, user_id: &String){
        self.users.insert(user_id.to_owned());
    }

    pub fn remove_user(&mut self, user_id: &String){
        self.users.remove(user_id);

        if self.users.len() == 0 {
            self.users.shrink_to_fit();
        }
    }

    pub fn has_user(&self, user_id: &String)->bool{
        self.users.contains(user_id)
    }

    pub fn get_connect_users_count(&mut self)->usize{
         if self.users.len() == 0 {
            self.users = HashSet::<String>::new();
        }

        self.users.len()
    }

}

