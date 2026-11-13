#!/usr/bin/env python3
"""Sube un MP4 a Escarlet con production.video.upload, en trozos de 192000 bytes.

Uso: upload_reel.py reel_cms.mp4 <uploadId> <filename.mp4> [site]
Escribe <mp4>.upload.json con media.id y publicUrl. Tarda ~5 min para 14 MB:
lanzar con nohup y consultar el .upload.json (o el .log).
Env: ESCARLET_MCP_URL y ESCARLET_MCP_TOKEN (los mismos que escarlet-mcp.py).
"""
import json, math, os, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
src, upload_id, filename = sys.argv[1:4]
site = sys.argv[4] if len(sys.argv) > 4 else os.environ.get('ESCARLET_SITE', 'shift')
data = open(src, 'rb').read()
CH = 192000  # 256000 caracteres en base64
n = math.ceil(len(data) / CH)
tmp = tempfile.mkdtemp(dir=os.environ.get('TMPDIR'))
log = open(src + '.upload.log', 'w')
last = ''
for i in range(n):
    p = os.path.join(tmp, 'chunk.bin')
    open(p, 'wb').write(data[i * CH:(i + 1) * CH])
    args = {"site": site, "filename": filename, "mimeType": "video/mp4", "uploadId": upload_id, "chunkIndex": i, "chunkCount": n,
            "mediaRole": "final_video", "format": "portrait", "assetType": "instagram_reel", "tool": "remotion",
            "provenance": {"generator": "shift-reels", "engine": "remotion 4.0.350"}}
    for attempt in range(4):
        r = subprocess.run([os.path.join(HERE, 'escarlet_mcp_full.py'), 'call', 'production.video.upload', '--args', json.dumps(args), '--file', f'contentBase64={p}'], capture_output=True, text=True)
        out = r.stdout + r.stderr
        if '"is_error": true' not in out and 'Traceback' not in out and r.returncode == 0:
            break
        time.sleep(2)
    log.write(f'{i + 1}/{n} {out[:300]}\n'); log.flush()
    last = out
    if '"is_error": true' in out or 'Traceback' in out or r.returncode != 0:
        print('FALLO chunk', i, out[:300]); sys.exit(1)
j = json.loads(last)
sc = j.get('structured_content') or json.loads(j['content'][0]['text'])
m = sc['media']
res = {'id': m['id'], 'url': m['publicUrl'], 'durationMs': m.get('durationMs'), 'poster': (m.get('posterMedia') or {}).get('id')}
json.dump(res, open(src + '.upload.json', 'w'), indent=2)
print(json.dumps(res))
