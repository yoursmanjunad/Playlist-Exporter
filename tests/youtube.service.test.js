import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { google } from 'googleapis';
import connectedAccount from '../src/models/connectedAccount.models.js';
import { getYouTubeClient } from '../src/services/youtube/youtube.service.js';
import { getYouTubeStatus } from '../src/controllers/oauth.controllers.js';
import { createYouTubePlaylist } from '../src/services/youtube/createPlaylist.js';

test('getYouTubeStatus should report connected when a YouTube account exists', async () => {
  const originalFindOne = connectedAccount.findOne;

  try {
    const objectId = new mongoose.Types.ObjectId('64f000000000000000000123');
    connectedAccount.findOne = async (query) => {
      assert.equal(query.userId, objectId.toString());
      return {
        userId: objectId.toString(),
        provider: 'youtube',
        providerAccountId: 'channel-123',
        providerDisplayName: 'My Channel',
        providerEmail: 'user@example.com',
        providerAvatarUrl: 'https://example.com/avatar.png',
        accessToken: 'encrypted-access-token',
        status: 'connected',
        tokenExpiresAt: new Date(Date.now() + 3600_000)
      };
    };

    const req = { user: { _id: objectId } };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      }
    };

    await getYouTubeStatus(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.connected, true);
    assert.equal(res.payload.account.providerDisplayName, 'My Channel');
  } finally {
    connectedAccount.findOne = originalFindOne;
  }
});

test('createYouTubePlaylist should use an OAuth2 client with credentials', async () => {
  const originalOAuth2 = google.auth.OAuth2;
  const originalYoutube = google.youtube;

  try {
    google.auth.OAuth2 = class {
      constructor() {
        this.credentials = null;
      }
      setCredentials(credentials) {
        this.credentials = credentials;
      }
    };

    google.youtube = ({ auth }) => {
      if (!auth || typeof auth.setCredentials !== 'function') {
        throw new Error('Expected OAuth2 client with setCredentials');
      }

      return {
        playlists: {
          insert: async () => ({
            data: {
              id: 'playlist-123',
              snippet: { title: 'Playlist title', description: 'Playlist description' }
            }
          })
        }
      };
    };

    const result = await createYouTubePlaylist({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      name: 'Playlist title',
      description: 'Playlist description'
    });

    assert.equal(result.playlistId, 'playlist-123');
  } finally {
    google.auth.OAuth2 = originalOAuth2;
    google.youtube = originalYoutube;
  }
});

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
