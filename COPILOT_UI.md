You are my senior React Native + Expo engineer. Build the Shift dApp UI (mobile-first, cross-mobile + RN Web). Use file naming:

Visual components: *.component.tsx

Business logic (containers): *.container.tsx

Data layer (hooks/adapters): *.datasource.tsx

Sources: Read Figma via MCP servers; adhere to design tokens and spacing; use Tailwind NativeWind if available or utility styles consistently.

Screens (implement containers + components + data sources):

Home: feed de necesidades/propuestas; filtros por comunidad.

Request Detail: título, resumen, debate (thread), botón “Crear borrador”, congelar debate.

Draft Builder: targets/values/calldata, adjuntos; preview multi-opción; “Escalar a propuesta”.

Voting: ver propuesta; slider o inputs para pesos (multi-choice); emitir voto; estado de quórum.

Action Types: browse/crear (mods) con evidencia requerida.

Claims: crear, subir foto/video/geoloc; verificador asignado; estado; apelar.

Projects: listing; detalle; tiers ERC-1155; milestones; contribuir (stable).

Marketplace: catálogo; compra; recibos; historial.

Housing: unidades; calendario por noches (1155); reservar; ver reservas.

Profile: SBTs, WorkerPoints, antigüedad, elegibilidad; delegación de voto.

Treasury: ingresos/egresos, split 50/30/20; redenciones de CommunityToken.

Data layer (*.datasource.tsx):

ethers + Wagmi/WalletConnect; network: Base; read/write contracts.

IPFS uploads (images/video) via pinned provider.

Caching + optimistic UI where safe.

Deliverables: Navigation, state management, error boundaries, skeleton loaders, accessibility basics. Generate component and container skeletons with proper props; wire minimal happy-path flows for MVP.