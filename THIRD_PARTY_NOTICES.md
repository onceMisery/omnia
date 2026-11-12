# Third-party notices

This is the initial US-001 attribution inventory, not the US-425 distribution audit.

Omnia is a derivative work intended for personal, non-commercial use under
Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International.
The original authors retain their rights. The full terms are in [LICENSE](LICENSE).

| Source | Frozen revision / version | License and use |
| --- | --- | --- |
| [lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox) | a8560b0ae4e7b1a7803a88093a9ebee391e21a7c | CC BY-NC-SA 4.0; backend behavior and protocol source, translated implementations and synthetic fixtures |
| [lioensky/VCPChat](https://github.com/lioensky/VCPChat) | c3e4855efa2b24c0578d76e17fd6c5f21857a539 | CC BY-NC-SA 4.0; frontend behavior and data contracts |
| [Longbridge GPUI Kit](https://github.com/longbridge/gpui-kit) | 0.9.1 | Apache-2.0 for code; GPUI Kit documentation and installed guide material use CC BY 4.0 |
| GPUI snapshots (gpui-pre family) | 0.3.12 | Apache-2.0; transitive framework dependencies, preserving original Zed Industries notices |
| gpui-shell (Longbridge GPUI Kit) | 0.9.1 | Apache-2.0; experimental QuickJS script-runtime probes only (M0), not the application runtime |
| quickjs-jit | 0.14.1 | MIT; QuickJS engine with JIT used by gpui-shell probes |
| gpui-fast (experimental backend) | 0.1.14 | Apache-2.0; opt-in `gpui-fast` feature comparison only, not the default backend |

Changes by Omnia: Rust workspace and independently structured Rust ports of the
frozen VCP behavior, native GPUI presentation, compatibility tests and build tools.
Compatibility targets and approved differences are defined in the scope matrix.
No affiliation with or endorsement by the upstream authors is implied.

Registry dependencies are resolved by [Cargo.lock](Cargo.lock). Their own license
terms and notices apply individually; this project does not relicense dependencies.
Use `cargo metadata --locked --format-version 1` to inspect the resolved inventory.
Before distribution, US-425 must collect the full transitive licenses, font/icon
notices and platform binaries actually shipped, and examine combined obligations.

No vendored memory or audio engine is currently part of this workspace. No Zed
application source or Folia-derived stage source is copied. The approved clean-room
boundary for later music-stage work remains in effect.
