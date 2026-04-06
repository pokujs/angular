# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-05

### Added

- Initial release of `@pokujs/angular`
- `render()` for standalone Angular components with signal-input support
- `renderHook()` for injection-context testing
- `cleanup()` / `afterEach(cleanup)` integration
- `screen` lazy proxy for Testing Library queries
- Async `fireEvent` wrapper with automatic Angular change detection
- `angularTestingPlugin` Poku plugin with `happy-dom` and `jsdom` DOM adapters
- Signal input support via internal `applyValueToInputSignal` mechanism
