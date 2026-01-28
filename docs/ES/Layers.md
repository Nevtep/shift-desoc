# Capas del Sistema Shift

Este documento proporciona una referencia completa de las cinco capas arquitectónicas del protocolo Shift DeSoc. Cada capa se construye sobre la anterior, creando un sistema completo para gobernanza comunitaria, verificación de trabajo y coordinación económica.

---

## Capa 1: Coordinación Comunitaria

**Propósito**: Fundación para coordinación comunitaria, discusión y toma de decisiones colaborativa antes de la gobernanza formal.

### Componentes

| Contrato | Rol |
|----------|-----|
| **CommunityRegistry** | Fuente única de verdad para metadatos, parámetros y direcciones de módulos |
| **RequestHub** | Foro de discusión on-chain para necesidades e ideas de la comunidad |
| **DraftsManager** | Desarrollo colaborativo de propuestas con versionado y revisión |
| **ParamController** | Gestión dinámica de parámetros con control de gobernanza |

### CommunityRegistry

Registro central que gestiona el ciclo de vida, metadatos y conexión de módulos de la comunidad.

**Funciones Clave**:
- `registerCommunity(params)` → communityId
- `updateCommunityParams(communityId, updates)` — Solo gobernanza
- `setModuleAddress(communityId, moduleKey, address)` — Configurar conexión de módulos
- `grantRole(communityId, user, role)` — Asignar roles comunitarios

**Estado**:
```solidity
struct Community {
    string name;
    string description;
    string metadataURI;
    uint256 debateWindow;
    uint256 voteWindow;
    uint256 executionDelay;
    uint256 minSeniority;
    uint256 proposalThreshold;
    address governor;
    address timelock;
    // ... direcciones de módulos
}
```

### RequestHub

Foro de discusión on-chain donde los miembros de la comunidad publican necesidades/ideas y colaboran en soluciones.

**Funciones Clave**:
- `createRequest(title, cid, tags)` → requestId
- `postComment(requestId, parentId, cid)` → commentId
- `setStatus(requestId, status)` — Controlado por moderadores

**Flujo de Estado**: `OPEN_DEBATE → FROZEN → ARCHIVED`

### DraftsManager

Desarrollo de propuestas multi-contribuidor con versionado antes de la presentación formal a gobernanza.

**Funciones Clave**:
- `createDraft(requestId, actions, cid)` → draftId
- `addContributor(draftId, contributor)` — Edición colaborativa
- `snapshotVersion(draftId, newVersionCID)` — Versionado inmutable
- `escalateToProposal(draftId, multiChoice, numOptions, description)` → proposalId

**Ciclo de Vida del Borrador**: `DRAFTING → REVIEW → ESCALATED → WON/LOST`

### ParamController

Oráculo de parámetros controlado por gobernanza para toda la configuración del sistema.

**Parámetros Clave**:
- Tiempos de gobernanza (ventana de debate, ventana de votación, retraso de ejecución)
- Configuración de verificación (tamaño del panel, aprobaciones mínimas)
- Distribuciones económicas (% trabajadores, % tesorería, % inversores)
- Configuración de tarifas y límites

**Acceso**: Todas las mutaciones requieren ejecución via timelock.

**Flujo de Trabajo**: `Necesidad Comunitaria → Discusión → Borrador Colaborativo → Revisión → Escalación a Gobernanza`

---

## Capa 2: Gobernanza Democrática

**Propósito**: Gobernanza democrática multi-opción con protección de timelock y toma de decisiones matizada.

### Componentes

| Contrato | Rol |
|----------|-----|
| **ShiftGovernor** | OpenZeppelin Governor con extensiones de votación multi-opción |
| **CountingMultiChoice** | Mecanismo de conteo de votos ponderados multi-opción |
| **MembershipTokenERC20Votes** | Tokens de gobernanza puramente basados en mérito |
| **TimelockController** | Retrasos de ejecución y protección de override de emergencia |

### ShiftGovernor

Orquestador de gobernanza que soporta propuestas binarias y multi-opción.

