import json
import os
import re
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, 'data')
CURATED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'curated')
BLACKLIST_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blacklist.txt')

CAT_META = {
    'film': ('Film', '🎬'),
    'serie': ('Serie TV', '📺'),
    'giochi': ('Videogiochi', '🎮'),
    'anime': ('Anime & Manga', '⛩️'),
    'disney': ('Disney & Pixar', '🏰'),
    'supereroi': ('Supereroi & cattivi', '🦸'),
    'attori': ('Attori', '🎭'),
    'registi': ('Registi', '🎥'),
    'musica': ('Cantanti & band', '🎤'),
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

NON_LATIN_RE = re.compile(r'[\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]')
GAME_NOISE_RE = re.compile(
    r"(\s*[-–:]\s*(definitive|goty|game of the year|remastered|enhanced|complete|director's cut|anniversary|special|deluxe|ultimate|hd|legacy)\b.*$)",
    re.IGNORECASE,
)
ARTICLE_RE = re.compile(r'^(il|lo|la|i|gli|le|un|uno|una|the|a|an)\s+', re.IGNORECASE)

def load_blacklist():
    if not os.path.exists(BLACKLIST_PATH):
        return set()
    with open(BLACKLIST_PATH, encoding='utf-8') as f:
        return {dedup_key(line) for line in f if line.strip()}

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

def dedup_key(text):
    s = unicodedata.normalize('NFKD', text or '')
    s = ''.join(ch for ch in s if not unicodedata.combining(ch)).lower().strip()
    s = re.sub(r"^l['’]\s*", '', s)
    s = ARTICLE_RE.sub('', s)
    return re.sub(r'[^a-z0-9]+', '', s)

def clean_name(raw, cat_id=''):
    if not raw:
        return ''
    s = raw.replace('™', '').replace('®', '').strip()
    s = re.sub(r'\s*\([^)]*\)\s*$', '', s)
    if cat_id == 'giochi':
        s = GAME_NOISE_RE.sub('', s)
    s = re.sub(r'\s+', ' ', s).strip(' -–:')
    if not s or len(s) > 44 or re.fullmatch(r'Q\d+', s):
        return ''
    if NON_LATIN_RE.search(s):
        return ''
    return s

def load_curated_items(cat_id):
    path = os.path.join(CURATED_DIR, f'{cat_id}.txt')
    if not os.path.exists(path):
        return []
    items = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or ':' not in line:
                continue
            grp, rest = line.split(':', 1)
            grp = grp.strip()
            for entry in rest.split(','):
                entry = entry.strip()
                if entry:
                    items.append((entry, grp))
    return items

def save_category(cat_id, items):
    os.makedirs(DATA_DIR, exist_ok=True)
    bl = load_blacklist()
    curated = load_curated_items(cat_id)
    combined = curated + list(items)
    seen = set()
    groups = {}
    total = 0
    for name, group in combined:
        c = clean_name(name, cat_id)
        if not c:
            continue
        key = dedup_key(c)
        if not key or key in bl or key in seen:
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
    for cat_id in CAT_META:
        path = os.path.join(DATA_DIR, f'{cat_id}.json')
        if os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                d = json.load(f)
            cats.append({'id': cat_id, 'n': d['n'], 'e': d['e'], 'count': d['count']})
    idx_path = os.path.join(DATA_DIR, 'index.json')
    with open(idx_path, 'w', encoding='utf-8') as f:
        json.dump({'categories': cats}, f, ensure_ascii=False, separators=(',', ':'))
    print(f'Updated {idx_path} with {len(cats)} categories.')
