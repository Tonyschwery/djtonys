#!/usr/bin/env node
/**
 * scripts/post-to-social.cjs
 *
 * Takes the blog post that generate-blog.cjs just created and pushes it out to
 * the Facebook page and Threads automatically, using Buffer's GraphQL API.
 *
 * This runs as a SEPARATE step in the GitHub Action, AFTER the new post has
 * been committed and pushed — because the header image needs to be reachable
 * at a real public URL, and that only exists once the push lands and Netlify
 * has rebuilt.
 *
 * Requires: Node 20+ (built-in fetch). No npm dependencies.
 *
 * Environment:
 *   BUFFER_ACCESS_TOKEN   (required) — GitHub repository secret
 *   SITE_URL              (optional) — defaults to https://djtonys.net
 *   FB_CHANNEL_ID         (optional) — overrides the value below
 *   THREADS_CHANNEL_ID    (optional) — overrides the value below
 *
 * Reads (from the GITHUB_OUTPUT values generate-blog.cjs already wrote):
 *   POST_SLUG, POST_TITLE, POST_IMAGE, POST_EXCERPT
 */

const BUFFER_API_URL = 'https://api.buffer.com';
const SITE_URL = (process.env.SITE_URL || 'https://djtonys.net').replace(/\/$/, '');

// ---------------------------------------------------------------------------
// Channel IDs, fetched from the Buffer API on 28 July 2026.
//
// These are not secret — they only identify WHICH channel, not who may post
// to it (that's what the API key is for) — so it's fine to keep them in the
// code. You can override either one with a GitHub repo variable if a channel
// is ever reconnected and gets a new ID.
//
// To re-fetch them later:  node scripts/list-buffer-channels.cjs
//
// Instagram is deliberately NOT posted to. Its channel ID is
// 6a68d4384b2d03035f57d61a if you ever want to turn it on.
// ---------------------------------------------------------------------------
const CHANNELS = {
  // "Dj Tony schwery" Facebook page
  facebook: process.env.FB_CHANNEL_ID || '6a68d6424b2d03035f57e671',
  // "djtonyschwery_music" on Threads
  threads: process.env.THREADS_CHANNEL_ID || '6a68d5264b2d03035f57decd',
};

function log(message) {
  console.log(`[post-to-social] ${message}`);
}

function warn(message) {
  console.warn(`[post-to-social] WARNING: ${message}`);
}

function fail(message) {
  console.error(`\n[post-to-social] ERROR: ${message}\n`);
  process.exit(1);
}

/** Runs one GraphQL request against the Buffer API. */
async function bufferRequest(token, query, variables) {
  const response = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = await response.json();

  if (body.errors && body.errors.length > 0) {
    throw new Error(body.errors.map((e) => e.message).join('; '));
  }

  return body.data;
}

const CREATE_POST_MUTATION = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess {
        post { id text }
      }
      ... on MutationError {
        message
      }
    }
  }
`;

/**
 * Creates one post on one channel. Never throws — a failure on one platform
 * shouldn't stop the other from posting. Returns true/false for the summary.
 */
async function postToChannel(token, { channelId, label, text, imageUrl, metadata }) {
  if (!channelId || channelId.startsWith('PASTE_')) {
    warn(`${label}: no channel ID configured — skipped.`);
    return false;
  }

  // Buffer changed this on 25 May 2026: `assets` is now a required list,
  // so text-only posts must send an empty array rather than omitting it.
  const input = {
    text,
    channelId,
    schedulingType: 'automatic',
    mode: 'shareNow',
    assets: imageUrl ? [{ image: { url: imageUrl } }] : [],
  };

  // Channel-specific settings. Facebook REQUIRES this: its `type` field is
  // non-nullable, and without it Buffer rejects the post with
  // "Facebook posts require a type (post, story, or reel)."
  // Threads has no equivalent requirement, which is why it always worked.
  if (metadata) {
    input.metadata = metadata;
  }

  try {
    const data = await bufferRequest(token, CREATE_POST_MUTATION, { input });
    const result = data.createPost;

    if (result && result.message) {
      // Buffer's MutationError shape — a handled, expected failure.
      warn(`${label}: ${result.message}`);
      return false;
    }

    log(`${label}: queued successfully (post id ${result.post.id})`);
    return true;
  } catch (error) {
    warn(`${label}: ${error.message}`);
    return false;
  }
}

function buildPostUrl(slug) {
  return `${SITE_URL}/blog/${slug}/`;
}

async function main() {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) {
    fail('BUFFER_ACCESS_TOKEN is not set. Add it as a GitHub repository secret.');
  }

  const slug = process.env.POST_SLUG || '';
  const title = process.env.POST_TITLE || '';
  const excerpt = process.env.POST_EXCERPT || '';
  const image = process.env.POST_IMAGE || ''; // e.g. /blog-images/foo-abcd1234.jpg

  if (!slug || !title) {
    log('No new post was published today (slug/title missing) — nothing to post. Exiting cleanly.');
    return;
  }

  const postUrl = buildPostUrl(slug);
  const imageUrl = image ? `${SITE_URL}${image}` : '';

  log(`Posting "${title}" to Facebook and Threads...`);
  log(`Article link: ${postUrl}`);
  if (imageUrl) log(`Image: ${imageUrl}`);

  const results = [];

  // --- Facebook page: full caption, link, and image if we have one --------
  results.push(
    await postToChannel(token, {
      channelId: CHANNELS.facebook,
      label: 'Facebook',
      text: `${title}\n\n${excerpt}\n\nRead the full article: ${postUrl}`,
      imageUrl,
      metadata: { facebook: { type: 'post' } },
    })
  );

  // --- Threads: short text plus link works best here ----------------------
  results.push(
    await postToChannel(token, {
      channelId: CHANNELS.threads,
      label: 'Threads',
      text: `${title}\n\n${postUrl}`,
    })
  );

  const succeeded = results.filter(Boolean).length;
  log(`Done: ${succeeded}/${results.length} platform(s) queued successfully.`);

  // Non-fatal by design — a social posting hiccup should never fail the
  // whole workflow or block tomorrow's run.
}

main().catch((error) => {
  warn(error.stack || error.message);
  // Exit 0 on purpose: social posting is a bonus step, not a blocker.
  process.exit(0);
});
