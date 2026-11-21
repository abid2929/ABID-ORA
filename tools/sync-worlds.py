"""Mark every world that has a module in src/worlds/wNNN.ts as live (page 'world') in experiences.json.
Run before building: python3 tools/sync-worlds.py"""
import json, os, re
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
p = os.path.join(root, 'public/_abidora/data/experiences.json')
built = {int(m.group(1)) for f in os.listdir(os.path.join(root, 'src/worlds')) if (m := re.fullmatch(r'w(\d{3})\.ts', f))}
d = json.load(open(p)); n = 0
for x in d['items']:
    if x['id'] in built: x['status'] = 'live'; x['page'] = 'world'; n += 1
    elif x.get('page') == 'world': x['status'] = 'planned'; x.pop('page')
json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('live worlds via world page:', n, sorted(built))
