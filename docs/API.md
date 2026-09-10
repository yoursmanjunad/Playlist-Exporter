# Ship Your Playlists API

The machine-readable API contract is [openapi.yaml](openapi.yaml). Import it into Postman, Insomnia, Swagger UI, or any OpenAPI-compatible client.

## Base URL and authentication

The development server listens on `http://localhost:3000` unless `PORT` is set. Protected endpoints accept either `Authorization: Bearer <access-token>` or the HttpOnly `accessToken` cookie. Register and login return the token in JSON and set `accessToken` (15 minutes) and `refreshToken` (7 days) cookies.

Browser clients must send credentials (`fetch(..., { credentials: 'include' })`). The authentication middleware can automatically renew an expired access cookie when a valid refresh cookie is available.

## Profile API

All profile endpoints require authentication.

- `GET /api/auth/get-me` returns `user.avatarUrl` and `user.transferredPlaylists`. The transfer count is the number of completed YouTube playlist records created from the user's imported playlists.
- `PATCH /api/auth/profile` accepts JSON fields `name`, `email`, `currentPassword`, and `newPassword`. Send at least one of `name`, `email`, or `newPassword`. Password changes require the current password and a new password of at least 8 characters. Email addresses are normalized to lowercase.
- `PUT /api/auth/profile/photo` accepts `multipart/form-data` with an image field named `photo`. JPEG, PNG, WebP, and GIF files are accepted up to 5 MB. The response contains the Cloudinary HTTPS `avatarUrl`.
- Profile photos are uploaded to Cloudinary using `CLOUDINARY_URI`; `avatarUrl` contains the Cloudinary HTTPS URL. Configure the value in Cloudinary URL format: `cloudinary://<api_key>:<api_secret>@<cloud_name>`.
- If this value is missing or malformed, the upload endpoint returns `503` with a configuration message. Do not use only the API key, API secret, or cloud name as `CLOUDINARY_URI`.
- `DELETE /api/auth/account` permanently deletes the authenticated account, connected OAuth accounts, cached playlists, tracks, and matches. Send `{ "confirmation": "DELETE", "currentPassword": "..." }`. OAuth-only accounts do not need `currentPassword`. This does not delete playlists already created on Spotify or YouTube.
- `DELETE /api/playlist/{playlistId}` deletes the authenticated user's cached Spotify playlist by MongoDB ID or Spotify playlist ID, including its local tracks, matches, and linked destination records. It does not delete the remote Spotify or YouTube playlist.

Registration creates an unverified account and sends a verification email through Resend. `GET /api/auth/verify-email?token=...` verifies the account and starts the session. Login is rejected until verification succeeds. Password changes require the current password and send a security notification email through Resend after the change.

- `POST /api/auth/forgot-password` accepts `{ "email": "..." }` and sends a one-hour reset link without revealing whether the address exists.
- `POST /api/auth/reset-password` accepts `{ "token": "...", "newPassword": "..." }`, consumes the one-time token, changes the password, sends a security notification, and starts a new session.

Example profile update:

```http
PATCH /api/auth/profile
Content-Type: application/json
Authorization: Bearer <access-token>

{"name":"Ada Lovelace","email":"ada@example.com","currentPassword":"old-password","newPassword":"new-password-123"}
```

Example photo upload:

```bash
curl -X PUT http://localhost:5000/api/auth/profile/photo \
	-H "Authorization: Bearer <access-token>" \
	-F "photo=@avatar.png"
```

## Typical transfer flow

1. `POST /api/auth/register` or `POST /api/auth/login`.
2. Open `GET /api/oauth/spotify-login` and `GET /api/oauth/youtube-login` in the browser to connect both services.
3. Confirm connections with the two `*-status` endpoints.
4. `GET /api/playlist/spotify` to import the Spotify playlist list.
5. `GET /api/playlist/spotify/{spotifyPlaylistId}` to import a playlist's tracks.
6. Optionally inspect candidates with `GET /api/sync/preview-matches/{playlistId}`.
7. `POST /api/sync/generate-matches/{playlistId}` to create and persist the matches. This replaces existing matches for that playlist.
8. `POST /api/sync/create-youtube-playlist/{playlistId}` to create the YouTube playlist and transfer the saved matched tracks.

Free accounts can export up to 100 tracks per calendar month. A playlist larger than the remaining allowance is exported only up to the remaining number of credits. Premium accounts have unlimited track exports. The authenticated user returned by `GET /api/auth/get-me` includes:

```json
{
	"usage": {
		"plan": "free",
		"period": "monthly",
		"tracksExported": 25,
		"tracksLimit": 100,
		"tracksRemaining": 75,
		"playlistsTransferred": 2,
		"playlistsLimit": null,
		"resetAt": "2026-10-01T00:00:00.000Z"
	}
}
```

The transfer response includes the same `usage` object. When no free track credits remain, the transfer endpoint returns `429` with `code: "TRACK_CREDIT_LIMIT_REACHED"`.

For sync endpoints, `{playlistId}` accepts the cached MongoDB playlist ID or the Spotify playlist ID. The playlist-track import endpoints only accept a Spotify playlist ID.

`GET /api/playlist` returns the current user's already imported Spotify playlists without contacting Spotify. Use it to render a returning user's playlist list before offering a refresh.

The home-page playlist response is cached in Redis for 5 minutes per user and device. Send a stable device identifier on every playlist request:

```http
X-Device-ID: browser-installation-id
```

Example:

```js
const playlistsResponse = await fetch("http://localhost:5000/api/playlist", {
	credentials: "include",
	headers: { "X-Device-ID": deviceId }
});
```

The backend uses the authenticated user ID plus a SHA-256 hash of `X-Device-ID` as the Redis key. Redis is optional; if unavailable, the endpoint falls back to MongoDB. Configure it with `REDIS_URL=redis://localhost:6379` or a managed Redis URL. The response includes `cache: "redis"` for a cache hit and `cache: "database"` after a database read.

## Stripe billing

Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PREMIUM_MONTHLY_PRICE_ID`, and `STRIPE_PREMIUM_YEARLY_PRICE_ID` in the backend environment.

- `GET /api/billing/status` returns the current subscription state.
- `POST /api/billing/checkout-session` with `{ "plan": "premium_monthly" }` or `{ "plan": "premium_yearly" }` returns a hosted Stripe `checkoutUrl`.
- `POST /api/billing/portal-session` returns a Stripe customer portal URL.
- `POST /api/billing/webhook` receives signed Stripe events and synchronizes subscription state.

Redirect the browser to the returned `checkoutUrl` or `portalUrl`. After returning from Checkout, call `/api/billing/status` to refresh the UI.

## Notes

- The OAuth callbacks are public provider redirect targets; do not call them directly except when testing an OAuth response.
- Set `FRONTEND_URL` in the backend environment to the frontend callback page (for example, `http://localhost:3000/home`). Browser OAuth callbacks redirect there with `?connected=spotify` or `?connected=youtube`.
- `/api/playlist/{playlistId}` and `/api/sync/transfer-playlist/{playlistId}` remain supported as deprecated aliases.
- `/api/sync/matchplaylistTrack/{playlistId}` is a diagnostic endpoint that returns raw candidates and does not persist match records.
- `/api/test-search` is a development diagnostic with a fixed query and should not be used as a general search API.
