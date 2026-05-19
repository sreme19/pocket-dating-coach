#!/usr/bin/env python3
"""Create bug tickets in Plane for pocket-dating-coach."""

import json
import sys
import urllib.request
import urllib.error

API_KEY = "plane_api_6b9df478323d40aea66ff884183faf57"
WORKSPACE = "woam"
PROJECT_ID = "bdb013db-8e4f-4bf3-bfb0-07e23c4589ea"
BASE_URL = "https://api.plane.so/api/v1"
HEADERS = {
    "X-Api-Key": API_KEY,
    "User-Agent": "plane-tickets/1.0",
    "Content-Type": "application/json"
}


def post(path, data):
    """Make a POST request to the Plane API."""
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers=HEADERS,
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        error_data = e.read().decode('utf-8')
        print(f"Error: {e.code} - {error_data}")
        raise


def create_ticket(name, description, priority="high", labels=None):
    """Create a ticket in Plane."""
    if labels is None:
        labels = []
    
    path = f"/workspaces/{WORKSPACE}/projects/{PROJECT_ID}/issues/"
    data = {
        "name": name,
        "description_html": description,
        "priority": priority
    }
    
    # Only add labels if they are provided and not empty
    if labels:
        data["labels"] = labels
    
    print(f"Creating ticket: {name}")
    result = post(path, data)
    print(f"  ✓ Created: PDC-{result.get('sequence_id', '?')}")
    return result


