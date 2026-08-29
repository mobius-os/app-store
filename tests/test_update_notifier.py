"""Notification payload and dedupe contract for the scheduled Store job."""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
from unittest import mock


SOURCE = Path(__file__).resolve().parents[1] / "notify-updates.py"
SPEC = importlib.util.spec_from_file_location("app_store_update_notifier", SOURCE)
notifier = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(notifier)


def test_unchanged_update_set_does_not_repeat_notification(tmp_path):
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
    assert notifier.main() == 0
    assert notifier.main() == 0

  notifications = [call for call in calls if call[1] == "/api/notifications/send"]
  assert len(notifications) == 1
  payload = notifications[0][2]
  assert payload["title"] == "1 app update available"
  assert payload["target"] == "/shell/?app=39&intent=updates"
  assert payload["actions"][0]["title"] == "Update all"
  assert all(action["target"] == payload["target"] for action in payload["actions"])
