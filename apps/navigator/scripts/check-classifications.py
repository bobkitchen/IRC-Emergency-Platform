import json

with open(r'C:\Users\BOB\.openclaw\workspace\emergency-response\app\src\data\process-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Check guideline sections
for section in data.get('guidelineSections', []):
    t = section.get('title', '')
    c = section.get('content', '')
    if 'classif' in t.lower() or 'classif' in c[:500].lower() or 'yellow' in c[:500].lower():
        print(f"=== {t} ===")
        print(c[:1500])
        print()

# Check search chunks for classification info
with open(r'C:\Users\BOB\.openclaw\workspace\emergency-response\app\src\data\search-chunks.json', 'r', encoding='utf-8') as f:
    chunks = json.load(f)

for chunk in chunks:
    if 'classif' in chunk.get('title', '').lower() and chunk['id'].startswith('guide'):
        print(f"=== CHUNK: {chunk['title']} ===")
        print(chunk['content'][:1000])
        print()

# Also search for the actual text
for chunk in chunks:
    c = chunk.get('content', '').lower()
    if 'yellow' in c and 'orange' in c and 'red' in c and ('classif' in c or 'stance' in c):
        print(f"=== CHUNK: {chunk['title']} ({chunk['id']}) ===")
        print(chunk['content'][:1500])
        print("---")
        break
