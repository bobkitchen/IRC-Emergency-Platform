#!/usr/bin/env python3
"""
Enrich process-data.json tasks with relevant resources from resource-index.json.

For each task, looks at the task title, subtask titles, and existing resource names,
then finds matching resources from the resource index using keyword matching
with domain-specific synonyms. Adds matched resources to each task.

Usage:
    python3 scripts/enrich-tasks-with-resources.py
"""

import json
import re
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'src', 'data')

# Domain-specific synonym groups — any word in a group matches any other
SYNONYM_GROUPS = [
    {'sitrep', 'sit rep', 'situation report'},
    {'transition', 'handover', 'hand over', 'hand-over'},
    {'ermt', 'emergency response management team', 'management team'},
    {'conops', 'concept of operations', 'operational concept'},
    {'classification', 'classify', 'classified'},
    {'crf', 'crisis response fund'},
    {'erpp', 'emergency response procurement', 'procurement protocol'},
    {'assessment', 'msna', 'needs assessment', 'multi-sector needs'},
    {'deployment', 'deploy', 'surge', 'ert'},
    {'safeguarding', 'safeguard'},
    {'mou', 'memorandum of understanding'},
    {'tor', 'terms of reference'},
    {'sop', 'standard operating procedure'},
    {'budget', 'budgeting', 'operating budget'},
    {'logframe', 'log frame', 'logical framework'},
    {'response plan', 'response planning'},
    {'recruitment', 'recruit', 'staffing', 'hiring'},
    {'onboarding', 'on-boarding', 'induction'},
    {'security', 'safety', 's&s'},
    {'meal', 'monitoring evaluation accountability learning'},
    {'partnership', 'partners', 'peer'},
    {'preparedness', 'early action'},
    {'scenario', 'scenario planning'},
    {'factsheet', 'fact sheet', 'country factsheet'},
    {'communication', 'communications', 'comms'},
    {'scale target', 'scale methodology', '10% target'},
    {'per diem', 'perdiem', 'per-diem'},
    {'integra', 'erp system'},
    {'power bi', 'powerbi', 'reporting', 'dashboard'},
    {'org chart', 'organizational chart', 'organogram'},
    {'delegation of authority', 'doa'},
    {'legal counsel', 'labor law', 'labour law'},
    {'handbook', 'employee handbook'},
    {'r&r', 'rest and recuperation', 'rest and relaxation'},
    {'incident', 'incident report', 'incident notification'},
    {'evacuation', 'relocation', 'hibernation'},
    {'cash', 'cash readiness', 'cash programming'},
]

# Generic words that appear in many tasks — low signal, don't count as matches
GENERIC_WORDS = {
    'emergency', 'response', 'management', 'team', 'staff', 'country',
    'office', 'plan', 'planning', 'report', 'template', 'guidance',
    'process', 'system', 'support', 'review', 'ensure', 'provide',
    'coordinate', 'establish', 'identify', 'develop', 'submit', 'complete',
    'update', 'conduct', 'begin', 'start', 'initial', 'ongoing', 'regular',
    'key', 'task', 'action', 'request', 'form', 'list', 'information',
    'director', 'coordinator', 'officer', 'manager', 'lead',
}


def extract_keywords(text):
    """Extract meaningful keywords from text, lowercased."""
    if not text:
        return set()
    text = text.lower()
    stop = {'the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'by',
            'with', 'as', 'is', 'at', 'be', 'it', 'if', 'per', 'all', 'new',
            'from', 'this', 'that', 'are', 'was', 'has', 'had', 'not', 'but',
            'its', 'any', 'can', 'may', 'also', 'each', 'will', 'been', 'into',
            'more', 'other', 'than', 'some', 'such', 'only', 'over', 'after',
            'before', 'between', 'through', 'during', 'about', 'these', 'those'}
    tokens = re.findall(r'[a-z&]+', text)
    # Single words (minus stop words and generic words)
    words = set(t for t in tokens if t not in stop and t not in GENERIC_WORDS and len(t) > 2)
    # Bigrams (these are more specific and valuable)
    for i in range(len(tokens) - 1):
        bigram = f'{tokens[i]} {tokens[i+1]}'
        # Only include bigrams where at least one word is non-generic
        if tokens[i] not in GENERIC_WORDS or tokens[i+1] not in GENERIC_WORDS:
            words.add(bigram)
    return words - stop


