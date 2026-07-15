//! Cloud sync module for D2R Tracker.
//!
//! Handles secure synchronization operations including:
//! - GitHub Gist API interactions (pull/push/test)
//! - Local file sync backend (atomic read/write)
//! - OS keychain credential management via the `keyring` crate
//!
//! All GitHub API calls are performed in Rust so that the personal access token
//! never reaches the frontend JavaScript context.

use keyring::Entry;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;

/// The service name used for keychain entries.
const SERVICE_NAME: &str = "d2r-tracker";

/// Result of pulling a sync payload from a GitHub Gist.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GistPullResult {
    /// The raw JSON payload content from the gist file.
    pub payload: String,
    /// The gist ID (useful when pulling from a known gist).
    pub gist_id: String,
}

/// Result of pushing a sync payload to a GitHub Gist.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GistPushResult {
    /// The gist ID (important for first-sync when a new gist is created).
    pub gist_id: String,
}

/// Result of testing the GitHub connection/token validity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    /// Whether the test connection succeeded.
    pub success: bool,
    /// Error message if the test failed.
    pub error: Option<String>,
}

/// Store a token in the OS keychain.
///
/// Validates that the token is non-empty, not whitespace-only, and between 1–255 characters.
#[tauri::command]
pub fn save_sync_token(service: String, token: String) -> Result<(), String> {
    let trimmed = token.trim();
    if trimmed.is_empty() {
        return Err("Token must not be empty or whitespace-only".to_string());
    }
    if token.len() > 255 {
        return Err("Token must not exceed 255 characters".to_string());
    }

    let entry = Entry::new(SERVICE_NAME, &service)
        .map_err(|e| format!("Cannot access system keychain: {}", e))?;
    entry
        .set_password(&token)
        .map_err(|e| format!("Cannot access system keychain: {}", e))?;
    Ok(())
}

/// Retrieve a token from the OS keychain.
///
/// Returns `None` if no entry exists for the given service key.
#[tauri::command]
pub fn get_sync_token(service: String) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, &service)
        .map_err(|e| format!("Cannot access system keychain: {}", e))?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Cannot access system keychain: {}", e)),
    }
}

/// Remove a token from the OS keychain.
#[tauri::command]
pub fn delete_sync_token(service: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, &service)
        .map_err(|e| format!("Cannot access system keychain: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already gone, not an error
        Err(e) => Err(format!("Cannot access system keychain: {}", e)),
    }
}

// ---------------------------------------------------------------------------
// GitHub Gist backend
// ---------------------------------------------------------------------------

/// The filename used for the sync payload within a GitHub Gist.
const GIST_SYNC_FILE_NAME: &str = "d2r-tracker-sync.json";

/// Fetch the sync payload from a GitHub Gist.
///
/// Retrieves the GitHub token from the OS keychain internally (never exposed to JS).
/// If `gist_id` is provided, fetches that specific gist and extracts the
/// `d2r-tracker-sync.json` file content.
///
/// Returns `None` if no gist_id is provided.
/// Returns an error for authentication failures, rate limiting, server errors, and timeouts.
#[tauri::command]
pub async fn github_gist_pull(gist_id: Option<String>) -> Result<Option<GistPullResult>, String> {
    let gist_id = match gist_id {
        Some(id) if !id.trim().is_empty() => id,
        _ => return Ok(None),
    };

    // Retrieve token from keychain (never returned to JS)
    let token = {
        let entry = Entry::new(SERVICE_NAME, "github_token")
            .map_err(|e| format!("Cannot access system keychain: {}", e))?;
        match entry.get_password() {
            Ok(t) => t,
            Err(keyring::Error::NoEntry) => {
                return Err("Authentication failed. Please re-enter your token.".to_string());
            }
            Err(e) => {
                return Err(format!("Cannot access system keychain: {}", e));
            }
        }
    };

    // Build HTTP client with 30-second timeout
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("https://api.github.com/gists/{}", gist_id);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "d2r-tracker")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Sync timed out".to_string()
            } else {
                format!("Sync failed: {}", e)
            }
        })?;

    let status = response.status();

    match status.as_u16() {
        200 => {}
        401 | 403 => {
            return Err("Authentication failed. Please re-enter your token.".to_string());
        }
        404 => {
            return Ok(None);
        }
        429 => {
            return Err("GitHub rate limit exceeded. Try again later.".to_string());
        }
        500..=599 => {
            return Err(format!("GitHub server error ({}). Try again later.", status.as_u16()));
        }
        _ => {
            return Err(format!("Unexpected GitHub API response: {}", status.as_u16()));
        }
    }

    // Parse the response JSON to extract the gist file content
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

    let payload = body
        .get("files")
        .and_then(|files| files.get(GIST_SYNC_FILE_NAME))
        .and_then(|file| file.get("content"))
        .and_then(|content| content.as_str())
        .map(|s| s.to_string());

    match payload {
        Some(content) => Ok(Some(GistPullResult {
            payload: content,
            gist_id,
        })),
        None => Ok(None),
    }
}

