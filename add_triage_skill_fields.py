#!/usr/bin/env python3
"""
NSLS Automations — Triage Skill Fields Migration

Adds the fields needed by the AI triage skill to the existing Ideas table.
Idempotent: skips any field whose name already exists.

Usage:
  source ~/.zshrc
  python3 add_triage_skill_fields.py
"""

import os, sys, json, time
import urllib.request, urllib.error

BASE_ID = "appd1hcbJXgvVXF05"
API_KEY = os.environ.get("AIRTABLE_API_KEY")

if not API_KEY:
    print("ERROR: AIRTABLE_API_KEY not set. Run: source ~/.zshrc")
    sys.exit(1)


def api(method, path, data=None):
    url = f"https://api.airtable.com/v0/meta/bases/{BASE_ID}/{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        url, data=body, method=method,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        }
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = json.loads(e.read())
        print(f"  ERROR {e.code}: {json.dumps(err, indent=2)}")
        return None


def get_ideas_table():
    tables = api("GET", "tables")
    if tables is None:
        print("Cannot read tables — check token has schema.bases:read")
        sys.exit(1)
    for t in tables.get("tables", []):
        if t["name"] == "Ideas":
            return t
    print("ERROR: Ideas table not found in base")
    sys.exit(1)


def add_field(table_id, field):
    result = api("POST", f"tables/{table_id}/fields", field)
    time.sleep(0.25)
    return result


def main():
    print(f"Loading schema for base {BASE_ID}…")
    ideas = get_ideas_table()
    ideas_id = ideas["id"]
    existing_names = {f["name"] for f in ideas.get("fields", [])}
    print(f"  Ideas table: {ideas_id} ({len(existing_names)} existing fields)")

    # Order matters: define link targets before the self-links are added.
    # All link targets here are the Ideas table itself (self-link).
    fields_to_add = [
        {
            "name": "Triage analysis",
            "type": "multilineText",
            "description": "Long-form markdown output from the AI triage skill (analysis, problem statement, recommendation).",
        },
        {
            "name": "Triage analyzed on",
            "type": "date",
            "options": {"dateFormat": {"name": "iso", "format": "YYYY-MM-DD"}},
            "description": "Date the Triage analysis was last refreshed.",
        },
        {
            "name": "Triage analyzed by",
            "type": "singleSelect",
            "options": {"choices": [
                {"name": "Skill-generated", "color": "purpleLight2"},
                {"name": "Skill + Chris edits", "color": "blueLight2"},
                {"name": "Chris (manual)", "color": "greenLight2"},
                {"name": "Not yet analyzed", "color": "grayLight2"},
            ]},
            "description": "Source of the latest Triage analysis. New records default to 'Not yet analyzed' (set by intake API).",
        },
        {
            "name": "Likely duplicate of",
            "type": "multipleRecordLinks",
            "options": {"linkedTableId": ideas_id},
            "description": "Other Ideas that appear to be duplicates of this one. Distinct from 'Related ideas'.",
        },
        {
            "name": "Related ideas",
            "type": "multipleRecordLinks",
            "options": {"linkedTableId": ideas_id},
            "description": "Adjacent/sibling Ideas. Not duplicates — kept separate per triage workflow.",
        },
        {
            "name": "Internal submitter Slack ID",
            "type": "singleLineText",
            "description": "Optional Slack user ID for the internal submitter, populated later from the Builders table when known.",
        },
    ]

    added, skipped, failed = [], [], []
    for field in fields_to_add:
        name = field["name"]
        if name in existing_names:
            print(f"  ⏭  {name} — already exists, skipping")
            skipped.append(name)
            continue
        print(f"  + Adding {name} ({field['type']})…")
        result = add_field(ideas_id, field)
        if result and result.get("id"):
            print(f"    ✓ {result['id']}")
            added.append(name)
        else:
            print(f"    ✗ failed")
            failed.append(name)

    print("\n─── Summary ────────────────────────────────")
    print(f"  Added:   {len(added)}  {added if added else ''}")
    print(f"  Skipped: {len(skipped)}  {skipped if skipped else ''}")
    if failed:
        print(f"  FAILED:  {len(failed)}  {failed}")
        sys.exit(1)
    print("\n✅ Migration complete.")
    if added:
        print("\nNext: redeploy the web app so the UI picks up the new fields.")
        print("  npx vercel --prod")


if __name__ == "__main__":
    main()
