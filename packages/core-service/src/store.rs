use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::models::{Message, MessageId, MessageStatus};

#[derive(Clone, Default)]
pub struct StoreManager {
    inner: Arc<Mutex<HashMap<MessageId, Message>>>,
}

impl StoreManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn save(&self, message: Message) {
        if let Ok(mut map) = self.inner.lock() {
            map.insert(message.envelope.id.clone(), message);
        }
    }

    pub fn update_status(&self, id: &MessageId, status: MessageStatus) {
        if let Ok(mut map) = self.inner.lock() {
            if let Some(message) = map.get_mut(id) {
                message.envelope.status = status;
            }
        }
    }

    pub fn get(&self, id: &MessageId) -> Option<Message> {
        self.inner.lock().ok().and_then(|map| map.get(id).cloned())
    }

    pub fn delete(&self, id: &MessageId) -> bool {
        self.inner
            .lock()
            .map(|mut map| map.remove(id).is_some())
            .unwrap_or(false)
    }

    pub fn list(&self, folder: &str) -> Vec<Message> {
        self.inner
            .lock()
            .map(|map| {
                map.values()
                    .filter(|msg| msg.envelope.folder == folder)
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn seed_demo_data(&self) -> Vec<MessageId> {
        let mut ids = Vec::new();
        for index in 0..3 {
            let mut envelope = crate::models::MessageEnvelope::new(
                &format!("Demo message {}", index + 1),
                crate::models::Address::sample(),
                vec![crate::models::Address::sample()],
            );
            envelope.folder = "inbox".into();
            let message = Message {
                envelope,
                content: crate::models::MessageContent {
                    body: "This is a demo message.".into(),
                },
            };
            ids.push(message.envelope.id.clone());
            self.save(message);
        }
        ids
    }
}