**Funciones Clave**:
```solidity
// Propuesta binaria (OpenZeppelin estándar)
function propose(targets, values, calldatas, description) → proposalId

// Propuesta multi-opción (innovación Shift)
function proposeMultiChoice(targets, values, calldatas, description, numOptions) → proposalId

// Votación
function castVote(proposalId, support)
function castVoteMultiChoice(proposalId, weights[], reason)

// Flujo de ejecución
function queue(targets, values, calldatas, descriptionHash)
function execute(targets, values, calldatas, descriptionHash)
```

**Configuración**:
| Parámetro | Por Defecto | Propósito |
|-----------|-------------|-----------|
| Retraso de Votación | 1 día | Previene ataques de gobernanza flash |
| Período de Votación | 5 días | Tiempo para participación comunitaria |
| Quórum | 4% | Participación mínima requerida |

### CountingMultiChoice

Distribución de preferencias ponderada a través de múltiples opciones de propuesta.

**Distribución de Votos**:
- Los votantes distribuyen peso entre opciones (debe sumar ≤ 100%)
- Ejemplo: 60% Opción A, 40% Opción B
- Soporta expresión de preferencias matizada vs sí/no binario

### MembershipTokenERC20Votes

**Principio Central**: "El poder de gobernanza se GANA, no se compra"

**Propiedades del Token**:
- Solo se acuña cuando los Compromisos son aprobados para completar ValuableActions
- No se puede comprar con ETH/USDC
- Sin recompensas de staking o airdrops
- Capacidades completas de delegación ERC20Votes
- Snapshots históricos previenen manipulación de votos

**Funciones Clave**:
```solidity
function mint(to, amount, reason) external onlyRole(MINTER_ROLE)
function delegate(delegatee) public
function getPastVotes(account, blockNumber) → uint256
```

**Flujo de Trabajo**: `Escalación de Borrador → Creación de Propuesta → Período de Votación → Retraso de Timelock → Ejecución`

---

## Capa 3: Verificación y Reputación

**Propósito**: Verificación democrática de trabajo reemplazando bonos económicos con verificadores elegidos por la comunidad.

### Componentes

| Contrato | Rol |
|----------|-----|
| **ValuableActionRegistry** | Capa de políticas y definiciones para todas las acciones valiosas |
| **Engagements** | Presentación de compromisos de trabajo y verificación M-de-N |
| **CredentialManager** | Aplicaciones de certificaciones con alcance de curso |
| **PositionManager** | Ciclo de vida de posiciones con SBT de ROL al éxito |
| **VerifierPowerToken1155** | Poder de verificador no transferible por comunidad |
| **VerifierElection** | Gestión de conjunto de verificadores controlada por gobernanza |
| **VerifierManager** | Selección de jurados M-de-N y seguimiento de rendimiento |
| **ValuableActionSBT** | Tokens soulbound con 5 tipos (WORK, ROLE, CREDENTIAL, POSITION, INVESTMENT) |

### ValuableActionRegistry

Capa de políticas canónica definiendo todas las acciones valiosas y coordinando emisión de SBT.

**Funciones Clave**:
```solidity
// Funciones de emisión (llamadas por contratos gestores)
function issueEngagement(communityId, recipient, subtype, actionTypeId, metadata) → tokenId
function issuePosition(communityId, recipient, roleTypeId, points, metadata) → tokenId
function issueInvestment(communityId, recipient, cohortId, weight, metadata) → tokenId
function issueRoleFromPosition(communityId, holder, roleTypeId, points, issuedAt, endedAt, outcome, metadata) → tokenId

// Ciclo de vida de posición
function closePositionToken(communityId, tokenId, outcome)
```

**Configuración de ValuableAction**:
```solidity
struct ValuableAction {
    uint32 membershipTokenReward;   // Tokens de gobernanza al completar
    uint32 communityTokenReward;    // CommunityToken para base salarial
    uint32 jurorsMin;               // M (aprobaciones mínimas)
    uint32 panelSize;               // N (jurados totales)
    uint32 verifyWindow;            // Límite de tiempo para verificación
    uint32 cooldownPeriod;          // Tiempo entre compromisos
    bool revocable;                 // ¿Puede gobernanza revocar?
    string evidenceSpecCID;         // Requisitos de evidencia IPFS
}
```

