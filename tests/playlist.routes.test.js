import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import playlistRouter from '../src/routes/playlist.routes.js';

test('playlist router matches /api/playlist/:playlistId and returns auth error instead of 404', async () => {
  const app = express();
  app.use('/api/playlist', playlistRouter);

  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/playlist/abc123`, {
      headers: {
        Authorization: 'Bearer invalid-token'
      }
    });

    assert.notEqual(response.status, 404, 'Expected route to exist for /api/playlist/:playlistId');
    assert.equal(response.status, 401, 'Expected auth middleware to reject invalid token');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('playlist router exposes DELETE /api/playlist/:playlistId', async () => {
  const app = express();
  app.use('/api/playlist', playlistRouter);

  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/playlist/abc123`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer invalid-token'
      }
    });

    assert.equal(response.status, 401, 'Expected auth middleware to protect playlist deletion');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
