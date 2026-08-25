//! Locating the directory the mod binary was loaded from.
//!
//! The stable ABI has no "where am I installed" slot, and a Workshop install
//! does not sit under the game folder, so the module resolves its own path.
//! On Windows that is exact (ask the loader for the module our own code is
//! in). Elsewhere it falls back to probing the usual install layouts.

use std::path::PathBuf;

/// Directory holding this mod's binary, or `None` when it cannot be
/// determined — callers then skip file I/O rather than writing somewhere
/// arbitrary.
pub fn mod_dir() -> Option<PathBuf> {
    if let Some(dir) = platform_mod_dir() {
        return Some(dir);
    }
    fallback_dir()
}

#[cfg(windows)]
fn platform_mod_dir() -> Option<PathBuf> {
    use std::ffi::c_void;
    use std::os::windows::ffi::OsStringExt;

    const FROM_ADDRESS: u32 = 0x0000_0004;
    const UNCHANGED_REFCOUNT: u32 = 0x0000_0002;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetModuleHandleExW(flags: u32, module_name: *const u16, module: *mut *mut c_void) -> i32;
        fn GetModuleFileNameW(module: *mut c_void, filename: *mut u16, size: u32) -> u32;
    }

    let mut module: *mut c_void = std::ptr::null_mut();
    // Any address inside this DLL identifies it; the function itself will do.
    let anchor = platform_mod_dir as *const () as *const u16;
    let ok = unsafe {
        GetModuleHandleExW(FROM_ADDRESS | UNCHANGED_REFCOUNT, anchor, &mut module)
    };
    if ok == 0 || module.is_null() {
        return None;
    }

    let mut buffer = vec![0u16; 1024];
    let written = unsafe { GetModuleFileNameW(module, buffer.as_mut_ptr(), buffer.len() as u32) };
    // A truncated path is not usable; treat it as a failure rather than
    // resolving to the wrong directory.
    if written == 0 || written as usize >= buffer.len() {
        return None;
    }
    buffer.truncate(written as usize);
    let path = PathBuf::from(std::ffi::OsString::from_wide(&buffer));
    path.parent().map(std::path::Path::to_path_buf)
}

#[cfg(not(windows))]
fn platform_mod_dir() -> Option<PathBuf> {
    None
}

/// Looks for a `mods/<mod_id>` directory near the running executable.
fn fallback_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let base = exe.parent()?;
    for candidate in [
        base.join("mods").join(crate::MOD_ID),
        base.join("..").join("mods").join(crate::MOD_ID),
    ] {
        if candidate.is_dir() {
            return Some(candidate);
        }
    }
    None
}