// ---------------------------------------------------------------------------
// GitHub Gist commands
// ---------------------------------------------------------------------------

/// Test the stored GitHub token by making a lightweight GET request to
/// `https://api.github.com/user`.
///
/// Returns a `TestResult` indicating success or an error description.
/// Uses a 10-second timeout for the HTTP request.
#[tauri::command]
pub async fn github_gist_test() -> Result<TestResult, String> {
    // Retrieve the token from the OS keychain
    let entry = Entry::new(SERVICE_NAME, "github_token")
        .map_err(|e| format!("Cannot access system keychain: {}", e))?;

    let token = match entry.get_password() {
        Ok(t) => t,
        Err(keyring::Error::NoEntry) => {
            return Ok(TestResult {
                success: false,
                error: Some("No GitHub token found. Please save a token first.".to_string()),
            });
        }
        Err(e) => {
            return Ok(TestResult {
                success: false,
                error: Some(format!("Cannot access system keychain: {}", e)),
            });
        }
    };

    // Build an HTTP client with a 10-second timeout
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // Make a lightweight GET to validate the token
    let response = match client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "d2r-tracker")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(e) => {
            let error_msg = if e.is_timeout() {
                "Connection timed out. Please check your network.".to_string()
            } else if e.is_connect() {
                "Network error: unable to connect to GitHub.".to_string()
            } else {
                format!("Network error: {}", e)
            };
            return Ok(TestResult {
                success: false,
                error: Some(error_msg),
            });
        }
    };

    match response.status() {
        StatusCode::OK => Ok(TestResult {
            success: true,
            error: None,
        }),
        StatusCode::UNAUTHORIZED => Ok(TestResult {
            success: false,
            error: Some("Authentication failed (401). Token is invalid or expired.".to_string()),
        }),
        StatusCode::FORBIDDEN => Ok(TestResult {
            success: false,
            error: Some(
                "Authentication failed (403). Token lacks required permissions.".to_string(),
            ),
        }),
        status => Ok(TestResult {
            success: false,
            error: Some(format!("Unexpected response from GitHub: HTTP {}", status.as_u16())),
        }),
    }
}

// ---------------------------------------------------------------------------
// GitHub Gist API commands
// ---------------------------------------------------------------------------

