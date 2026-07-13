use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::Mutex as StdMutex;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::net::TcpListener;
use tokio::sync::{broadcast, Mutex as TokioMutex};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

use crate::models::{CoopItemData, CoopItemInput, CoopServerInfo, PlayerInfo, SessionState};

/// WebSocket protocol messages for co-op session communication.
/// All messages are serialized as JSON with a "type" field for routing.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(tag = "type")]
pub enum ProtocolMessage {
    // Client → Host
    Auth {
        session_code: String,
        player_name: String,
        profile_id: String,
    },
    ItemLog {
        name: String,
        item_type: String,
        rarity: String,
        player_name: String,
        profile_id: String,
    },

    // Host → Client
    AuthOk,
    AuthFail {
        reason: String,
    },
    SessionSync {
        state: SessionState,
    },
    RunSplit {
        run_count: u32,
        timestamp: String,
    },
    Pause {
        paused: bool,
    },
    SessionEnd,
    ItemUpdate {
        items: Vec<CoopItemData>,
    },
    TimerTick {
        elapsed_secs: u64,
    },
    PlayerUpdate {
        players: Vec<PlayerInfo>,
    },
}

/// Generate a random 6-character alphanumeric session code (A-Z, 0-9).
pub fn generate_session_code() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let chars: Vec<char> = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".chars().collect();
    (0..6)
        .map(|_| chars[rng.gen_range(0..chars.len())])
        .collect()
}

pub struct ClientConnection {
    pub player_name: String,
    pub profile_id: String,
    pub tx: tokio::sync::mpsc::UnboundedSender<String>,
}

pub struct CoopServer {
    pub session_code: String,
    pub host_ip: String,
    pub port: u16,
    pub shutdown_tx: broadcast::Sender<()>,
    pub session_state: Arc<TokioMutex<SessionState>>,
    pub clients: Arc<TokioMutex<Vec<ClientConnection>>>,
}

impl CoopServer {
    pub async fn start(host_player: String) -> Result<Self, String> {
        let session_code = generate_session_code();
        let (shutdown_tx, _) = broadcast::channel(1);

        // Try ports 9876-9885
        let mut port = 9876u16;
        let mut listener = None;
        for attempt in 0..10 {
            let addr: SocketAddr = format!("0.0.0.0:{}", 9876 + attempt).parse().unwrap();
            match TcpListener::bind(addr).await {
                Ok(l) => {
                    port = 9876 + attempt;
                    listener = Some(l);
                    break;
                }
                Err(_) => continue,
            }
        }

        let listener =
            listener.ok_or_else(|| "Could not bind to any port (9876-9885)".to_string())?;

        // Get local IP
        let host_ip = get_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());

        let session_state = Arc::new(TokioMutex::new(SessionState {
            session_code: session_code.clone(),
            host_player: host_player.clone(),
            players: vec![PlayerInfo {
                name: host_player,
                profile_id: "host".to_string(),
                status: "connected".to_string(),
                items_found: 0,
                runs_contributed: 0,
            }],
            run_count: 0,
            elapsed_secs: 0,
            paused: false,
            items: vec![],
        }));

        let clients: Arc<TokioMutex<Vec<ClientConnection>>> =
            Arc::new(TokioMutex::new(Vec::new()));

        // Spawn accept loop
        let clients_clone = clients.clone();
        let state_clone = session_state.clone();
        let code_clone = session_code.clone();
        let mut shutdown_rx = shutdown_tx.subscribe();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    result = listener.accept() => {
                        match result {
                            Ok((stream, _addr)) => {
                                let clients = clients_clone.clone();
                                let state = state_clone.clone();
                                let code = code_clone.clone();
                                tokio::spawn(async move {
                                    if let Ok(ws_stream) = accept_async(stream).await {
                                        handle_connection(ws_stream, clients, state, code).await;
                                    }
                                });
                            }
                            Err(_) => break,
                        }
                    }
                    _ = shutdown_rx.recv() => {
                        break;
                    }
                }
            }
        });

        Ok(CoopServer {
            session_code,
            host_ip,
            port,
            shutdown_tx,
            session_state,
            clients,
        })
    }

    pub async fn stop(&self) {
        let _ = self.shutdown_tx.send(());
        // Close all client connections
        let mut clients = self.clients.lock().await;
        clients.clear();
    }

    pub async fn broadcast(&self, message: &ProtocolMessage) {
        let json = serde_json::to_string(message).unwrap_or_default();
        let clients = self.clients.lock().await;
        for client in clients.iter() {
            let _ = client.tx.send(json.clone());
        }
    }
}

