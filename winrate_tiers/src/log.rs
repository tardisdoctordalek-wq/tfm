//! File logging for the server extension.
//!
//! `StableHost` is documented as valid only inside the callback that
//! received it ("never store one"), and the server hooks are handed a
//! `StableServerCtx` instead — which has no log slot. So anything the
//! extension wants to report goes to a file next to the mod, which is also
//! where a player looking into the mod's behaviour would expect it.

use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

static SINK: Mutex<Option<PathBuf>> = Mutex::new(None);

/// Points the log at `dir/winrate_tiers.log` and starts a fresh session
/// block. Called once the mod directory is known.
pub fn open(dir: &Path) {
    let path = dir.join(concat!(env!("CARGO_PKG_NAME"), ".log"));
    // A long-running career would otherwise grow this without bound.
    if std::fs::metadata(&path).is_ok_and(|meta| meta.len() > 512 * 1024) {
        let _ = std::fs::remove_file(&path);
    }
    if let Ok(mut sink) = SINK.lock() {
        *sink = Some(path);
    }
    line("---- session start ----");
}

pub fn line(message: &str) {
    let Ok(sink) = SINK.lock() else { return };
    let Some(path) = sink.as_ref() else { return };
    let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) else {
        return;
    };
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs());
    let _ = writeln!(file, "[{stamp}] {message}");
}
