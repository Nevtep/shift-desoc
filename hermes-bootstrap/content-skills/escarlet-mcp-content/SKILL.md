---
name: escarlet-mcp-content
description: "Gestiona contenido multicanal de Escarlet mediante MCP v3: descubre la marca, genera copy y media fuera del CMS, crea o edita Posts, prepara la revisión y publica o programa mediante el control plane. Úsala en Hermes, Cursor, Claude u otro cliente MCP conectado a /mcp/v3."
---

# Escarlet MCP Content

Usa esta skill cuando el usuario quiera crear, editar, revisar, administrar,
programar o publicar contenido de una marca conectada al MCP de Escarlet.
Funciona como guía de operación para el agente cliente. El MCP conserva el
contexto, la validación, la procedencia y el estado de publicación, pero la IA
externa genera el copy, los píxeles y el vídeo.

## Contrato obligatorio

- Usa únicamente el endpoint `/mcp/v3` y capabilities con nombres namespaced.
  Si el cliente ofrece `/mcp`, `blog_*`, `content_*` legacy o rutas de la API
  antigua, ignóralas.
- Si el usuario tiene acceso a más de una marca, llama primero
  `workspace.context.get`, muestra las opciones y pide una elección. No elijas
  una marca por defecto. Incluye `site` o `brandId` explícito en cada llamada.
- Para descubrir el contrato usa `capability.guide`, `capability.search` y
  `capability.get`. Para recipes usa `recipe.list`, `recipe.get` y `recipe.run`.
  Respeta siempre el schema y los permisos devueltos por el manifest.
- Conserva `postId`, `variantId`, `assetId`, `preparationId`,
  `brandKitVersionId`, `brandKitSnapshotHash`, `generationRunId` y
  `publicationId` de cada respuesta. No los sustituyas por títulos o URLs.
- La generación, la revisión, la aprobación y la publicación son estados
  distintos. Nunca declares publicado un resultado que solo está listo para
  revisión.
- Una acción externa de publicación necesita confirmación humana explícita en
  el turno actual. La autorización MCP o el rol del usuario no sustituyen esa
  confirmación.
- La única excepción es `recipe.autonomous-content`, pensada para un scheduler
  como Hermes u OpenClaw. Solo publica si el token tiene `content:publish` y la
  llamada incluye `automation.enabled: true`, `automation.confirmed: true` y
  `automation.publish: true`. Ese opt-in debe quedar configurado fuera del
  prompt, en la política del job.

## Crear contenido

1. Resuelve el scope con `workspace.context.get` y el Brand Kit activo con
   `brand.context.get`. Consulta `brand.voice.get`, `brand.rules.get`,
   `brand.visual_style.get` y `brand.references.resolve` cuando el encargo
   necesite sus detalles.
2. Define un brief concreto: objetivo, audiencia, idea, canales, formato, CTA,
   fuentes y restricciones. Redacta el copy fuera del CMS aplicando la voz de
   la marca y `sharedEditorialPolicy`. No inventes cifras, clientes, citas,
   resultados ni referencias.
3. Valida el texto completo con `copy.validate`. Corrige los hallazgos que
   bloqueen el canal antes de guardar el Post.
4. Crea una unidad editorial canónica con `content.post.create`. Incluye
   `title`, `channels` o `variants`, el brief y el `brandKitVersionId` si está
   disponible. Si no se indica campaña, el Post queda en Inbox editorial. Usa
   `idempotencyKey` en reintentos.
5. Guarda primero texto y variantes. Para una campaña de varios Posts usa
   `content.campaign.create` o `release.create` solo si el usuario pidió una
   agrupación coordinada. No crees una campaña nueva para editar un Post que ya
   existe.

Ejemplo mínimo:

```json
{
  "site": "<site>",
  "title": "<título>",
  "brief": "<objetivo, audiencia, idea y CTA>",
  "channels": ["blog", "instagram"],
  "idempotencyKey": "<clave-estable>"
}
```

## Generar y asociar media

La IA del cliente genera los archivos. El CMS no genera píxeles ni compone
overlays.

1. Después de crear el Post, llama `brand.generation.prepare` una vez por
   asset o conjunto homogéneo. Pasa `itemId`, `channel`, `assetType`,
   `expectedAssetCount` y el copy aprobado cuando corresponda.
2. Usa exactamente `resolvedReferences`, `generationPrompt`,
   `brandKitVersionId` y `brandKitSnapshotHash` que devuelve la preparación.
   No elijas referencias sueltas ni mezcles Brand Kits.
3. Si `generationBlocked` es `true`, o la respuesta indica
   `brand_preparation_required`, `BRAND_GROUNDING_STALE` o
   `BRAND_VERSION_MISMATCH`, detén el flujo. Corrige el Brand Kit o crea una
   preparación nueva. No subas un archivo con un snapshot antiguo.
