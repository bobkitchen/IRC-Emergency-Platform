"""
Pass 2: Download files from shared folder+file URLs and bare file URLs.
Also download contents of shared folders.
READ ONLY.
"""
import sys, json, os, re, time
sys.path.insert(0, r'C:\Users\BOB\AppData\Roaming\Python\Python313\site-packages')
import requests

OUTDIR = r'C:\Users\BOB\.openclaw\workspace\emergency-response\box-downloads'
DATA_JSON = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'process-data.json')

def get_token():
    with open(os.path.expanduser('~/.box/IRC_token_cache.json')) as f:
        return json.load(f)['accessToken']

token = get_token()
headers_base = {'Authorization': f'Bearer {token}'}

with open(DATA_JSON, 'r', encoding='utf-8') as f:
    raw = f.read()

box_urls = list(set(re.findall(r'https://rescue(?:\.app)?\.box\.com/[^"]+', raw)))

downloaded = 0
failed = 0
skipped = 0

def existing(name):
    name = sanitize_filename(name)
    return os.path.exists(os.path.join(OUTDIR, name))

def sanitize_filename(name):
    """Remove characters illegal in Windows filenames."""
    for ch in [':', '*', '?', '"', '<', '>', '|']:
        name = name.replace(ch, '_')
    return name.strip()

def save_file(content, name):
    name = sanitize_filename(name)
    path = os.path.join(OUTDIR, name)
    base, ext = os.path.splitext(name)
    counter = 1
    while os.path.exists(path):
        path = os.path.join(OUTDIR, f"{base}_{counter}{ext}")
        counter += 1
    with open(path, 'wb') as f:
        f.write(content)
    return path

def download_by_id(file_id, shared_link=None):
    """Download file by ID, optionally with shared link context."""
    h = dict(headers_base)
    if shared_link:
        h['BoxApi'] = f'shared_link={shared_link}'
    r = requests.get(f'https://api.box.com/2.0/files/{file_id}/content', headers=h, allow_redirects=True)
    return r if r.status_code == 200 else None

def get_file_info(file_id, shared_link=None):
    h = dict(headers_base)
    if shared_link:
        h['BoxApi'] = f'shared_link={shared_link}'
    r = requests.get(f'https://api.box.com/2.0/files/{file_id}?fields=name,size,type', headers=h)
    return r.json() if r.status_code == 200 else None

def get_folder_items(folder_id, shared_link=None):
    h = dict(headers_base)
    if shared_link:
        h['BoxApi'] = f'shared_link={shared_link}'
    items = []
    offset = 0
    while True:
        r = requests.get(f'https://api.box.com/2.0/folders/{folder_id}/items?limit=100&offset={offset}&fields=id,name,type,size', headers=h)
        if r.status_code != 200:
            break
        data = r.json()
        items.extend(data.get('entries', []))
        if len(items) >= data.get('total_count', 0):
            break
        offset += 100
    return items

def resolve_shared(url):
    h = dict(headers_base)
    h['BoxApi'] = f'shared_link={url}'
    r = requests.get('https://api.box.com/2.0/shared_items?fields=id,name,type', headers=h)
    return r.json() if r.status_code == 200 else None

# Pattern 1: shared_link/file/ID URLs (folder shared link + specific file)
folder_file_urls = [u for u in box_urls if re.search(r'/s/[a-z0-9]+/file/\d+', u)]
print(f"=== Pattern 1: {len(folder_file_urls)} folder+file URLs ===")