async fn handle_connection(
    ws_stream: tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    clients: Arc<TokioMutex<Vec<ClientConnection>>>,
    state: Arc<TokioMutex<SessionState>>,
    expected_code: String,
) {
    let (mut write, mut read) = ws_stream.split();

    // Wait for Auth message (first message must be Auth)
    let auth_msg = match read.next().await {
        Some(Ok(Message::Text(text))) => {
            serde_json::from_str::<ProtocolMessage>(&text.to_string()).ok()
        }
        _ => None,
    };

    let (player_name, profile_id) = match auth_msg {
        Some(ProtocolMessage::Auth {
            session_code,
            player_name,
            profile_id,
        }) => {
            if session_code != expected_code {
                let fail = ProtocolMessage::AuthFail {
                    reason: "Invalid session code".to_string(),
                };
                let json = serde_json::to_string(&fail).unwrap();
                let _ = write.send(Message::Text(json.into())).await;
                return;
            }
            (player_name, profile_id)
        }
        _ => {
            let fail = ProtocolMessage::AuthFail {
                reason: "Expected Auth message".to_string(),
            };
            let json = serde_json::to_string(&fail).unwrap();
            let _ = write.send(Message::Text(json.into())).await;
            return;
        }
    };

    // Auth successful - send AuthOk
    let auth_ok = serde_json::to_string(&ProtocolMessage::AuthOk).unwrap();
    if write.send(Message::Text(auth_ok.into())).await.is_err() {
        return;
    }

    // Send current session state
    {
        let current_state = state.lock().await;
        let sync_msg = ProtocolMessage::SessionSync {
            state: current_state.clone(),
        };
        let json = serde_json::to_string(&sync_msg).unwrap();
        if write.send(Message::Text(json.into())).await.is_err() {
            return;
        }
    }

    // Add player to session state
    {
        let mut s = state.lock().await;
        s.players.push(PlayerInfo {
            name: player_name.clone(),
            profile_id: profile_id.clone(),
            status: "connected".to_string(),
            items_found: 0,
            runs_contributed: 0,
        });
    }

    // Set up message channel for this client
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    {
        let mut c = clients.lock().await;
        c.push(ClientConnection {
            player_name: player_name.clone(),
            profile_id: profile_id.clone(),
            tx,
        });
    }

    // Spawn writer task (sends messages from channel to WebSocket)
    let write = Arc::new(TokioMutex::new(write));
    let write_clone = write.clone();
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let mut w = write_clone.lock().await;
            if w.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Read loop (receive messages from this client)
    while let Some(Ok(msg)) = read.next().await {
        if let Message::Text(text) = msg {
            if let Ok(protocol_msg) =
                serde_json::from_str::<ProtocolMessage>(&text.to_string())
            {
                match protocol_msg {
                    ProtocolMessage::ItemLog {
                        name,
                        item_type,
                        rarity,
                        player_name: pn,
                        profile_id: pid,
                    } => {
                        // Store item in session state
                        let item = CoopItemData {
                            id: uuid::Uuid::new_v4().to_string(),
                            name,
                            item_type,
                            rarity,
                            player_name: pn.clone(),
                            found_at: chrono::Utc::now().to_rfc3339(),
                        };

                        let items_list;
                        {
                            let mut s = state.lock().await;
                            s.items.push(item);
                            items_list = s.items.clone();
                            // Update player items count
                            if let Some(p) =
                                s.players.iter_mut().find(|p| p.profile_id == pid)
                            {
                                p.items_found += 1;
                            }
                        }

                        // Broadcast updated items to all clients
                        let update = ProtocolMessage::ItemUpdate { items: items_list };
                        let json = serde_json::to_string(&update).unwrap_or_default();
                        let c = clients.lock().await;
                        for client in c.iter() {
                            let _ = client.tx.send(json.clone());
                        }
                    }
                    _ => {} // Ignore other messages from clients
                }
            }
        }
    }

    // Client disconnected — mark as disconnected
    {
        let mut s = state.lock().await;
        if let Some(p) = s.players.iter_mut().find(|p| p.profile_id == profile_id) {
            p.status = "disconnected".to_string();
        }
    }

    // Remove from clients list
    {
        let mut c = clients.lock().await;
        c.retain(|client| client.profile_id != profile_id);
    }
}