4. Genera el archivo fuera del CMS y súbelo con `asset.upload`, conservando el
   mismo `preparationId`. Usa `kind: "post"` para una portada de blog y
   `kind: "social"` para una pieza social. Elige `contentBase64`, `file` o
   `blob` según lo que acepte el cliente. Para archivos grandes usa
   `uploadId`, `chunkIndex` y `chunkCount`.
5. Para Instagram, el archivo final debe llevar el texto aprobado integrado en
   la imagen. Declara `textRendered: true`, `templateId` (`editorial` o
   `impact`), `renderedBy: "chatgpt-image-generation"` y `textContent` con
   `headline` y `body`. Las slides son 1080x1350; los Stories son 1080x1920.
   Sube cada asset con `assetIndex` consecutivo y el mismo `preparationId`.
6. Para una portada de blog, genera una imagen sin texto, logos ni UI legible,
   valida el tamaño que indique la preparación y declara un `alt` descriptivo.
7. Comprueba que `asset.upload` devuelve `assetId`, `url` o media persistida y
   estado. Si el asset no quedó unido al Post, usa
   `content.media.attach` con `itemId`, `mediaAssetId`, `channels` y el
   `assetIndex` correcto. No dejes un asset publicable huérfano.

No uses una URL local como `/mnt/data` para simular una media pública. No
afirmes que una imagen se guardó solo porque `brand.generation.prepare` tuvo
éxito.

## Revisar y editar

- Lista con `content.post.list` y lee el detalle completo con
  `content.post.get`. Filtra por `status`, `channel`, `query`, `inbox` o
  `archive` cuando sea útil.
- Edita el mismo Post con `content.post.update`. Para una sola variante usa
  `content.post.variant.upsert`. Conserva los campos actuales antes de
  reemplazar un body y usa el `postId` o `itemId` existente.
- Tras cambiar copy o media, vuelve a ejecutar `copy.validate` y marca solo
  las variantes terminadas con `content.post.review` y `reviewChannels`.
- Devuelve el `postUrl` recibido para que la persona pueda revisar el Post en
  la PWA. La revisión humana ocurre allí o en el flujo de trabajo equivalente
  del cliente MCP.
- Para archivar o restaurar usa `content.post.archive` con `confirm: true`.
  Es reversible y no debe usarse sobre un Post ya publicado.

Nunca uses `content.post.create` para corregir un Post existente. Eso duplica
contenido y rompe la trazabilidad.

## Recipe para agentes programados

Usa `recipe.autonomous-content` cuando un agente tenga que ejecutar una
cadencia editorial sin pedir confirmación en cada ejecución. La recipe conserva
la misma frontera de seguridad, pero coordina el flujo completo y deja trazas
idempotentes:

1. Llama `content.topic.check` con el tema antes de crear nada. La capability
   compara títulos y temas activos de la marca. Si devuelve `isOriginal: false`,
   no fuerces el duplicado: elige otro ángulo y vuelve a comprobarlo.
2. Ejecuta `recipe.run` con `topic`, `title`, `text`, `channels`, `variants` y
   una `idempotencyKey` estable por ejecución. La respuesta crea un único Post
   y devuelve `generationTasks` con `preparationId`, formato, referencias y
   prompt para cada imagen necesaria.
   Para X o LinkedIn alcanza con el body `{ "text": "..." }`; Instagram y
   Stories necesitan sus estructuras `socialPack` con captions, slides o
   frames y el copy que debe coincidir con cada imagen.
3. Genera los píxeles fuera del CMS con el modelo de imágenes disponible para
   el agente. Sube cada archivo con `asset.upload`, el `preparationId`, el
   `itemId` o `postId`, el canal y `assetIndex`. El CMS no genera imágenes por
   sí mismo.
4. Reanuda la misma recipe con `postId` y `mediaAssetIds` agrupados por canal.
   La recipe comprueba que todas las variantes tengan los medios esperados y
   que los canales sigan activos.
5. Para publicación autónoma envía `publish: true` y los tres flags de
   `automation` indicados arriba. Sin esos flags el resultado queda en
   `ready_for_review` o `awaiting_media`. Con ellos, el MCP aprueba y encola la
   publicación usando el control plane, sin recibir credenciales del proveedor.
6. Consulta `publication.status.get` o `content.post.get` después de cada run.
   Usa la misma `idempotencyKey` en reintentos y no crees otro Post si el job
   ya devolvió `postId`.

Ejemplo de primera ejecución:

