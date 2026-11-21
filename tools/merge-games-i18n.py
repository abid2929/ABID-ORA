"""Merge tools/i18n-games.json (game worlds 11, 36, 41, 82, 99) into public/_abidora/i18n/<lang>.json.
Existing keys with the same name are replaced; nothing else changes. Run: python3 tools/merge-games-i18n.py"""
import json, os
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
src = json.load(open(os.path.join(here, 'i18n-games.json'), encoding='utf-8'))
for lang, kv in src.items():
    if lang.startswith('_'): continue
    p = os.path.join(root, 'public/_abidora/i18n', lang + '.json')
    d = json.load(open(p, encoding='utf-8')); d.update(kv)
    json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(lang, len(kv), 'keys merged')
