#!/usr/bin/env python3
"""Close completed tickets in Plane."""

import json
import urllib.request
import urllib.parse

API_KEY = "plane_api_6b9df478323d40aea66ff884183faf57"
WORKSPACE = "woam"
PROJECT_ID = "bdb013db-8e4f-4bf3-bfb0-07e23c4589ea"
BASE_URL = "https://api.plane.so/api/v1"
HEADERS = {"X-Api-Key": API_KEY, "User-Agent": "plane-tickets/1.0", "Content-Type": "application/json"}

# Tickets to close
TICKETS_TO_CLOSE = [
    {"id": "PDC-1", "title": "Core SvelteKit Scaffold"},
    {"id": "PDC-2", "title": "Voyage AI Embeddings"},
    {"id": "PDC-28", "title": "AI Bestie (Female Assistant)"},
    {"id": "PDC-29", "title": "AI Wingman (Male Assistant)"},
    {"id": "PDC-32", "title": "ID Extraction Error Handling"},
]

def get(path):
    """Make a GET request to the Plane API."""
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def patch(path, data):
    """Make a PATCH request to the Plane API."""
    url = f"{BASE_URL}{path}"
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=HEADERS, method='PATCH')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def get_all_issues():
    """Fetch all issues to find the ones we need to close."""
    path = f"/workspaces/{WORKSPACE}/projects/{PROJECT_ID}/issues/"
    results = []
    url_path = f"{path}?per_page=100"
    
    while True:
        data = get(url_path)
        items = data.get("results", [])
        results.extend(items)
        if not data.get("next_page_results"):
            break
        cursor = data.get("next_cursor")
        if not cursor:
            break
        base = url_path.split("?cursor=")[0]
        sep = "&" if "?" in base else "?"
        url_path = f"{base}{sep}cursor={urllib.parse.quote(cursor)}&per_page=100"
    
    return results

def find_issue_by_sequence(issues, sequence_id):
    """Find an issue by its sequence ID (e.g., 'PDC-1')."""
    for issue in issues:
        if issue.get("sequence_id") == sequence_id:
            return issue
    return None

def get_closed_state_id():
    """Get the ID of the 'Closed' state."""
    path = f"/workspaces/{WORKSPACE}/projects/{PROJECT_ID}/states/"
    states = get(path)
    
    for state in states.get("results", []):
        if state.get("name", "").lower() == "closed":
            return state.get("id")
    
    # If no 'Closed' state found, try 'Done'
    for state in states.get("results", []):
        if state.get("name", "").lower() == "done":
            return state.get("id")
    
    return None

def main():
    print("=" * 80)
    print("CLOSING PLANE TICKETS")
    print("=" * 80)
    
    # Fetch all issues
    print("\nFetching all issues...")
    issues = get_all_issues()
    print(f"Found {len(issues)} total issues")
    
    # Get closed state ID
    print("\nFinding 'Closed' state...")
    closed_state_id = get_closed_state_id()
    if not closed_state_id:
        print("ERROR: Could not find 'Closed' state!")
        return
    print(f"Found closed state ID: {closed_state_id}")
    
    # Close each ticket
    print("\n" + "=" * 80)
    print("CLOSING TICKETS")
    print("=" * 80)
    
    closed_count = 0
    for ticket in TICKETS_TO_CLOSE:
        seq_id = ticket["id"]
        title = ticket["title"]
        
        # Find the issue
        issue = find_issue_by_sequence(issues, seq_id)
        if not issue:
            print(f"\n❌ {seq_id}: NOT FOUND")
            continue
        
        issue_id = issue.get("id")
        current_state = issue.get("state_detail", {}).get("name", "Unknown")
        
        print(f"\n✅ {seq_id}: {title}")
        print(f"   Current State: {current_state}")
        print(f"   Issue ID: {issue_id}")
        
        # Close the issue
        try:
            path = f"/workspaces/{WORKSPACE}/projects/{PROJECT_ID}/issues/{issue_id}/"
            result = patch(path, {"state": closed_state_id})
            new_state = result.get("state_detail", {}).get("name", "Unknown")
            print(f"   New State: {new_state}")
            print(f"   ✅ CLOSED")
            closed_count += 1
        except Exception as e:
            print(f"   ❌ ERROR: {str(e)}")
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"\nTickets Closed: {closed_count}/{len(TICKETS_TO_CLOSE)}")
    
    if closed_count == len(TICKETS_TO_CLOSE):
        print("\n✅ All tickets closed successfully!")
    else:
        print(f"\n⚠️  {len(TICKETS_TO_CLOSE) - closed_count} tickets failed to close")
    
    print("\n" + "=" * 80 + "\n")

if __name__ == "__main__":
    main()
