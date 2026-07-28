#!/usr/bin/env node
/**
 * scripts/list-buffer-channels.cjs
 *
 * A one-time helper. Run this on your own computer to find the channel IDs
 * for the accounts you've connected to Buffer, so you can paste them into
 * scripts/post-to-social.cjs.
 *
 * Channel IDs are not secret — they only say WHICH account, not who may post
 * to it. The API key is the secret part.
 *
 * How to run it (Windows PowerShell):
 *   $env:BUFFER_ACCESS_TOKEN="paste-your-key-here"
 *   node scripts/list-buffer-channels.cjs
 *
 * How to run it (Git Bash / Mac / Linux):
 *   BUFFER_ACCESS_TOKEN="paste-your-key-here" node scripts/list-buffer-channels.cjs
 */

const BUFFER_API_URL = 'https://api.buffer.com';

async function bufferRequest(token, query) {
  const response = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  const body = await response.json();

  if (body.errors && body.errors.length > 0) {
    throw new Error(body.errors.map((e) => e.message).join('; '));
  }

  return body.data;
}

const ORGANIZATIONS_QUERY = `
  query GetOrganizations {
    account {
      email
      organizations {
        id
        name
      }
    }
  }
`;

function channelsQuery(organizationId) {
  return `
    query GetChannels {
      channels(input: { organizationId: "${organizationId}" }) {
        id
        name
        displayName
        service
      }
    }
  `;
}

async function main() {
  const token = process.env.BUFFER_ACCESS_TOKEN;

  if (!token) {
    console.error('\nERROR: BUFFER_ACCESS_TOKEN is not set.\n');
    console.error('Windows PowerShell:');
    console.error('  $env:BUFFER_ACCESS_TOKEN="your-key"');
    console.error('  node scripts/list-buffer-channels.cjs\n');
    process.exit(1);
  }

  const orgData = await bufferRequest(token, ORGANIZATIONS_QUERY);
  const organizations = orgData?.account?.organizations || [];

  if (organizations.length === 0) {
    console.log('\nNo organizations found for this key.\n');
    return;
  }

  for (const org of organizations) {
    console.log(`\nOrganization: ${org.name}  (id: ${org.id})`);
    console.log('-'.repeat(60));

    const channelData = await bufferRequest(token, channelsQuery(org.id));
    const channels = channelData?.channels || [];

    if (channels.length === 0) {
      console.log('  No channels connected. Connect Facebook and Threads in Buffer first.');
      continue;
    }

    for (const channel of channels) {
      console.log(`  service:  ${channel.service}`);
      console.log(`  name:     ${channel.displayName || channel.name}`);
      console.log(`  id:       ${channel.id}`);
      console.log('');
    }
  }

  console.log('Copy the "id" values for facebook and threads into');
  console.log('scripts/post-to-social.cjs, in the CHANNELS block near the top.\n');
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}\n`);
  console.error('If it mentions authentication, the key is wrong or expired.\n');
  process.exit(1);
});