/// Push (create or update) a sync payload to a GitHub Gist.
///
/// - If `gist_id` is `None`, creates a new **private** gist via POST.
/// - If `gist_id` is `Some(id)`, updates the existing gist via PATCH.
///
/// Returns the gist ID (important for first-sync when a new gist is created).
/// The GitHub token is retrieved from the OS keychain internally.
#[tauri::command]
pub async fn github_gist_push(
    gist_id: Option<String>,
    payload: String,
) -> Result<GistPushResult, String> {
    // Retrieve token from keychain — never expose to JS
    let entry = Entry::new(SERVICE_NAME, "github_token")
        .map_err(|e| format!("Cannot access system keychain: {}", e))?;
    let token = entry
        .get_password()
        .map_err(|e| match e {
            keyring::Error::NoEntry => {
                "Authentication failed. Please re-enter your token.".to_string()
            }
            _ => format!("Cannot access system keychain: {}", e),
        })?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Build the JSON body for the Gist API
    let files = serde_json::json!({
        GIST_SYNC_FILE_NAME: {
            "content": payload
        }
    });

    let response = match &gist_id {
        None => {
            // Create a new private gist
            let body = serde_json::json!({
                "description": "D2R Tracker Sync Data",
                "public": false,
                "files": files
            });

            client
                .post("https://api.github.com/gists")
                .header("Authorization", format!("Bearer {}", token))
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "d2r-tracker")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .json(&body)
                .send()
                .await
        }
        Some(id) => {
            // Update existing gist
            let body = serde_json::json!({
                "files": files
            });

            client
                .patch(format!("https://api.github.com/gists/{}", id))
                .header("Authorization", format!("Bearer {}", token))
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "d2r-tracker")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .json(&body)
                .send()
                .await
        }
    };

    let response = response.map_err(|e| {
        if e.is_timeout() {
            "Sync timed out".to_string()
        } else {
            format!("Sync failed: {}", e)
        }
    })?;

    let status = response.status();

    match status.as_u16() {
        200 | 201 => {
            // Success — parse the gist ID from the response
            let body: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            let id = body["id"]
                .as_str()
                .ok_or_else(|| "Invalid response: missing gist id".to_string())?
                .to_string();

            Ok(GistPushResult { gist_id: id })
        }
        401 | 403 => Err("Authentication failed. Please re-enter your token.".to_string()),
        429 => Err("GitHub rate limit exceeded. Try again later.".to_string()),
        500..=599 => Err(format!("GitHub server error ({}). Try again later.", status.as_u16())),
        _ => {
            let body_text = response.text().await.unwrap_or_default();
            Err(format!("Unexpected response ({}): {}", status.as_u16(), body_text))
        }
    }
}

// ---------------------------------------------------------------------------
// Local file sync backend
// ---------------------------------------------------------------------------

const SYNC_FILE_NAME: &str = "d2r-tracker-sync.json";
const SYNC_TMP_FILE_NAME: &str = ".d2r-tracker-sync.json.tmp";

/// Read `d2r-tracker-sync.json` from the given folder.
///
/// Returns `None` if the file does not exist, or an error for other I/O failures.
#[tauri::command]
pub fn local_file_pull(folder_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&folder_path).join(SYNC_FILE_NAME);

    match std::fs::read_to_string(&path) {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Cannot read {}: {}", path.display(), e)),
    }
}

/// Atomic write of the sync payload to the given folder.
///
/// Writes to a temporary file first, then renames to `d2r-tracker-sync.json`
/// so that external sync services never see a partially-written file.
#[tauri::command]
pub fn local_file_push(folder_path: String, payload: String) -> Result<(), String> {
    let folder = Path::new(&folder_path);
    let tmp_path = folder.join(SYNC_TMP_FILE_NAME);
    let final_path = folder.join(SYNC_FILE_NAME);

    // Write to temporary file
    std::fs::write(&tmp_path, &payload).map_err(|e| {
        format!("Cannot write to {}: {}", tmp_path.display(), e)
    })?;

    // Atomic rename
    std::fs::rename(&tmp_path, &final_path).map_err(|e| {
        // Clean up tmp file on rename failure
        let _ = std::fs::remove_file(&tmp_path);
        format!(
            "Cannot rename {} to {}: {}",
            tmp_path.display(),
            final_path.display(),
            e
        )
    })?;

    Ok(())
}

/// Validate that the given folder path exists and is writable.
///
/// Returns `true` if the folder is usable for sync.
/// Returns an error string for inaccessible paths with OS-level details.
#[tauri::command]
pub fn local_folder_validate(folder_path: String) -> Result<bool, String> {
    let folder = Path::new(&folder_path);

    // Check if the path exists
    if !folder.exists() {
        return Err(format!("Folder does not exist: {}", folder.display()));
    }

    // Check if it's a directory
    if !folder.is_dir() {
        return Err(format!("Path is not a directory: {}", folder.display()));
    }

    // Check writability by attempting to create and remove a temporary probe file
    let probe_path = folder.join(".d2r-sync-write-probe");
    match std::fs::write(&probe_path, b"probe") {
        Ok(_) => {
            let _ = std::fs::remove_file(&probe_path);
            Ok(true)
        }
        Err(e) => Err(format!(
            "Folder is not writable: {}: {}",
            folder.display(),
            e
        )),
    }
}
