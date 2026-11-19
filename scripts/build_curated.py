import glob
import os
from common import save_category

CURATED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'curated')

def run_curated(only=None):
    for path in sorted(glob.glob(os.path.join(CURATED_DIR, '*.txt'))):
        cat_id = os.path.splitext(os.path.basename(path))[0]
        if only and cat_id not in only:
            continue
        print(f'== {cat_id} (curated)')
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
        save_category(cat_id, items)

if __name__ == '__main__':
    run_curated()
