from common import save_category

PURE_CURATED = ['animali', 'cibi', 'natura', 'oggetti', 'sport', 'trasporti', 'vestiti', 'supereroi']

def run_curated(only=None):
    for cat_id in PURE_CURATED:
        if only and cat_id not in only:
            continue
        print(f'== {cat_id} (curated)')
        save_category(cat_id, [])

if __name__ == '__main__':
    run_curated()
