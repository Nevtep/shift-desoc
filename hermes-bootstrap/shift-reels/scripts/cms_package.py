#!/usr/bin/env python3
"""Empaqueta un reel para Escarlet: antepone 2 cuadros (0,067 s) con la portada.
Escarlet extrae el poster del primer cuadro, asi que la portada pasa a ser ese cuadro.

Uso: cms_package.py reel.mp4 salida.mp4 poster.png
"""
import subprocess, sys

src, out, poster = sys.argv[1:4]
fc = ("[0:v]scale=1080:1920,format=yuv420p,fps=30,setsar=1[c];"
      "[1:v]fps=30,format=yuv420p,setsar=1[v];[c][v]concat=n=2:v=1:a=0[vo]")
cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', '0.0667', '-i', poster, '-i', src]
has_audio = bool(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip())
if has_audio:
    fc += ";[1:a]adelay=67|67[ao]"
cmd += ['-filter_complex', fc, '-map', '[vo]'] + (['-map', '[ao]', '-c:a', 'aac', '-b:a', '192k'] if has_audio else []) + \
       ['-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
subprocess.run(cmd, check=True)
print('ok', out)
