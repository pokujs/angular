import { Component, input, OnDestroy } from '@angular/core';

/**
 * Component that fires an optional callback when destroyed.
 * Mirrors the Vue UnmountWatcher pattern to verify `ngOnDestroy` fires.
 */
@Component({
  standalone: true,
  selector: 'app-unmount-watcher',
  template: `<span>Mounted</span>`,
})
export class UnmountWatcher implements OnDestroy {
  readonly onCleanup = input<() => void>();

  ngOnDestroy() {
    this.onCleanup()?.();
  }
}
