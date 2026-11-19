import json
import os
import time
import urllib.parse
import urllib.request
from common import load_env, save_category

BASE = 'https://api.themoviedb.org/3'

def tmdb_get(path, params, api_key):
    params = dict(params)
    params['language'] = 'it-IT'
    headers = {'Accept': 'application/json'}
    if len(api_key) > 40 or '.' in api_key:
        headers['Authorization'] = f'Bearer {api_key}'
    else:
        params['api_key'] = api_key
    url = f'{BASE}{path}?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def fetch_genres(kind, api_key):
    data = tmdb_get(f'/genre/{kind}/list', {}, api_key)
    return {g['id']: g['name'] for g in data.get('genres', [])}

def fetch_movies(api_key, pages=35):
    genres = fetch_genres('movie', api_key)
    items = []
    for page in range(1, pages + 1):
        data = tmdb_get('/discover/movie', {
            'sort_by': 'vote_count.desc',
            'vote_count.gte': 600,
            'page': page,
        }, api_key)
        for m in data.get('results', []):
            gids = m.get('genre_ids') or []
            grp = genres.get(gids[0], 'Altro') if gids else 'Altro'
            items.append((m.get('title') or m.get('original_title'), grp))
        time.sleep(0.15)
    return save_category('film', items)

def fetch_series(api_key, pages=25):
    genres = fetch_genres('tv', api_key)
    items = []
    for page in range(1, pages + 1):
        data = tmdb_get('/discover/tv', {
            'sort_by': 'vote_count.desc',
            'vote_count.gte': 250,
            'page': page,
        }, api_key)
        for s in data.get('results', []):
            gids = s.get('genre_ids') or []
            grp = genres.get(gids[0], 'Altro') if gids else 'Altro'
            items.append((s.get('name') or s.get('original_name'), grp))
        time.sleep(0.15)
    return save_category('serie', items)

def fetch_people(api_key, target, pages=35):
    actors, directors = [], []
    for page in range(1, pages + 1):
        data = tmdb_get('/person/popular', {'page': page}, api_key)
        for p in data.get('results', []):
            dept = p.get('known_for_department')
            name = p.get('name')
            if dept == 'Acting':
                actors.append((name, 'Attori'))
            elif dept == 'Directing':
                directors.append((name, 'Registi'))
        time.sleep(0.15)
    if target in ('attori', 'all'):
        save_category('attori', actors)
    if target in ('registi', 'all'):
        save_category('registi', directors)

def run_tmdb(only=None):
    load_env()
    api_key = os.environ.get('TMDB_API_KEY', '').strip()
    if not api_key:
        print('TMDB_API_KEY not set: using QLever fallback.')
        return False
    targets = set(only) if only else {'film', 'serie', 'attori', 'registi'}
    if 'film' in targets:
        print('== film (TMDB)')
        fetch_movies(api_key)
    if 'serie' in targets:
        print('== serie (TMDB)')
        fetch_series(api_key)
    if 'attori' in targets or 'registi' in targets:
        print('== attori / registi (TMDB)')
        which = 'all' if ('attori' in targets and 'registi' in targets) else ('attori' if 'attori' in targets else 'registi')
        fetch_people(api_key, which)
    return True

if __name__ == '__main__':
    run_tmdb()
