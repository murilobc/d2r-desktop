use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::SystemTime;

use tauri::AppHandle;

use super::monitor::ClipboardMonitor;
use super::settings::ScreenshotSettings;

/// Monitors the D2R screenshots folder for new image files using filesystem polling.
///
/// Uses only standard `std::fs::read` and `std::fs::read_dir` — no kernel-level
/// file watch APIs — to comply with anti-cheat requirements (Requirement 6).
///
/// Polls every 2 seconds and processes new `.jpg`/`.png` files whose modification
/// time is strictly after the recorded baseline.
pub struct FolderWatcher {
    watch_path: PathBuf,
    last_modified: Arc<Mutex<Option<SystemTime>>>,
    running: Arc<AtomicBool>,
}

impl FolderWatcher {
    /// Resolves the default D2R screenshots folder path.
    ///
    /// Checks in order:
    /// 1. `<Documents>/Diablo II Resurrected/Screenshots/`
    /// 2. `<Home>/Saved Games/Diablo II Resurrected/Screenshots/`
    ///
    /// Returns `None` if neither directory exists on disk.
    pub fn resolve_default_path() -> Option<PathBuf> {
        // Try Documents folder first
        if let Some(docs) = dirs::document_dir() {
            let path = docs.join("Diablo II Resurrected").join("Screenshots");
            if path.is_dir() {
                return Some(path);
            }
        }

        // Try Saved Games folder second
        if let Some(home) = dirs::home_dir() {
            let path = home
                .join("Saved Games")
                .join("Diablo II Resurrected")
                .join("Screenshots");
            if path.is_dir() {
                return Some(path);
            }
        }

        None
    }

    /// Starts watching the folder for new `.jpg`/`.png` files.
    ///
    /// Spawns a tokio task that polls every 2 seconds. Records the current time
    /// as the baseline — only processes files with modification times strictly
    /// after this baseline (ignores pre-existing files).
    pub fn start(app_handle: AppHandle, path: PathBuf, settings: ScreenshotSettings) -> Self {
        let running = Arc::new(AtomicBool::new(true));
        let last_modified: Arc<Mutex<Option<SystemTime>>> =
            Arc::new(Mutex::new(Some(SystemTime::now())));

        let watcher = Self {
            watch_path: path.clone(),
            last_modified: last_modified.clone(),
            running: running.clone(),
        };

        let r = running.clone();
        let lm = last_modified.clone();

        tauri::async_runtime::spawn(async move {
            while r.load(Ordering::Relaxed) {
                let new_files = poll_new_files_inner(&path, &lm);

                for file_path in new_files {
                    match std::fs::read(&file_path) {
                        Ok(image_data) => {
                            let ah = app_handle.clone();
                            let s = settings.clone();
                            tauri::async_runtime::spawn_blocking(move || {
                                ClipboardMonitor::process_image(&ah, &image_data, &s);
                            });
                        }
                        Err(e) => {
                            eprintln!(
                                "[FolderWatcher] Error reading file {:?}: {}",
                                file_path, e
                            );
                        }
                    }
                }

                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            }
        });

        watcher
    }

    /// Stops the folder watcher by signaling the polling loop to exit.
    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
    }

    /// Returns whether the watcher is currently active.
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    /// Checks for new files since the last poll.
    ///
    /// Reads the watched directory, filters to `.jpg` and `.png` files whose
    /// modification time is strictly after `last_modified`, sorts by modification
    /// time (oldest first), and updates `last_modified` to the newest file's time.
    pub fn poll_new_files(&self) -> Vec<PathBuf> {
        poll_new_files_inner(&self.watch_path, &self.last_modified)
    }
}

