# Auth Flow Checklist

## Required Environment Variables

### API
- `JWT_SECRET`
- `API_BASE_URL`
- `WEB_APP_URL`
- `CORS_ORIGIN`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Web
- `NEXT_PUBLIC_API_URL`

## Seeded Login

- Email: `seed.alex@devoverflow.dev`
- Password: `Password123!`

## Manual Verification

1. Sign up with a new username, email, and password.
2. Sign in with the seeded local account and confirm the app shell updates to the signed-in state.
3. Sign out from the left sidebar and confirm protected routes redirect back to `sign-in`.
4. Open `/questions/ask` while signed out and confirm the redirect preserves the `next` URL.
5. Trigger forgot password and confirm the check-email screen renders the preview reset link in non-production.
6. Open the reset link, submit a new password, and confirm the session is restored.
7. Start GitHub sign-in and Google sign-in with valid provider credentials.
8. Confirm a first-time social user is created and redirected back to the requested route.
9. Confirm an existing local-email match redirects to `/account-link-conflict`.
10. Accept account linking and confirm the provider account is attached and a session is created.
11. Verify `/auth/me` returns `401` while signed out and the current user payload while signed in.
