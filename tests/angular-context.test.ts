import { afterEach, assert, test } from 'poku';
import { ThemeConsumer } from './__fixtures__/ThemeConsumer.ts';
import { THEME_TOKEN } from './__fixtures__/ThemeToken.ts';
import { cleanup, render, screen } from '../src/index.ts';

afterEach(cleanup);

await test('injects provided InjectionToken value via the providers array', async () => {
  await render(ThemeConsumer, {
    providers: [{ provide: THEME_TOKEN, useValue: 'dark' }],
  });

  assert.strictEqual(
    screen.getByText('Theme: dark').textContent,
    'Theme: dark'
  );
});

await test('falls back to the token factory default when no provider is given', async () => {
  await render(ThemeConsumer);

  assert.strictEqual(
    screen.getByText('Theme: light').textContent,
    'Theme: light'
  );
});
