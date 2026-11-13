#!/usr/bin/env python3
"""Genera un reel de Shift (1080x1920, 30 fps) desde un spec JSON con Remotion.

Uso:
  python3 scripts/make_reel.py examples/idea-a-votacion/spec.json
  python3 scripts/make_reel.py spec.json --preview 60,200,400      # solo cuadros sueltos
  python3 scripts/make_reel.py spec.json --validate-only

Salida (por defecto /opt/data/outputs/reels/<slug>/): reel.mp4, cover.png, manifest.json, render.log
El render completo tarda ~10 a 15 min: correrlo en segundo plano (nohup) y revisar manifest.json.
"""
import argparse, glob, json, os, re, shutil, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
BANNED = ['\u2014', '\u2013']  # raya y semirraya: prohibidas por el Brand Kit y por Diseño


def die(msg):
    print('ERROR:', msg, file=sys.stderr)
    sys.exit(2)


def walk_strings(o, path=''):
    if isinstance(o, str):
        yield path, o
    elif isinstance(o, dict):
        for k, v in o.items():
            yield from walk_strings(v, f'{path}.{k}')
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from walk_strings(v, f'{path}[{i}]')


INTRO_STYLES = ('seed', 'sunrise', 'leaves', 'hills')


def pick_intro_style(spec, remember):
    """'auto' rota los estilos de apertura: nunca repite el del reel anterior."""
    st = spec['intro'].get('style', 'auto')
    if st != 'auto':
        return st
    state = os.path.join(ROOT, '.last_intro_style')
    last = open(state).read().strip() if os.path.exists(state) else ''
    st = INTRO_STYLES[(INTRO_STYLES.index(last) + 1) % len(INTRO_STYLES)] if last in INTRO_STYLES else INTRO_STYLES[0]
    if remember:
        open(state, 'w').write(st)
    return st


def validate(spec, base):
    errs, warns = [], []
    for p, s in walk_strings(spec):
        for b in BANNED:
            if b in s:
                errs.append(f'{p}: contiene guion largo (prohibido): {s!r}')
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,60}', spec.get('slug', '')):
        errs.append('slug debe ser minusculas, numeros y guiones')
    steps = spec.get('steps', [])
    if not 1 <= len(steps) <= 5:
        errs.append('steps debe tener entre 1 y 5 pasos')
    if spec.get('intro', {}).get('style', 'auto') not in ('auto',) + INTRO_STYLES:
        errs.append('intro.style debe ser auto o uno de: ' + ', '.join(INTRO_STYLES))
    if len(spec.get('intro', {}).get('headline', '')) > 60:
        errs.append('intro.headline supera 60 caracteres')
    mu = spec.get('music')
    if mu:
        name = mu if isinstance(mu, str) else mu.get('track', 'auto')
        tr = json.load(open(os.path.join(ROOT, 'public', 'music', 'tracks.json')))
        if name != 'auto' and name not in tr:
            errs.append(f'music.track desconocido: {name}')
    illustrative = False
    for i, st in enumerate(steps):
        if len(st.get('title', '')) > 32:
            errs.append(f'steps[{i}].title supera 32 caracteres')
        if len(st.get('body', '')) > 110:
            errs.append(f'steps[{i}].body supera 110 caracteres')
        v = st.get('visual') or {'type': 'none'}
        t = v.get('type')
        if t not in ('none', 'thread', 'document', 'bars', 'points'):
            errs.append(f'steps[{i}].visual.type invalido: {t}')
        if t in ('thread', 'document', 'bars'):
            illustrative = True
        if t == 'thread' and len(v.get('comments', [])) > 3:
            errs.append(f'steps[{i}] thread admite hasta 3 comentarios')
        if t == 'document':
            if len(v.get('lines', [])) > 3:
                errs.append(f'steps[{i}] document admite hasta 3 lineas')
        if t == 'bars':
            if len(v.get('panels', [])) > 2:
                errs.append(f'steps[{i}] bars admite hasta 2 paneles')
            for pn in v.get('panels', []):
                if len(pn.get('rows', [])) > 3:
                    errs.append(f'steps[{i}] panel con mas de 3 filas')
        if t == 'points' and len(v.get('items', [])) > 4:
            errs.append(f'steps[{i}] points admite hasta 4 items')
        bd = st.get('backdrop')
        if bd and not os.path.exists(os.path.join(base, bd)):
            errs.append(f'steps[{i}].backdrop no existe: {bd}')
        else:
            if not bd:
                warns.append(f'steps[{i}] sin backdrop')
    bd = spec.get('intro', {}).get('backdrop')
    if bd and not os.path.exists(os.path.join(base, bd)):
        errs.append(f'intro.backdrop no existe: {bd}')
    if illustrative and not spec.get('cardNote') and not spec.get('realData'):
        errs.append('hay tarjetas ilustrativas: definir cardNote (p. ej. "Ejemplo ilustrativo") o realData=true')
    total = spec.get('intro', {}).get('durationSec', 4.2) + sum(s.get('durationSec', 5.4) for s in steps) + spec.get('outro', {}).get('durationSec', 2.8) + spec.get('logoSec', 3) + 0.5
    if total > 80:
        errs.append(f'duracion total {total:.1f}s supera 80s')
    return errs, warns, total


