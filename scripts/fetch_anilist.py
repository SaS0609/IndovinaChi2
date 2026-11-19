import json
import time
import urllib.request
from common import save_category

URL = 'https://graphql.anilist.co'
QUERY = """
query ($page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    characters(sort: FAVOURITES_DESC) {
      name { full }
      media(sort: POPULARITY_DESC, perPage: 1) {
        nodes { title { romaji english } }
      }
    }
  }
}
"""

def fetch_anime(pages=16):
    print('== anime (AniList)')
    items = []
    for page in range(1, pages + 1):
        body = json.dumps({'query': QUERY, 'variables': {'page': page}}).encode('utf-8')
        req = urllib.request.Request(
            URL,
            data=body,
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'IndovinaGame/2.0',
            },
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            res = json.load(r)
        page_data = res['data']['Page']
        for ch in page_data['characters']:
            name = (ch.get('name') or {}).get('full') or ''
            nodes = (ch.get('media') or {}).get('nodes') or []
            grp = 'Anime'
            if nodes:
                t = nodes[0].get('title') or {}
                grp = t.get('english') or t.get('romaji') or 'Anime'
            items.append((name, grp))
        if not page_data['pageInfo']['hasNextPage']:
            break
        time.sleep(0.8)
    return save_category('anime', items)

if __name__ == '__main__':
    fetch_anime()