for url in sorted(folder_file_urls):
    m = re.search(r'(/s/[a-z0-9]+)/file/(\d+)', url)
    if not m:
        continue
    base_url = url[:url.index(m.group(0))] + m.group(1)
    file_id = m.group(2)
    
    print(f"  File {file_id} from {base_url[:60]}...")
    
    info = get_file_info(file_id, base_url)
    if not info or 'name' not in info:
        # Try without shared link
        info = get_file_info(file_id)
    
    if not info or 'name' not in info:
        print(f"    FAIL: can't get info")
        failed += 1
        continue
    
    if existing(info['name']):
        print(f"    EXISTS: {info['name']}")
        skipped += 1
        continue
    
    r = download_by_id(file_id, base_url)
    if not r:
        r = download_by_id(file_id)
    
    if r:
        save_file(r.content, info['name'])
        print(f"    OK: {info['name']} ({len(r.content):,} bytes)")
        downloaded += 1
    else:
        print(f"    FAIL: {info['name']}")
        failed += 1
    
    time.sleep(0.3)

# Pattern 2: bare file URLs without shared token
bare_file_urls = [u for u in box_urls if re.search(r'/file/\d+$', u) or re.search(r'/file/\d+\?', u)]
bare_file_urls = [u for u in bare_file_urls if '/s/' not in u]
print(f"\n=== Pattern 2: {len(bare_file_urls)} bare file URLs ===")

for url in sorted(bare_file_urls):
    m = re.search(r'/file/(\d+)', url)
    if not m:
        continue
    file_id = m.group(1)
    
    # Check for ?s= parameter
    shared = None
    s_match = re.search(r'\?s=([a-z0-9]+)', url)
    if s_match:
        shared = url
    
    print(f"  File {file_id}...")
    info = get_file_info(file_id, shared)
    if not info or 'name' not in info:
        info = get_file_info(file_id)
    
    if not info or 'name' not in info:
        print(f"    FAIL: can't get info")
        failed += 1
        continue
    
    if existing(info['name']):
        print(f"    EXISTS: {info['name']}")
        skipped += 1
        continue
    
    r = download_by_id(file_id, shared)
    if not r:
        r = download_by_id(file_id)
    
    if r:
        save_file(r.content, info['name'])
        print(f"    OK: {info['name']} ({len(r.content):,} bytes)")
        downloaded += 1
    else:
        print(f"    FAIL: {info['name']}")
        failed += 1
    
    time.sleep(0.3)

# Pattern 3: shared folders - download their file contents
folder_urls = [u for u in box_urls if '/folder/' in u or (re.search(r'/s/[a-z0-9]+$', u.rstrip('/')))]
# Resolve to find which are folders
print(f"\n=== Pattern 3: Checking {len(folder_urls)} potential folder URLs ===")

for url in sorted(set(folder_urls)):
    url = url.rstrip('/')
    item = resolve_shared(url)
    if not item or item.get('type') != 'folder':
        continue
    
    folder_name = item.get('name', 'unknown')
    folder_id = item['id']
    print(f"  Folder: {folder_name} ({folder_id})")
    
    items = get_folder_items(folder_id, url)
    files = [i for i in items if i['type'] == 'file']
    print(f"    {len(files)} files in folder")
    
    for f in files:
        if f['name'].lower().endswith(('.mp4', '.mov', '.avi', '.mkv')):
            print(f"      SKIP (video): {f['name']}")
            skipped += 1
            continue
        
        if existing(f['name']):
            print(f"      EXISTS: {f['name']}")
            skipped += 1
            continue
        
        r = download_by_id(f['id'], url)
        if not r:
            r = download_by_id(f['id'])
        
        if r:
            save_file(r.content, f['name'])
            print(f"      OK: {f['name']} ({len(r.content):,} bytes)")
            downloaded += 1
        else:
            print(f"      FAIL: {f['name']}")
            failed += 1
        
        time.sleep(0.3)

print(f"\n{'='*60}")
print(f"PASS 2 DONE: {downloaded} downloaded, {skipped} skipped, {failed} failed")

# Final total
total = len(os.listdir(OUTDIR))
total_size = sum(os.path.getsize(os.path.join(OUTDIR, f)) for f in os.listdir(OUTDIR))
print(f"Total files in box-downloads: {total} ({total_size/1024/1024:.1f} MB)")
