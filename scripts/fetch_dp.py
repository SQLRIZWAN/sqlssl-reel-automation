#!/usr/bin/env python3
"""Apna Instagram DP (profile picture, HD) nikalta hai — cookie session se.
env: IG_COOKIES (JSON with sessionid)
args: <out_path>  (png/jpg bytes yahin likhe jayenge)
Exit: 0 = mila, 3 = fail (fallback chalega)
"""
import json
import os
import sys


def fail(msg):
    print(f"ERR {msg}", file=sys.stderr)
    sys.exit(3)


def main():
    if len(sys.argv) < 2:
        fail("usage: fetch_dp.py <out_path>")
    out_path = sys.argv[1]
    raw = (os.environ.get("IG_COOKIES") or "").strip()
    if not raw:
        fail("IG_COOKIES khali")
    try:
        cookies = json.loads(raw)
    except Exception:
        fail("IG_COOKIES JSON invalid")
    sessionid = str(cookies.get("sessionid") or "").strip()
    if not sessionid:
        fail("sessionid missing")

    from instagrapi import Client

    cl = Client()
    cl.delay_range = [1, 2]
    try:
        ok = cl.login_by_sessionid(sessionid)
    except Exception as e:
        fail(f"login exception: {e}")
    if not ok:
        fail("login failed")

    try:
        me = cl.account_info().user
        url = getattr(me, "profile_pic_url_hd", None) or getattr(me, "profile_pic_url", None)
        if not url:
            # fallback: full user_info
            u = cl.user_info(me.pk)
            url = getattr(u, "profile_pic_url_hd", None) or getattr(u, "profile_pic_url", None)
        if not url:
            fail("profile_pic_url nahi mili")
        r = cl.session.get(str(url), timeout=40)
        if r.status_code != 200 or len(r.content) < 2000:
            fail(f"DP download fail http={r.status_code} size={len(r.content)}")
        with open(out_path, "wb") as f:
            f.write(r.content)
        print(f"OK dp bytes={len(r.content)} url={str(url)[:80]}")
    except SystemExit:
        raise
    except Exception as e:
        fail(f"DP fetch exception: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
