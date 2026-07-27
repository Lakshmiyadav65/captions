# Production Google OAuth (audience launch)

Caplio on Vercel is configured for **real sign-in**:

| Variable | Production value |
|----------|------------------|
| `AUTH_ENABLED` | `true` |
| `AUTH_DEV_LOGIN` | `false` (no open email login) |
| `AUTH_SECRET` | strong random (rotated) |
| `AUTH_URL` / `APP_URL` | `https://captions-gilt.vercel.app` |

**Still required from you:** Google OAuth Client ID + Secret. Without them, “Start free” opens sign-in but there is no Google button.

## 1. Create the Google OAuth client

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create project (or pick an existing one) → **Configure OAuth consent screen**
   - User type: **External**
   - App name: Caplio (or Telugu Captions)
   - Support email: yours
   - Add scopes: `email`, `profile`, `openid` (default)
   - Test users: add yourself while status is **Testing**, or publish the app for all users
3. **Create credentials → OAuth client ID → Web application**
4. Authorized JavaScript origins:
   - `https://captions-gilt.vercel.app`
5. Authorized redirect URIs (exact):
   - `https://captions-gilt.vercel.app/api/auth/callback/google`
6. Copy **Client ID** and **Client secret**.

## 2. Add secrets to Vercel

In the Vercel project → **Settings → Environment Variables** (Production + Preview):

```
AUTH_GOOGLE_ID=<client id>
AUTH_GOOGLE_SECRET=<client secret>
STRICT_PROD_AUTH=true
```

Or CLI:

```bash
echo "YOUR_CLIENT_ID" | npx vercel env add AUTH_GOOGLE_ID production
echo "YOUR_CLIENT_SECRET" | npx vercel env add AUTH_GOOGLE_SECRET production
# repeat for preview
echo "true" | npx vercel env add STRICT_PROD_AUTH production
```

Then **Redeploy** production.

## 3. Verify

1. Open `https://captions-gilt.vercel.app`
2. Click **Start free** → should land on sign-in
3. **Continue with Google** → consent → back to home upload section
4. Upload should work while signed in; signed-out upload returns to sign-in

## Optional: GitHub

Same pattern with `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` and callback:

`https://captions-gilt.vercel.app/api/auth/callback/github`

Google alone is enough for a Telugu creator audience.
