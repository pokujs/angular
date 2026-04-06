import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

/**
 * Reactive login form built with Angular's `FormBuilder` and `inject()`.
 * Demonstrates real-world form testing: invalid state, validation error
 * messages, and a successful submission that reveals a welcome message.
 */
@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  selector: 'app-login-form',
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label for="email">Email</label>
      <input
        id="email"
        type="email"
        formControlName="email"
        placeholder="you@example.com"
      />
      @if (form.controls['email'].invalid && form.controls['email'].touched) {
        <p role="alert">Valid email is required.</p>
      }

      <label for="password">Password</label>
      <input
        id="password"
        type="password"
        formControlName="password"
        placeholder="••••••••"
      />
      @if (
        form.controls['password'].invalid && form.controls['password'].touched
      ) {
        <p role="alert">Password must be at least 8 characters.</p>
      }

      <button type="submit" [disabled]="form.invalid">Sign in</button>
    </form>

    @if (submitted()) {
      <p role="status">Welcome, {{ form.controls['email'].value }}!</p>
    }
  `,
})
export class LoginForm {
  private readonly fb = inject(FormBuilder);
  protected readonly submitted = signal(false);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit() {
    if (this.form.valid) {
      this.submitted.set(true);
    }
  }
}
