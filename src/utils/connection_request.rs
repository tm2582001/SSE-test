
#[derive(serde::Deserialize)]
pub struct ConnectionRequest{
    #[serde(rename = "userId")]
    pub user_id: String
}