#!/usr/bin/env python3
"""Render a share card for a blog post.

    python3 scripts/blog-og-card.py zero-is-not-a-measurement

Reads the post's own frontmatter, writes static/og/blog/<slug>.png at 1200x630,
and prints the `cover:` line to paste back into the post.

Why a script and not a runtime service: the blog compiles to static output at
build time and ships no server-side rendering beyond the SvelteKit function, so
a card generated on request would be the only moving part on an otherwise inert
page. Cards change exactly when a title changes, which is when someone is
already editing the file.

Typography is the blog's own — Iowan Old Style, the same face `--serif` asks for
first — so a card looks like it came off the page rather than out of a template.
Colours are the `.blog` light-theme tokens from blog.css; share cards are never
shown in dark mode by LinkedIn or WhatsApp, so there is only one palette to keep
in step.
"""

import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
MARGIN = 84

PAPER = (252, 251, 248)      # --paper
INK = (23, 22, 27)           # --ink
MUTED = (110, 106, 99)       # --muted
ACCENT = (180, 84, 30)       # --accent
RULE = (232, 227, 216)       # --rule

SERIF = '/System/Library/Fonts/Supplemental/Iowan Old Style.ttc'
SANS = '/System/Library/Fonts/Supplemental/Arial.ttf'
SERIF_BOLD, SERIF_ROMAN = 1, 0

POSTS = 'src/lib/blog/posts'
OUT_DIR = 'static/og/blog'


def frontmatter(path):
    with open(path, encoding='utf-8') as fh:
        src = fh.read()
    m = re.match(r'^---\r?\n(.*?)\r?\n---\r?\n', src, re.S)
    if not m:
        sys.exit(f'{path}: no frontmatter block')
    data = {}
    for line in m.group(1).split('\n'):
        if ':' not in line or line.strip().startswith('#'):
            continue
        k, v = line.split(':', 1)
        data[k.strip()] = v.strip().strip('\'"')
    return data


def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ''
    for word in words:
        trial = f'{cur} {word}'.strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def render(slug):
    md = os.path.join(POSTS, f'{slug}.md')
    if not os.path.exists(md):
        sys.exit(f'no such post: {md}')
    data = frontmatter(md)
    title = data.get('title') or sys.exit(f'{md}: frontmatter has no title')

    img = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(img)

    # Accent hairline down the left edge — the one piece of colour, and the
    # only thing that identifies the card at thumbnail size.
    d.rectangle([0, 0, 7, H], fill=ACCENT)

    kicker = ImageFont.truetype(SANS, 25)
    byline = ImageFont.truetype(SANS, 25)

    # Largest size at which the title fits three lines; long titles step down
    # rather than overflowing or being cut.
    for size in (82, 74, 66, 58, 52):
        title_font = ImageFont.truetype(SERIF, size, index=SERIF_BOLD)
        lines = wrap(d, title, title_font, W - MARGIN * 2)
        if len(lines) <= 3:
            break

    d.text((MARGIN, 74), 'SREE DAYANIDHI', font=kicker, fill=MUTED)

    leading = int(size * 1.16)
    block_h = leading * len(lines)
    y = (H - block_h) // 2 + 14
    for line in lines:
        d.text((MARGIN, y), line, font=title_font, fill=INK)
        y += leading

    d.line([(MARGIN, H - 128), (W - MARGIN, H - 128)], fill=RULE, width=1)
    d.text((MARGIN, H - 104), 'sree.riteangle.dating', font=byline, fill=MUTED)

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f'{slug}.png')
    img.save(out, optimize=True)
    print(f'wrote {out}  ({img.size[0]}x{img.size[1]})')
    print(f'frontmatter:  cover: /og/blog/{slug}.png')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    render(sys.argv[1])
