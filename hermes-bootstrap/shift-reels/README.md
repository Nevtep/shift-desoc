# shift-reels

Generador de reels de Shift (1080x1920, 30 fps, H.264 yuv420p) desde un spec JSON, con Remotion.
No usa el motor de Escarlet. Corre en el entorno de Hermes con el Chromium headless de Playwright.

## Flujo para un reel nuevo

1. Tomar el Post de Escarlet (`content.post.get`) y guardar su JSON.
2. `python3 scripts/post_to_spec.py post.json --out specs/<slug>/` crea `spec.json` (borrador) y `bg_prompts.json`.
3. Revisar el spec a mano: textos cortos, elegir el `visual` de cada paso, agregar `cardNote` si hay ejemplos.
4. Generar los fondos sin texto con `image_generate` (9:16, referencia: guía visual del Brand Kit) y guardarlos como `bg0.jpg`, `bg1.jpg`, ... junto al spec.
5. `python3 scripts/make_reel.py specs/<slug>/spec.json --validate-only` (reglas de marca y límites).
6. `--preview 60,200,400` para mirar cuadros sueltos y ajustar.
7. Render completo en segundo plano: `nohup python3 scripts/make_reel.py specs/<slug>/spec.json > run.log 2>&1 &` (10 a 15 min).
8. Salida en `/opt/data/outputs/reels/<slug>/`: `reel.mp4`, `cover.png`, `manifest.json`.

## Spec

Ver `src/types.ts` y `examples/idea-a-votacion/spec.json`. Visuales por paso:
- `thread`: hilo de hasta 3 comentarios con avatares.
- `document`: documento de hasta 3 líneas, una editada, chips de versión y revisores.
- `bars`: hasta 2 paneles de barras, con avatares que votan.
- `points`: hasta 4 puntos con tilde (genérico).
- `none`: solo texto y fondo.

## Reglas de marca que el validador exige

- Sin guiones largos (raya o semirraya) en ningún texto.
- Sin barras ni líneas decorativas (el diseño no las dibuja).
- Todo reel termina con la pantalla del logo de Shift (`public/logo.png`).
- Tarjetas con ejemplos llevan `cardNote` ("Ejemplo ilustrativo") o `realData: true`.
- Títulos de paso hasta 32 caracteres, cuerpo hasta 110.
- Los fondos van sin texto, con la paleta del Brand Kit, a baja opacidad.

## Control de calidad automático

El render por software puede dejar cuadros con rectángulos negros. `make_reel.py` escanea todos los cuadros,
vuelve a renderizar los dañados como imágenes sueltas y los empalma. Si quedan dañados, falla.

## Pendiente conocido

- Sin audio (el MP4 sale sin pista de audio).
- Tipografías: Fraunces e Inter como reemplazo hasta confirmar las del Brand Kit.
- Publicación: depende de que Escarlet acepte subir video (asset.upload hoy solo acepta imágenes).

## Instalación

`npm install` en esta carpeta (Remotion 4.0.350). Requiere `ffmpeg` y el Chromium de Playwright en
`/opt/hermes/.playwright` (o `REEL_BROWSER=/ruta/a/chrome-headless-shell`).


## Apertura variable y logo final

- `intro.style`: `auto` (por defecto, rota y nunca repite la del reel anterior), `seed`, `sunrise`, `leaves` o `hills`. Cada estilo cambia la capa de fondo y la animacion del titular. Se puede forzar con `--intro-style`.
- El logo final entra 0,5 s despues de que el fondo ya es crema plena, para que no se vea el recuadro de la imagen. La pantalla del logo dura `logoSec` + 0,5 s.