/// Get the local network IP address (first non-loopback IPv4).
fn get_local_ip() -> Option<String> {
    use std::net::UdpSocket;
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|a| a.ip().to_string())
}

// ===== Managed State =====

/// Tauri managed state for co-op sessions.
pub struct CoopState {
    pub server: StdMutex<Option<CoopServer>>,
    pub client: StdMutex<Option<CoopClient>>,
}

// ===== CoopClient =====

/// Guest WebSocket client for co-op sessions.
pub struct CoopClient {
    pub session_state: Arc<TokioMutex<SessionState>>,
    pub tx: tokio::sync::mpsc::UnboundedSender<String>,
    pub shutdown_tx: broadcast::Sender<()>,
    pub item_queue: Arc<TokioMutex<Vec<CoopItemInput>>>,
    pub connected: Arc<TokioMutex<bool>>,
}

impl CoopClient {
    pub async fn connect(
        host_ip: String,
        port: u16,
        session_code: String,
        player_name: String,
        profile_id: String,
    ) -> Result<Self, String> {
        let url = format!("ws://{}:{}", host_ip, port);
        let (ws_stream, _) = tokio_tungstenite::connect_async(&url)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        let (mut write, mut read) = ws_stream.split();

        // Send Auth message
        let auth = ProtocolMessage::Auth {
            session_code,
            player_name: player_name.clone(),
            profile_id: profile_id.clone(),
        };
        let auth_json = serde_json::to_string(&auth).unwrap();
        write
            .send(Message::Text(auth_json.into()))
            .await
            .map_err(|e| format!("Failed to send auth: {}", e))?;

        // Wait for AuthOk or AuthFail
        let response = read
            .next()
            .await
            .ok_or_else(|| "Connection closed".to_string())?
            .map_err(|e| format!("Read error: {}", e))?;

        let auth_response = match response {
            Message::Text(text) => serde_json::from_str::<ProtocolMessage>(&text.to_string())
                .map_err(|e| format!("Invalid response: {}", e))?,
            _ => return Err("Unexpected message type".to_string()),
        };

        match auth_response {
            ProtocolMessage::AuthOk => {}
            ProtocolMessage::AuthFail { reason } => {
                return Err(format!("Auth failed: {}", reason))
            }
            _ => return Err("Unexpected response".to_string()),
        }

        // Wait for SessionSync
        let sync_response = read
            .next()
            .await
            .ok_or_else(|| "Connection closed".to_string())?
            .map_err(|e| format!("Read error: {}", e))?;

        let initial_state = match sync_response {
            Message::Text(text) => {
                match serde_json::from_str::<ProtocolMessage>(&text.to_string()) {
                    Ok(ProtocolMessage::SessionSync { state }) => state,
                    _ => return Err("Expected SessionSync".to_string()),
                }
            }
            _ => return Err("Unexpected message type".to_string()),
        };

        let session_state = Arc::new(TokioMutex::new(initial_state));
        let (msg_tx, mut msg_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
        let (shutdown_tx, _) = broadcast::channel(1);
        let item_queue = Arc::new(TokioMutex::new(Vec::<CoopItemInput>::new()));
        let connected = Arc::new(TokioMutex::new(true));

        // Spawn writer task
        let write = Arc::new(TokioMutex::new(write));
        let write_clone = write.clone();
        tokio::spawn(async move {
            while let Some(msg) = msg_rx.recv().await {
                let mut w = write_clone.lock().await;
                if w.send(Message::Text(msg.into())).await.is_err() {
                    break;
                }
            }
        });

        // Spawn reader task
        let state_clone = session_state.clone();
        let connected_clone = connected.clone();
        let mut shutdown_rx = shutdown_tx.subscribe();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    msg = read.next() => {
                        match msg {
                            Some(Ok(Message::Text(text))) => {
                                if let Ok(protocol_msg) = serde_json::from_str::<ProtocolMessage>(&text.to_string()) {
                                    let mut s = state_clone.lock().await;
                                    match protocol_msg {
                                        ProtocolMessage::SessionSync { state } => *s = state,
                                        ProtocolMessage::RunSplit { run_count, .. } => s.run_count = run_count,
                                        ProtocolMessage::Pause { paused } => s.paused = paused,
                                        ProtocolMessage::SessionEnd => {
                                            *connected_clone.lock().await = false;
                                            break;
                                        }
                                        ProtocolMessage::ItemUpdate { items } => s.items = items,
                                        ProtocolMessage::TimerTick { elapsed_secs } => s.elapsed_secs = elapsed_secs,
                                        ProtocolMessage::PlayerUpdate { players } => s.players = players,
                                        _ => {}
                                    }
                                }
                            }
                            Some(Ok(Message::Close(_))) | None => {
                                *connected_clone.lock().await = false;
                                break;
                            }
                            _ => {}
                        }
                    }
                    _ = shutdown_rx.recv() => {
                        break;
                    }
                }
            }
        });

        Ok(CoopClient {
            session_state,
            tx: msg_tx,
            shutdown_tx,
            item_queue,
            connected,
        })
    }

    pub async fn send_item(
        &self,
        item: &CoopItemInput,
        player_name: &str,
        profile_id: &str,
    ) -> Result<(), String> {
        let connected = *self.connected.lock().await;
        if !connected {
            // Queue the item for later
            self.item_queue.lock().await.push(item.clone());
            return Ok(());
        }

        let msg = ProtocolMessage::ItemLog {
            name: item.name.clone(),
            item_type: item.item_type.clone(),
            rarity: item.rarity.clone(),
            player_name: player_name.to_string(),
            profile_id: profile_id.to_string(),
        };
        let json = serde_json::to_string(&msg).map_err(|e| e.to_string())?;
        self.tx.send(json).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn disconnect(&self) {
        let _ = self.shutdown_tx.send(());
    }
}

