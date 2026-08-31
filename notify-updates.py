#!/usr/bin/env python3
"""Notify once per distinct set of available App Store updates.

The supervised runner supplies APP_TOKEN and the Store's numeric app id. The
job never guesses from version labels: it uses each app's git-native
update-check result and stores only the last notified signature in Store-owned
storage. ``--dry-run`` prints the would-be payload and never sends a push.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request


API = os.environ.get("API_BASE_URL", "http://localhost:8000").rstrip("/")
TOKEN = os.environ.get("APP_TOKEN", "")
APP_ID = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else ""


def request(method: str, path: str, body=None):
  headers = {"Authorization": f"Bearer {TOKEN}"}
  data = None
  if body is not None:
    data = json.dumps(body, separators=(",", ":")).encode()
    headers["Content-Type"] = "application/json"
  req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
  with urllib.request.urlopen(req, timeout=12) as response:
    raw = response.read()
    return json.loads(raw) if raw else None


def available_updates():
  apps = request("GET", "/api/apps/") or []
  candidates = [app for app in apps if (
    app.get("manifest_url") and int(app.get("id") or 0) != int(APP_ID)
  )]

  def probe(app):
    if not app.get("manifest_url") or int(app.get("id") or 0) == int(APP_ID):
      return None
    try:
      check = request("GET", f"/api/apps/{int(app['id'])}/update-check") or {}
    except (OSError, ValueError, urllib.error.HTTPError):
      return None
    if check.get("update_available") is True:
      return {
        "id": int(app["id"]),
        "name": str(app.get("name") or app.get("slug") or "App"),
        "revision": str(check.get("candidate_source_digest") or check.get("upstream_version") or "available"),
      }
    return None

  with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    updates = [item for item in pool.map(probe, candidates) if item]
  return sorted(updates, key=lambda item: item["id"])


def main() -> int:
  global APP_ID
  parser = argparse.ArgumentParser()
  parser.add_argument("app_id", nargs="?", default=APP_ID)
  parser.add_argument("--dry-run", action="store_true")
  args = parser.parse_args()
  APP_ID = str(args.app_id or APP_ID)
  if not TOKEN or not APP_ID:
    return 0
  try:
    updates = available_updates()
  except (OSError, ValueError, urllib.error.HTTPError):
    return 0
  if not updates:
    return 0
  signature = hashlib.sha256(json.dumps(updates, sort_keys=True).encode()).hexdigest()
  state_path = f"/api/storage/apps/{APP_ID}/store/update-notification.json"
  try:
    previous = request("GET", state_path) or {}
  except urllib.error.HTTPError as error:
    previous = {} if error.code == 404 else None
  if previous is None or previous.get("signature") == signature:
    return 0
  count = len(updates)
  names = ", ".join(item["name"] for item in updates[:3])
  if count > 3:
    names += f" and {count - 3} more"
  payload = {
    "title": f"{count} app {'update' if count == 1 else 'updates'} available",
    "body": f"Safe updates can be applied together: {names}",
    "source_id": str(APP_ID),
    "target": f"/shell/?app={APP_ID}&intent=updates",
    "actions": [
      {
        "action": "update_all",
        "title": "Update all",
        "target": f"/shell/?app={APP_ID}&intent=updates",
      },
      {
        "action": "open_store",
        "title": "Open App Store",
        "target": f"/shell/?app={APP_ID}&intent=updates",
      },
    ],
  }
  if args.dry_run:
    print(json.dumps(payload, indent=2))
    return 0
  request("POST", "/api/notifications/send", payload)
  request("PUT", state_path, {"signature": signature, "updates": updates})
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
