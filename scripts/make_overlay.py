#!/usr/bin/env python3
"""Scene overlay PNG — reference-reel style:
neon rounded border box + bold white Devanagari text (black stroke), transparent bg.

args: --text --font --size --wrap --max-lines --out --width --height --y-ratio
      --border-color r,g,b --border-width --line-gap
"""
import argparse

from PIL import Image, ImageDraw, ImageFont, ImageFilter


def wrap_text(text, max_chars, max_lines):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if len(t) > max_chars and cur:
            lines.append(cur)
            cur = w
        else:
            cur = t
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        # last line ellipsis agar cut hua
        if len(words) > len(" ".join(lines).split()):
            lines[-1] = lines[-1] + "..."
    return lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True)
    ap.add_argument("--font", required=True)
    ap.add_argument("--size", type=int, default=84)
    ap.add_argument("--wrap", type=int, default=16)
    ap.add_argument("--max-lines", type=int, default=3)
    ap.add_argument("--out", required=True)
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--height", type=int, default=1920)
    ap.add_argument("--y-ratio", type=float, default=0.47)
    ap.add_argument("--border-color", default="62,207,214")
    ap.add_argument("--border-width", type=int, default=5)
    ap.add_argument("--line-gap", type=int, default=20)
    ap.add_argument("--pad-x", type=int, default=56)
    ap.add_argument("--pad-y", type=int, default=44)
    ap.add_argument("--radius", type=int, default=48)
    ap.add_argument("--font-scale", type=float, default=1.0, help="auto-fit ke baad extra scale")
    a = ap.parse_args()

    bcol = tuple(int(x) for x in a.border_color.split(",")) + (255,)
    font = ImageFont.truetype(a.font, int(a.size * a.font_scale))

    def measure(font):
        dummy = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
        lines = wrap_text(a.text, a.wrap, a.max_lines)
        bbs = [dummy.textbbox((0, 0), l, font=font, stroke_width=4) for l in lines]
        tw = max((b[2] - b[0]) for b in bbs)
        th = sum((b[3] - b[1]) for b in bbs) + (len(lines) - 1) * a.line_gap
        return lines, tw, th

    lines, tw, th = measure(font)
    max_w = int(a.width * 0.88)
    W = tw + 2 * a.pad_x
    if W > max_w:  # font auto-shrink to fit width
        scale = max_w / W
        font = ImageFont.truetype(a.font, max(30, int(a.size * a.font_scale * scale)))
        lines, tw, th = measure(font)
        W = tw + 2 * a.pad_x
    H = th + 2 * a.pad_y

    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # glow layer (blurred cyan border)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    inset = a.border_width // 2 + 2
    gd.rounded_rectangle(
        [inset, inset, W - inset - 1, H - inset - 1],
        radius=a.radius,
        outline=bcol,
        width=a.border_width + 6,
    )
    glow = glow.filter(ImageFilter.GaussianBlur(8))
    canvas.alpha_composite(glow)

    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle(
        [inset, inset, W - inset - 1, H - inset - 1],
        radius=a.radius,
        outline=bcol,
        width=a.border_width,
    )

    # text (2-layer faux bold + black stroke like reference)
    y = a.pad_y
    for line in lines:
        bb = d.textbbox((0, 0), line, font=font, stroke_width=4)
        lw, lh = bb[2] - bb[0], bb[3] - bb[1]
        x = (W - lw) // 2 - bb[0]
        d.text(
            (x, y - bb[1]),
            line,
            font=font,
            fill=(255, 255, 255, 255),
            stroke_width=5,
            stroke_fill=(0, 0, 0, 255),
        )
        y += lh + a.line_gap

    canvas.save(a.out)
    # position hint for caller (centered at y-ratio)
    cy = int(a.height * a.y_ratio - H / 2)
    print(f"OK box={W}x{H} x={(a.width - W) // 2} y={cy}")


if __name__ == "__main__":
    main()
