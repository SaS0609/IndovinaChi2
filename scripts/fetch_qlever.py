import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from common import save_category

EP = 'https://qlever.dev/api/wikidata'
UA = 'IndovinaGame/2.0 (personal project)'

PREFIXES = """
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
"""

OCC = [
    ('Sovrani', 'monarca sovrano re regina imperatore principe faraone sultano zar'),
    ('Religiosi', 'sacerdote vescovo papa santo monaco religioso cardinale profeta'),
    ('Militari', 'militare ufficiale generale ammiraglio condottiero soldato'),
    ('Politici', 'politico statista diplomatico rivoluzionario attivista'),
    ('Musicisti', 'musicista cantante compositore direttore pianista chitarrista'),
    ('Scrittori', 'scrittore poeta drammaturgo romanziere giornalista saggista'),
    ('Artisti', 'pittore scultore architetto fotografo artista illustratore'),
    ('Scienziati', 'fisico chimico matematico astronomo biologo scienziato medico inventore ingegnere informatico'),
    ('Filosofi', 'filosofo economista sociologo teologo'),
    ('Esploratori', 'esploratore navigatore aviatore astronauta pilota'),
    ('Spettacolo', 'attore attrice regista comico ballerino conduttore'),
    ('Sportivi', 'calciatore tennista cestista pugile ciclista atleta nuotatore allenatore'),
]

def occ_group(s):
    words = set(re.findall(r'\w+', (s or '').lower()))
    for name, kw in OCC:
        if words & set(kw.split()):
            return name
    return 'Altri'

QUERIES = {
    'giochi': (
        '?i wdt:P31 wd:Q7889 .',
        'OPTIONAL { ?i wdt:P136 ?gg . ?gg rdfs:label ?gl . FILTER(LANG(?gl) = "it") }',
        800,
        False,
    ),
    'calcio': (
        '?i wdt:P31 wd:Q5 ; wdt:P106 wd:Q937857 .',
        'OPTIONAL { ?i wdt:P27 ?gg . ?gg rdfs:label ?gl . FILTER(LANG(?gl) = "it") }',
        700,
        False,
    ),
    'musica': (
        '{ ?i wdt:P106 wd:Q177220 } UNION { ?i wdt:P31 wd:Q215380 }',
        'OPTIONAL { ?i wdt:P27 ?gg . ?gg rdfs:label ?gl . FILTER(LANG(?gl) = "it") }',
        700,
        False,
    ),
    'storici': (
        '?i wdt:P31 wd:Q5 ; wdt:P569 ?b . FILTER(?b < "1930-01-01T00:00:00Z"^^xsd:dateTime)',
        'OPTIONAL { ?i wdt:P106 ?gg . ?gg rdfs:label ?gl . FILTER(LANG(?gl) = "it") }',
        800,
        True,
    ),
    'famosi': (
        '?i wdt:P31 wd:Q5 ; wdt:P569 ?b . FILTER(?b >= "1930-01-01T00:00:00Z"^^xsd:dateTime)',
        'OPTIONAL { ?i wdt:P106 ?gg . ?gg rdfs:label ?gl . FILTER(LANG(?gl) = "it") }',
        800,
        True,
    ),
    'disney': (
        'VALUES ?co { wd:Q1047410 wd:Q127552 wd:Q191224 wd:Q1210936 } ?w wdt:P272 ?co . ?i wdt:P1441 ?w .',
        'OPTIONAL { ?i wdt:P1441 ?w2 . ?w2 rdfs:label ?gl . FILTER(LANG(?gl) = "it") }',
        450,
        False,
    ),
    'citta': (
        '{ ?i wdt:P31 wd:Q515 } UNION { ?i wdt:P31 wd:Q5119 }',
        'OPTIONAL { ?i wdt:P17 ?gg . ?gg rdfs:label ?gl . FILTER(LANG(?gl) = "it") }',
        600,
        False,
    ),
    'paesi': (
        '?i wdt:P31 wd:Q3624078 .',
        'OPTIONAL { ?i wdt:P30 ?gg . ?gg rdfs:label ?gl . FILTER(LANG(?gl) = "it") }',
        220,
        False,
    ),
    'luoghi': (
        'VALUES ?root { wd:Q4989906 wd:Q839954 wd:Q33506 wd:Q23413 wd:Q16560 wd:Q44539 } ?i wdt:P31 ?root .',
        'OPTIONAL { ?i wdt:P17 ?gg . ?gg rdfs:label ?gl . FILTER(LANG(?gl) = "it") }',
        500,
        False,
    ),
    'mestieri': (
        '?i wdt:P31 wd:Q28640 .',
        '',
        350,
        False,
    ),
    'film': (
        '?i wdt:P31 wd:Q11424 .',
        'OPTIONAL { ?i wdt:P136 ?gg . ?gg rdfs:label ?gl . FILTER(LANG(?gl) = "it") }',
        800,
        False,
    ),
    'serie': (
        '?i wdt:P31 wd:Q5398426 .',
        'OPTIONAL { ?i wdt:P136 ?gg . ?gg rdfs:label ?gl . FILTER(LANG(?gl) = "it") }',
        600,
        False,
    ),
    'attori': (
        '?i wdt:P31 wd:Q5 ; wdt:P106 wd:Q33999 .',
        '',
        700,
        False,
    ),
    'registi': (
        '?i wdt:P31 wd:Q5 ; wdt:P106 wd:Q2526255 .',
        '',
        400,
        False,
    ),
}

def run_sparql(query, tries=3):
    data = urllib.parse.urlencode({'query': PREFIXES + query}).encode('utf-8')
    for k in range(tries):
        try:
            req = urllib.request.Request(
                EP,
                data=data,
                headers={
                    'User-Agent': UA,
                    'Accept': 'application/sparql-results+json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)['results']['bindings']
        except urllib.error.HTTPError as e:
            if e.code == 429 and k + 1 < tries:
                wait = 5 * (k + 1)
                print(f'     rate limit (429), retrying in {wait}s...')
                time.sleep(wait)
                continue
            raise

def fetch_one(cat_id):
    print(f'== {cat_id} (QLever)')
    where, gpat, limit, use_occ = QUERIES[cat_id]
    gsel = '(SAMPLE(?gl) AS ?g)' if gpat else ''
    q = f"""
    SELECT ?i ?sl (SAMPLE(?it) AS ?n) {gsel} WHERE {{
      {{
        SELECT DISTINCT ?i ?sl WHERE {{
          {where}
          ?i wikibase:sitelinks ?sl .
        }}
        ORDER BY DESC(?sl)
        LIMIT {limit}
      }}
      ?i rdfs:label ?it .
      FILTER(LANG(?it) = "it")
      {gpat}
    }}
    GROUP BY ?i ?sl
    ORDER BY DESC(?sl)
    """
    rows = run_sparql(q)
    items = []
    for r in rows:
        name = (r.get('n') or {}).get('value', '')
        grp = (r.get('g') or {}).get('value', '')
        if use_occ:
            grp = occ_group(grp)
        items.append((name, grp))
    time.sleep(1.2)
    return save_category(cat_id, items)

def run_qlever(cat_ids):
    for cid in cat_ids:
        if cid in QUERIES:
            try:
                fetch_one(cid)
            except Exception as e:
                print(f'  !! error on {cid}: {e} (saving curated fallback if present)')
                save_category(cid, [])

if __name__ == '__main__':
    run_qlever(['giochi', 'calcio', 'musica', 'storici', 'famosi', 'disney', 'citta', 'paesi', 'luoghi', 'mestieri'])
