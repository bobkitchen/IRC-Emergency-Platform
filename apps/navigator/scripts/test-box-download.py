import sys, json, os
sys.path.insert(0, r'C:\Users\BOB\AppData\Roaming\Python\Python313\site-packages')
import requests

with open(os.path.expanduser('~/.box/IRC_token_cache.json')) as f:
    tokens = json.load(f)
access_token = tokens['accessToken']

# Check permissions on shared item
url = 'https://rescue.app.box.com/s/hyucu64v6jakttw45b240cn2wg3iws4x'
headers = {
    'Authorization': f'Bearer {access_token}',
    'BoxApi': f'shared_link={url}'
}
r = requests.get('https://api.box.com/2.0/shared_items?fields=id,name,permissions,shared_link', headers=headers)
data = r.json()
print(f"File: {data.get('name')}")
print(f"Permissions: {json.dumps(data.get('permissions', {}), indent=2)}")
print(f"Shared link: {json.dumps(data.get('shared_link', {}), indent=2)}")

# Try download WITH shared link header
r2 = requests.get(
    f"https://api.box.com/2.0/files/{data['id']}/content",
    headers=headers,
    allow_redirects=True
)
print(f"\nDownload with shared_link header: {r2.status_code}, {len(r2.content)} bytes")
if r2.status_code == 200:
    print("SUCCESS!")
else:
    print(r2.text[:300])
