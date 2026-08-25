Stable-ABI Mod SDK
==================

0. Install Rust once from https://rustup.rs (any toolchain â€” stable is fine).
   This SDK pins nothing; `cargo` just has to be on your PATH.
1. Copy the `template` folder anywhere and rename it.
2. Keep `mod-api-stable` next to it (the template references ../mod-api-stable).
3. Edit src/lib.rs and mod.mod_info, then run: cargo build --release
4. Copy the built module out of target/release/ into mods/<your_mod_id>/,
   renamed to <your_mod_id> plus its extension, together with the edited
   mod.mod_info. The folder name is your mod id.

     Windows  my_mod.dll      (from my_mod.dll)
     Linux    my_mod.so       (from libmy_mod.so)
     macOS    my_mod.dylib    (from libmy_mod.dylib)

The template ships a ready mod.mod_info; fill in name/author/version and keep
the "base" dependency requirement permissive (>=) so game updates do not
disable your mod.

Platform support is not declared anywhere â€” it is read off the binaries you
ship. A package holding only my_mod.dll is a Windows mod; add my_mod.so beside
it and the same package also runs on Linux. Building for another platform
requires that platform (a .dylib needs a Mac, because Apple's SDK cannot be
redistributed for cross-linking), so ship what you can actually build. Players
on a platform you did not build for get a clear message instead of a mod that
silently does nothing.

Any Rust toolchain works. A module built once keeps loading on future game
versions; the game only rejects mods that require a NEWER ABI level than it
supports.
