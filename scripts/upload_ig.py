#!/usr/bin/env python3
"""Instagram Reel upload via web session cookie (instagrapi).

Env:  IG_COOKIES  = JSON string, e.g.
      {"sessionid":"...","csrftoken":"...","ds_user_id":"...","mid":"...","ig_did":"..."}
      (sirf sessionid zaroori hai, baaki optional)
Args: <video_path> <caption_file>

Exit: 0 = published (prints REEL_PUBLISHED id=... code=... user=...)
      2 = setup problem (missing/invalid env+args)
      3 = login/upload failure (fallback chalega)
"""
import json
import os
import sys


def fail(code, msg):
    print(f"ERR {msg}", file=sys.stderr)
    sys.exit(code)


def main():
    if len(sys.argv) < 3:
        fail(2, "usage: upload_ig.py <video> <caption_file>")
    video, capfile = sys.argv[1], sys.argv[2]

    if not os.path.isfile(video):
        fail(2, f"video not found: {video}")
    if not os.path.isfile(capfile):
        fail(2, f"caption file not found: {capfile}")

    raw = (os.environ.get("IG_COOKIES") or "").strip()
    if not raw:
        fail(2, "IG_COOKIES env khali hai")
    try:
        cookies = json.loads(raw)
    except Exception:
        fail(2, "IG_COOKIES valid JSON nahi hai")

    sessionid = str(cookies.get("sessionid") or "").strip()
    if not sessionid:
        fail(2, "IG_COOKIES me sessionid missing hai")

    caption = open(capfile, encoding="utf-8").read().strip()

    try:
        from instagrapi import Client
    except Exception as e:
        fail(3, f"instagrapi install nahi hai: {e}")

    cl = Client()
    cl.delay_range = [1, 3]

    # extra cookies (csrftoken/ds_user_id/mid/ig_did) ho to session me daal do
    extra = {k: str(v) for k, v in cookies.items() if v and k != "sessionid"}
    if extra:
        try:
            cl.session.cookies.update(extra)
        except Exception:
            pass

    try:
        ok = cl.login_by_sessionid(sessionid)
    except Exception as e:
        fail(3, f"login exception: {type(e).__name__}: {str(e)[:300]}")
    if not ok:
        fail(3, "login_by_sessionid False returned (session expired/invalid)")

    try:
        info = cl.account_info()
        uname = info.user.username
        uid = info.user.pk
    except Exception as e:
        fail(3, f"account_info failed (session invalid): {str(e)[:300]}")
    print(f"OK logged in as @{uname} (id={uid})", flush=True)

    # Instagram limit: 50 posts / 24h rolling
    try:
        media = cl.clip_upload(video, caption=caption)
    except Exception as e:
        fail(3, f"clip_upload failed: {type(e).__name__}: {str(e)[:400]}")

    if not media:
        fail(3, "clip_upload returned nothing")
    mid = str(getattr(media, "pk", "") or getattr(media, "id", "") or "")
    code = getattr(media, "code", "") or ""
    print(f"REEL_PUBLISHED id={mid} code={code} user={uname}", flush=True)


if __name__ == "__main__":
    main()
