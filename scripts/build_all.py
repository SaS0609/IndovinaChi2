import argparse
from build_curated import run_curated
from common import write_index
from fetch_anilist import fetch_anime
from fetch_qlever import run_qlever
from fetch_tmdb import run_tmdb

TMDB_CATS = ['film', 'serie', 'attori', 'registi']
QLEVER_CATS = ['giochi', 'calcio', 'musica', 'storici', 'famosi', 'disney', 'citta', 'paesi', 'luoghi', 'mestieri']

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='comma-separated categories')
    args = ap.parse_args()
    only = set(args.only.split(',')) if args.only else None

    run_curated(only)

    if not only or 'anime' in only:
        try:
            fetch_anime()
        except Exception as e:
            print(f'  !! error on anime: {e}')

    tmdb_targets = [c for c in TMDB_CATS if not only or c in only]
    qlever_targets = [c for c in QLEVER_CATS if not only or c in only]

    if tmdb_targets:
        used_tmdb = run_tmdb(tmdb_targets)
        if not used_tmdb:
            qlever_targets = tmdb_targets + qlever_targets

    if qlever_targets:
        run_qlever(qlever_targets)

    write_index()

if __name__ == '__main__':
    main()
