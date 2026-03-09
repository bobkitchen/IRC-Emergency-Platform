import json, os

with open(r'C:\Users\BOB\.openclaw\workspace\emergency-response\app\src\data\process-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=== METADATA (hardcoded in process-data.json) ===")
print(json.dumps(data['metadata'], indent=2))

resources_with_urls = 0
total_resources = 0
for s in data['sectors']:
    for t in s['tasks']:
        for r in t.get('resources', []):
            total_resources += 1
            if r.get('url', '').startswith('http'):
                resources_with_urls += 1
        for sub in t.get('subtasks', []):
            for r in sub.get('resources', []):
                total_resources += 1
                if r.get('url', '').startswith('http'):
                    resources_with_urls += 1

print(f"\n=== ACTUAL COUNTS ===")
print(f"Resources in task cards: {total_resources} ({resources_with_urls} with URLs)")
print(f"Annexes: {len(data.get('annexes', []))}")
print(f"EmU Services: {len(data.get('emuServices', []))}")
print(f"Preparedness Library: {len(data.get('preparednessLibrary', []))}")

with open(r'C:\Users\BOB\.openclaw\workspace\emergency-response\app\src\data\search-chunks.json', 'r', encoding='utf-8') as f:
    chunks = json.load(f)
box_chunks = [c for c in chunks if c['id'].startswith('box-')]
print(f"Search chunks: {len(chunks)} total ({len(box_chunks)} from Box docs, {len(chunks)-len(box_chunks)} from process)")

with open(r'C:\Users\BOB\.openclaw\workspace\emergency-response\app\src\data\resource-index.json', 'r', encoding='utf-8') as f:
    res_idx = json.load(f)
print(f"Resource index (with URLs): {len(res_idx)}")

dl = r'C:\Users\BOB\.openclaw\workspace\emergency-response\box-downloads'
files = [f for f in os.listdir(dl) if os.path.isfile(os.path.join(dl, f))]
exts = {}
for f in files:
    ext = os.path.splitext(f)[1].lower() or '(none)'
    exts[ext] = exts.get(ext, 0) + 1
print(f"Box downloaded files: {len(files)}")
print(f"  By type: {json.dumps(dict(sorted(exts.items(), key=lambda x: -x[1])))}")