def main():
    print("=" * 80)
    print("Creating Bug Tickets in Plane")
    print("=" * 80)
    print()

    # Bug #1: Government ID Extraction JSON Parsing Error
    bug1_description = """<h2>Government ID extraction fails with "Unexpected token '&lt;', '&lt;!doctype'" error</h2>

<h3>Root Cause</h3>
<p>Claude API is returning HTML error page instead of JSON. This typically indicates:</p>
<ul>
<li><strong>Invalid/Missing API Key</strong> - ANTHROPIC_API_KEY not set or incorrect</li>
<li><strong>API Rate Limiting</strong> - Claude API returning 429 as HTML</li>
<li><strong>API Version Mismatch</strong> - Using deprecated API version header</li>
<li><strong>Network/Firewall Issues</strong> - Request blocked or redirected</li>
</ul>

<h3>Affected Code</h3>
<p><code>/src/lib/verified-vibe/server/verification.ts</code> (lines 97-102)</p>
<pre><code>let parsedResponse;
try {
  parsedResponse = JSON.parse(content);
} catch (e) {
  console.error('Failed to parse Claude response:', content);
  throw new Error('Invalid response format from Claude API');
}</code></pre>

<h3>Issues</h3>
<ul>
<li>No validation of API key format before use</li>
<li>No timeout on fetch calls - can hang indefinitely</li>
<li>Logs raw HTML content which could be huge</li>
<li>Generic error message doesn't help user understand what went wrong</li>
<li>No retry logic for rate limiting</li>
</ul>

<h3>Impact</h3>
<ul>
<li>Users cannot upload government ID</li>
<li>Entire verification flow is blocked</li>
<li>No clear error message to user</li>
</ul>

<h3>Steps to Reproduce</h3>
<ol>
<li>Go to Verified Vibe flow</li>
<li>Upload a government ID photo</li>
<li>See error: "Unexpected token '&lt;', '&lt;!doctype '... is not valid JSON"</li>
</ol>

<h3>Fix Priority</h3>
<ol>
<li>Verify ANTHROPIC_API_KEY is set and valid in .env.local</li>
<li>Add API key validation in verification.ts</li>
<li>Add try-catch around all JSON.parse() calls</li>
<li>Add timeout to fetch calls (30 seconds)</li>
<li>Add structured error responses from Claude API</li>
<li>Add retry logic with exponential backoff for rate limiting</li>
</ol>"""

    create_ticket(
        name="Government ID extraction fails with JSON parsing error",
        description=bug1_description,
        priority="urgent"
    )

    print()

    # Bug #2: Selfie Photo Upload Error Handling
    bug2_description = """<h2>Selfie photo upload fails silently with no error feedback</h2>

<h3>Root Cause</h3>
<p>Missing error handling in multiple layers:</p>
<ul>
<li><strong>Frontend</strong> - No try-catch on response.json()</li>
<li><strong>API Endpoint</strong> - Generic error messages</li>
<li><strong>Backend Function</strong> - Incomplete JSON parsing validation</li>
</ul>

<h3>Affected Code</h3>
<p><code>/src/lib/verified-vibe/components/LivenessStep.svelte</code> (lines 73-77)</p>
<pre><code>const result = await response.json();
extractedData = result.data;
isConfirming = true;</code></pre>

<p><code>/src/lib/verified-vibe/server/verification.ts</code> (lines 214-220)</p>
<pre><code>return {
  confidence: parsedResponse.confidence || 0,
  match: parsedResponse.match || parsedResponse.confidence >= 80
};</code></pre>

<h3>Issues</h3>
<ul>
<li>No try-catch on response.json() - crashes if API returns invalid JSON</li>
<li>No timeout handling - infinite loading if API hangs</li>
<li>No network error detection</li>
<li>No validation of confidence score range (allows > 100 or < 0)</li>
<li>Generic error messages don't help user understand what went wrong</li>
<li>No retry logic for transient failures</li>
</ul>

<h3>Impact</h3>
<ul>
<li>Users see blank screen or app crash when uploading selfie</li>
<li>No feedback on what went wrong</li>
<li>Cannot retry or get help</li>
<li>Verification flow is completely blocked</li>
</ul>

<h3>Steps to Reproduce</h3>
<ol>
<li>Go to Selfie Verification step</li>
<li>Upload a selfie photo</li>
<li>Click "Check Liveness"</li>
<li>See no error message or app crash</li>
</ol>

<h3>Fix Priority</h3>
<ol>
<li>Add try-catch around response.json() in LivenessStep.svelte</li>
<li>Add timeout handling with AbortController</li>
<li>Add specific error messages for different failure types</li>
<li>Add validation of confidence score (0-100 range)</li>
<li>Add retry logic with exponential backoff</li>
<li>Add user-friendly error messages</li>
</ol>"""

    create_ticket(
        name="Selfie photo upload fails silently with no error feedback",
        description=bug2_description,
        priority="high"
    )

    print()

    # Bug #3: Photo Story Upload Fails
    bug3_description = """<h2>Photo Story upload fails - unable to upload 5+ photos</h2>

<h3>Root Cause</h3>
<p>Multiple issues prevent successful photo upload:</p>
<ul>
<li><strong>Missing Error Handling</strong> - No try-catch on response.json()</li>
<li><strong>Unsafe Regex JSON Extraction</strong> - Greedy regex captures extra text</li>
<li><strong>No Timeout Handling</strong> - API calls can hang indefinitely</li>
<li><strong>No Validation of Response Structure</strong> - Assumes parsed JSON has required fields</li>
<li><strong>Generic Error Messages</strong> - User doesn't know what went wrong</li>
</ul>

<h3>Affected Code</h3>
<p><code>/src/lib/verified-vibe/components/PhotoUploadStep.svelte</code> (lines 115-135)</p>
<pre><code>const response = await fetch('/api/verified-vibe/check-photo-consistency', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    images: base64Images,
    mimeTypes: uploadedFiles.map(f => f.type)
  })
});

if (!response.ok) {
  const data = await response.json();
  throw new Error(data.error || 'Failed to check photo consistency');
}

const result = await response.json();
consistencyResult = result.data;</code></pre>

<p><code>/src/routes/api/verified-vibe/check-photo-consistency/+server.ts</code> (lines 130-145)</p>
<pre><code>// Extract JSON from response (Claude might include extra text)
const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  throw new Error('No JSON found in response');
}
const parsed = JSON.parse(jsonMatch[0]);
result = {
  confidence: Math.round(parsed.confidence),
  consistent: parsed.confidence >= 80
};</code></pre>

<h3>Issues</h3>
<ul>
<li>No try-catch on response.json() - crashes if API returns invalid JSON</li>
<li>Unsafe regex /\{[\s\S]*\}/ is too greedy - captures extra text from Claude response</li>
<li>No timeout on fetch - can hang indefinitely if Claude API is slow</li>
<li>No validation that parsed.confidence is a number (could be string or undefined)</li>
<li>No validation that parsed.consistent is a boolean</li>
<li>Generic error message "Failed to check photo consistency" doesn't help user</li>
<li>No retry logic for transient failures</li>
<li>No handling for rate limiting (429 errors)</li>
</ul>

<h3>Impact</h3>
<ul>
<li>Users cannot upload photos for their profile</li>
<li>Photo Story step is completely blocked</li>
<li>No feedback on what went wrong</li>
<li>Verification flow cannot proceed</li>
</ul>

<h3>Steps to Reproduce</h3>
<ol>
<li>Go to Verified Vibe flow</li>
<li>Complete ID and Selfie verification steps</li>
<li>Reach Photo Story step</li>
<li>Upload 5+ photos</li>
<li>Label all photos</li>
<li>Click "Check Consistency"</li>
<li>See error or blank screen</li>
</ol>

<h3>Fix Priority</h3>
<ol>
<li>Add try-catch around response.json() in PhotoUploadStep.svelte</li>
<li>Add timeout handling with AbortController (30 seconds)</li>
<li>Improve regex-based JSON extraction or use safer parsing</li>
<li>Add validation of parsed response structure</li>
<li>Add specific error messages for different failure types</li>
<li>Add retry logic with exponential backoff</li>
<li>Add rate limiting detection and handling</li>
</ol>"""

    create_ticket(
        name="Photo Story upload fails - unable to upload 5+ photos",
        description=bug3_description,
        priority="high"
    )

    print()
    print("=" * 80)
    print("✓ All tickets created successfully!")
    print("=" * 80)


if __name__ == "__main__":
    main()
