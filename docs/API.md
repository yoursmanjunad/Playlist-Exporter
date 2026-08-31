# Ship Your Playlists API

The machine-readable API contract is [openapi.yaml](openapi.yaml). Import it into Postman, Insomnia, Swagger UI, or any OpenAPI-compatible client.

## Base URL and authentication

The development server listens on `http://localhost:3000` unless `PORT` is set. Protected endpoints accept either `Authorization: Bearer <access-token>` or the HttpOnly `accessToken` cookie. Register and login return the token in JSON and set `accessToken` (15 minutes) and `refreshToken` (7 days) cookies.

Browser clients must send credentials (`fetch(..., { credentials: 'include' })`). The authentication middleware can automatically renew an expired access cookie when a valid refresh cookie is available.

## Typical transfer flow

1. `POST /api/auth/register` or `POST /api/auth/login`.
2. Open `GET /api/oauth/spotify-login` and `GET /api/oauth/youtube-login` in the browser to connect both services.
3. Confirm connections with the two `*-status` endpoints.
4. `GET /api/playlist/spotify` to import the Spotify playlist list.
5. `GET /api/playlist/spotify/{spotifyPlaylistId}` to import a playlist's tracks.
6. Optionally inspect candidates with `GET /api/sync/preview-matches/{playlistId}`.
7. `POST /api/sync/generate-matches/{playlistId}` to create and persist the matches. This replaces existing matches for that playlist.
8. `POST /api/sync/create-youtube-playlist/{playlistId}` to create the YouTube playlist and transfer the saved matched tracks.

For sync endpoints, `{playlistId}` accepts the cached MongoDB playlist ID or the Spotify playlist ID. The playlist-track import endpoints only accept a Spotify playlist ID.

## Notes

- The OAuth callbacks are public provider redirect targets; do not call them directly except when testing an OAuth response.
- `/api/playlist/{playlistId}` and `/api/sync/transfer-playlist/{playlistId}` remain supported as deprecated aliases.
- `/api/sync/matchplaylistTrack/{playlistId}` is a diagnostic endpoint that returns raw candidates and does not persist match records.
- `/api/test-search` is a development diagnostic with a fixed query and should not be used as a general search API.
