"""Owner-run household provisioning. Dry-run by default; no rule or Auth writes."""
import argparse
import hashlib
import json
import re
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

PROJECT = "homegroups-fellowship"
ROOT = "projects/" + PROJECT + "/databases/(default)/documents"
BASE = "https://firestore.googleapis.com/v1/" + ROOT

def build_plan(accounts):
    if not isinstance(accounts, list) or len(accounts) != 4:
        raise ValueError("Exactly four approved household accounts are required.")
    for item in accounts:
        if set(item) != {"uid", "displayName"}:
            raise ValueError("Use only uid and displayName for each account.")
        if not isinstance(item["uid"], str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", item["uid"]):
            raise ValueError("An account UID is invalid.")
        if not isinstance(item["displayName"], str) or not 1 <= len(item["displayName"].strip()) <= 80:
            raise ValueError("Each account needs a display name of 1–80 characters.")
    if len({item["uid"] for item in accounts}) != 4:
        raise ValueError("The four account UIDs must be distinct.")
    records = [("household community", "groups/household-pilot", {"name": {"stringValue": "Household"}}, True)]
    for person in accounts:
        uid, name = person["uid"], person["displayName"].strip()
        records.append(("membership for " + name, "groups/household-pilot/members/" + uid,
                        {"role": {"stringValue": "member"}}, False))
        records.append(("display name for " + name, "groups/household-pilot/profiles/" + uid,
                        {"displayName": {"stringValue": name}}, False))
    records.append(("household room", "groups/household-pilot/studyThreads/household",
                    {"open": {"booleanValue": True}, "title": {"stringValue": "Household conversation"},
                     "memberLabels": {"mapValue": {"fields": {item["uid"]: {"stringValue": item["displayName"].strip()} for item in accounts}}}}, True))
    people = sorted(accounts, key=lambda item: item["uid"])
    for first_index, first in enumerate(people):
        for second in people[first_index + 1:]:
            ids = [first["uid"], second["uid"]]
            identifier = "pair-" + hashlib.sha256(json.dumps(ids, separators=(",", ":")).encode()).hexdigest()[:32]
            title = first["displayName"].strip() + " & " + second["displayName"].strip()
            # Titles are bounded independently of profile names.
            records.append(("private pairing " + title, "groups/household-pilot/privateChats/" + identifier,
                            {"participantIds": {"arrayValue": {"values": [{"stringValue": uid} for uid in ids]}},
                             "title": {"stringValue": title[:80]}}, True))
    return records

def cloud_request(url, token, payload=None, allow_missing=False):
    headers = {"Authorization": "Bearer " + token, "Content-Type": "application/json",
               "x-goog-user-project": PROJECT}
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if allow_missing and error.code == 404:
            return None
        raise RuntimeError("Cloud request failed with HTTP " + str(error.code) +
                           ". No rules or Authentication accounts were modified.") from None

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("accounts", type=Path)
    parser.add_argument("--apply", action="store_true", help="Create only missing pilot records using the signed-in owner's gcloud identity.")
    args = parser.parse_args()
    accounts = json.loads(args.accounts.read_text(encoding="utf-8-sig"))
    records = build_plan(accounts)
    print("Target project: " + PROJECT)
    print("Plan: one household community, four memberships, four names, one shared room, six private pairings.")
    if not args.apply:
        for label, _, _, _ in records:
            print("Would preserve or create: " + label)
        print("Dry-run only. No network requests, data writes, rule publication or Authentication changes.")
        return
    token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
    if not token:
        raise RuntimeError("Sign in as the project owner in Cloud Shell first.")
    # Check only the four requested UIDs. Never list or print account emails.
    result = cloud_request("https://identitytoolkit.googleapis.com/v1/projects/" + PROJECT + "/accounts:lookup",
                           token, {"localId": [item["uid"] for item in accounts]})
    users = {item["localId"]: item for item in result.get("users", [])}
    if set(users) != {item["uid"] for item in accounts} or any(item.get("disabled") for item in users.values()):
        raise RuntimeError("All four requested accounts must exist and be enabled in this project. No writes performed.")
    for person in accounts:
        providers = {item.get("providerId") for item in users[person["uid"]].get("providerUserInfo", [])}
        if "google.com" not in providers:
            print("Check Google sign-in linkage for " + person["displayName"] + "; Authentication will not be changed.")
    approved_ids = {item["uid"] for item in accounts}
    members = cloud_request(BASE + "/groups/household-pilot/members?pageSize=100", token, allow_missing=True) or {}
    if members.get("nextPageToken") or any(item["name"].rsplit("/", 1)[-1] not in approved_ids for item in members.get("documents", [])):
        raise RuntimeError("The household group already contains another member. Review its audience before adding records. No writes performed.")
    profiles = cloud_request(BASE + "/groups/household-pilot/profiles?pageSize=100", token, allow_missing=True) or {}
    for item in profiles.get("documents", []):
        fields = item.get("fields", {})
        label = fields.get("displayName", {}).get("stringValue", "")
        if item["name"].rsplit("/", 1)[-1] not in approved_ids or set(fields) != {"displayName"} or not isinstance(label, str) or not 1 <= len(label.strip()) <= 80:
            raise RuntimeError("Existing household profiles differ from the name-only pilot contract. No writes performed.")
    if profiles.get("nextPageToken"):
        raise RuntimeError("The household directory has unexpected additional profiles. No writes performed.")
    chats = cloud_request(BASE + "/groups/household-pilot/privateChats?pageSize=100", token, allow_missing=True) or {}
    expected_chats = {ROOT + "/" + relative for _, relative, _, _ in records if "/privateChats/" in relative}
    if chats.get("nextPageToken") or any(item["name"] not in expected_chats for item in chats.get("documents", [])):
        raise RuntimeError("The household group contains other private conversations. Review them before adding records. No writes performed.")
    writes = []
    for label, relative, fields, timestamp in records:
        existing = cloud_request(BASE + "/" + relative, token, allow_missing=True)
        if existing is not None:
            actual = existing.get("fields", {})
            if relative == "groups/household-pilot" and actual.get("name") != {"stringValue": "Household"}:
                raise RuntimeError("The household group ID is already used for a different community. No writes performed.")
            if "/privateChats/" in relative and actual.get("participantIds") != fields["participantIds"]:
                raise RuntimeError("Existing private pairing differs from this plan. No writes performed.")
            if relative.endswith("/studyThreads/household") and actual.get("open") != {"booleanValue": True}:
                raise RuntimeError("An existing household room is closed. Review it before changing it. No writes performed.")
            print("Preserving existing " + label)
            continue
        write = {"update": {"name": ROOT + "/" + relative, "fields": fields},
                 "currentDocument": {"exists": False}}
        if timestamp:
            write["updateTransforms"] = [{"fieldPath": "createdAt", "setToServerValue": "REQUEST_TIME"}]
        writes.append(write)
    if writes:
        cloud_request(BASE + ":commit", token, {"writes": writes})
        print("Created " + str(len(writes)) + " missing records atomically.")
    else:
        print("All household records already exist; nothing changed.")
    print("Existing memberships, roles, names and messages were preserved.")
    print("No security rules or Authentication accounts were changed.")
    print("The household room uses existing group permissions. Private chats await reviewed participant-only rules.")

if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))