// ===== View struct for frontend =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CoopSessionView {
    pub role: String,
    pub session_code: String,
    pub host_ip: String,
    pub port: u16,
    pub players: Vec<PlayerInfo>,
    pub items: Vec<CoopItemData>,
    pub run_count: u32,
    pub elapsed_secs: u64,
    pub paused: bool,
}

// ===== Host Tauri Commands =====

#[tauri::command]
pub async fn start_coop_server(
    state: State<'_, CoopState>,
    player_name: String,
) -> Result<CoopServerInfo, String> {
    let server = CoopServer::start(player_name).await?;
    let info = CoopServerInfo {
        session_code: server.session_code.clone(),
        host_ip: server.host_ip.clone(),
        port: server.port,
    };
    *state.server.lock().map_err(|e| e.to_string())? = Some(server);
    Ok(info)
}

#[tauri::command]
pub async fn stop_coop_server(state: State<'_, CoopState>) -> Result<(), String> {
    let server = state.server.lock().map_err(|e| e.to_string())?.take();
    if let Some(server) = server {
        server.broadcast(&ProtocolMessage::SessionEnd).await;
        server.stop().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn coop_split_run(state: State<'_, CoopState>) -> Result<(), String> {
    // Clone the Arc handles out of the std::sync::Mutex, then drop it before awaiting
    let (session_state, clients) = {
        let server_lock = state.server.lock().map_err(|e| e.to_string())?;
        match &*server_lock {
            Some(server) => (server.session_state.clone(), server.clients.clone()),
            None => return Err("Not hosting a session".to_string()),
        }
    };

    let mut s = session_state.lock().await;
    s.run_count += 1;
    let run_count = s.run_count;
    drop(s);

    let msg = ProtocolMessage::RunSplit {
        run_count,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    let json = serde_json::to_string(&msg).unwrap_or_default();
    let c = clients.lock().await;
    for client in c.iter() {
        let _ = client.tx.send(json.clone());
    }
    Ok(())
}

#[tauri::command]
pub async fn coop_pause(state: State<'_, CoopState>) -> Result<(), String> {
    // Clone the Arc handles out of the std::sync::Mutex, then drop it before awaiting
    let (session_state, clients) = {
        let server_lock = state.server.lock().map_err(|e| e.to_string())?;
        match &*server_lock {
            Some(server) => (server.session_state.clone(), server.clients.clone()),
            None => return Err("Not hosting a session".to_string()),
        }
    };

    let mut s = session_state.lock().await;
    s.paused = !s.paused;
    let paused = s.paused;
    drop(s);

    let msg = ProtocolMessage::Pause { paused };
    let json = serde_json::to_string(&msg).unwrap_or_default();
    let c = clients.lock().await;
    for client in c.iter() {
        let _ = client.tx.send(json.clone());
    }
    Ok(())
}

#[tauri::command]
pub async fn coop_end_session(state: State<'_, CoopState>) -> Result<(), String> {
    let server = state.server.lock().map_err(|e| e.to_string())?.take();
    if let Some(server) = server {
        server.broadcast(&ProtocolMessage::SessionEnd).await;
        server.stop().await;
    }
    Ok(())
}

// ===== Guest Tauri Commands =====

#[tauri::command]
pub async fn join_coop_session(
    state: State<'_, CoopState>,
    host_ip: String,
    port: u16,
    session_code: String,
    player_name: String,
) -> Result<(), String> {
    let client =
        CoopClient::connect(host_ip, port, session_code, player_name.clone(), player_name).await?;
    *state.client.lock().map_err(|e| e.to_string())? = Some(client);
    Ok(())
}

#[tauri::command]
pub async fn leave_coop_session(state: State<'_, CoopState>) -> Result<(), String> {
    let client = state.client.lock().map_err(|e| e.to_string())?.take();
    if let Some(client) = client {
        client.disconnect().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn coop_log_item(
    state: State<'_, CoopState>,
    item: CoopItemInput,
    player_name: String,
) -> Result<(), String> {
    // Clone the tx sender and connected/item_queue Arcs out of the lock
    let (tx, connected, item_queue) = {
        let client_lock = state.client.lock().map_err(|e| e.to_string())?;
        match &*client_lock {
            Some(client) => (
                client.tx.clone(),
                client.connected.clone(),
                client.item_queue.clone(),
            ),
            None => return Err("Not connected to a session".to_string()),
        }
    };

    let is_connected = *connected.lock().await;
    if !is_connected {
        item_queue.lock().await.push(item);
        return Ok(());
    }

    let msg = ProtocolMessage::ItemLog {
        name: item.name.clone(),
        item_type: item.item_type.clone(),
        rarity: item.rarity.clone(),
        player_name: player_name.clone(),
        profile_id: player_name,
    };
    let json = serde_json::to_string(&msg).map_err(|e| e.to_string())?;
    tx.send(json).map_err(|e| format!("Failed to send item: {}", e))?;
    Ok(())
}

// ===== State Query Command =====

#[tauri::command]
pub async fn get_coop_state(
    state: State<'_, CoopState>,
) -> Result<Option<CoopSessionView>, String> {
    // Check if hosting — clone Arc out, then drop std lock before awaiting
    let server_data = {
        let server_lock = state.server.lock().map_err(|e| e.to_string())?;
        server_lock.as_ref().map(|server| {
            (
                server.session_code.clone(),
                server.host_ip.clone(),
                server.port,
                server.session_state.clone(),
            )
        })
    };

    if let Some((session_code, host_ip, port, session_state)) = server_data {
        let s = session_state.lock().await;
        return Ok(Some(CoopSessionView {
            role: "host".to_string(),
            session_code,
            host_ip,
            port,
            players: s.players.clone(),
            items: s.items.clone(),
            run_count: s.run_count,
            elapsed_secs: s.elapsed_secs,
            paused: s.paused,
        }));
    }

    // Check if guest — clone Arc out, then drop std lock before awaiting
    let client_state = {
        let client_lock = state.client.lock().map_err(|e| e.to_string())?;
        client_lock
            .as_ref()
            .map(|client| client.session_state.clone())
    };

    if let Some(session_state) = client_state {
        let s = session_state.lock().await;
        return Ok(Some(CoopSessionView {
            role: "guest".to_string(),
            session_code: s.session_code.clone(),
            host_ip: "".to_string(),
            port: 0,
            players: s.players.clone(),
            items: s.items.clone(),
            run_count: s.run_count,
            elapsed_secs: s.elapsed_secs,
            paused: s.paused,
        }));
    }

    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_message_serialization() {
        let msg = ProtocolMessage::Auth {
            session_code: "ABC123".to_string(),
            player_name: "TestPlayer".to_string(),
            profile_id: "id-1".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\":\"Auth\""));
        assert!(json.contains("\"session_code\":\"ABC123\""));

        let deserialized: ProtocolMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(msg, deserialized);
    }

    #[test]
    fn test_session_sync_serialization() {
        let state = SessionState {
            session_code: "XYZ789".to_string(),
            host_player: "Host".to_string(),
            players: vec![],
            run_count: 5,
            elapsed_secs: 300,
            paused: false,
            items: vec![],
        };
        let msg = ProtocolMessage::SessionSync {
            state: state.clone(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        let deserialized: ProtocolMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(ProtocolMessage::SessionSync { state }, deserialized);
    }

    #[test]
    fn test_generate_session_code_format() {
        for _ in 0..100 {
            let code = generate_session_code();
            assert_eq!(code.len(), 6);
            assert!(code
                .chars()
                .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()));
        }
    }
}
