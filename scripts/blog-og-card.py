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


FAINT = (244, 241, 234)      # --paper-tint, for the deterministic stages
WARM = (246, 236, 228)       # --accent-soft, for the stages a model runs
GREEN = (47, 107, 70)


def arrow(d, x1, y, x2, colour=MUTED, width=2):
    """A short horizontal connector with a solid head."""
    d.line([(x1, y), (x2 - 7, y)], fill=colour, width=width)
    d.polygon([(x2, y), (x2 - 9, y - 5), (x2 - 9, y + 5)], fill=colour)


def flow_strip(d, stages, top):
    """A left-to-right pipeline across the card.

    Each stage is `label|sub|kind`, where kind is `ai` for anything a model
    runs and anything else for a deterministic step. The two fills are the
    only distinction the card needs to make at thumbnail size.
    """
    n = len(stages)
    gap = 40
    box_w = (W - MARGIN * 2 - gap * (n - 1)) // n
    box_h = 104
    lab_f = ImageFont.truetype(SERIF, 27, index=SERIF_BOLD)
    sub_f = ImageFont.truetype(SANS, 19)

    centres = []
    for i, spec in enumerate(stages):
        parts = (spec.split('|') + ['', ''])[:3]
        label, sub, kind = parts[0].strip(), parts[1].strip(), parts[2].strip()
        x = MARGIN + i * (box_w + gap)
        fill = WARM if kind == 'ai' else FAINT
        edge = ACCENT if kind == 'ai' else RULE
        d.rounded_rectangle([x, top, x + box_w, top + box_h], radius=10,
                            fill=fill, outline=edge, width=2)
        for ln, (txt, font, colour, dy) in enumerate((
            (label, lab_f, INK, 26), (sub, sub_f, MUTED, 62),
        )):
            if txt:
                w = d.textlength(txt, font=font)
                d.text((x + (box_w - w) / 2, top + dy), txt, font=font, fill=colour)
        centres.append((x, x + box_w))
        if i:
            arrow(d, centres[i - 1][1] + 8, top + box_h // 2, x - 6)
    return centres, top + box_h


def retry_arc(d, centres, y, label):
    """The loop back from the judge to the generator, drawn under the strip."""
    x_from = (centres[2][0] + centres[2][1]) // 2
    x_to = (centres[1][0] + centres[1][1]) // 2
    d.line([(x_from, y), (x_from, y + 30), (x_to, y + 30)], fill=ACCENT, width=2)
    d.line([(x_to, y + 30), (x_to, y + 8)], fill=ACCENT, width=2)
    d.polygon([(x_to, y), (x_to - 5, y + 11), (x_to + 5, y + 11)], fill=ACCENT)
    f = ImageFont.truetype(SANS, 19)
    w = d.textlength(label, font=f)
    d.text(((x_from + x_to) / 2 - w / 2, y + 38), label, font=f, fill=ACCENT)


def render(slug, stages=None, loop_label=None):
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
    d.text((MARGIN, 62), 'SREE DAYANIDHI', font=kicker, fill=MUTED)

    # With a diagram the title takes the top third and steps down harder,
    # because the strip below it is the thing worth looking at.
    sizes = (58, 52, 46, 42) if stages else (82, 74, 66, 58, 52)
    max_lines = 2 if stages else 3
    for size in sizes:
        title_font = ImageFont.truetype(SERIF, size, index=SERIF_BOLD)
        lines = wrap(d, title, title_font, W - MARGIN * 2)
        if len(lines) <= max_lines:
            break

    leading = int(size * 1.16)
    if stages:
        y = 118
    else:
        y = (H - leading * len(lines)) // 2 + 14
    for line in lines:
        d.text((MARGIN, y), line, font=title_font, fill=INK)
        y += leading

    if stages:
        centres, strip_bottom = flow_strip(d, stages, top=y + 46)
        if loop_label and len(centres) >= 3:
            retry_arc(d, centres, strip_bottom + 6, loop_label)

    d.line([(MARGIN, H - 92), (W - MARGIN, H - 92)], fill=RULE, width=1)
    d.text((MARGIN, H - 68), 'sree.riteangle.dating', font=byline, fill=MUTED)

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f'{slug}.png')
    img.save(out, optimize=True)
    print(f'wrote {out}  ({img.size[0]}x{img.size[1]})')
    print(f'frontmatter:  cover: /og/blog/{slug}.png')


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    slug, stages, loop = args[0], None, None
    if '--flow' in args:
        stages = args[args.index('--flow') + 1].split('||')
    if '--loop' in args:
        loop = args[args.index('--loop') + 1]
    render(slug, stages, loop)
