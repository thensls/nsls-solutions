"""
Syncs builders from the legacy base (appd5oK1wLVPYZeia) into NSLS Solutions
(appd1hcbJXgvVXF05). Matches on email — skips anyone already present.

Usage:
  AIRTABLE_API_KEY=pat... python3 sync_builders.py
"""

import json, os, urllib.request, urllib.parse

TOKEN = os.environ.get("AIRTABLE_API_KEY")
if not TOKEN:
    raise SystemExit("AIRTABLE_API_KEY env var is required")
OLD_BASE = "appd5oK1wLVPYZeia"
OLD_TABLE = "tbleFuEBIwoSHxlbC"
NEW_BASE = "appd1hcbJXgvVXF05"
NEW_TABLE = "Builders"

HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def fetch_all(base, table, fields):
    records, offset = [], None
    params = {"fields[]": fields, "pageSize": "100"}
    while True:
        if offset:
            params["offset"] = offset
        qs = urllib.parse.urlencode(params, doseq=True)
        url = f"https://api.airtable.com/v0/{base}/{urllib.parse.quote(table)}?{qs}"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req) as r:
            data = json.loads(r.read())
        records.extend(data["records"])
        offset = data.get("offset")
        if not offset:
            break
    return records


def batch_insert(base, table, records):
    url = f"https://api.airtable.com/v0/{base}/{urllib.parse.quote(table)}"
    inserted = 0
    for i in range(0, len(records), 10):
        batch = records[i:i+10]
        body = json.dumps({"records": [{"fields": r} for r in batch]}).encode()
        req = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
        with urllib.request.urlopen(req) as r:
            data = json.loads(r.read())
        inserted += len(data["records"])
    return inserted


def main():
    print("Fetching builders from legacy base…")
    old = fetch_all(OLD_BASE, OLD_TABLE, ["Name", "Email", "Department"])
    print(f"  {len(old)} builders in legacy base")

    print("Fetching builders from NSLS Solutions…")
    new = fetch_all(NEW_BASE, NEW_TABLE, ["Name", "Email"])
    existing_emails = {r["fields"].get("Email", "").lower() for r in new}
    print(f"  {len(new)} builders already in NSLS Solutions")

    to_add = []
    for r in old:
        email = r["fields"].get("Email", "").lower()
        if email and email not in existing_emails:
            fields = {"Name": r["fields"].get("Name", ""), "Email": r["fields"].get("Email", "")}
            if r["fields"].get("Department"):
                fields["Department"] = r["fields"]["Department"]
            to_add.append(fields)

    if not to_add:
        print("No new builders to add.")
        return

    print(f"Adding {len(to_add)} new builder(s)…")
    inserted = batch_insert(NEW_BASE, NEW_TABLE, to_add)
    print(f"Done — {inserted} builder(s) added.")
    for b in to_add:
        print(f"  + {b['Name']} ({b['Email']})")


if __name__ == "__main__":
    main()
