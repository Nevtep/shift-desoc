#!/usr/bin/env python3
"""Borrador de spec de reel a partir de un Post de Escarlet (content.post.get).

Uso:
  python3 scripts/post_to_spec.py post.json --out specs/<slug>/    # post.json = salida de content.post.get
Genera:
  specs/<slug>/spec.json        borrador (intro + pasos + cierre) para REVISAR a mano
  specs/<slug>/bg_prompts.json  prompts para generar los fondos sin texto (image_generate)

Es un borrador: el agente debe acortar textos, elegir `visual` por paso (thread, document, bars, points)
y generar los fondos bg0..bgN.jpg en la misma carpeta antes de correr make_reel.py.
"""
import argparse, json, os, re, unicodedata

STYLE = (
    'Vertical 9:16 soft background illustration for a motion graphics video, flat cut-paper style, matte paper texture, '
    'very low contrast, airy. Palette strictly: sage #7C8F62, olive #5F704A, mustard #CFA63D, terracotta #D88F43, cream #E9E3D6, sand #D8CBAE. '
    'Cream paper base. Subject only in the lower 55%, top 45% almost plain cream. '
    'ABSOLUTELY no text, letters, numbers, logos, lines or dashes. Scene: '
)
BAN = {'\u2014': ',', '\u2013': ','}


def clean(s):
    for k, v in BAN.items():
        s = s.replace(k, v)
    return s.strip()


def shorten(s, n):
    s = clean(s)
    if len(s) <= n:
        return s
    parts = re.split(r'(?<=[.!?])\s+', s)
    out = ''
    for p in parts:
        if len(out) + len(p) + 1 <= n:
            out = (out + ' ' + p).strip()
        else:
            break
    return out or s[: n - 1].rstrip() + '.'


def phrases(body):
    # frases cortas (<= 44 caracteres) por oracion o coma; las largas se descartan: el agente completa a mano
    out = []
    for sent in re.split(r'(?<=[.!?])\s+', clean(body)):
        for ph in re.split(r',\s+', sent):
            ph = ph.strip().rstrip('.')
            if 6 <= len(ph) <= 44:
                out.append(ph[0].upper() + ph[1:])
    return out[:4] or ['Completar a mano']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('post_json')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    d = json.load(open(a.post_json))
    d = d.get('structured_content', d)
    post = d.get('post', d)
    ig = next((v for v in post['variants'] if v['channel'] == 'instagram'), None)
    if not ig or 'slides' not in ig['body']:
        raise SystemExit('el Post no tiene variante de Instagram con slides')
    slides = sorted(ig['body']['slides'], key=lambda s: s['index'])
    norm = unicodedata.normalize('NFKD', clean(post['title']).lower()).encode('ascii', 'ignore').decode()
    slug = re.sub(r'[^a-z0-9]+', '-', norm).strip('-')[:40] or 'reel'
    first, rest = slides[0], slides[1:]
    spec = {
        'slug': slug,
        'cardNote': 'Ejemplo ilustrativo',
        'intro': {'headline': shorten(first['headline'], 60), 'sub': shorten(first['body'], 110), 'backdrop': 'bg0.jpg', 'durationSec': 4.2},
        'steps': [],
        'outro': {'headline': shorten(ig['body'].get('cta') or 'Conoce Shift', 60) + '.', 'sub': '', 'durationSec': 2.8},
        'logoSec': 3,
    }
    prompts = {'bg0.jpg': STYLE + clean(first.get('alt', ''))}
    for i, s in enumerate(rest):
        sents = [x for x in re.split(r'(?<=[.!?])\s+', clean(s['body'])) if x]
        spec['steps'].append({
            'title': shorten(s['headline'], 32),
            'body': shorten(s['body'], 110),
            'backdrop': f'bg{i + 1}.jpg',
            'durationSec': 5.4,
            'visual': {'type': 'points', 'items': phrases(s['body'])},
        })
        prompts[f'bg{i + 1}.jpg'] = STYLE + clean(s.get('alt', ''))
    os.makedirs(a.out, exist_ok=True)
    json.dump(spec, open(os.path.join(a.out, 'spec.json'), 'w'), ensure_ascii=False, indent=2)
    json.dump(prompts, open(os.path.join(a.out, 'bg_prompts.json'), 'w'), ensure_ascii=False, indent=2)
    print('borrador en', a.out, '| pasos:', len(spec['steps']), '| REVISAR textos y visuales antes de renderizar')


if __name__ == '__main__':
    main()
