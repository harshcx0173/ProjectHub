import { test, expect } from '@playwright/test';

test.describe('Phase 1 Core End-to-End User Journeys', () => {
  test('1. Auth Gate & Signup Denial: Public signup is strictly disabled', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Project Hub/);

    // Verify login form elements
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Assert that no "Sign up" or "Register" link exists on the page
    const signupLinks = page.locator('a:has-text("Sign up"), a:has-text("Register"), a:has-text("Create account")');
    await expect(signupLinks).toHaveCount(0);
  });

  test('2. Two-Factor Authentication (2FA) Gate and Verification UI', async ({ page }) => {
    await page.goto('/auth/2fa');
    // Verifies 2FA challenge screen loads with 6-digit passcode input
    await expect(page.locator('text=Two-Factor Authentication')).toBeVisible();
    const tokenInput = page.locator('input[type="text"], input[inputmode="numeric"]');
    await expect(tokenInput).toBeVisible();
  });

  test('3. Invitation Flow: Invalid or expired token is cleanly rejected', async ({ page }) => {
    await page.goto('/invite/accept?token=invalid-expired-mock-token-12345');
    // Verify user is redirected to the invalid invite error page
    await expect(page).toHaveURL(/.*invite\/invalid/);
    await expect(page.locator('text=Invalid or Expired Invitation')).toBeVisible();
  });

  test('4. Security & Role Restriction: Non-authenticated user cannot access Admin Console', async ({ page }) => {
    await page.goto('/admin');
    // Middleware must intercept and redirect to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('5. Deactivated User Access Revocation', async ({ page }) => {
    await page.goto('/login?error=deactivated');
    // Verifies clear error message is shown to disabled users
    await expect(page.locator('text=Your account has been deactivated')).toBeVisible();
  });

  test('6. PWA Manifest & Service Worker Registration', async ({ page }) => {
    await page.goto('/login');
    // Verify manifest link exists in head
    await expect(page.locator('link[rel="manifest"]')).toBeAttached();
    // Verify sw.js is accessible
    const response = await page.request.get('/sw.js');
    expect(response.status()).toBe(200);
  });
});