/// Internal implementation of poll_new_files, used by both the struct method
/// and the spawned async task.
fn poll_new_files_inner(
    watch_path: &PathBuf,
    last_modified: &Arc<Mutex<Option<SystemTime>>>,
) -> Vec<PathBuf> {
    let baseline = {
        let guard = last_modified.lock().unwrap();
        *guard
    };

    let entries = match std::fs::read_dir(watch_path) {
        Ok(entries) => entries,
        Err(e) => {
            eprintln!(
                "[FolderWatcher] Error reading directory {:?}: {}",
                watch_path, e
            );
            return Vec::new();
        }
    };

    let mut candidates: Vec<(PathBuf, SystemTime)> = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                eprintln!("[FolderWatcher] Error reading directory entry: {}", e);
                continue;
            }
        };

        let path = entry.path();

        // Only process files (skip directories)
        if !path.is_file() {
            continue;
        }

        // Filter by extension: only .jpg and .png (case-insensitive)
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());
        match ext.as_deref() {
            Some("jpg") | Some("png") => {}
            _ => continue,
        }

        // Get modification time
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(e) => {
                eprintln!(
                    "[FolderWatcher] Error reading metadata for {:?}: {}",
                    path, e
                );
                continue;
            }
        };

        let modified = match metadata.modified() {
            Ok(t) => t,
            Err(e) => {
                eprintln!(
                    "[FolderWatcher] Error getting modification time for {:?}: {}",
                    path, e
                );
                continue;
            }
        };

        // Filter: modification time must be strictly after baseline
        if let Some(baseline_time) = baseline {
            if modified <= baseline_time {
                continue;
            }
        }

        candidates.push((path, modified));
    }

    // Sort by modification time (oldest first) for sequential processing
    candidates.sort_by_key(|(_, time)| *time);

    // Update last_modified to the newest file's time
    if let Some((_, newest_time)) = candidates.last() {
        let mut guard = last_modified.lock().unwrap();
        *guard = Some(*newest_time);
    }

    candidates.into_iter().map(|(path, _)| path).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use std::fs;
    use std::io::Write;
    use std::thread;
    use std::time::Duration;

    // Helper: create a temp directory with a unique name
    fn create_test_dir() -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("folder_watcher_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("Failed to create test directory");
        dir
    }

    // Helper: create a file with specific modification time using filetime
    fn create_file_with_mtime(dir: &PathBuf, name: &str, mtime: SystemTime) {
        let path = dir.join(name);
        fs::write(&path, b"test content").expect("Failed to write test file");
        filetime::set_file_mtime(&path, filetime::FileTime::from_system_time(mtime))
            .expect("Failed to set file modification time");
    }

    // Validates: Requirements 3.2, 3.3
    // Property 4: Folder watcher detects new files by modification time
    //
    // For any set of files with extensions .jpg or .png in the watched directory,
    // poll_new_files SHALL return exactly those files whose modification time is
    // strictly after the watcher's last processed file time, and exclude all others.
    proptest! {
        #[test]
        fn prop_folder_watcher_detects_new_files_by_modification_time(
            // Generate random counts of files in each category
            num_old_jpg in 0u8..4,
            num_old_png in 0u8..4,
            num_old_txt in 0u8..3,
            num_new_jpg in 0u8..4,
            num_new_png in 0u8..4,
            num_new_txt in 0u8..3,
            num_exact_jpg in 0u8..3,
        ) {
            let dir = create_test_dir();

            // Use a fixed baseline: 10 seconds ago from now
            let now = SystemTime::now();
            let baseline = now - Duration::from_secs(10);
            let old_time = baseline - Duration::from_secs(5);
            let new_time = baseline + Duration::from_secs(5);

            // Create "old" files (before baseline) — should NOT be returned
            for i in 0..num_old_jpg {
                create_file_with_mtime(&dir, &format!("old_{}.jpg", i), old_time);
            }
            for i in 0..num_old_png {
                create_file_with_mtime(&dir, &format!("old_{}.png", i), old_time);
            }
            // Old .txt files — never returned regardless of time
            for i in 0..num_old_txt {
                create_file_with_mtime(&dir, &format!("old_{}.txt", i), old_time);
            }

            // Create files at exactly the baseline time — should NOT be returned
            // (must be STRICTLY after)
            for i in 0..num_exact_jpg {
                create_file_with_mtime(&dir, &format!("exact_{}.jpg", i), baseline);
            }

            // Create "new" files (after baseline) with valid extensions — SHOULD be returned
            for i in 0..num_new_jpg {
                create_file_with_mtime(&dir, &format!("new_{}.jpg", i), new_time);
            }
            for i in 0..num_new_png {
                create_file_with_mtime(&dir, &format!("new_{}.png", i), new_time);
            }

            // Create "new" files with invalid extensions — should NOT be returned
            for i in 0..num_new_txt {
                create_file_with_mtime(&dir, &format!("new_{}.txt", i), new_time);
            }

            // Create the watcher with the baseline
            let last_modified = Arc::new(Mutex::new(Some(baseline)));
            let result = poll_new_files_inner(&dir, &last_modified);

            // Expected count: only new .jpg and .png files
            let expected_count = (num_new_jpg + num_new_png) as usize;
            prop_assert_eq!(
                result.len(),
                expected_count,
                "Expected {} new files, got {}. \
                 Old: jpg={}, png={}, txt={}. Exact: jpg={}. New: jpg={}, png={}, txt={}",
                expected_count, result.len(),
                num_old_jpg, num_old_png, num_old_txt, num_exact_jpg,
                num_new_jpg, num_new_png, num_new_txt
            );

            // Verify all returned files have .jpg or .png extension
            for path in &result {
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_lowercase())
                    .unwrap_or_default();
                prop_assert!(
                    ext == "jpg" || ext == "png",
                    "Returned file {:?} has invalid extension '{}'",
                    path, ext
                );
            }

            // Verify all returned files are "new" (not "old" or "exact")
            for path in &result {
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                prop_assert!(
                    name.starts_with("new_"),
                    "Returned file should be 'new_*', got {:?}",
                    path
                );
            }

            // Cleanup
            let _ = fs::remove_dir_all(&dir);
        }
    }

    // Additional property: after polling, last_modified is updated so the same
    // files are not returned on a subsequent poll.
    proptest! {
        #[test]
        fn prop_folder_watcher_updates_last_modified_after_poll(
            num_new_files in 1u8..5,
        ) {
            let dir = create_test_dir();

            let now = SystemTime::now();
            let baseline = now - Duration::from_secs(20);

            // Create new files with progressively newer modification times
            for i in 0..num_new_files {
                let file_time = baseline + Duration::from_secs(5 + i as u64);
                create_file_with_mtime(&dir, &format!("file_{}.jpg", i), file_time);
            }

            let last_modified = Arc::new(Mutex::new(Some(baseline)));

            // First poll should return all new files
            let result = poll_new_files_inner(&dir, &last_modified);
            prop_assert_eq!(result.len(), num_new_files as usize);

            // Second poll should return empty — last_modified was updated
            let result2 = poll_new_files_inner(&dir, &last_modified);
            prop_assert_eq!(
                result2.len(),
                0,
                "Second poll should return no files since last_modified was updated"
            );

            // Cleanup
            let _ = fs::remove_dir_all(&dir);
        }
    }

    // Unit tests

    #[test]
    fn test_resolve_default_path_returns_option() {
        // Just verifies the function doesn't panic
        let result = FolderWatcher::resolve_default_path();
        if let Some(path) = &result {
            assert!(path.is_dir());
        }
    }

    #[test]
    fn test_poll_new_files_empty_directory() {
        let dir = create_test_dir();
        let last_modified = Arc::new(Mutex::new(Some(SystemTime::now())));

        let files = poll_new_files_inner(&dir, &last_modified);
        assert!(files.is_empty());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_poll_new_files_ignores_old_files() {
        let dir = create_test_dir();

        // Create a file before the baseline
        let old_time = SystemTime::now() - Duration::from_secs(10);
        create_file_with_mtime(&dir, "old_screenshot.png", old_time);

        // Set baseline to now (after file creation)
        let last_modified = Arc::new(Mutex::new(Some(SystemTime::now())));

        let files = poll_new_files_inner(&dir, &last_modified);
        assert!(files.is_empty(), "Old files should be ignored");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_poll_new_files_detects_new_files() {
        let dir = create_test_dir();

        // Set baseline to the past
        let baseline = SystemTime::now() - Duration::from_secs(5);
        let last_modified = Arc::new(Mutex::new(Some(baseline)));

        // Create a new file with modification time after baseline
        let new_time = SystemTime::now();
        create_file_with_mtime(&dir, "new_screenshot.jpg", new_time);

        let files = poll_new_files_inner(&dir, &last_modified);
        assert_eq!(files.len(), 1);
        assert!(files[0].ends_with("new_screenshot.jpg"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_poll_new_files_filters_by_extension() {
        let dir = create_test_dir();

        // Set baseline to the past
        let baseline = SystemTime::now() - Duration::from_secs(5);
        let last_modified = Arc::new(Mutex::new(Some(baseline)));

        // Create files with various extensions, all newer than baseline
        let new_time = SystemTime::now();
        create_file_with_mtime(&dir, "screenshot.jpg", new_time);
        create_file_with_mtime(&dir, "screenshot.png", new_time);
        create_file_with_mtime(&dir, "readme.txt", new_time);
        create_file_with_mtime(&dir, "data.json", new_time);
        create_file_with_mtime(&dir, "image.bmp", new_time);

        let files = poll_new_files_inner(&dir, &last_modified);
        assert_eq!(files.len(), 2);

        let names: Vec<String> = files
            .iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().to_string())
            .collect();
        assert!(names.contains(&"screenshot.jpg".to_string()));
        assert!(names.contains(&"screenshot.png".to_string()));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_poll_new_files_updates_last_modified() {
        let dir = create_test_dir();

        let baseline = SystemTime::now() - Duration::from_secs(5);
        let last_modified = Arc::new(Mutex::new(Some(baseline)));

        // Create a new file after baseline
        let new_time = SystemTime::now();
        create_file_with_mtime(&dir, "screenshot1.png", new_time);

        let files = poll_new_files_inner(&dir, &last_modified);
        assert_eq!(files.len(), 1);

        // Polling again without new files should return empty
        let files2 = poll_new_files_inner(&dir, &last_modified);
        assert!(files2.is_empty(), "Should not re-detect the same file");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_poll_new_files_sorts_oldest_first() {
        let dir = create_test_dir();

        let baseline = SystemTime::now() - Duration::from_secs(10);
        let last_modified = Arc::new(Mutex::new(Some(baseline)));

        // Create files with distinct modification times
        let time1 = baseline + Duration::from_secs(2);
        let time2 = baseline + Duration::from_secs(5);
        create_file_with_mtime(&dir, "second.jpg", time2);
        create_file_with_mtime(&dir, "first.png", time1);

        let files = poll_new_files_inner(&dir, &last_modified);
        assert_eq!(files.len(), 2);
        // First file should be oldest
        assert!(files[0].ends_with("first.png"));
        assert!(files[1].ends_with("second.jpg"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_stop_and_is_running() {
        let watcher = FolderWatcher {
            watch_path: PathBuf::from("/tmp/test"),
            last_modified: Arc::new(Mutex::new(Some(SystemTime::now()))),
            running: Arc::new(AtomicBool::new(true)),
        };

        assert!(watcher.is_running());
        watcher.stop();
        assert!(!watcher.is_running());
    }

    #[test]
    fn test_poll_new_files_handles_nonexistent_directory() {
        let nonexistent = PathBuf::from("/tmp/definitely_does_not_exist_d2r_test_12345");
        let last_modified = Arc::new(Mutex::new(Some(SystemTime::now())));

        // Should not panic, just return empty
        let files = poll_new_files_inner(&nonexistent, &last_modified);
        assert!(files.is_empty());
    }

    #[test]
    fn test_poll_new_files_with_none_baseline_returns_all() {
        let dir = create_test_dir();
        let last_modified = Arc::new(Mutex::new(None));

        // Create files — with no baseline, all should be returned
        let _ = fs::File::create(dir.join("any.png"))
            .unwrap()
            .write_all(b"data");
        let _ = fs::File::create(dir.join("any2.jpg"))
            .unwrap()
            .write_all(b"data2");

        // Small delay to ensure files are written
        thread::sleep(Duration::from_millis(10));

        let files = poll_new_files_inner(&dir, &last_modified);
        assert_eq!(files.len(), 2);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_exact_baseline_time_excluded() {
        let dir = create_test_dir();

        // Use a specific time as baseline
        let baseline = SystemTime::now() - Duration::from_secs(5);
        let last_modified = Arc::new(Mutex::new(Some(baseline)));

        // Create a file with modification time exactly at baseline
        create_file_with_mtime(&dir, "exact.jpg", baseline);

        let files = poll_new_files_inner(&dir, &last_modified);
        assert!(
            files.is_empty(),
            "Files at exactly the baseline time should NOT be returned"
        );

        let _ = fs::remove_dir_all(&dir);
    }
}
