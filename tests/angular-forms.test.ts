import { afterEach, assert, test } from 'poku';
import { LoginForm } from './__fixtures__/LoginForm.ts';
import { cleanup, fireEvent, render, screen } from '../src/index.ts';

afterEach(cleanup);

await test('submit button is disabled while the form is invalid', async () => {
  await render(LoginForm);

  const button = screen.getByRole('button', { name: 'Sign in' });
  assert.strictEqual(button.hasAttribute('disabled'), true);
});

await test('shows email validation error after blurring an empty email field', async () => {
  await render(LoginForm);

  const emailInput = screen.getByLabelText('Email');
  await fireEvent.focus(emailInput);
  await fireEvent.blur(emailInput);

  assert.strictEqual(
    screen.getByRole('alert').textContent,
    'Valid email is required.'
  );
});

await test('shows password validation error after a short password is entered', async () => {
  await render(LoginForm);

  const passwordInput = screen.getByLabelText('Password');
  await fireEvent.focus(passwordInput);
  await fireEvent.input(passwordInput, { target: { value: 'short' } });
  await fireEvent.blur(passwordInput);

  assert.strictEqual(
    screen.getByRole('alert').textContent,
    'Password must be at least 8 characters.'
  );
});

await test('displays welcome message after valid credentials are submitted', async () => {
  await render(LoginForm);

  await fireEvent.input(screen.getByLabelText('Email'), {
    target: { value: 'grace@example.com' },
  });
  await fireEvent.input(screen.getByLabelText('Password'), {
    target: { value: 'securepassword' },
  });

  await fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

  assert.strictEqual(
    screen.getByRole('status').textContent,
    'Welcome, grace@example.com!'
  );
});