def browser():
    cands = sorted(glob.glob('/opt/hermes/.playwright/chromium_headless_shell-*/chrome-headless-shell-linux-arm64/chrome-headless-shell')) + sorted(glob.glob('/opt/hermes/.playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell'))
    if os.environ.get('REEL_BROWSER'):
        return os.environ['REEL_BROWSER']
    if not cands:
        die('no encontre chrome-headless-shell; definir REEL_BROWSER')
    return cands[-1]


def run(cmd, log=None, cwd=ROOT):
    f = open(log, 'a') if log else None
    r = subprocess.run(cmd, cwd=cwd, stdout=f or subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if f:
        f.close()
    return r


def resolve_music(spec):
    mu = spec.get('music')
    if not mu:
        return None
    tracks = json.load(open(os.path.join(ROOT, 'public', 'music', 'tracks.json')))
    if isinstance(mu, str):
        mu = {'track': mu}
    name = mu.get('track', 'auto')
    if name == 'auto':
        import datetime
        keys = sorted(tracks)
        name = keys[datetime.date.today().toordinal() % len(keys)]
    if name not in tracks:
        die(f'music.track desconocido: {name}')
    info = tracks[name]
    return {'name': name, 'path': os.path.join(ROOT, 'public', 'music', info['file']), 'start': float(mu.get('startSec', info.get('startSec', 0))), 'lufs': float(mu.get('lufs', -20))}


def mix_music(video, mu, out):
    dur = float(json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', video], capture_output=True, text=True).stdout)['format']['duration'])
    fo = 2.5
    af = (f"atrim=start={mu['start']}:duration={dur},asetpts=PTS-STARTPTS,loudnorm=I={mu['lufs']}:TP=-2:LRA=7,"
          f"afade=t=in:st=0:d=1.2,afade=t=out:st={dur - fo:.2f}:d={fo}")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', video, '-i', mu['path'], '-filter_complex', f'[1:a]{af}[a]', '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', f'{dur:.3f}', '-movflags', '+faststart', out], check=True)


def dark_frames(path, w=270, h=480, thr=18, maxdark=12):
    r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-vf', f'scale={w}:{h},format=gray', '-f', 'rawvideo', '-'], capture_output=True)
    d = r.stdout
    sz = w * h
    n = len(d) // sz
    return n, [i for i in range(n) if sum(1 for v in d[i * sz:(i + 1) * sz] if v < thr) > maxdark]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('spec')
    ap.add_argument('--out')
    ap.add_argument('--concurrency', type=int, default=4)
    ap.add_argument('--preview', help='lista de cuadros separados por coma; renderiza PNG sueltos')
    ap.add_argument('--validate-only', action='store_true')
    ap.add_argument('--intro-style', choices=INTRO_STYLES, help='fuerza el estilo de apertura (si no, el de spec.intro.style o rotacion auto)')
    a = ap.parse_args()

    spec_path = os.path.abspath(a.spec)
    base = os.path.dirname(spec_path)
    spec = json.load(open(spec_path))
    errs, warns, total = validate(spec, base)
    for w in warns:
        print('AVISO:', w)
    if errs:
        for e in errs:
            print('ERROR:', e, file=sys.stderr)
        sys.exit(2)
    print(f'spec valido, duracion estimada {total:.1f}s')
    if a.validate_only:
        return

    slug = spec['slug']
    out = a.out or f'/opt/data/outputs/reels/{slug}'
    os.makedirs(out, exist_ok=True)
    log = os.path.join(out, 'render.log')
    open(log, 'w').close()

    # preparar assets
    asset_dir = os.path.join(ROOT, 'public', 'reels', slug)
    os.makedirs(asset_dir, exist_ok=True)
    for f in glob.glob(os.path.join(base, '*')):
        if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            shutil.copy(f, asset_dir)
    if a.intro_style:
        spec['intro']['style'] = a.intro_style
    spec['intro']['style'] = pick_intro_style(spec, remember=not a.preview)
    print('apertura:', spec['intro']['style'])
    props = {'spec': spec, 'assetBase': f'reels/{slug}'}
    props_path = os.path.join(out, 'props.json')
    json.dump(props, open(props_path, 'w'), ensure_ascii=False)
    br = browser()
    common = ['--props=' + props_path, '--browser-executable=' + br, '--gl=swangle']

    if a.preview:
        for fr in a.preview.split(','):
            r = run(['npx', 'remotion', 'still', 'src/index.ts', 'Reel', os.path.join(out, f'preview_{fr}.png'), f'--frame={fr}'] + common, log)
            print('preview', fr, 'ok' if r.returncode == 0 else 'FALLO')
        return

    t0 = time.time()
    raw = os.path.join(out, 'raw.mp4')
    r = run(['npx', 'remotion', 'render', 'src/index.ts', 'Reel', raw, f'--concurrency={a.concurrency}', '--crf=16', '--codec=h264', '--pixel-format=yuv420p'] + common, log)
    if r.returncode != 0 or not os.path.exists(raw):
        die('fallo el render, ver ' + log)

    n, bad = dark_frames(raw)
    fixed = []
    seq = os.path.join(out, 'seq')
    final = os.path.join(out, 'reel.mp4')
    vf = 'scale=in_range=full:out_range=tv:flags=accurate_rnd,format=yuv420p'
    if bad:
        shutil.rmtree(seq, ignore_errors=True)
        os.makedirs(seq)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-start_number', '0', os.path.join(seq, 'f_%05d.png')], check=True)
        for fr in bad:
            png = os.path.join(out, f'fix_{fr}.png')
            for attempt in range(3):
                run(['npx', 'remotion', 'still', 'src/index.ts', 'Reel', png, f'--frame={fr}'] + common, log)
                if os.path.exists(png):
                    break
            if os.path.exists(png):
                shutil.copy(png, os.path.join(seq, f'f_{fr:05d}.png'))
                os.remove(png)
                fixed.append(fr)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-start_number', '0', '-i', os.path.join(seq, 'f_%05d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-vf', vf, '-color_range', 'tv', '-movflags', '+faststart', final], check=True)
        shutil.rmtree(seq, ignore_errors=True)
    else:
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-vf', vf, '-color_range', 'tv', '-an', '-movflags', '+faststart', final], check=True)
    n2, bad2 = dark_frames(final)
    mu = resolve_music(spec)
    if mu:
        tmp = os.path.join(out, 'reel_silent.mp4')
        os.replace(final, tmp)
        mix_music(tmp, mu, final)
        os.remove(tmp)
    if bad2:
        die(f'quedan cuadros danados tras reparar: {bad2}')
    os.remove(raw)

    cover_t = spec['intro'].get('durationSec', 4.2) + 3.2
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(cover_t), '-i', final, '-frames:v', '1', os.path.join(out, 'cover.png')], check=True)
    poster = os.path.join(out, 'poster.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(round(spec['intro'].get('durationSec', 4.2) * 0.8, 2)), '-i', final, '-frames:v', '1', poster], check=True)
    subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'cms_package.py'), final, os.path.join(out, 'reel_cms.mp4'), poster], check=True)
    pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size:stream=width,height,pix_fmt', '-of', 'json', final], capture_output=True, text=True).stdout)
    manifest = {'slug': slug, 'video': final, 'cover': os.path.join(out, 'cover.png'), 'cms_video': os.path.join(out, 'reel_cms.mp4'), 'frames': n2, 'duration_s': float(pr['format']['duration']), 'size_bytes': int(pr['format']['size']), 'width': pr['streams'][0]['width'], 'height': pr['streams'][0]['height'], 'pix_fmt': pr['streams'][0]['pix_fmt'], 'frames_repaired': fixed, 'intro_style': spec['intro']['style'], 'audio': bool(mu), 'music': (mu or {}).get('name'), 'render_seconds': round(time.time() - t0)}
    json.dump(manifest, open(os.path.join(out, 'manifest.json'), 'w'), indent=2)
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
