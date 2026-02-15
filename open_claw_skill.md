---
name: ship_post
description: One-shot X + LinkedIn post from newest clip with tap-to-post links
user-invocable: true
---

# Ship Post (One-shot)

When invoked, DO NOT ask questions. DO NOT request confirmation. Just do it.

## Instructions

1) List files in:
/home/sid/Downloads/clips

2) Keep only files ending in `.md`

3) Sort by modified time (newest first)

4) Read the first file

5) Extract from the selected file:
- `title`
- `url`
- `## Highlight` (first quoted block; trim to <= 240 chars)
- `## Takeaway` (trim to <= 140 chars)
Ignore `## Image` entirely.

6) Generate ONE tweet (<= 280 chars):
- technical but casual
- builder voice
- no emojis
- include the clip URL

7) Encode the tweet text using RFC3986 percent-encoding.

8) Create share links:

X intent:
https://x.com/intent/post?text={ENCODED_TWEET_TEXT}

Twitter fallback:
https://twitter.com/intent/tweet?text={ENCODED_TWEET_TEXT}

LinkedIn share:
https://www.linkedin.com/sharing/share-offsite/?url={ENCODED_URL}

## Output (STRICT)

Tweet:
<tweet text>

Tap-to-post (phone):
<x intent link>
<twitter intent link>
<linkedin share link>
