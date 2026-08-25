//! Stable-ABI mod skeleton.
//!
//! A DLL built from this template keeps loading on future game versions —
//! no rebuild needed when the game updates (loader rule: your required ABI
//! level <= the game's level).

use mod_api_stable::{declare_stable_mod, LogLevel, StableHost, StableMod};

fn init(host: &StableHost) -> StableMod {
    let version = host.game_version();
    host.log(
        LogLevel::Info,
        &format!("my mod loaded (game {}.{}.{})", version.major, version.minor, version.patch),
    );

    // `mut` is what the register calls below need; it is unused until you
    // uncomment one of them.
    #[allow(unused_mut)]
    let mut decl = StableMod::new("my_mod_id");
    // decl.add_champion(...);          // impl StableChampion — a champion also
    //                                  // needs its art remapped in
    //                                  // mod.override_info, or the renderer
    //                                  // panics on the missing animation.
    // decl.add_item(...);              // impl StableItem
    // decl.add_native_effect(...);     // impl StableEffectType (for .data_champion)
    // decl.set_extension(...);         // impl StableExtension (title/game UI, save, net)
    // decl.set_server_extension(...);  // impl StableServerExtension (authoritative hooks)
    // decl.add_draft_score_hook(...);  // impl StableDraftHook
    // decl.add_player_input_ai(...);   // impl StablePlayerAi
    decl
}

declare_stable_mod!(init);
