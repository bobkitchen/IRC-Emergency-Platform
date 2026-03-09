"""Merge existing search-chunks.json with box-chunks.json into a single index."""
import json, os

DATA_DIR = r'C:\Users\BOB\.openclaw\workspace\emergency-response\app\src\data'

with open(os.path.join(DATA_DIR, 'search-chunks.json'), 'r', encoding='utf-8') as f:
    existing = json.load(f)

with open(os.path.join(DATA_DIR, 'box-chunks.json'), 'r', encoding='utf-8') as f:
    box = json.load(f)

# Deduplicate by id
ids = {c['id'] for c in existing}
added = 0
for chunk in box:
    if chunk['id'] not in ids:
        existing.append(chunk)
        ids.add(chunk['id'])
        added += 1

with open(os.path.join(DATA_DIR, 'search-chunks.json'), 'w', encoding='utf-8') as f:
    json.dump(existing, f, indent=2, ensure_ascii=False)

print(f"Merged: {added} new chunks added")
print(f"Total chunks in index: {len(existing)}")
