import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, 'data')
BLACKLIST_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blacklist.txt')

CAT_META = {
    'film': ('Film', '🎬'),
    'serie': ('Serie TV', '📺'),
    'giochi': ('Videogiochi', '🎮'),
    'anime': ('Anime & Manga', '⛩️'),
    'disney': ('Disney & Pixar', '🏰'),
    'attori': ('Attori', '🎭'),
    'registi': ('Registi', '🎥'),
    'musica': ('Musica', '🎵'),
    'calcio': ('Calciatori', '⚽'),
    'storici': ('Personaggi storici', '🏛️'),
    'famosi': ('Personaggi famosi', '⭐'),
    'citta': ('Città del mondo', '🌍'),
    'paesi': ('Paesi', '🚩'),
    'luoghi': ('Luoghi & monumenti', '🗺️'),
    'mestieri': ('Mestieri', '💼'),
    'animali': ('Animali', '🦁'),
    'cibi': ('Cibi & bevande', '🍕'),
    'oggetti': ('Oggetti', '🔧'),
    'vestiti': ('Vestiti & accessori', '👕'),
    'trasporti': ('Mezzi di trasporto', '🚗'),
    'sport': ('Sport & giochi', '🏆'),
    'natura': ('Natura & scienza', '🌳'),
}

def load_blacklist():
    if not os.path.exists(BLACKLIST_PATH):
        return set()
    with open(BLACKLIST_PATH, encoding='utf-8') as f:
        return {line.strip().lower() for line in f if line.strip()}

def load_env():
    env_path = os.path.join(ROOT, '.env')
    if not os.path.exists(env_path):
        return
    with open(env_path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or '=' not in line:
                continue
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

def clean_name(raw):
    if not raw:
        return ''
    s = re.sub(r'\s*\([^)]*\)\s*$', '', raw.strip())
    s = re.sub(r'\s+', ' ', s).strip()
    if not s or len(s) > 42 or re.fullmatch(r'Q\d+', s):
        return ''
    return s

def save_category(cat_id, items):
    os.makedirs(DATA_DIR, exist_ok=True)
    bl = load_blacklist()
    seen = set()
    groups = {}
    total = 0
    for name, group in items:
        c = clean_name(name)
        if not c:
            continue
        key = c.lower()
        if key in bl or key in seen:
            continue
        seen.add(key)
        g = (group or 'Generale').strip()
        groups.setdefault(g, []).append(c)
        total += 1
    label, emoji = CAT_META.get(cat_id, (cat_id.capitalize(), '🎯'))
    payload = {
        'id': cat_id,
        'n': label,
        'e': emoji,
        'count': total,
        'g': groups,
    }
    out_path = os.path.join(DATA_DIR, f'{cat_id}.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  -> saved {out_path} ({total} entries, {len(groups)} groups)')
    return payload

def write_index():
    os.makedirs(DATA_DIR, exist_ok=True)
    cats = []
    for cat_id, (label, emoji) in CAT_META.items():
        path = os.path.join(DATA_DIR, f'{cat_id}.json')
        if os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                d = json.load(f)
            cats.append({'id': cat_id, 'n': d['n'], 'e': d['e'], 'count': d['count']})
    idx_path = os.path.join(DATA_DIR, 'index.json')
    with open(idx_path, 'w', encoding='utf-8') as f:
        json.dump({'categories': cats}, f, ensure_ascii=False, separators=(',', ':'))
    print(f'Updated {idx_path} with {len(cats)} categories.')