```json
{
  "recipeId": "recipe.autonomous-content",
  "site": "<site>",
  "topic": "<tema original>",
  "title": "<título>",
  "text": "<copy validado>",
  "channels": ["instagram", "x"],
  "assetCounts": { "instagram": 1, "x": 1 },
  "idempotencyKey": "<job-id-estable>"
}
```

Ejemplo de reanudación y publicación autorizada por la política del job:

```json
{
  "recipeId": "recipe.autonomous-content",
  "site": "<site>",
  "postId": "<postId-devuelto>",
  "channels": ["instagram", "x"],
  "mediaAssetIds": { "instagram": ["<assetId>"], "x": ["<assetId>"] },
  "prepareMedia": false,
  "publish": true,
  "automation": { "enabled": true, "confirmed": true, "publish": true },
  "idempotencyKey": "<job-id-estable>"
}
```

## Aprobar, preparar y publicar

### Publicación de un Post

1. Deja el Post y las variantes en `ready_for_review` con
   `content.post.review`.
2. Espera la confirmación humana. Solo después llama `content.post.approve`.
3. Consulta `publication.destination.list` con el canal y los assets. Elige
   un destino compatible, o pide al usuario que elija entre los candidatos.
4. Valida con `publication.destination.validate` o `publication.validate`.
5. Enruta con `publication.route` y prepara el bundle con
   `publication.prepare`. Esta preparación no contacta al proveedor.
6. Para una fecha futura llama `publication.schedule` con
   `publicationDate` y `timezone`. Para publicar ahora llama
   `publication.publish`. Ambas acciones necesitan la aprobación humana y
   los permisos indicados por el manifest.
7. Consulta `publication.status.get` hasta obtener un estado terminal. Si el
   estado es `unknown`, `awaiting_provider` o `failed`, informa de ello y no
   declares éxito.

### Campañas o releases

Cuando el usuario pide coordinar varios Posts, conserva la misma frontera de
revisión y usa `content.campaign.approve` seguido de
`content.campaign.schedule` o `content.campaign.publish`. Para un release
editorial usa `release.create`, `release.add_post`, `release.schedule` o
`release.publish`. No mezcles el flujo de una campaña con el de un Post sin
comprobar qué identificador devuelve cada operación.

Los proveedores iniciales son un detalle del control plane. Pueden ser Buffer,
Coolify o WordPress, pero el agente debe trabajar con `publication.*` y no con
credenciales ni APIs directas del proveedor.

## Administración y auditoría

- Usa `content.audit.inventory` para revisar Posts, variantes, assets,
  procedencia, duplicados y huérfanos. Es solo lectura.
- Usa `content.audit.repair.plan` para obtener propuestas. El plan no ejecuta
  reparaciones. Tras una confirmación humana ejecuta la capability concreta,
  por ejemplo `content.media.attach` o `content.post.archive`.
- Usa `asset.list` para localizar media temporal o standalone. `asset.delete`
  requiere `confirm: true`, respeta el preflight de vínculos y está restringido
  por rol. `force: true` es irreversible y puede dejar un Post o vídeo sin
  media, por lo que debe explicitarse antes de usarlo.
- Para administrar el Brand Kit, un owner o admin crea una versión con
  `brand.version.create`, sube referencias con `asset.upload` usando
  `kind: "reference"`, las registra con `brand.asset.register`, valida con
  `brand.version.validate` y publica con `brand.version.publish` solo tras
  confirmación humana. Las versiones publicadas son inmutables.

## Estados y errores

Trata como estados editoriales normales `draft`, `generating`,
`ready_for_review`, `changes_requested`, `approved`, `scheduled`,
`publishing`, `published`, `failed` y `archived`. Una respuesta
`blocked`, `awaiting_provider` o `failed` requiere inspección y una acción
explícita. No hagas reintentos ciegos. Repite una escritura solo con la misma
`idempotencyKey` y después de comprobar el estado.

Si falta permiso, scope, destino, Brand Kit, media, copy válido o conexión del
proveedor, explica el bloqueo y pide solo el dato o la acción necesaria. No
uses tokens de servidor, no expongas secretos y no guardes Posts en el git del
frontend.

## Checklist antes de cerrar

- Marca y scope explícitos en las llamadas.
- Copy validado y variantes completas para los canales solicitados.
- Tema comprobado con `content.topic.check` y sin coincidencias bloqueantes.
- Preparación vigente y procedencia conservada para cada media generada.
- Cada asset publicable unido a un Post y con `assetIndex` correcto.
- `postId`, `assetId`, `postUrl` y `publicationId` persistidos en la respuesta.
- Revisión humana completada antes de aprobar, programar o publicar, salvo que
  `recipe.autonomous-content` tenga el opt-in de automatización y el permiso
  `content:publish` exigidos.
- Estado final verificado con `content.post.get` o `publication.status.get`.
