import test from 'node:test';
import assert from 'node:assert/strict';
import { google } from 'googleapis';
import connectedAccount from '../src/models/connectedAccount.models.js';
import { getYouTubeClient } from '../src/services/youtube/youtube.service.js';

test('getYouTubeClient should build a client without throwing when account exists', async () => {
  const originalFindOne = connectedAccount.findOne;
  const originalOAuth2 = google.auth.OAuth2;
  const originalYoutube = google.youtube;

  try {
    connectedAccount.findOne = () => ({
      select: () => ({
        _id: 'account123',
        userId: 'user123',
        provider: 'youtube',
        status: 'connected',
        accessToken: 'encrypted-access-token',
        refreshToken: 'encrypted-refresh-token',
        tokenExpiresAt: new Date(Date.now() + 3600_000)
      })
    });

    google.auth.OAuth2 = class {
      constructor() {}
      setCredentials() {}
      on() {}
    };

    google.youtube = () => ({ ok: true });

    const client = await getYouTubeClient('user123');

    assert.deepEqual(client, { ok: true });
  } finally {
    connectedAccount.findOne = originalFindOne;
    google.auth.OAuth2 = originalOAuth2;
    google.youtube = originalYoutube;
  }
});
