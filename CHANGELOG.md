# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0](https://github.com/pokujs/angular/compare/angular-v1.0.0...angular-v1.1.0) (2026-10-22)


### Features

* initial release of @pokujs/angular v1.0.0 ([b01d4ea](https://github.com/pokujs/angular/commit/b01d4ea1e45e07a0f95a17eaccda97830638cddd))
* isolate Angular runtime per render ([#1](https://github.com/pokujs/angular/issues/1)) ([3dd78be](https://github.com/pokujs/angular/commit/3dd78bee72b301aaa454f79a0c0f6430a06c4db8))


### Bug Fixes

* isolate Angular helpers and reset platform on DOM changes ([#3](https://github.com/pokujs/angular/issues/3)) ([1db4225](https://github.com/pokujs/angular/commit/1db4225e534760b18701fe810775ff8731e16aac))

## [1.0.0] - 2026-10-22

### Added

- Initial release of `@pokujs/angular`
- `render()` for standalone Angular components with signal-input support
- `renderHook()` for injection-context testing
- `cleanup()` / `afterEach(cleanup)` integration
- `screen` lazy proxy for Testing Library queries
- Async `fireEvent` wrapper with automatic Angular change detection
- `angularTestingPlugin` Poku plugin with `happy-dom` and `jsdom` DOM adapters
- Signal input support via internal `applyValueToInputSignal` mechanism
- Angular 18–21 compatibility, isolated application runtimes, and scoped cleanup
- Fragment snapshots, debug helpers, live hook results, and error propagation