### Engagements (Compromisos)

Verificación de compromisos de trabajo únicos con votación de jurados M-de-N.

**Ciclo de Vida**: `Enviar → Selección de Jurados → Votación → Resolución → Acuñación de SBT`

**Funciones Clave**:
- `submit(typeId, evidenceCID)` → engagementId
- `verify(engagementId, approve)` — Votación de jurados
- `submitAppeal(engagementId, reason)` — Apelación del trabajador

**Modelo de Privacidad**: Doble capa (agregados públicos + votos individuales internos)

### CredentialManager (Certificaciones)

Aplicaciones de certificaciones de cursos con aprobación de verificador designado.

**Funciones Clave**:
```solidity
function defineCourse(courseId, communityId, verifier, active) — Solo Gov/Mod
function applyForCredential(courseId, evidence) → appId
function approveApplication(appId) → tokenId  // Acuña SBT CREDENTIAL
function revokeCredential(tokenId, courseId, reason) — Solo gobernanza
```

**Ciclo de Vida**: `Definir Curso → Aplicar → Verificador Aprueba → SBT CREDENTIAL Acuñado`

### PositionManager

Gestiona roles continuos con SBTs de Posición y participación en ingresos.

**Funciones Clave**:
```solidity
function definePositionType(roleTypeId, communityId, points, active) — Gov/Mod
function applyForPosition(roleTypeId, evidence) → appId
function approveApplication(appId, metadata) → positionTokenId  // Registra con RevenueRouter
function closePosition(positionTokenId, outcome, evidence) → roleTokenId  // SUCCESS acuña SBT ROLE
```

**Resultados de Cierre**:
| Resultado | Efecto |
|-----------|--------|
| `SUCCESS` | SBT de Compromiso ROLE acuñado (historial certificado) |
| `NEUTRAL` | Sin SBT (gobernanza puede acuñar manualmente) |
| `NEGATIVE` | Sin SBT (mala conducta/remoción) |

### Sistema de Poder de Verificador (VPS)

Reemplaza el staking económico con elecciones de verificadores controladas por gobernanza.

**VerifierPowerToken1155**:
- ERC-1155 donde token ID = community ID
- No transferible (transferencias deshabilitadas)
- Solo timelock puede acuñar/quemar poder

**VerifierElection**:
- Gestiona listas de verificadores por comunidad
- Prohibiciones/habilitaciones con CIDs de razón
- Sincroniza con balances de VPT

**VerifierManager**:
- Selecciona paneles M-de-N de verificadores elegibles
- Ponderación configurable (uniforme vs proporcional al poder)
- Reporta fraude a VerifierElection

### ValuableActionSBT

Tokens soulbound representando todas las contribuciones verificadas.

**Tipos de Token**:
```solidity
enum TokenKind {
    WORK,        // Compromiso de trabajo único completado
    ROLE,        // Rol pasado certificado (de cierre de Posición)
    CREDENTIAL,  // Certificación de curso/formación
    POSITION,    // Rol activo en curso
    INVESTMENT   // Membresía de cohorte de inversión
}
```

**Propiedades**:
- No transferible (transferencias ERC721 revierten)
- WorkerPoints con decaimiento basado en tiempo
- Gobernanza puede revocar por mala conducta

**Flujo de Trabajo**: `Definición de Trabajo → Envío de Compromiso → Selección de Verificadores → Votación M-de-N → Acuñación de SBT → Recompensas`

---

## Capa 4: Motor Económico

**Propósito**: Distribución de ingresos basada en cohortes con ROI objetivo y mecánicas de cascada automatizada.

### Componentes

| Contrato | Rol |
|----------|-----|
| **CommunityToken** | Moneda programable respaldada 1:1 con USDC |
| **CohortRegistry** | Seguimiento de cohortes de inversión con ROI objetivo |
| **RevenueRouter** | Motor de distribución en cascada |
| **TreasuryAdapter** | Controles de gasto de tesorería como módulo Safe |
| **InvestmentCohortManager** | Coordinación de ciclo de vida de cohortes y emisión de inversiones |