def expand_with_synonyms(keywords):
    """Expand keyword set with synonyms."""
    expanded = set(keywords)
    for kw in keywords:
        for group in SYNONYM_GROUPS:
            if kw in group:
                expanded.update(group)
    return expanded


def score_match(task_keywords, resource_keywords, resource_name):
    """Score how well a resource matches a task. Higher = better match.

    Only counts meaningful keyword overlaps — ignores generic/short terms.
    """
    if not task_keywords or not resource_keywords:
        return 0

    overlap = task_keywords & resource_keywords
    if not overlap:
        return 0

    # Only count overlaps of meaningful keywords (>3 chars or multi-word)
    meaningful = [w for w in overlap if len(w) > 4 or ' ' in w]
    if not meaningful:
        return 0

    # Score: sum of lengths, but cap single-word contribution
    score = 0
    for w in meaningful:
        if ' ' in w:
            score += len(w) * 1.5  # Bigram matches are much more valuable
        else:
            score += len(w)

    return score


def main():
    # Load data
    with open(os.path.join(DATA_DIR, 'process-data.json')) as f:
        pd = json.load(f)
    with open(os.path.join(DATA_DIR, 'resource-index.json')) as f:
        ri = json.load(f)

    # Pre-compute resource keywords (expanded with synonyms)
    resource_entries = []
    for r in ri:
        if not r.get('url') or not r['url'].startswith('http'):
            continue
        kws = extract_keywords(r['name'])
        kws_expanded = expand_with_synonyms(kws)
        resource_entries.append({
            'name': r['name'],
            'url': r['url'],
            'sector': r.get('sector', ''),
            'task': r.get('task', ''),
            'keywords': kws_expanded,
        })

    print(f'Resource index: {len(resource_entries)} entries with URLs')

    # Process each task
    total_enriched = 0
    total_added = 0

    for sector in pd['sectors']:
        for task in sector['tasks']:
            # Build keyword set from task title + subtask titles + existing resource names
            text_parts = [task['title']]
            for sub in task.get('subtasks', []):
                text_parts.append(sub.get('title', ''))
                for res in sub.get('resources', []):
                    text_parts.append(res.get('name', ''))
            for res in task.get('resources', []):
                text_parts.append(res.get('name', ''))

            combined_text = ' '.join(text_parts)
            task_keywords = extract_keywords(combined_text)
            task_keywords = expand_with_synonyms(task_keywords)

            # Collect existing URLs to avoid duplicates
            existing_urls = set()
            for res in task.get('resources', []):
                if res.get('url'):
                    existing_urls.add(res['url'].lower().rstrip('/'))
            for sub in task.get('subtasks', []):
                for res in sub.get('resources', []):
                    if res.get('url'):
                        existing_urls.add(res['url'].lower().rstrip('/'))

            # Score all resources against this task
            scored = []
            for entry in resource_entries:
                url_key = entry['url'].lower().rstrip('/')
                if url_key in existing_urls:
                    continue  # Already linked
                score = score_match(task_keywords, entry['keywords'], entry['name'])
                if score >= 8:  # Higher threshold for meaningful matches
                    scored.append((score, entry))

            # Take top matches (limit to avoid clutter)
            scored.sort(key=lambda x: -x[0])
            matches = scored[:3]  # Max 3 suggested resources per task

            if matches:
                total_enriched += 1
                for score, entry in matches:
                    task['resources'].append({
                        'name': entry['name'],
                        'url': entry['url'],
                        'type': 'suggested',
                    })
                    total_added += 1
                    print(f'  {task["id"]}: +"{entry["name"]}" (score={score:.0f})')

    print(f'\nEnriched {total_enriched} tasks with {total_added} new resource links')

    # Write updated process-data
    with open(os.path.join(DATA_DIR, 'process-data.json'), 'w') as f:
        json.dump(pd, f, indent=2)
    print(f'Wrote {os.path.join(DATA_DIR, "process-data.json")}')


if __name__ == '__main__':
    main()
