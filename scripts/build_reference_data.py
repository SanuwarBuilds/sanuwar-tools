"""Refresh the static reference datasets used by the browser tools."""
import csv
import io
import json
import os
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'static', 'assets', 'data')
SOURCES = {
    'tlds': 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt',
    'ipv4': 'https://www.iana.org/assignments/ipv4-address-space/ipv4-address-space.csv',
    'ipv6': 'https://www.iana.org/assignments/ipv6-unicast-address-assignments/ipv6-unicast-address-assignments.csv',
    'asn1': 'https://www.iana.org/assignments/as-numbers/as-numbers-1.csv',
    'asn2': 'https://www.iana.org/assignments/as-numbers/as-numbers-2.csv',
    'emoji': 'https://raw.githubusercontent.com/github/gemoji/master/db/emoji.json',
}


def fetch(name):
    request = urllib.request.Request(SOURCES[name], headers={'User-Agent': 'SanuwarTools data refresh'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode('utf-8')


def write(name, data):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with open(path, 'w', encoding='utf-8') as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(',', ':'))
    print(f'{name}: {os.path.getsize(path)} bytes')


def tlds():
    items = []
    for line in fetch('tlds').splitlines():
        value = line.strip()
        if not value or value.startswith('#'):
            continue
        kind = 'IDN' if value.startswith('XN--') else 'ccTLD' if len(value) == 2 else 'gTLD'
        if value == 'ARPA':
            kind = 'Infrastructure'
        items.append({'tld': value, 'type': kind})
    return items


def address_space(name):
    rows = list(csv.DictReader(io.StringIO(fetch(name))))
    items = []
    for row in rows:
        prefix = (row.get('Prefix') or '').strip()
        if not prefix:
            continue
        items.append({
            'prefix': prefix,
            'designation': (row.get('Designation') or '').strip(),
            'date': (row.get('Date') or '').strip(),
            'status': (row.get('Status') or row.get('Status [1]') or '').strip(),
            'note': (row.get('Note') or '').strip(),
        })
    return items


def asn_blocks():
    items = []
    for name in ('asn1', 'asn2'):
        for row in csv.DictReader(io.StringIO(fetch(name))):
            number = (row.get('Number') or '').strip()
            if not number:
                continue
            bounds = number.split('-')
            try:
                start = int(bounds[0])
                end = int(bounds[1]) if len(bounds) > 1 else start
            except ValueError:
                continue
            items.append({
                'range': number,
                'start': start,
                'end': end,
                'description': (row.get('Description') or '').strip(),
                'date': (row.get('Registration Date') or '').strip(),
            })
    items.sort(key=lambda item: item['start'])
    return items


def emoji():
    rows = json.loads(fetch('emoji'))
    items = []
    for row in rows:
        items.append({
            'e': row.get('emoji', ''),
            'd': row.get('description', ''),
            'c': row.get('category', ''),
            't': ' '.join(row.get('tags') or []),
            'a': ' '.join(row.get('aliases') or []),
            'v': row.get('unicode_version', ''),
        })
    return items


if __name__ == '__main__':
    write('tlds.json', tlds())
    write('ipv4-space.json', address_space('ipv4'))
    write('ipv6-space.json', address_space('ipv6'))
    write('asn-blocks.json', asn_blocks())
    write('emoji.json', emoji())