### CommunityToken

Stablecoin respaldado 1:1 con USDC para pagos comunitarios.

**Funciones Clave**:
```solidity
function mint(usdcAmount) → tokensIssued     // Depositar USDC, obtener tokens
function redeem(tokenAmount) → usdcRedeemed  // Quemar tokens, obtener USDC
function withdrawFromTreasury(recipient, amount, reason) — TREASURY_ROLE
```

**Características de Seguridad**:
- Pausa de emergencia
- Retiro de emergencia con retraso
- Ratio de respaldo siempre ≥ 1:1

### CohortRegistry

Gestiona cohortes de inversión con términos de ROI objetivo inmutables.

**Estructura de Cohorte**:
```solidity
struct Cohort {
    uint256 id;
    uint256 communityId;
    uint16 targetRoiBps;      // ej: 15000 = 150% (inmutable)
    uint32 priorityWeight;    // Prioridad de ingresos (1-1000)
    uint256 investedTotal;
    uint256 recoveredTotal;
    bool active;              // Auto-desactiva cuando se alcanza ROI objetivo
    bytes32 termsHash;        // Términos inmutables
}
```

**Funciones Clave**:
```solidity
function createCohort(communityId, targetRoiBps, priorityWeight, termsHash, startAt, endAt, active) → cohortId
function addInvestment(cohortId, investor, amount, tokenId) — Solo ValuableActionRegistry
function markRecovered(cohortId, amount) — Solo RevenueRouter
```

### RevenueRouter

Distribución determinística en cascada.

**Orden de Distribución**:
1. **Mínimo de Trabajadores** — Porción garantizada (ej: 40%)
2. **Base de Tesorería** — Reserva comunitaria
3. **Pool de Inversores** — Distribuido a cohortes activas por peso
4. **Excedente** — Fondos restantes según política de gobernanza

**Funciones Clave**:
```solidity
function routeRevenue(communityId, token, amount) — DISTRIBUTOR_ROLE
function registerPosition(tokenId) — Llamado cuando se asigna Posición
function unregisterPosition(tokenId) — Llamado cuando se cierra Posición
```

### TreasuryAdapter

Ruta de ejecución como módulo Safe para gasto de tesorería gobernado.

**Protecciones**:
| Regla | Límite |
|-------|--------|
| Frecuencia | Máx 1 pago por semana |
| Tamaño | Máx 10% del balance del token por pago |
| Tokens | Solo lista permitida de stablecoins |
| Control | Solo gobernanza via Timelock |

**Funciones Clave**:
```solidity
function executePayment(token, to, amount, reasonURI) — onlyTimelock, whenNotPaused
function emergencyWithdraw(token, to, amount) — onlyGovernorOrGuardian
function pause() / unpause()
```

### InvestmentCohortManager

Coordina ciclo de vida de cohortes y emisión de SBT de Inversión.

**Funciones Clave**:
```solidity
function createCohort(communityId, targetRoiBps, priorityWeight, termsHash, startAt, endAt, active) → cohortId
function setCohortActive(cohortId, active)
function issueInvestment(to, cohortId, weight, metadata) → tokenId  // Acuña SBT INVESTMENT
```

**Flujo de Trabajo**: `Generación de Ingresos → Pool de Trabajadores → Reserva de Tesorería → Distribución de Cohortes → Seguimiento de ROI → Auto-Completación`

---

## Capa 5: Comercio y Vivienda

**Propósito**: Aplicaciones específicas de comunidad incluyendo marketplace, co-vivienda y crowdfunding de proyectos.

### Componentes

| Contrato | Rol |
|----------|-----|
| **Marketplace** | Comercio descentralizado con escrow |
| **CommerceDisputes** | Resolución de disputas para transacciones comerciales |
| **HousingManager** | Coordinación de co-vivienda y reservaciones |
| **ProjectFactory** | Crowdfunding ERC-1155 con validación de hitos |

### Marketplace

