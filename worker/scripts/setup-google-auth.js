#!/usr/bin/env node
/**
 * One-time script to get a Google OAuth refresh token for the Cloudflare Worker.
 * Run: node scripts/setup-google-auth.js
 *
 * Prerequisites:
 *   1. Create a Google Cloud project at https://console.cloud.google.com
 *   2. Enable the Google Calendar API
 *   3. Create OAuth 2.0 credentials (Desktop app type)
 *   4. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET below (or as env vars)
 */

import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:9876/oauth/callback';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
  console.error('  export GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com');
  console.error('  export GOOGLE_CLIENT_SECRET=your-client-secret');
  process.exit(1);
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

console.log('\n🔐 Google Calendar OAuth Setup\n');
console.log('Opening browser for authorization...');
console.log('If browser does not open, visit:\n', authUrl.toString(), '\n');

// Open browser
const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
execAsync(`${openCmd} "${authUrl.toString()}"`).catch(() => {});

// Start local server to capture the callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:9876`);
  if (url.pathname !== '/oauth/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h1>Authorization denied: ${error}</h1>`);
    server.close();
    process.exit(1);
  }

  try {
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResp.json();

    if (!tokens.refresh_token) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Error: No refresh token received. Delete the app in Google account settings and try again.</h1>');
      server.close();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>✅ Authorization complete! Check your terminal.</h1>');
    server.close();

    console.log('\n✅ Authorization successful!\n');
    console.log('Add these secrets to your Cloudflare Worker:\n');
    console.log(`  wrangler secret put GOOGLE_CLIENT_ID`);
    console.log(`    → ${CLIENT_ID}\n`);
    console.log(`  wrangler secret put GOOGLE_CLIENT_SECRET`);
    console.log(`    → ${CLIENT_SECRET}\n`);
    console.log(`  wrangler secret put GOOGLE_REFRESH_TOKEN`);
    console.log(`    → ${tokens.refresh_token}\n`);
    console.log('Or add to .dev.vars for local development:');
    console.log(`  GOOGLE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`  GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`  GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\nAlso set GOOGLE_CALENDAR_ID to your Gmail address.');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>Error: ${err.message}</h1>`);
    server.close();
    process.exit(1);
  }
});

server.listen(9876, () => {
  console.log('Waiting for authorization callback on http://localhost:9876...');
});
