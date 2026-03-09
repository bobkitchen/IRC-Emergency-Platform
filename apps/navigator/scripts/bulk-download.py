"""
Bulk download all Box files referenced in process-data.json.
READ ONLY - downloads only, never modifies anything on Box.
"""
import sys, json, os, re, time
sys.path.insert(0, r'C:\Users\BOB\AppData\Roaming\Python\Python313\site-packages')
import requests

OUTDIR = r'C:\Users\BOB\.openclaw\workspace\emergency-response\box-downloads'
DATA_JSON = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'process-data.json')

os.makedirs(OUTDIR, exist_ok=True)

# Load token
def get_token():
    with open(os.path.expanduser('~/.box/IRC_token_cache.json')) as f:
        return json.load(f)['accessToken']

# Extract all unique Box URLs from process-data.json
with open(DATA_JSON, 'r', encoding='utf-8') as f:
    raw = f.read()

box_urls = list(set(re.findall(r'https://rescue(?:\.app)?\.box\.com/[^"]+', raw)))
# Also get RescueNet URLs (can't download those - need browser)
rescuenet_urls = list(set(re.findall(r'https://rescuenet\.rescue\.org/[^"]+', raw)))

print(f"Found {len(box_urls)} Box URLs, {len(rescuenet_urls)} RescueNet URLs (skipping)")

downloaded = 0
failed = 0
skipped = 0
folders = 0
token = get_token()

def resolve_shared_link(url):
    headers = {
        'Authorization': f'Bearer {token}',
        'BoxApi': f'shared_link={url}'
    }
    r = requests.get('https://api.box.com/2.0/shared_items?fields=id,name,type,permissions,size', headers=headers)
    if r.status_code == 200:
        return r.json()
    return None

def download_file(file_id, filename, shared_url):
    headers = {
        'Authorization': f'Bearer {token}',
        'BoxApi': f'shared_link={shared_url}'
    }
    r = requests.get(f'https://api.box.com/2.0/files/{file_id}/content', headers=headers, allow_redirects=True)
    if r.status_code == 200:
        outpath = os.path.join(OUTDIR, filename)
        # Handle duplicate names
        base, ext = os.path.splitext(filename)
        counter = 1
        while os.path.exists(outpath):
            outpath = os.path.join(OUTDIR, f"{base}_{counter}{ext}")
            counter += 1
        with open(outpath, 'wb') as f:
            f.write(r.content)
        return outpath
    return None

for i, url in enumerate(sorted(box_urls)):
    # Clean URL
    url = url.rstrip('?').rstrip('/')
    
    # Skip non-file URLs (mailto, etc)
    if 'box.com' not in url:
        skipped += 1
        continue
    
    print(f"[{i+1}/{len(box_urls)}] {url[:80]}...")
    
    try:
        item = resolve_shared_link(url)
        if not item:
            print(f"  FAIL: couldn't resolve")
            failed += 1
            continue
        
        if item['type'] == 'folder':
            print(f"  SKIP (folder): {item['name']}")
            folders += 1
            continue
        
        if item['type'] == 'file':
            # Check if already downloaded
            name = item['name']
            if os.path.exists(os.path.join(OUTDIR, name)):
                print(f"  EXISTS: {name}")
                skipped += 1
                continue
            
            if not item.get('permissions', {}).get('can_download', False):
                print(f"  SKIP (no download permission): {name}")
                skipped += 1
                continue
            
            path = download_file(item['id'], name, url)
            if path:
                size = os.path.getsize(path)
                print(f"  OK: {name} ({size:,} bytes)")
                downloaded += 1
            else:
                print(f"  FAIL: {name}")
                failed += 1
        
        # Rate limit - be gentle
        time.sleep(0.3)
        
    except Exception as e:
        print(f"  ERROR: {e}")
        failed += 1

print(f"\n{'='*60}")
print(f"DONE: {downloaded} downloaded, {skipped} skipped, {folders} folders, {failed} failed")
print(f"Files saved to: {OUTDIR}")
