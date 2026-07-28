#!/usr/bin/env node
/**
 * scripts/generate-blog.js
 *
 * Daily SEO post generator for djtony.qa (Tony Schwery).
 *
 * 1. Asks Claude for a trending, relevant topic we haven't covered, and writes
 *    a full Markdown article. Research is done with Brave Search, called
 *    directly from this script via a tool-use loop.
 * 2. Analyses that article to detect its genre and mood.
 * 3. Builds a genre-matched, ultra-realistic image prompt.
 * 4. Generates the image with Cloudflare Workers AI, falling back to
 *    Pollinations if Cloudflare is unavailable.
 * 5. Saves the image to public/blog-images/ and links it in the frontmatter.
 *
 * Requires: Node 20+ (uses built-in fetch). No npm dependencies.
 *
 * Environment:
 *   ANTHROPIC_API_KEY  (required) — GitHub repository secret
 *   BRAVE_API_KEY      (required for research) — GitHub repository secret.
 *                                   Without it the post is still written, but
 *                                   from the model's own knowledge, ungrounded.
 *   CF_ACCOUNT_ID      (optional) — Cloudflare Workers AI, primary image source
 *   CF_API_TOKEN       (optional) — pairs with CF_ACCOUNT_ID
 *   ANTHROPIC_MODEL    (optional) — defaults to claude-sonnet-5
 *   CF_IMAGE_MODEL     (optional) — override the Cloudflare image model
 *   DRAFT_MODE         (optional) — "true" writes posts with draft: true
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search';

// --- Adapted for djtony.qa's folder layout ---
const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');
const IMAGES_DIR = path.join(process.cwd(), 'public', 'blog-images');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const DRAFT_MODE = String(process.env.DRAFT_MODE).toLowerCase() === 'true';

const MAX_SEARCHES = 6;
const MAX_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function fail(message) {
  console.error(`\n[generate-blog] ERROR: ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[generate-blog] WARNING: ${message}`);
}

function log(message) {
  console.log(`[generate-blog] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70)
    .replace(/-$/, '');
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function yamlSafe(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
}

function setActionOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  const safe = String(value).replace(/\r?\n/g, ' ');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${safe}\n`);
}

// ---------------------------------------------------------------------------
// Genre presets — each one drives a distinct visual direction
// ---------------------------------------------------------------------------

const GENRE_PRESETS = {
  techno: {
    label: 'Techno',
    match: ['techno', 'hard techno', 'industrial', 'peak time', 'warehouse'],
    visual:
      'a dark underground industrial club, raw concrete walls, moody strobe lights cutting through heavy atmospheric haze, racks of vintage hardware synthesisers and drum machines, cold steel and deep shadow, a single silhouetted figure behind the decks',
    palette: 'monochrome steel blues and stark white strobe against near-black',
  },
  'afro-house': {
    label: 'Afro House',
    match: ['afro house', 'afro-house', 'afro tech', 'afrohouse', 'tribal'],
    visual:
      'an open-air rooftop club at golden hour turning to dusk, organic warm textures, woven rattan and natural wood surfaces, vibrant tribal lighting in amber and deep orange, high-end Pioneer CDJ decks and a professional mixer, hand percussion resting beside the booth',
    palette: 'warm amber, terracotta, and burnt gold with deep indigo shadows',
  },
  'tech-house': {
    label: 'Tech House',
    match: ['tech house', 'tech-house', 'groove', 'rolling bassline'],
    visual:
      'a packed intimate basement club, low ceiling, tight crowd energy just out of focus, clean modern DJ booth with Pioneer CDJs and a rotary mixer, crisp directional spotlights, condensation and motion blur',
    palette: 'saturated magenta and cyan wash over warm skin tones',
  },
  retro: {
    label: 'Retro 70s / 80s / 90s',
    match: ['70s', '80s', '90s', 'seventies', 'eighties', 'nineties', 'retro', 'classics', 'throwback', 'oldschool', 'old school', 'vinyl'],
    visual:
      'a glamorous retro discotheque interior, a large glittering mirror ball scattering beams across a polished dance floor, warm tungsten glow, vintage turntables and a classic rotary mixer, crates of vinyl records, elegantly dressed dancers softly blurred in motion',
    palette: 'warm gold, deep burgundy, and champagne highlights',
  },
  lounge: {
    label: 'Lounge & Chillout',
    match: ['lounge', 'chillout', 'chill out', 'downtempo', 'sunset', 'yacht', 'brunch', 'dinner', 'ambient'],
    visual:
      'an elegant waterfront lounge terrace at sunset, sleek modern furniture, calm reflective water beyond, a tasteful DJ booth with a compact controller, soft warm light and gentle sea haze, refined and unhurried atmosphere',
    palette: 'soft coral, warm sand, and pale turquoise under a golden sky',
  },
  wedding: {
    label: 'Weddings & Private Events',
    match: ['wedding', 'private party', 'corporate', 'birthday', 'celebration', 'gala', 'booking', 'event'],
    visual:
      'an upscale private event ballroom at night, elegant uplighting washing the walls, a polished dance floor with a joyful crowd, a discreet professional DJ booth with premium equipment, chandeliers and refined decor',
    palette: 'champagne gold, ivory, and deep royal blue accents',
  },
  'melodic-techno': {
    label: 'Melodic Techno',
    match: ['melodic techno', 'melodic house', 'progressive', 'organic house', 'afterlife'],
    visual:
      'a vast minimal venue with a single dramatic light installation, sparse architectural geometry, a lone figure at a clean modern booth, wide cinematic framing, atmospheric depth',
    palette: 'deep midnight blue and cold white with a single warm accent',
  },
  house: {
    label: 'House',
    match: ['deep house', 'jazz house', 'disco', 'soulful', 'house music', 'house'],
    visual:
      'a classic warm wood-panelled club interior, a glowing mirror ball scattering light, vintage rotary mixer and turntables, an unhurried crowd, rich analogue warmth',
    palette: 'warm amber, deep burgundy, and soft gold',
  },
  default: {
    label: 'Electronic',
    match: [],
    visual:
      'a professional DJ booth in a modern club at peak hour, high-end Pioneer CDJ decks and mixer in sharp focus, atmospheric haze and directional stage lighting, a crowd softly blurred in the background',
    palette: 'deep charcoal with warm gold highlights',
  },
};

const GENRE_KEYS = Object.keys(GENRE_PRESETS).filter((k) => k !== 'default');

function detectGenreByKeywords(markdown) {
  const haystack = markdown.toLowerCase();
  let best = { key: 'default', score: 0 };

  for (const key of GENRE_KEYS) {
    const preset = GENRE_PRESETS[key];
    let score = 0;

    for (const term of preset.match) {
      const matches = haystack.split(term).length - 1;
      score += matches * (term.includes(' ') ? 2 : 1);
    }

    if (score > best.score) best = { key, score };
  }

  return best.key;
}

// ---------------------------------------------------------------------------
// Brave Search
// ---------------------------------------------------------------------------

let lastBraveCall = 0;

async function braveSearch(query, count = 8) {
  const apiKey = process.env.BRAVE_API_KEY;

  if (!apiKey) {
    warn('BRAVE_API_KEY is not set — search is unavailable this run.');
    return 'Search is unavailable: no API key configured. Write the article from your own knowledge and avoid citing specific figures or recent events.';
  }

  if (!query) {
    return 'No query was supplied. Send a short, specific search phrase.';
  }

  const sinceLast = Date.now() - lastBraveCall;
  if (sinceLast < 1200) await sleep(1200 - sinceLast);
  lastBraveCall = Date.now();

  log(`  Brave search: "${query}"`);

  let response;
  try {
    response = await fetch(`${BRAVE_URL}?q=${encodeURIComponent(query)}&count=${count}`, {
      headers: {
        accept: 'application/json',
        'accept-encoding': 'gzip',
        'x-subscription-token': apiKey,
      },
    });
  } catch (networkError) {
    warn(`Brave network failure: ${networkError.message}`);
    return `Search failed (network error): ${networkError.message}. Try once more, then write with what you have.`;
  }

  if (response.status === 429) {
    warn('Brave rate limit hit — pausing.');
    await sleep(3000);
    return 'Search was rate limited. Try at most one more query, then write the article with what you already have.';
  }

  if (response.status === 401 || response.status === 403) {
    warn(`Brave rejected the key (${response.status}). Check BRAVE_API_KEY.`);
    return 'Search is unavailable: the API key was rejected. Write the article from your own knowledge and avoid citing specific figures.';
  }

  if (!response.ok) {
    const text = await response.text();
    warn(`Brave returned HTTP ${response.status}.`);
    return `Search failed (HTTP ${response.status}): ${text.slice(0, 200)}`;
  }

  const data = await response.json();
  const results = data?.web?.results || [];

  if (results.length === 0) {
    return `No results found for "${query}". Try a different phrasing.`;
  }

  return results
    .slice(0, count)
    .map((result, index) => {
      const snippet = (result.description || '').replace(/<\/?strong>/g, '');
      const age = result.age || result.page_age;
      return [
        `${index + 1}. ${result.title}`,
        `   ${result.url}`,
        `   ${snippet}`,
        age ? `   Published: ${age}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

const BRAVE_TOOL = {
  name: 'brave_search',
  description:
    'Search the live web using Brave. Returns numbered results with titles, URLs, snippets and publication dates. Use it to find what people are searching for and discussing right now.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query. Keep it short and specific, like a real search.',
      },
    },
    required: ['query'],
  },
};

// ---------------------------------------------------------------------------
// Anthropic: article generation
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the in-house SEO content writer for the official website of TONY SCHWERY — a Lebanese DJ, VJ, and record producer based in Doha, Qatar, with over 20 years of experience.

WHO HE IS — keep this factually accurate, never invent credits:
- Born in Beirut. Lebanese DJ, VJ, and record producer.
- 20+ years of experience. Has released on labels including Inkognito Records, Sensual Ibiza, and Blackhole Records.
- Deep expertise across all genres, especially 70s, 80s, and 90s music.
- Has played premier clubs and festivals across the Middle East and Europe.
- Based in Doha, Qatar. Available for bookings: private parties, yacht parties, weddings, corporate events, club residencies, studio sessions, and collaborations worldwide.

BRAND VOICE — follow this precisely:
- Confident and warm. Professional but never stiff. Written from Tony's perspective where natural.
- Short, clear sentences. No marketing fluff, no hype adjectives stacked together.
- Use **bold** for the load-bearing points. Roughly one bolded phrase per section.
- Speak to the reader as someone planning an event or discovering the music ("you", "your event", "your guests").
- Name real things: Pioneer CDJs, Rekordbox, Serato, vinyl, BPM, live VJ visuals, specific venues and eras.
- Close every post by tying back to bookings — that Tony is available in Doha and worldwide, with a natural nudge toward getting in touch.

GEOGRAPHIC FOCUS — the Middle East and Gulf are the priority:
- Primary markets, in order: Doha/Qatar, Dubai and Abu Dhabi/UAE, Beirut/Lebanon.
- Secondary Gulf markets worth naming where relevant: Saudi Arabia (Riyadh, Jeddah), Bahrain, Kuwait, Oman.
- Tony is based in Doha and travels for bookings, so any of these markets is fair game. Never claim he has played a specific venue unless it is in the facts above.

TOPIC RANGE — rotate widely across these, do not keep writing the same kind of post:
- Weddings: planning, timelines, music for each part of the night, cultural expectations, Lebanese and Arabic wedding traditions, mixed Arabic/Western receptions, venue acoustics, what to ask a DJ before booking.
- Event management: budgets, vendor coordination, run-of-show, sound and lighting basics, outdoor events in Gulf heat, Ramadan and seasonal scheduling, permits and venue logistics.
- Entertainment companies and agencies: how they work in the Gulf, what they charge for, how to work with one, booking directly vs through an agency.
- Resident DJs and club culture: what a residency involves, how residencies work in Doha/Dubai/Beirut, the region's venue scene, festival culture.
- Artists and music history: DJs, producers, labels, scenes, eras. The 70s, 80s and 90s especially — this is Tony's deepest expertise.
- Music selection craft: how a DJ actually builds a set, reading a room, key and BPM matching, Camelot wheel, energy curves, when to drop a classic, programming for weddings vs clubs vs lounges, building and organising a music library, crate preparation.
- Gear and technique: Pioneer CDJs, Rekordbox, Serato, controllers, vinyl, VJ visuals and live video mixing.

KEYWORD STRATEGY:
- The commercial goal is BOOKINGS across the Gulf and Levant. High-intent phrases to work in naturally, choosing whichever fits the post: "DJ in Qatar", "DJ in Doha", "DJ in Dubai", "DJ in Beirut", "Lebanese DJ", "wedding DJ Qatar", "wedding DJ Dubai", "wedding DJ Lebanon", "private party DJ Doha", "yacht party DJ Qatar", "corporate event DJ Dubai", "book a DJ in Doha", "VJ Qatar", "event entertainment Gulf".
- Every post should pair a genuinely interesting topic with at least one of those location-plus-intent phrases.
- Prefer titles shaped like: "[Interesting topic] + [location/booking intent]". Concrete example of the right shape: "How to Pick the Right Wedding DJ in Doha: A 20-Year Veteran's Checklist" beats "Wedding Music Trends 2026".
- Work at least one Gulf or Levant location into the title or first paragraph of most posts — local search is where the bookings come from. Vary which city leads; do not put Doha in every single title.
- Do not keyword-stuff. One natural mention beats five forced ones.

OUTBOUND LINKS:
- Where a post genuinely discusses music selection, crate preparation, library organisation, or sourcing DJ-ready tracks, you may link once to https://topdjcrates.com as a useful resource for curated, DJ-ready WAV packs.
- Only do this when it is actually relevant to the paragraph. Roughly one post in three at most. Never force it, never link twice in one post, and never build a whole post around it.
- Also link out to genuinely authoritative third-party sources where you cite facts, so the post does not look like it only links to one place.

RESEARCH:
- Use the brave_search tool first to find what people are actually searching for and talking about right now. Run several searches before you start writing.
- Ground claims in the search results. Attribute figures in prose. Never invent statistics.
- Never invent Tony's gigs, awards, or releases beyond the facts listed above.
- Paraphrase everything. Do not quote sources at length.

OUTPUT FORMAT — this is critical:
When you have finished researching, return ONLY a Markdown document. No preamble, no code fences around the whole thing.
It must begin with YAML frontmatter in exactly this shape:

---
title: "A specific, compelling, search-friendly title"
date: "${'${DATE}'}"
excerpt: "One or two sentences used as the meta description and card summary."
keywords: "comma, separated, high intent, search terms"
---

Then the article body in pure Markdown.

BODY RULES:
- 900-1500 words.
- Do NOT repeat the title as a heading — the site renders it from frontmatter.
- Use ## and ### headings that read like real search queries where natural.
- Pure Markdown only. No raw HTML tags.
- Include at least one numbered or bulleted list of practical points.`;

function buildUserPrompt(existingPosts) {
  const alreadyCovered = existingPosts.length
    ? existingPosts.map((p) => `- ${p.title}`).join('\n')
    : '- (nothing published yet)';

  return `Write today's blog post for the Tony Schwery official website.

Today's date is ${todayISO()}.

Search the web to identify ONE genuinely interesting, relevant topic — something people planning events in Qatar, the UAE, Lebanon or the wider Gulf, or music fans following the region's scene, would actually search for right now. Then write the full article on it.

Deliberately vary your choice from post to post. Rotate across the topic range and across the different markets — do not default to Doha weddings every time. Look at the list below and pick something clearly different from what is already there, in both subject and city.

We have ALREADY published the following:
${alreadyCovered}

Return only the Markdown document, starting with the frontmatter block.`;
}

async function callAnthropicRaw(apiKey, body, label) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`Anthropic ${label} (attempt ${attempt}/${maxAttempts})...`);

    let response;
    try {
      response = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (networkError) {
      if (attempt === maxAttempts) throw new Error(`Network failure: ${networkError.message}`);
      await sleep(attempt * 5000);
      continue;
    }

    if (response.ok) {
      return await response.json();
    }

    const errorBody = await response.text();

    if (response.status === 401 || response.status === 403) {
      fail(`Anthropic auth failed (${response.status}). Check ANTHROPIC_API_KEY.\n${errorBody}`);
    }
    if (response.status === 400) {
      fail(`Anthropic bad request (400) — often an invalid model name.\n${errorBody}`);
    }
    if (attempt === maxAttempts) {
      throw new Error(`Anthropic request failed (${response.status}).\n${errorBody}`);
    }

    await sleep(attempt * 10000);
  }
}

async function callAnthropic(apiKey, body, label) {
  const data = await callAnthropicRaw(apiKey, body, label);
  return (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}

async function generateArticle(apiKey, existingPosts) {
  const messages = [{ role: 'user', content: buildUserPrompt(existingPosts) }];
  let searchesUsed = 0;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const data = await callAnthropicRaw(
      apiKey,
      {
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT.replace('${DATE}', todayISO()),
        messages,
        tools: [BRAVE_TOOL],
      },
      `article round ${round}`
    );

    const blocks = data.content || [];
    const toolUses = blocks.filter((block) => block.type === 'tool_use');

    if (data.stop_reason !== 'tool_use' || toolUses.length === 0) {
      log(`Article written after ${searchesUsed} search(es).`);
      return blocks
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();
    }

    messages.push({ role: 'assistant', content: blocks });

    const toolResults = [];
    for (const toolUse of toolUses) {
      let result;

      if (searchesUsed >= MAX_SEARCHES) {
        result =
          'Search budget for this run is exhausted. Write the full article now using what you have already found.';
      } else {
        searchesUsed++;
        result = await braveSearch(String(toolUse.input?.query || '').trim());
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  throw new Error(
    `Article generation did not finish within ${MAX_ROUNDS} rounds. Aborting rather than publishing a partial post.`
  );
}

// ---------------------------------------------------------------------------
// Step 2: analyse the finished article for genre + mood
// ---------------------------------------------------------------------------

async function analyseArticle(apiKey, markdown) {
  const keywordGenre = detectGenreByKeywords(markdown);

  const prompt = `Read this blog article and classify it.

Return ONLY a JSON object, no code fences, no commentary, in exactly this shape:
{"genre": "<one of: ${GENRE_KEYS.join(', ')}>", "mood": "<3-8 words describing the article's emotional tone and energy>"}

The genre must be the dominant musical or event style the article is about. If the article covers several, pick the one given the most weight. If none clearly dominates, use "default".

The mood should describe atmosphere, not content. Examples: "urgent and confrontational, late-night intensity", "warm optimistic momentum, communal energy", "focused technical precision, workmanlike calm".

ARTICLE:
${markdown.slice(0, 6000)}`;

  try {
    const raw = await callAnthropic(
      apiKey,
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      },
      'genre/mood analysis'
    );

    const cleaned = raw.replace(/```(?:json)?/g, '').trim();
    const parsed = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1));

    const genre = GENRE_PRESETS[parsed.genre] ? parsed.genre : keywordGenre;
    const mood = (parsed.mood || '').trim() || 'high-energy nocturnal club atmosphere';

    log(`Analysis: genre="${genre}", mood="${mood}"`);
    return { genre, mood };
  } catch (error) {
    warn(`Genre/mood analysis failed (${error.message}). Falling back to keyword detection.`);
    return { genre: keywordGenre, mood: 'high-energy nocturnal club atmosphere' };
  }
}

// ---------------------------------------------------------------------------
// Step 3: build the image prompt
// ---------------------------------------------------------------------------

function buildImagePrompt({ genre, mood, title }) {
  const preset = GENRE_PRESETS[genre] || GENRE_PRESETS.default;

  return [
    `Ultra-realistic cinematic editorial photograph for an article titled "${title}".`,
    `Scene: ${preset.visual}.`,
    `Colour palette: ${preset.palette}.`,
    `Mood and atmosphere: ${mood}.`,
    'Shot on a full-frame camera with a fast prime lens, shallow depth of field, natural volumetric lighting, fine grain, razor-sharp focus on the foreground subject.',
    'Photorealistic, 8K detail, clean, premium, professional commercial photography quality.',
    'Composition: wide 16:9 landscape framing with clear negative space, suitable as a blog header image.',
    'STRICT NEGATIVE CONSTRAINTS: absolutely no text of any kind, no lettering, no words, no signage, no captions, no watermarks, no logos, no brand marks, no visible screen interfaces or readable displays, no illustration, no cartoon, no 3D render, no CGI look, no distorted hands or faces, no oversaturation, no recognisable real person.',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// Step 4: generate the image (Cloudflare Workers AI, Pollinations as backup)
// ---------------------------------------------------------------------------

function saveImage(buffer, extension, slug) {
  if (buffer.length < 5000) {
    throw new Error(`Returned image is suspiciously small (${buffer.length} bytes).`);
  }

  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const suffix = crypto.randomBytes(4).toString('hex');
  const fileName = `${slug}-${suffix}.${extension}`;
  fs.writeFileSync(path.join(IMAGES_DIR, fileName), buffer);

  log(`Saved public/blog-images/${fileName} (${Math.round(buffer.length / 1024)} KB)`);
  return `/blog-images/${fileName}`;
}

async function cloudflareImage(prompt) {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  const model = process.env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt: prompt.slice(0, 2000) }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 250)}`);
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await response.json();
    const base64 = data?.result?.image;
    if (!base64) throw new Error(`No image in response: ${JSON.stringify(data).slice(0, 250)}`);
    return { buffer: Buffer.from(base64, 'base64'), extension: 'jpg' };
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    extension: contentType.includes('jpeg') ? 'jpg' : 'png',
  };
}

async function pollinationsImage(prompt) {
  const trimmed = prompt.slice(0, 1200);
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(trimmed)}` +
    `?width=1280&height=720&nologo=true&model=flux&seed=${Math.floor(Math.random() * 100000)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Expected an image, got ${contentType}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    extension: contentType.includes('jpeg') ? 'jpg' : 'png',
  };
}

async function generateImage({ prompt, slug }) {
  const providers = [];

  if (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) {
    providers.push({ name: 'Cloudflare (free)', run: cloudflareImage });
  }
  if (String(process.env.DISABLE_POLLINATIONS).toLowerCase() !== 'true') {
    providers.push({ name: 'Pollinations (free)', run: pollinationsImage });
  }

  if (providers.length === 0) {
    throw new Error('No image provider is configured.');
  }

  const failures = [];

  for (const provider of providers) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      log(`Image provider: ${provider.name}, attempt ${attempt}/2...`);

      try {
        const { buffer, extension } = await provider.run(prompt);
        log(`  -> success via ${provider.name}`);
        return saveImage(buffer, extension, slug);
      } catch (error) {
        log(`  -> ${error.message.slice(0, 200)}`);

        if (attempt === 2) {
          failures.push(`${provider.name}: ${error.message.slice(0, 300)}`);
        } else {
          await sleep(5000);
        }
      }
    }
  }

  throw new Error(`All image providers failed.\n\n${failures.join('\n\n')}`);
}

// ---------------------------------------------------------------------------
// Existing posts, parsing, document assembly
// ---------------------------------------------------------------------------

function getExistingPosts() {
  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
    return [];
  }

  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => /\.mdx?$/.test(f))
    .map((fileName) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, fileName), 'utf8');
      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      let title = fileName.replace(/\.mdx?$/, '');

      if (match) {
        const titleLine = match[1].match(/^title:\s*(.+)$/m);
        if (titleLine) title = titleLine[1].trim().replace(/^["']|["']$/g, '');
      }

      return { fileName, title };
    });
}

function normaliseMarkdown(raw) {
  let text = raw.trim();
  const fenced = text.match(/^```(?:markdown|md)?\r?\n([\s\S]*?)\r?\n```$/);
  if (fenced) text = fenced[1].trim();

  if (!/^---\r?\n/.test(text)) {
    const marker = text.search(/(^|\n)---\r?\n/);
    if (marker !== -1) {
      const start = text.indexOf('---', marker);
      text = text.slice(start).trim();
    }
  }

  return text;
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const block = match[1];
  const read = (key) => {
    const line = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return line ? line[1].trim().replace(/^["']|["']$/g, '') : '';
  };

  return {
    title: read('title'),
    date: read('date'),
    excerpt: read('excerpt'),
    keywords: read('keywords'),
  };
}

function rebuildDocument(markdown, meta, extras) {
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();

  const lines = [
    '---',
    `title: "${yamlSafe(meta.title)}"`,
    `date: "${todayISO()}"`,
    `excerpt: "${yamlSafe(meta.excerpt)}"`,
    `keywords: "${yamlSafe(meta.keywords)}"`,
  ];

  if (extras.image) {
    lines.push(`image: "${yamlSafe(extras.image)}"`);
    lines.push(`imageAlt: "${yamlSafe(extras.imageAlt)}"`);
  }
  if (extras.genre) lines.push(`genre: "${yamlSafe(extras.genre)}"`);
  lines.push('video: ""');
  if (DRAFT_MODE) lines.push('draft: true');

  lines.push('---', '', body, '');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    fail(
      'ANTHROPIC_API_KEY is not set.\n' +
      'In GitHub: Settings > Secrets and variables > Actions > New repository secret.'
    );
  }

  if (!process.env.BRAVE_API_KEY) {
    warn(
      'BRAVE_API_KEY is not set. The post will be written without live research.\n' +
      '           In GitHub: Settings > Secrets and variables > Actions > New repository secret.'
    );
  } else {
    log('Brave Search is configured.');
  }

  const existingPosts = getExistingPosts();
  log(`Found ${existingPosts.length} existing post(s).`);

  // --- 1. Article -----------------------------------------------------------
  const raw = await generateArticle(anthropicKey, existingPosts);
  const markdown = normaliseMarkdown(raw);

  const meta = parseFrontmatter(markdown);
  if (!meta || !meta.title) {
    fail(
      'Generated document is missing valid frontmatter or a title. Nothing written.\n\n' +
      markdown.slice(0, 400)
    );
  }

  const wordCount = markdown.split(/\s+/).length;
  if (wordCount < 300) {
    fail(`Generated post is only ~${wordCount} words. Refusing to publish.`);
  }

  // Filenames are date-prefixed so the site's build script sorts them newest-first.
  const baseSlug = slugify(meta.title) || `dj-tony-${todayISO()}`;
  let fileName = `${todayISO()}-${baseSlug}.md`;

  if (fs.existsSync(path.join(POSTS_DIR, fileName))) {
    log(`${fileName} already exists. Skipping today's run.`);
    setActionOutput('slug', '');
    setActionOutput('title', 'skipped — duplicate');
    return;
  }

  // --- 2 & 3. Analyse and build the image prompt ----------------------------
  const { genre, mood } = await analyseArticle(anthropicKey, markdown);
  const preset = GENRE_PRESETS[genre] || GENRE_PRESETS.default;
  const imagePrompt = buildImagePrompt({ genre, mood, title: meta.title });

  // --- 4. Image (non-fatal: never lose the article over a failed image) -----
  let imagePath = '';
  const imageAlt = `${preset.label} DJ setup — editorial header image for ${meta.title}`;

  try {
    imagePath = await generateImage({ prompt: imagePrompt, slug: baseSlug });
  } catch (error) {
    warn(`Image generation failed, publishing without art: ${error.message}`);
    fs.writeFileSync('image-error.log', error.message);
  }

  // --- 5. Write ------------------------------------------------------------
  const document = rebuildDocument(markdown, meta, {
    image: imagePath,
    imageAlt,
    genre: preset.label,
  });

  fs.writeFileSync(path.join(POSTS_DIR, fileName), document, 'utf8');

  log(`Wrote ${fileName} (~${wordCount} words, genre: ${preset.label})`);
  log(`Title: ${meta.title}`);
  if (imagePath) log(`Image: ${imagePath}`);
  if (DRAFT_MODE) log('DRAFT_MODE is on — this post stays off the live site.');

  setActionOutput('slug', baseSlug);
  setActionOutput('title', meta.title);
  setActionOutput('excerpt', meta.excerpt);
  setActionOutput('image', imagePath);
  setActionOutput('genre', preset.label);
}

main().catch((error) => fail(error.stack || error.message));
