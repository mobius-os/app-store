"""Notification payload and dedupe contract for the scheduled Store job."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest
from unittest import mock
import urllib.parse


SOURCE = Path(__file__).resolve().parents[1] / "notify-updates.py"
SPEC = importlib.util.spec_from_file_location("app_store_update_notifier", SOURCE)
notifier = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(notifier)


class UpdateNotifierTests(unittest.TestCase):
  def test_catalog_manifest_urls_include_manifest_rename_aliases(self):
    workout_url = "https://raw.githubusercontent.com/mobius-os/app-workout/main/mobius.json"

    urls = notifier.catalog_manifest_urls()

    self.assertEqual(urls["gym"], workout_url)
    self.assertEqual(urls["workout"], workout_url)

  def test_scheduled_check_uses_live_candidate_after_catalog_id_rename(self):
    workout_url = "https://raw.githubusercontent.com/mobius-os/app-workout/main/mobius.json"
    expected_query = urllib.parse.urlencode({"manifest_url": workout_url})
    paths = []

    def request(method, path, body=None):
      paths.append(path)
      if path == "/api/apps/":
        return [{
          "id": 7,
          "name": "Workout",
          "manifest_url": "https://raw.githubusercontent.com/mobius-os/app-workout/abc123/mobius.json",
          "source_manifest": {"id": "workout"},
        }]
      self.assertEqual(path, f"/api/apps/7/update-check?{expected_query}")
      return {"update_available": True, "upstream_version": "3.5.5"}

    with mock.patch.object(notifier, "APP_ID", "39"), mock.patch.object(
      notifier, "request", side_effect=request,
    ):
      self.assertEqual(notifier.available_updates(), [{
        "id": 7,
        "name": "Workout",
        "revision": "3.5.5",
      }])

    self.assertEqual(
      paths,
      ["/api/apps/", f"/api/apps/7/update-check?{expected_query}"],
    )

  def test_unchanged_update_set_does_not_repeat_notification(self):
    updates = [{
      "id": "7", "name": "Atlas", "candidate": "digest", "pending": "none",
    }]
    calls = []
    state = {}

    def request(method, path, body=None):
      if method == "GET":
        return state.copy()
      calls.append((method, path, body))
      if method == "PUT":
        state.update(body)
      return {"id": "notification"}

    with mock.patch.object(notifier, "TOKEN", "scoped-token"), mock.patch.object(
      notifier, "available_updates", return_value=updates,
    ), mock.patch.object(notifier, "request", side_effect=request), mock.patch.object(
      notifier.sys, "argv", ["notify-updates.py", "39"],
    ):
      self.assertEqual(notifier.main(), 0)
      self.assertEqual(notifier.main(), 0)

    notifications = [call for call in calls if call[1] == "/api/notifications/send"]
    self.assertEqual(len(notifications), 1)
    payload = notifications[0][2]
    self.assertEqual(payload["title"], "1 app update available")
    self.assertEqual(payload["target"], "/shell/?app=39&intent=updates")
    self.assertEqual(payload["actions"][0]["title"], "Update all")
    self.assertTrue(
      all(action["target"] == payload["target"] for action in payload["actions"])
    )


if __name__ == "__main__":
  unittest.main()
