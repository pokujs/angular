import { afterEach, assert, test } from "poku";
import { AsyncPipeline } from "./__fixtures__/AsyncPipeline.ts";
import { GreetingCard } from "./__fixtures__/GreetingCard.ts";
import { UnmountWatcher } from "./__fixtures__/UnmountWatcher.ts";
import { CounterButton } from "./__fixtures__/CounterButton.ts";
import { Component, Input } from "@angular/core";
import { cleanup, render, renderHook, screen, waitFor } from "../src/index.ts";

afterEach(cleanup);

await test("rerender propagates updated signal input to the DOM", async () => {
  const view = await render(GreetingCard, {
    inputs: { name: "Ada" },
  });

  assert.strictEqual(
    screen.getByRole("heading", { level: 3 }).textContent,
    "Hello Ada",
  );

  await view.rerender({ name: "Grace" });

  assert.strictEqual(
    screen.getByRole("heading", { level: 3 }).textContent,
    "Hello Grace",
  );
});

await test("unmount fires ngOnDestroy on the component instance", async () => {
  let cleaned = false;

  const view = await render(UnmountWatcher, {
    inputs: {
      onCleanup: () => {
        cleaned = true;
      },
    },
  });

  assert.strictEqual(cleaned, false);
  view.unmount();
  assert.strictEqual(cleaned, true);
});

await test("fixture.debugElement is non-null after render", async () => {
  const { fixture } = await render(CounterButton);

  // getDebugNode is backed by Angular's live debug map, which is populated
  // after the first change-detection pass triggered by render().
  assert.ok(
    fixture.debugElement !== null,
    "debugElement should be populated after render",
  );
});

await test("render with detectChanges:false defers DOM population until explicit detectChanges", async () => {
  const view = await render(CounterButton, {
    inputs: { initialCount: 7 },
    detectChanges: false,
  });

  // No change detection has run yet — the interpolated text is not in the DOM.
  assert.throws(() => screen.getByRole("heading", { name: "Count: 7" }));

  // Trigger change detection manually.
  await view.detectChanges();

  assert.strictEqual(
    screen.getByRole("heading", { name: "Count: 7" }).textContent,
    "Count: 7",
  );
});

await test("fixture.isStable reflects Angular application stability", async () => {
  const view = await render(AsyncPipeline, {
    detectChanges: false,
  });

  view.fixture.detectChanges();
  assert.strictEqual(view.fixture.isStable(), false);

  await view.fixture.whenStable();
  assert.strictEqual(view.fixture.isStable(), true);
});

@Component({
  selector: "decorator-input-card",
  standalone: true,
  template: `<p data-testid="decorator-label">{{ label }}</p>`,
})
class DecoratorInputCard {
  @Input() label = "default";
}

await test("provides fragment snapshots after signal input rerenders", async () => {
  const view = await render(GreetingCard, {
    inputs: { name: "Ada" },
  });

  assert.strictEqual(
    screen.getByRole("heading", { level: 3 }).textContent,
    "Hello Ada",
  );

  await view.rerender({ name: "Grace" });

  assert.strictEqual(
    screen.getByRole("heading", { level: 3 }).textContent,
    "Hello Grace",
  );
  assert.strictEqual(
    view.asFragment().querySelector("h3")?.textContent,
    "Hello Grace",
  );
});

await test("supports standard @Input() decorator properties, waitFor, and live renderHook.result", async () => {
  const view = await render(DecoratorInputCard, {
    inputs: { label: "First Label" },
  });

  assert.strictEqual(
    screen.getByTestId("decorator-label").textContent,
    "First Label",
  );

  await view.rerender({ label: "Second Label" });
  await waitFor(() => {
    assert.strictEqual(
      screen.getByTestId("decorator-label").textContent,
      "Second Label",
    );
  });

  const { result, rerender } = await renderHook((val: number) => val * 3, {
    initialProps: 2,
  });
  assert.strictEqual(result.current, 6);
  rerender(4);
  assert.strictEqual(result.current, 12);
});

await test("unmount fires ngOnDestroy on the component instance", async () => {
  let cleaned = false;

  const view = await render(UnmountWatcher, {
    inputs: {
      onCleanup: () => {
        cleaned = true;
      },
    },
  });

  assert.strictEqual(cleaned, false);
  view.unmount();
  assert.strictEqual(cleaned, true);
});
