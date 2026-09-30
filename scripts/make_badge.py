#!/usr/bin/env python3
"""Bottom-left badge PNG: circular DP (gold ring) + gold @handle — har scene par lagega.
args: --out --font --handle [--dp path] --size --fs --pad
DP na ho to sirf handle text (gold, black stroke) banta hai.
"""
import argparse
import os

from PIL import Image, ImageDraw, ImageFont

GOLD = (245, 197, 66, 255)
GOLD_DIM = (214, 165, 40, 255)


def circle_img(src, size):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2)).resize(
        (size, size), Image.LANCZOS
    )
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--font", required=True)
    ap.add_argument("--handle", default="@sql.ssl")
    ap.add_argument("--dp", default="")
    ap.add_argument("--size", type=int, default=150)
    ap.add_argument("--fs", type=int, default=56)
    ap.add_argument("--ring", type=int, default=7)
    ap.add_argument("--gap", type=int, default=22)
    a = ap.parse_args()

    font = ImageFont.truetype(a.font, a.fs)
    dummy = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
    tb = dummy.textbbox((0, 0), a.handle, font=font, stroke_width=3)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]

    has_dp = a.dp and os.path.isfile(a.dp) and os.path.getsize(a.dp) > 2000
    dp_size = a.size if has_dp else 0
    W = dp_size + (a.gap + tw if dp_size else tw) + 8
    H = max(dp_size, th + 8) + 8

    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)

    x = 0
    if has_dp:
        dp = circle_img(a.dp, dp_size)
        canvas.alpha_composite(dp, (0, (H - dp_size) // 2))
        # gold ring
        r0 = (H - dp_size) // 2
        d.ellipse(
            [a.ring // 2, r0 + a.ring // 2, dp_size - a.ring // 2 - 1, r0 + dp_size - a.ring // 2 - 1],
            outline=GOLD,
            width=a.ring,
        )
        x = dp_size + a.gap

    # handle text (vertical center)
    ty = (H - th) // 2 - tb[1]
    d.text((x, ty), a.handle, font=font, fill=GOLD, stroke_width=3, stroke_fill=(0, 0, 0, 255))

    canvas.save(a.out)
    print(f"OK badge={W}x{H} dp={'yes' if has_dp else 'no'}")


if __name__ == "__main__":
    main()
