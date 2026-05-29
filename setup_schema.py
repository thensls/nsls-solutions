#!/usr/bin/env python3
"""
NSLS Automations — Airtable Schema Setup
Run this once after creating the Airtable token with schema.bases:write scope.

Usage:
  source ~/.zshrc
  python3 setup_schema.py
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


def create_table(name, description, fields):
    print(f"\n→ Creating table: {name}")
    result = api("POST", "tables", {"name": name, "description": description, "fields": fields})
    if result:
        print(f"  ✓ Created — ID: {result['id']}")
        return result
    return None


def add_field(table_id, field):
    print(f"  + Adding field: {field['name']}")
    result = api("POST", f"tables/{table_id}/fields", field)
    if result:
        print(f"    ✓ {result['id']}")
    time.sleep(0.2)  # avoid rate limits
    return result


# ─── Check existing tables ──────────────────────────────────────────────────
print("Checking existing tables…")
existing = api("GET", "tables")
if existing is None:
    print("Cannot read tables — check token has schema.bases:read")
    sys.exit(1)

existing_names = {t["name"]: t["id"] for t in existing.get("tables", [])}
print(f"  Found: {list(existing_names.keys())}")

BUILDERS_TABLE_ID = existing_names.get("Builders")
AUTOMATIONS_TABLE_ID = existing_names.get("Automations")

# ─── BUILDERS TABLE (create if fresh base) ───────────────────────────────────
if not BUILDERS_TABLE_ID:
    print("\n→ Creating Builders table")
    b = create_table("Builders", "People who build and maintain NSLS automations", [
        {"name": "Name", "type": "singleLineText"},
        {"name": "Email", "type": "email"},
        {"name": "Department", "type": "singleSelect", "options": {"choices": [
            {"name": "CS", "color": "orangeLight2"}, {"name": "MEX", "color": "cyanLight2"},
            {"name": "Product", "color": "purpleLight2"}, {"name": "Sales", "color": "greenLight2"},
            {"name": "Marketing", "color": "pinkLight2"}, {"name": "Engineering", "color": "blueLight2"},
            {"name": "Finance", "color": "tealLight2"}, {"name": "People (HR)", "color": "yellowLight2"},
            {"name": "Leadership (SLT)", "color": "redLight2"},
        ]}},
        {"name": "Builder level", "type": "singleSelect", "options": {"choices": [
            {"name": "Not started", "color": "grayLight2"}, {"name": "Maker", "color": "cyanLight2"},
            {"name": "Explorer", "color": "purpleLight2"}, {"name": "Builder", "color": "yellowLight2"},
            {"name": "Steward", "color": "greenDark1"}, {"name": "Engineer", "color": "blueLight2"},
        ]}},
        {"name": "Capacity signal", "type": "singleSelect", "options": {"choices": [
            {"name": "Available", "color": "greenLight2"},
            {"name": "Booked", "color": "yellowLight2"},
            {"name": "Slammed", "color": "redLight2"},
        ]}},
        {"name": "Capacity last updated", "type": "date", "options": {"dateFormat": {"name": "iso", "format": "YYYY-MM-DD"}}},
        {"name": "Slack User ID", "type": "singleLineText"},
        {"name": "GitHub Username", "type": "singleLineText"},
    ])
    if b:
        BUILDERS_TABLE_ID = b["id"]
        print(f"  ✓ Builders table created — ID: {BUILDERS_TABLE_ID}")

# ─── AUTOMATIONS TABLE (create if fresh base) ─────────────────────────────────
if not AUTOMATIONS_TABLE_ID:
    print("\n→ Creating Automations table")
    a = create_table("Automations", "Org-owned end state — shipped automations", [
        {"name": "Name", "type": "singleLineText"},
        {"name": "What it does", "type": "multilineText"},
        {"name": "Stage", "type": "singleSelect", "options": {"choices": [
            {"name": "Prototype (local)", "color": "grayLight2"},
            {"name": "Hosted prototype", "color": "yellowLight2"},
            {"name": "Production", "color": "greenLight2"},
            {"name": "Org-owned asset", "color": "greenDark1"},
            {"name": "Retired", "color": "grayDark1"},
        ]}},
        {"name": "Hosted at", "type": "singleSelect", "options": {"choices": [
            {"name": "Railway", "color": "purpleLight2"}, {"name": "Vercel", "color": "blueLight2"},
            {"name": "Internal", "color": "grayLight2"}, {"name": "Other", "color": "tealLight2"},
        ]}},
        {"name": "Auth pattern", "type": "singleSelect", "options": {"choices": [
            {"name": "Centralized auth", "color": "greenLight2"},
            {"name": "Custom", "color": "yellowLight2"},
            {"name": "None", "color": "grayLight2"},
        ]}},
        {"name": "Health", "type": "singleSelect", "options": {"choices": [
            {"name": "Green", "color": "greenLight2"},
            {"name": "Yellow", "color": "yellowLight2"},
            {"name": "Red", "color": "redLight2"},
        ]}},
        {"name": "Demo link", "type": "url"},
        {"name": "Repo link", "type": "url"},
    ])
    if a:
        AUTOMATIONS_TABLE_ID = a["id"]
        print(f"  ✓ Automations table created — ID: {AUTOMATIONS_TABLE_ID}")


# ─── IDEAS TABLE ─────────────────────────────────────────────────────────────
if "Ideas" in existing_names:
    print("\n⚠ Ideas table already exists — skipping creation (add fields manually if needed)")
    IDEAS_TABLE_ID = existing_names["Ideas"]
else:
    ideas_result = create_table("Ideas", "Intake and triage pipeline for automation ideas", [
        {"name": "Idea", "type": "singleLineText"},
        {"name": "Description", "type": "multilineText"},
        {"name": "Reference links", "type": "multilineText"},
        {"name": "Submitted on", "type": "date", "options": {"dateFormat": {"name": "iso", "format": "YYYY-MM-DD"}}},
        {"name": "Intake source", "type": "singleSelect", "options": {"choices": [
            {"name": "Internal form", "color": "blueLight2"},
            {"name": "External form", "color": "purpleLight2"},
            {"name": "Manual entry", "color": "grayLight2"},
        ]}},
        {"name": "Status", "type": "singleSelect", "options": {"choices": [
            {"name": "Triage", "color": "purpleLight2"},
            {"name": "Ready", "color": "blueLight2"},
            {"name": "Picked up", "color": "cyanLight2"},
            {"name": "Building", "color": "yellowLight2"},
            {"name": "Shipped", "color": "greenLight2"},
            {"name": "Routed", "color": "pinkLight2"},
            {"name": "Parked", "color": "grayLight2"},
            {"name": "Won't do", "color": "redLight2"},
            {"name": "Archived", "color": "grayDark1"},
        ]}},
    ])
    if not ideas_result:
        print("Failed to create Ideas table — check token has schema.bases:write")
        sys.exit(1)
    IDEAS_TABLE_ID = ideas_result["id"]

    # Add remaining Ideas fields
    ideas_fields = [
        {"name": "Attachments", "type": "multipleAttachments"},
        {"name": "External submitter name", "type": "singleLineText"},
        {"name": "External submitter email", "type": "email"},
        {"name": "External submitter org", "type": "singleLineText"},
        {"name": "External submitter role", "type": "singleLineText"},
        {"name": "Internal submitter name", "type": "singleLineText"},
        {"name": "Internal submitter email", "type": "email"},
        {"name": "Internal submitter Slack ID", "type": "singleLineText"},
        {"name": "Related NSLS contact", "type": "singleLineText"},
        {"name": "Source", "type": "singleSelect", "options": {"choices": [
            {"name": "CS team", "color": "orangeLight2"},
            {"name": "MEX team", "color": "cyanLight2"},
            {"name": "Product team", "color": "purpleLight2"},
            {"name": "Sales team", "color": "greenLight2"},
            {"name": "Marketing team", "color": "pinkLight2"},
            {"name": "Other employee", "color": "grayLight2"},
            {"name": "Partner school", "color": "blueLight2"},
            {"name": "Roadshow", "color": "tealLight2"},
            {"name": "NSLS Coach (time suck)", "color": "redLight2"},
            {"name": "Member feedback", "color": "yellowLight2"},
        ]}},
        {"name": "Source detail", "type": "singleLineText"},
        {"name": "Solution type", "type": "singleSelect", "options": {"choices": [
            {"name": "Customer-facing", "color": "blueLight2"},
            {"name": "Sales enablement", "color": "greenLight2"},
            {"name": "Internal ops / productivity", "color": "yellowLight2"},
            {"name": "Product feature", "color": "purpleLight2"},
            {"name": "Infrastructure", "color": "grayLight2"},
        ]}},
        {"name": "Affected teams", "type": "multipleSelects", "options": {"choices": [
            {"name": "CS", "color": "orangeLight2"},
            {"name": "MEX", "color": "cyanLight2"},
            {"name": "Sales", "color": "greenLight2"},
            {"name": "Marketing", "color": "pinkLight2"},
            {"name": "Product", "color": "purpleLight2"},
            {"name": "Engineering", "color": "blueLight2"},
            {"name": "Finance", "color": "tealLight2"},
            {"name": "Org-wide", "color": "yellowLight2"},
        ]}},
        {"name": "Chapter health impact", "type": "singleSelect", "options": {"choices": [
            {"name": "0", "color": "grayLight2"}, {"name": "1", "color": "yellowLight2"},
            {"name": "2", "color": "orangeLight2"}, {"name": "3", "color": "greenLight2"},
        ]}},
        {"name": "Time saved", "type": "number", "options": {"precision": 1}},
        {"name": "Cost savings", "type": "number", "options": {"precision": 0}},
        {"name": "Revenue impact", "type": "number", "options": {"precision": 0}},
        {"name": "Schools affected", "type": "number", "options": {"precision": 0}},
        {"name": "Schools affected (qualitative)", "type": "singleSelect", "options": {"choices": [
            {"name": "All", "color": "greenLight2"}, {"name": "Many", "color": "tealLight2"},
            {"name": "Specific cohort", "color": "blueLight2"}, {"name": "Single school", "color": "grayLight2"},
        ]}},
        {"name": "Strategic fit", "type": "singleSelect", "options": {"choices": [
            {"name": "0", "color": "grayLight2"}, {"name": "1", "color": "yellowLight2"},
            {"name": "2", "color": "orangeLight2"}, {"name": "3", "color": "greenLight2"},
        ]}},
        {"name": "Effort", "type": "singleSelect", "options": {"choices": [
            {"name": "XS (<2hr)", "color": "greenLight2"}, {"name": "S (half day)", "color": "tealLight2"},
            {"name": "M (1-2 days)", "color": "yellowLight2"}, {"name": "L (week+)", "color": "orangeLight2"},
            {"name": "XL (real project)", "color": "redLight2"},
        ]}},
        {"name": "Required skill level", "type": "singleSelect", "options": {"choices": [
            {"name": "Maker", "color": "cyanLight2"}, {"name": "Explorer", "color": "purpleLight2"},
            {"name": "Builder", "color": "yellowLight2"}, {"name": "Steward", "color": "greenDark1"},
            {"name": "Engineering", "color": "blueLight2"},
        ]}},
        {"name": "Priority override", "type": "singleSelect", "options": {"choices": [
            {"name": "P0", "color": "redBright"}, {"name": "P1", "color": "redLight2"},
            {"name": "P2", "color": "orangeLight2"}, {"name": "P3", "color": "yellowLight2"},
            {"name": "Parking lot", "color": "grayLight2"},
        ]}},
        {"name": "Triage notes", "type": "multilineText"},
        {"name": "Triage analysis", "type": "multilineText"},
        {"name": "Triage analyzed on", "type": "date", "options": {"dateFormat": {"name": "iso", "format": "YYYY-MM-DD"}}},
        {"name": "Triage analyzed by", "type": "singleSelect", "options": {"choices": [
            {"name": "Skill-generated", "color": "purpleLight2"},
            {"name": "Skill + Chris edits", "color": "blueLight2"},
            {"name": "Chris (manual)", "color": "greenLight2"},
            {"name": "Not yet analyzed", "color": "grayLight2"},
        ]}},
        {"name": "Clarifying questions", "type": "multilineText"},
        {"name": "Clarification status", "type": "singleSelect", "options": {"choices": [
            {"name": "None needed", "color": "greenLight2"}, {"name": "Asked", "color": "yellowLight2"},
            {"name": "Got response", "color": "tealLight2"}, {"name": "Stuck waiting", "color": "redLight2"},
        ]}},
        {"name": "Decision", "type": "singleSelect", "options": {"choices": [
            {"name": "Route to product team", "color": "purpleLight2"},
            {"name": "Move to Ready", "color": "greenLight2"},
            {"name": "Park", "color": "yellowLight2"},
            {"name": "Decline", "color": "redLight2"},
        ]}},
        {"name": "Routed to", "type": "singleSelect", "options": {"choices": [
            {"name": "Lauren (Society \u2014 GitHub)", "color": "pinkLight2"},
            {"name": "Core team (David, GitHub)", "color": "blueLight2"},
            {"name": "Help Desk (Jira)", "color": "orangeLight2"},
        ]}},
        {"name": "Handoff summary", "type": "multilineText"},
        {"name": "Routing handoff link", "type": "url"},
        {"name": "Routing date", "type": "date", "options": {"dateFormat": {"name": "iso", "format": "YYYY-MM-DD"}}},
        {"name": "Routing accepted", "type": "checkbox", "options": {"icon": "check", "color": "greenBright"}},
        {"name": "Assignment note", "type": "multilineText"},
        {"name": "Park reason", "type": "multilineText"},
        {"name": "Revisit date", "type": "date", "options": {"dateFormat": {"name": "iso", "format": "YYYY-MM-DD"}}},
        {"name": "Decline reason", "type": "multilineText"},
        {"name": "Submitter status", "type": "singleSelect", "options": {"choices": [
            {"name": "Acknowledged", "color": "blueLight2"}, {"name": "In review", "color": "cyanLight2"},
            {"name": "In backlog", "color": "grayLight2"}, {"name": "Routed to product team", "color": "purpleLight2"},
            {"name": "Building", "color": "yellowLight2"}, {"name": "Shipped", "color": "greenLight2"},
            {"name": "Declined", "color": "redLight2"}, {"name": "Needs more info", "color": "orangeLight2"},
        ]}},
        {"name": "Last submitter message", "type": "multilineText"},
        {"name": "Last submitter message sent on", "type": "date", "options": {"dateFormat": {"name": "iso", "format": "YYYY-MM-DD"}}},
        {"name": "Notify submitter on next status change?", "type": "checkbox", "options": {"icon": "check", "color": "greenBright"}},
        {"name": "Notes", "type": "multilineText"},
    ]

    print(f"\n  Adding {len(ideas_fields)} more fields to Ideas…")
    for field in ideas_fields:
        add_field(IDEAS_TABLE_ID, field)

    # Link fields (require table IDs)
    if BUILDERS_TABLE_ID:
        for fname in ["Submitted by", "Suggested builder", "Picked up by", "Owner"]:
            add_field(IDEAS_TABLE_ID, {
                "name": fname,
                "type": "multipleRecordLinks",
                "options": {"linkedTableId": BUILDERS_TABLE_ID},
            })

    # Self-links for triage workflow (Ideas → Ideas)
    for fname in ["Likely duplicate of", "Related ideas"]:
        add_field(IDEAS_TABLE_ID, {
            "name": fname,
            "type": "multipleRecordLinks",
            "options": {"linkedTableId": IDEAS_TABLE_ID},
        })

    # Score formula
    score_formula = (
        "("
        "IF({Chapter health impact}=\"3\",3,IF({Chapter health impact}=\"2\",2,IF({Chapter health impact}=\"1\",1,0)))*3"
        "+IF({Strategic fit}=\"3\",3,IF({Strategic fit}=\"2\",2,IF({Strategic fit}=\"1\",1,0)))*2"
        "+IF({Time saved},{Time saved}/10,0)"
        "+IF({Cost savings},{Cost savings}/500,0)"
        "+IF({Revenue impact},{Revenue impact}/1000,0)"
        "+IF({Schools affected (qualitative)}=\"All\",5,"
          "IF({Schools affected (qualitative)}=\"Many\",3,"
          "IF({Schools affected (qualitative)}=\"Specific cohort\",2,"
          "IF({Schools affected (qualitative)}=\"Single school\",1,0))))"
        ")/IF({Effort}=\"XS (<2hr)\",1,"
          "IF({Effort}=\"S (half day)\",2,"
          "IF({Effort}=\"M (1-2 days)\",4,"
          "IF({Effort}=\"L (week+)\",8,"
          "IF({Effort}=\"XL (real project)\",16,1)))))"
    )
    add_field(IDEAS_TABLE_ID, {"name": "Score", "type": "formula", "options": {"formula": score_formula}})
    print("  ✓ Score formula added")


# ─── BUILDS TABLE ────────────────────────────────────────────────────────────
if "Builds" in existing_names:
    print("\n⚠ Builds table already exists — skipping")
    BUILDS_TABLE_ID = existing_names["Builds"]
else:
    builds_result = create_table("Builds", "Active work — ideas that have been picked up and are in progress", [
        {"name": "Build name", "type": "singleLineText"},
        {"name": "Stage", "type": "singleSelect", "options": {"choices": [
            {"name": "Prototype (local)", "color": "grayLight2"},
            {"name": "Hosted prototype (Vercel/Railway, single user)", "color": "yellowLight2"},
            {"name": "Production (multi-user, internal)", "color": "greenLight2"},
            {"name": "Org-owned asset", "color": "greenDark1"},
        ]}},
        {"name": "Started", "type": "date", "options": {"dateFormat": {"name": "iso", "format": "YYYY-MM-DD"}}},
        {"name": "Demo link", "type": "url"},
        {"name": "Repo link", "type": "url"},
        {"name": "Auth integrated?", "type": "checkbox", "options": {"icon": "check", "color": "greenBright"}},
        {"name": "Blockers", "type": "multilineText"},
    ])
    if not builds_result:
        print("Failed to create Builds table")
        sys.exit(1)
    BUILDS_TABLE_ID = builds_result["id"]

    # Link fields
    if BUILDERS_TABLE_ID:
        add_field(BUILDS_TABLE_ID, {
            "name": "Builder",
            "type": "multipleRecordLinks",
            "options": {"linkedTableId": BUILDERS_TABLE_ID},
        })
    add_field(BUILDS_TABLE_ID, {
        "name": "Linked Idea",
        "type": "multipleRecordLinks",
        "options": {"linkedTableId": IDEAS_TABLE_ID},
    })
    if AUTOMATIONS_TABLE_ID:
        add_field(BUILDS_TABLE_ID, {
            "name": "Linked Automation",
            "type": "multipleRecordLinks",
            "options": {"linkedTableId": AUTOMATIONS_TABLE_ID},
        })

# Add Linked Build to Ideas
print("\n→ Adding Linked Build field to Ideas")
add_field(IDEAS_TABLE_ID, {
    "name": "Linked Build",
    "type": "multipleRecordLinks",
    "options": {"linkedTableId": BUILDS_TABLE_ID},
})


# (Capacity fields already included in Builders table creation above)


# ─── AUTOMATIONS ADDITIONS ───────────────────────────────────────────────────
if AUTOMATIONS_TABLE_ID and "Builds" not in existing_names:
    print("\n→ Adding Linked Build field to Automations")
    add_field(AUTOMATIONS_TABLE_ID, {
        "name": "Linked Build",
        "type": "multipleRecordLinks",
        "options": {"linkedTableId": BUILDS_TABLE_ID},
    })


print("\n✅ Schema setup complete!")
print(f"\nTable IDs:")
print(f"  Ideas:       {IDEAS_TABLE_ID}")
print(f"  Builds:      {BUILDS_TABLE_ID}")
print(f"  Builders:    {BUILDERS_TABLE_ID}")
print(f"  Automations: {AUTOMATIONS_TABLE_ID}")
print("\nNext step: deploy the web app")
print("  cd /Users/chrishigbee/Desktop/nsls-solutions")
print("  npx vercel --prod")
