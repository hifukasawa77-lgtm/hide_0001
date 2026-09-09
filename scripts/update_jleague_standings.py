#!/usr/bin/env python3
"""Fetch J.League standings from ESPN without trusting the HTTP response."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ESPN_BASE_URL = os.environ.get(
    "ESPN_BASE_URL",
    "https://site.api.espn.com/apis/site/v2/sports/soccer",
).rstrip("/")
MAX_ATTEMPTS = int(os.environ.get("STANDINGS_MAX_ATTEMPTS", "3"))
RETRY_DELAY_SECONDS = float(os.environ.get("STANDINGS_RETRY_DELAY_SECONDS", "2"))
MAX_RESPONSE_BYTES = 10 * 1024 * 1024


class ResponseValidationError(ValueError):
    """The server responded, but the response cannot safely be used."""


def _entry_list(payload: Any) -> list[dict[str, Any]]:
    paths = (
        ("standings", "entries"),
        ("children", 0, "standings", "entries"),
        ("children", 0, "children", 0, "standings", "entries"),
    )

    for path in paths:
        value = payload
        try:
            for key in path:
                value = value[key]
        except (KeyError, IndexError, TypeError):
            continue

        if isinstance(value, list) and value and all(isinstance(item, dict) for item in value):
            return value

    raise ResponseValidationError("standings entries are missing, empty, or malformed")


def _stat(entry: dict[str, Any], name: str) -> str:
    stats = entry.get("stats", [])
    if not isinstance(stats, list):
        return "0"
    for stat in stats:
        if isinstance(stat, dict) and stat.get("name") == name:
            return str(stat.get("displayValue", "0"))
    return "0"


def parse_standings(payload: Any) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for entry in _entry_list(payload):
        team = entry.get("team")
        if not isinstance(team, dict):
            raise ResponseValidationError("standings entry has no valid team")

        logos = team.get("logos", [])
        badge = ""
        if isinstance(logos, list) and logos and isinstance(logos[0], dict):
            badge = str(logos[0].get("href", ""))

        rows.append(
            {
                "intRank": _stat(entry, "rank"),
                "strTeam": str(team.get("displayName", "")),
                "intPlayed": _stat(entry, "gamesPlayed"),
                "intWin": _stat(entry, "wins"),
                "intLoss": _stat(entry, "losses"),
                "intDraw": _stat(entry, "ties"),
                "intPoints": _stat(entry, "points"),
                "strTeamBadge": badge,
            }
        )
    return rows


def _read_json_response(response: Any) -> Any:
    content_type = response.headers.get_content_type().lower()
    if content_type != "application/json" and not content_type.endswith("+json"):
        raise ResponseValidationError("response Content-Type is not JSON")

    body = response.read(MAX_RESPONSE_BYTES + 1)
    if len(body) > MAX_RESPONSE_BYTES:
        raise ResponseValidationError("response exceeds the size limit")

    try:
        text = body.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError as exc:
        raise ResponseValidationError("response is not valid UTF-8") from exc

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ResponseValidationError("response is not valid JSON") from exc


def fetch_standings(slug: str) -> list[dict[str, str]]:
    url = f"{ESPN_BASE_URL}/{slug}/standings"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "jleague-standings-updater/1.0",
        },
    )
    last_error = "request failed"

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                rows = parse_standings(_read_json_response(response))
            print(f"{slug}: fetched successfully on attempt {attempt}")
            return rows
        except (OSError, urllib.error.URLError, ResponseValidationError) as exc:
            last_error = str(exc).replace("\r", " ").replace("\n", " ")
            if attempt < MAX_ATTEMPTS:
                print(
                    f"::warning title=ESPN API retry::{slug} attempt "
                    f"{attempt}/{MAX_ATTEMPTS} failed ({last_error}); retrying",
                    file=sys.stderr,
                )
                time.sleep(RETRY_DELAY_SECONDS * attempt)

    raise RuntimeError(
        f"{slug} failed after {MAX_ATTEMPTS} attempts ({last_error})"
    )


def write_standings(output_file: Path) -> None:
    document = {
        "j1": fetch_standings("jpn.1"),
        "j2": fetch_standings("jpn.2"),
        "j3": fetch_standings("jpn.3"),
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    output_file.parent.mkdir(parents=True, exist_ok=True)
    temp_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            dir=output_file.parent,
            prefix=f".{output_file.name}.",
            suffix=".tmp",
            delete=False,
        ) as temp_file:
            json.dump(document, temp_file, ensure_ascii=False, indent=2)
            temp_file.write("\n")
            temp_name = temp_file.name
        os.replace(temp_name, output_file)
        temp_name = None
    finally:
        if temp_name is not None:
            Path(temp_name).unlink(missing_ok=True)

    for league in ("j1", "j2", "j3"):
        print(f"{league.upper()}: {len(document[league])} teams")


def main() -> int:
    output_file = Path(sys.argv[1] if len(sys.argv) > 1 else "data/standings.json")
    try:
        write_standings(output_file)
    except (RuntimeError, ValueError) as exc:
        message = str(exc).replace("\r", " ").replace("\n", " ")
        print(f"::error title=ESPN API error::{message}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
