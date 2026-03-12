#!/usr/bin/env python3
"""
Audit all Box shared links in resource-index.json using the Box API.

Unlike HTTP HEAD/GET requests (which fail because Box serves an SPA),
this uses the Box Content API /2.0/shared_items endpoint — the only
reliable way to check if a shared link is valid.

Setup:
  1. Go to https://app.box.com/developers/console
  2. Create a Custom App (or use existing) → Server Authentication (CCG)
  3. Generate a Developer Token (valid 60 min)
  4. Run: python3 scripts/audit-box-links.py <YOUR_TOKEN>

  Or save token to ~/.box/IRC_token_cache.json:
    {"accessToken": "YOUR_TOKEN_HERE"}
  Then run without args: python3 scripts/audit-box-links.py

Output:
  - Prints summary to stdout
  - Writes link-audit.json with full results
"""

import json
import os
import sys
import time

try:
    import requests
except ImportError:
    print("Installing requests...")
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--break-system-packages', 'requests'])
    import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'src', 'data')


def get_token():
    """Get Box access token from CLI arg or cache file."""
    if len(sys.argv) > 1:
        return sys.argv[1]
    cache_path = os.path.expanduser('~/.box/IRC_token_cache.json')
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            return json.load(f)['accessToken']
    print("Usage: python3 audit-box-links.py <BOX_ACCESS_TOKEN>")
    print()
    print("Get a token:")
    print("  1. Go to https://app.box.com/developers/console")
    print("  2. Open your app → Configuration → Developer Token")
    print("  3. Click 'Generate Developer Token' (valid 60 min)")
    sys.exit(1)


def check_box_link(url, token):
    """Check a Box shared link via the API. Returns (status, info)."""
    headers = {
        'Authorization': f'Bearer {token}',
        'BoxApi': f'shared_link={url}'
    }
    try:
        r = requests.get(
            'https://api.box.com/2.0/shared_items',
            params={'fields': 'id,name,type,shared_link'},
            headers=headers,
            timeout=15
        )
        if r.status_code == 200:
            data = r.json()
            return 'valid', {
                'box_id': data.get('id'),
                'box_name': data.get('name'),
                'box_type': data.get('type'),
            }
        elif r.status_code == 404:
            return 'broken', {'reason': 'Not found — link removed or expired'}
        elif r.status_code == 403:
            return 'restricted', {'reason': 'Access denied — may need different permissions'}
        elif r.status_code == 401:
            return 'auth_error', {'reason': 'Token invalid or expired — generate a new one'}
        else:
            return 'error', {'reason': f'HTTP {r.status_code}: {r.text[:200]}'}
    except requests.Timeout:
        return 'timeout', {'reason': 'Request timed out'}
    except Exception as e:
        return 'error', {'reason': str(e)}


def check_other_link(url):
    """Check a non-Box link with a standard HEAD/GET request."""
    try:
        r = requests.head(url, timeout=10, allow_redirects=True,
                         headers={'User-Agent': 'Mozilla/5.0'})
        if r.status_code < 400:
            return 'valid', {}
        # Try GET as fallback
        r = requests.get(url, timeout=10, allow_redirects=True,
                        headers={'User-Agent': 'Mozilla/5.0'}, stream=True)
        if r.status_code < 400:
            return 'valid', {}
        return 'broken', {'reason': f'HTTP {r.status_code}'}
    except Exception as e:
        return 'error', {'reason': str(e)}


def main():
    token = get_token()

    with open(os.path.join(DATA_DIR, 'resource-index.json')) as f:
        resources = json.load(f)

    urls_to_check = [r for r in resources if r.get('url', '').startswith('http')]
    print(f"Checking {len(urls_to_check)} resource links...")
    print()

    results = {'valid': [], 'broken': [], 'restricted': [], 'error': []}

    for i, r in enumerate(urls_to_check):
        url = r['url']
        is_box = 'box.com' in url

        if is_box:
            status, info = check_box_link(url, token)
        else:
            status, info = check_other_link(url)

        entry = {
            'name': r['name'],
            'url': url,
            'sector': r.get('sector', ''),
            'task': r.get('task', ''),
            'status': status,
            **info
        }

        if status == 'valid':
            results['valid'].append(entry)
            icon = '✓'
        elif status == 'restricted':
            results['restricted'].append(entry)
            icon = '🔒'
        elif status == 'broken':
            results['broken'].append(entry)
            icon = '✗'
        else:
            results['error'].append(entry)
            icon = '?'

        if status != 'valid':
            print(f"  {icon} [{status}] {r['name'][:60]}")
            if 'reason' in info:
                print(f"    {info['reason']}")

        # Check for auth failure early
        if status == 'auth_error':
            print("\nToken is invalid. Generate a new one and retry.")
            sys.exit(1)

        # Rate limit: Box API allows ~10 req/sec
        if is_box and (i + 1) % 10 == 0:
            time.sleep(1)

        if (i + 1) % 50 == 0:
            print(f"  ... checked {i + 1}/{len(urls_to_check)}")

    # Summary
    print(f"\n{'='*50}")
    print(f"AUDIT SUMMARY")
    print(f"{'='*50}")
    print(f"  Valid:      {len(results['valid'])}")
    print(f"  Broken:     {len(results['broken'])}")
    print(f"  Restricted: {len(results['restricted'])}")
    print(f"  Errors:     {len(results['error'])}")
    print(f"  Total:      {len(urls_to_check)}")

    # Write report
    report = {
        'checked_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'method': 'Box API /2.0/shared_items (authenticated)',
        'summary': {
            'valid': len(results['valid']),
            'broken': len(results['broken']),
            'restricted': len(results['restricted']),
            'errors': len(results['error']),
        },
        **results
    }
    out_path = os.path.join(SCRIPT_DIR, '..', 'link-audit.json')
    with open(out_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\nFull report: {out_path}")


if __name__ == '__main__':
    main()
