#!/usr/bin/env python3
"""Submit new sitemap URLs to Baidu's ordinary link submit API.

The script is intentionally dependency-free so it can run in Railway Cron,
Windows Task Scheduler, GitHub Actions, or any small VPS with Python 3.
Secrets are read from environment variables and are never written to disk.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_SITE = "https://aiquan.me"
DEFAULT_STATE_FILE = "data/baidu-submitted-urls.json"
DEFAULT_USER_AGENT = "AIQ-BaiduSubmit/1.0"


def main() -> int:
    args = parse_args()

    if args.loop:
        while True:
            run_once(args)
            print(f"[baidu-submit] sleeping {args.interval_hours}h", flush=True)
            time.sleep(max(args.interval_hours, 1) * 60 * 60)

    return run_once(args)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read sitemap.xml, submit new URLs to Baidu, and remember submitted URLs.",
    )
    parser.add_argument("--site", default=os.getenv("BAIDU_SUBMIT_SITE", DEFAULT_SITE))
    parser.add_argument("--token", default=os.getenv("BAIDU_SUBMIT_TOKEN"))
    parser.add_argument("--sitemap-url", default=os.getenv("BAIDU_SITEMAP_URL"))
    parser.add_argument("--state-file", default=os.getenv("BAIDU_SUBMIT_STATE_FILE", DEFAULT_STATE_FILE))
    parser.add_argument("--daily-limit", type=int, default=read_int_env("BAIDU_SUBMIT_DAILY_LIMIT", 10))
    parser.add_argument("--batch-size", type=int, default=read_int_env("BAIDU_SUBMIT_BATCH_SIZE", 100))
    parser.add_argument("--timeout", type=int, default=read_int_env("BAIDU_SUBMIT_TIMEOUT_SECONDS", 30))
    parser.add_argument("--dry-run", action="store_true", default=os.getenv("BAIDU_SUBMIT_DRY_RUN") == "1")
    parser.add_argument(
        "--seed-existing",
        action="store_true",
        help="Record current sitemap URLs as already known without submitting them.",
    )
    parser.add_argument("--loop", action="store_true", help="Run forever and submit once per interval.")
    parser.add_argument("--interval-hours", type=int, default=read_int_env("BAIDU_SUBMIT_INTERVAL_HOURS", 24))
    return parser.parse_args()


def run_once(args: argparse.Namespace) -> int:
    site = normalize_site(args.site)
    sitemap_url = args.sitemap_url or f"{site}/sitemap.xml"
    state_path = Path(args.state_file)
    state = read_state(state_path)
    known_urls = set(state.get("submittedUrls", []))

    print(f"[baidu-submit] reading sitemap: {sitemap_url}", flush=True)
    sitemap_urls = read_sitemap_urls(sitemap_url, args.timeout)
    candidate_urls = [url for url in sitemap_urls if is_same_site_url(url, site)]
    new_urls = [url for url in candidate_urls if url not in known_urls]
    submit_limit = max(0, min(args.daily_limit, args.batch_size))
    urls_to_submit = new_urls[:submit_limit]

    print(
        "[baidu-submit] "
        f"sitemap={len(sitemap_urls)} sameSite={len(candidate_urls)} "
        f"known={len(known_urls)} new={len(new_urls)} submit={len(urls_to_submit)}",
        flush=True,
    )

    if args.seed_existing:
        state["submittedUrls"] = sorted(known_urls.union(candidate_urls))
        state["seededAt"] = now_iso()
        append_history(state, {"ok": True, "seedExisting": True, "seeded": len(candidate_urls)})
        write_state(state_path, state)
        print(f"[baidu-submit] seeded={len(candidate_urls)} state={state_path}", flush=True)
        return 0

    if not urls_to_submit:
        append_history(state, {"ok": True, "submitted": 0, "reason": "no-new-url"})
        write_state(state_path, state)
        return 0

    if args.dry_run:
        print("[baidu-submit] dry-run URLs:")
        for url in urls_to_submit:
            print(url)
        append_history(state, {"ok": True, "dryRun": True, "submitted": len(urls_to_submit)})
        write_state(state_path, state)
        return 0

    if not args.token:
        print("[baidu-submit] BAIDU_SUBMIT_TOKEN is required", file=sys.stderr)
        return 2

    result = submit_urls_to_baidu(site=site, token=args.token, urls=urls_to_submit, timeout=args.timeout)
    accepted_urls = filter_accepted_urls(urls_to_submit, result)
    state["submittedUrls"] = sorted(known_urls.union(accepted_urls))
    state["lastSubmittedAt"] = now_iso()
    state["lastResult"] = redact_result(result)
    append_history(
        state,
        {
            "ok": True,
            "submitted": len(urls_to_submit),
            "accepted": len(accepted_urls),
            "result": redact_result(result),
        },
    )
    write_state(state_path, state)

    print(f"[baidu-submit] baidu response: {json.dumps(redact_result(result), ensure_ascii=False)}", flush=True)
    print(f"[baidu-submit] accepted={len(accepted_urls)} state={state_path}", flush=True)
    return 0


def read_sitemap_urls(sitemap_url: str, timeout: int, seen: set[str] | None = None) -> list[str]:
    seen = seen or set()
    if sitemap_url in seen:
        return []
    seen.add(sitemap_url)

    raw_xml = http_get_text(sitemap_url, timeout)
    root = ET.fromstring(raw_xml)
    urls: list[str] = []

    if root.tag.endswith("sitemapindex"):
        for loc in root.findall(".//{*}sitemap/{*}loc"):
            if loc.text:
                urls.extend(read_sitemap_urls(loc.text.strip(), timeout, seen))
        return unique_preserve_order(urls)

    for loc in root.findall(".//{*}url/{*}loc"):
        if loc.text:
            urls.append(loc.text.strip())

    return unique_preserve_order(urls)


def submit_urls_to_baidu(site: str, token: str, urls: list[str], timeout: int) -> dict[str, Any]:
    endpoint = "http://data.zz.baidu.com/urls"
    query = urllib.parse.urlencode({"site": site, "token": token})
    request_url = f"{endpoint}?{query}"
    body = ("\n".join(urls) + "\n").encode("utf-8")
    request = urllib.request.Request(
        request_url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "text/plain",
            "User-Agent": DEFAULT_USER_AGENT,
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload)
    except urllib.error.HTTPError as error:
        payload = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Baidu submit failed with HTTP {error.code}: {payload}") from error


def http_get_text(url: str, timeout: int) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8")


def read_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"submittedUrls": [], "history": []}

    try:
        with path.open("r", encoding="utf-8") as file:
            parsed = json.load(file)
    except (OSError, json.JSONDecodeError):
        return {"submittedUrls": [], "history": []}

    return {
        "submittedUrls": parsed.get("submittedUrls", []) if isinstance(parsed, dict) else [],
        "history": parsed.get("history", []) if isinstance(parsed, dict) else [],
        **({"lastSubmittedAt": parsed["lastSubmittedAt"]} if isinstance(parsed, dict) and "lastSubmittedAt" in parsed else {}),
        **({"lastResult": parsed["lastResult"]} if isinstance(parsed, dict) and "lastResult" in parsed else {}),
    }


def write_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(state, file, ensure_ascii=False, indent=2)
        file.write("\n")


def append_history(state: dict[str, Any], entry: dict[str, Any]) -> None:
    history = state.get("history")
    if not isinstance(history, list):
        history = []
    history.append({"at": now_iso(), **entry})
    state["history"] = history[-30:]


def filter_accepted_urls(urls: list[str], result: dict[str, Any]) -> list[str]:
    rejected = set(result.get("not_same_site", [])) | set(result.get("not_valid", []))
    if result.get("success", 0) <= 0:
        return []
    return [url for url in urls if url not in rejected]


def redact_result(result: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in result.items()
        if key not in {"token"}
    }


def normalize_site(site: str) -> str:
    return site.strip().rstrip("/")


def is_same_site_url(url: str, site: str) -> bool:
    try:
        parsed_url = urllib.parse.urlparse(url)
        parsed_site = urllib.parse.urlparse(site)
    except ValueError:
        return False

    return parsed_url.scheme in {"http", "https"} and parsed_url.netloc == parsed_site.netloc


def unique_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def read_int_env(name: str, fallback: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return fallback

    try:
        value = int(raw)
    except ValueError:
        return fallback

    return value if value > 0 else fallback


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


if __name__ == "__main__":
    raise SystemExit(main())
