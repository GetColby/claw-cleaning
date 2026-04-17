// OpenClaw plugin entry for claw.cleaning.
//
// The plugin ships the `apartment-cleaning` skill (see ./skills/apartment-cleaning)
// and registers the remote MCP server at https://claw.cleaning/mcp as a provider
// so the agent can call its tools without any local CLI.
//
// The MCP service is hosted separately (worker/) and is not touched by this plugin —
// we only declare a connection to it.

import { definePluginEntry } from '@openclaw/plugin-sdk';

const DEFAULT_MCP_URL = 'https://claw.cleaning/mcp';

export default definePluginEntry(({ api, config }) => {
  const serverUrl = (config && config.serverUrl) || DEFAULT_MCP_URL;

  // Register the remote MCP server. The exact registration method on the
  // plugin API surface is not yet pinned down in the public OpenClaw docs we
  // have on hand (docs.openclaw.ai/plugins/manifest, /plugins/building-plugins).
  // The call below matches the naming pattern used by other OpenClaw
  // provider registrations — adjust the method name once confirmed against
  // the SDK types.
  api.registerMcpServer({
    id: 'claw-cleaning',
    transport: 'streamable-http',
    url: serverUrl,
    // No auth — claw.cleaning/mcp is an open endpoint. Bookings require only
    // customer-supplied name/email/address; no credentials are exchanged.
    auth: null,
    tools: [
      'check_availability',
      'initiate_booking',
      'force_checkout_booking',
      'check_booking_status',
    ],
    description: 'Book a San Francisco apartment cleaning. $40/hour, weekends only.',
  });

  return {
    async dispose() {
      // Nothing to clean up — registration is declarative and torn down by
      // the host when the plugin is disabled.
    },
  };
});