Superficie de comercio canónica soportando bienes, servicios y productos impulsados por módulos.

**Tipos de Oferta**: `GENERIC`, `HOUSING`, extensible a futuros adaptadores

**Ciclo de Vida de Orden**:
1. Comprador inicia compra
2. Marketplace deposita fondos en escrow
3. Para HOUSING: llama a HousingManager.consume()
4. Vendedor marca como cumplido
5. Ventana de disputa de 72 horas
6. Liquidación via RevenueRouter

**Funciones Clave**:
```solidity
function createOffer(communityId, kind, productContract, productId, basePrice, ...) → offerId
function purchaseOffer(offerId, paymentToken, params) → orderId
function markOrderFulfilled(orderId)
function settleOrder(orderId) — Después de ventana de disputa
function openOrderDispute(orderId, evidenceURI) — Solo comprador
```

### CommerceDisputes

Resolución de disputas dedicada separada de verificación de trabajo.

**Resultados** (MVP):
- `REFUND_BUYER` — Escrow completo devuelto
- `PAY_SELLER` — Liquidación completa via RevenueRouter

**Funciones Clave**:
```solidity
function openDispute(communityId, disputeType, relatedId, buyer, seller, amount, evidenceURI) → disputeId
function finalizeDispute(disputeId, outcome)
```

**Integración**: Llama a `IDisputeReceiver.onDisputeResolved()` para activar reembolso/liquidación.

### HousingManager

Gestión de inventario y reservaciones de co-vivienda implementando interfaz ModuleProduct.

**Gestión de Unidades**:
```solidity
struct HousingUnit {
    uint256 unitId;
    uint256 communityId;
    address unitToken;         // NFT de propiedad
    uint256 basePricePerNight;
    bool staked;               // Disponible para uso comunitario
    bool listed;               // Activo en Marketplace
}
```

**Interfaz ModuleProduct**:
```solidity
function quote(productId, params, basePrice) → finalPrice
function consume(productId, buyer, params, amountPaid) → reservationId
function onOrderSettled(productId, resourceId, outcome)
```

**Ciclo de Vida de Reservación**: `CONFIRMED → CHECKED_IN → CHECKED_OUT → CANCELLED`

**Política de Cancelación**: Global por comunidad (estancia mínima: 3 días o 30 días)

### ProjectFactory

Crowdfunding ERC-1155 con validación de hitos.

**Funciones Clave**:
```solidity
function createProject(creator, metadataCID, fundingToken) → projectId
function setProjectActive(projectId, active)
```

**Integración**: Los proyectos pueden generar listados de Marketplace, asignar inventario de vivienda, y configurar cohortes para participación de inversores.

---

## Resumen de Integración Entre Capas

```
┌─────────────────────────────────────────────────────────────────────┐
│  Capa 5: Comercio         │ Marketplace, HousingManager, Disputes  │
├───────────────────────────┼─────────────────────────────────────────┤
│  Capa 4: Económica        │ CommunityToken, RevenueRouter, Cohortes│
├───────────────────────────┼─────────────────────────────────────────┤
│  Capa 3: Verificación     │ Engagements, VPS, SBTs, Gestores       │
├───────────────────────────┼─────────────────────────────────────────┤
│  Capa 2: Gobernanza       │ Governor, Counting, MembershipToken    │
├───────────────────────────┼─────────────────────────────────────────┤
│  Capa 1: Coordinación     │ Registry, RequestHub, Drafts, Params   │
└─────────────────────────────────────────────────────────────────────┘
```

**Flujos de Datos**:
- Coordinación → Gobernanza: Borradores escalan a propuestas
- Gobernanza → Todas las Capas: Timelock ejecuta cambios de parámetros
- Verificación → Gobernanza: Compromisos aprobados acuñan MembershipTokens
- Verificación → Económica: Posiciones se registran con RevenueRouter
- Económica → Todas: RevenueRouter distribuye a trabajadores, tesorería, inversores
- Comercio → Económica: Liquidaciones se enrutan a través de RevenueRouter
- Comercio → Verificación: Órdenes completadas pueden activar ValuableActions
