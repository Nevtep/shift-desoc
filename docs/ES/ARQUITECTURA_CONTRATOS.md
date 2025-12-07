# Shift DeSoc · Arquitectura Integral de Contratos

Este documento consolida la descripción técnica de todos los smart contracts de Shift DeSoc. Puede usarse como contexto unificado para agentes GPT u otras herramientas de automatización.

## Índice

1. [Claims](#claims)
2. [CohortRegistry](#cohortregistry)
3. [CommunityRegistry](#communityregistry)
4. [CommunityToken](#communitytoken)
5. [CountingMultiChoice](#countingmultichoice)
6. [DraftsManager](#draftsmanager)
7. [HousingManager](#housingmanager)
8. [Marketplace](#marketplace)
9. [MembershipTokenERC20Votes](#membershiptokenerc20votes)
10. [ParamController](#paramcontroller)
11. [ProjectFactory](#projectfactory)
12. [RequestHub](#requesthub)
13. [RevenueRouter](#revenuerouter)
14. [ShiftGovernor](#shiftgovernor)
15. [TreasuryAdapter](#treasuryadapter)
16. [ValuableActionRegistry](#valuableactionregistry)
17. [ValuableActionSBT](#valuableactionsbt)
18. [VerifierElection](#verifierelection)
19. [VerifierPowerToken1155](#verifierpowertoken1155)
20. [VerifierManager](#verifiermanager)

---

## Claims

- **Rol**: Motor central de verificación. Recibe reclamos de trabajo, coordina jurados M-de-N vía VerifierManager y aplica resoluciones/appeals.
- **Arquitectura**:
  - Modelo de privacidad dual: agregados anónimos públicos (`approvalsCount`, `rejectionsCount`) + tracking individual cifrado para reputación.
  - Estructura de `Claim` con estados (`Pending`, `Approved`, `Rejected`, `Appealed`) y ventanas de verificación derivadas de ValuableActionRegistry.
  - Integración directa con `ValuableActionRegistry`, `VerifierManager`, `ValuableActionSBT`, `MembershipTokenERC20Votes` y `CommunityToken`.
- **Funciones Clave**: `submitClaim`, `castVote`, `finalizeClaim`, `appealClaim`, `adminResolveClaim`.
- **Integraciones**: 
  - Selección de jurados (VerifierManager).
  - Recompensas/reputación (ValuableActionSBT + MembershipTokenERC20Votes).
  - Economía (CommunityToken, RevenueRouter para pagos).

## CohortRegistry

- **Rol**: Registro de cohortes de inversión con ROI objetivo inmutable y seguimiento de recuperación.
- **Arquitectura**:
  - `struct Cohort` almacena ROI objetivo, peso de prioridad, montos invertidos/recuperados y hash de términos.
  - Mapas `cohorts`, `investedBy`, `cohortInvestors`, `activeCohorts` por comunidad.
  - Sólo el `timelock` crea cohortes; `RevenueRouter` marca recuperaciones; `ValuableActionSBT` registra inversiones.
- **Funciones Clave**: `createCohort`, `addInvestment`, `markRecovered`, `getUnrecoveredAmount`, `getCohortWeight`.
- **Integraciones**: RevenueRouter para waterfall, ValuableActionSBT para emisión de Investment SBT, CommunityToken para pagos.

## CommunityRegistry

- **Rol**: Fuente única de verdad para metadatos de comunidad, parámetros, módulos y relaciones.
- **Arquitectura**:
  - `struct Community` con parámetros de gobernanza/económicos, direcciones de módulos (`requestHub`, `draftsManager`, `claimsManager`, `verifierElection`, `verifierPowerToken1155`, `verifierManager`, etc.).
  - Roles específicos por comunidad (moderators, curators, founders).
  - Relaciones jerárquicas: `parentCommunityId`, `allyCommunityIds`.
- **Funciones Clave**: `registerCommunity`, `updateParameters`, `setModuleAddress`, `grantRole`, `getCommunityModules`.
- **Integraciones**: ParamController, RequestHub, DraftsManager, Claim system, TreasuryAdapter.

## CommunityToken

- **Rol**: Token estable respaldado 1:1 por USDC para salarios y tesorería.
- **Arquitectura**:
  - ERC20 + AccessControl + Pausable + ReentrancyGuard.
  - Reserva total rastreada: `totalReserves`, `emergencyReserve`, métricas de respaldo.
  - Sistema de salarios periódicos con snapshots de ValuableActionSBT.
- **Funciones Clave**: `mintFromSalary`, `redeem`, `fundSalaryBudget`, `initializePeriod`, `claimSalary`, `emergencyFreeze`.
- **Integraciones**: ValuableActionSBT (weights), TreasuryAdapter, RevenueRouter (funding), CommunityRegistry.

## CountingMultiChoice

- **Rol**: Motor de conteo para votaciones multi-opción integrado en ShiftGovernor.
- **Arquitectura**:
  - `ProposalVote` con conteos tradicionales + mapa de pesos por votante.
  - `MultiChoiceConfig` para habilitar opciones, pesos máximos y totales por opción.
- **Funciones Clave**: `enableMulti`, `castVoteMulti`, `proposalVotes`, `proposalOptionTotals`.
- **Integraciones**: ShiftGovernor (hooks de conteo) y frontends de gobernanza.

## DraftsManager

- **Rol**: Orquestador de desarrollo colaborativo de propuestas (puente RequestHub → ShiftGovernor).
- **Arquitectura**:
  - `Draft` con contributors, historial de versiones (IPFS), `ActionBundle` (targets, valores, calldatas, `actionsHash`).
  - `ReviewState` para feedback comunitario y señales previas a escalamiento.
  - Estados: Drafting → Review → Finalized → Escalated → Won/Lost.
- **Funciones Clave**: `createDraft`, `addContributor`, `snapshotVersion`, `submitForReview`, `finalizeForProposal`, `escalateToProposal`.
- **Integraciones**: RequestHub (requests origen), ShiftGovernor (escalación), ValuableActionRegistry (definición de acciones).

## HousingManager *(stub)*

- **Rol**: Futuro módulo de reservas de co-housing y administración de propiedades.
- **Estado**: Implementación mínima (emisión de eventos) planificada para Fase 2.
- **Arquitectura Prevista**: `HousingUnit`, reglas de pricing dinámico, `PriorityRule` basado en ValuableActionSBT.

## Marketplace *(stub)*

- **Rol**: Comercio descentralizado de bienes/servicios con fees para la comunidad.
- **Estado**: Placeholder con eventos básicos (listado/compra) para Fase 2.
- **Arquitectura Prevista**: `Product`, reglas de fees, distribución de ingresos, reputación.

## MembershipTokenERC20Votes

- **Rol**: Token de gobernanza basado exclusivamente en mérito (mint sólo vía Claims aprobados).
- **Arquitectura**:
  - ERC20Votes + ERC20Permit + AccessControlEnumerable.
  - Roles limitados (`MINTER_ROLE`) a Claims y CommunityFactory.
  - Cap máximo `MAX_SUPPLY = 100M` para evitar concentración.
- **Funciones Clave**: `mintFromWork`, delegación estándar, snapshots para votación.
- **Integraciones**: ShiftGovernor, CommunityFactory, Claims.

## ParamController

- **Rol**: Almacén dinámico de parámetros de gobernanza, elegibilidad y economía.
- **Arquitectura**:
  - `GovernanceParams`, `EligibilityParams`, `EconomicParams` por comunidad.
  - `ParameterUpdate` para cambios encolados vía gobernanza.
- **Funciones Clave**: `queueGovernanceUpdate`, `executeUpdate`, getters por categoría, `setRevenuePolicy`.
- **Integraciones**: ShiftGovernor (timing), RevenueRouter (splits), VerifierManager (config jurados), RequestHub (rate limits).

## ProjectFactory

- **Rol**: Registro de proyectos comunitarios y base para crowdfunding ERC-1155.
- **Arquitectura**:
  - `Project` con creador, metadata IPFS, token ERC-1155 asociado y flag `active`.
  - ID incremental `lastId`.
- **Funciones Clave**: `create`, `archive`, `getProject` (futuro).
- **Integraciones**: Marketplace, RequestHub (origen de iniciativas), RevenueRouter (distribución futura).

## RequestHub

- **Rol**: Foro on-chain para coordinación comunitaria y origen de propuestas.
- **Arquitectura**:
  - `Request` con metadata, estado (`OPEN_DEBATE`, `FROZEN`, `ARCHIVED`), tags y link opcional a ValuableAction.
  - `Comment` con soporte threaded (`parentId`).
  - Mecanismos anti-spam: rate limits, `postingStake`, roles de moderación.
- **Funciones Clave**: `createRequest`, `postComment`, `setStatus`, `linkValuableAction`, `createBountyRequest`.
- **Integraciones**: DraftsManager, Claims (bounties), CommunityRegistry (moderators), ValuableActionSBT (permisos).

## RevenueRouter

- **Rol**: Distribución en cascada basada en cohortes garantizando ROI objetivo y priorizando trabajadores.
- **Arquitectura**:
  - Dependencias: `paramController`, `cohortRegistry`.
  - Pools: `workerPools`, `treasuryReserves`, `workerClaims`, `investorClaims` por comunidad/token.
  - Flujo: Entrada → mínimo trabajadores → base tesoro → pool inversores → asignación a cohortes por peso → spillover.
- **Funciones Clave**: `routeRevenue`, `_distributeToActiveCohorts`, `_distributeToCohortInvestors`, `allocateWorkerRevenue`, `previewDistribution`.
- **Integraciones**: CohortRegistry, ValuableActionSBT/Claims (asignación a trabajadores), CommunityToken/Treasury.

## ShiftGovernor

- **Rol**: Contrato de gobernanza principal (basado en OpenZeppelin Governor) con voto binario y multi-opción.
- **Arquitectura**:
  - Integración con CountingMultiChoice para `castVoteMulti`.
  - Hooks con timelock y ParamController para enforcement.
  - Soporta `proposeMultiChoice`, `proposalThreshold`, `quorum`, `votingDelay/Period` configurables.
- **Funciones Clave**: `propose`, `proposeMultiChoice`, `castVote`, `castVoteMultiChoice`, `execute`, `cancel`.
- **Integraciones**: MembershipTokenERC20Votes, TimelockController, DraftsManager.

## TreasuryAdapter *(stub)*

- **Rol**: Puente previsto entre gobernanza on-chain y tesorerías externas (Gnosis Safe/Zodiac).
- **Estado**: Placeholder, todas las funciones actuales revertidas (`NotConfigured`).
- **Arquitectura Prevista**: `TreasuryOperation`, colas de ejecución timelock, integración multisig.

## ValuableActionRegistry

- **Rol**: Definición democrática de tipos de trabajo (Valuable Actions) y sus parámetros económicos/operativos.
- **Arquitectura**:
  - `ValuableAction` con recompensas (`membershipTokenReward`, `communityTokenReward`, `investorSBTReward`), parámetros de jurado (`jurorsMin`, `panelSize`, `verifyWindow`), control de calidad, metadata IPFS, reglas de automatización.
  - Founder whitelist para bootstrap seguro.
- **Funciones Clave**: `createValuableAction`, `updateValuableAction`, `activateFromGovernance`, `setFounderStatus`.
- **Integraciones**: Claims, ValuableActionSBT, MembershipTokenERC20Votes, CohortRegistry (acciones de inversión).

## ValuableActionSBT

**Rol**: Sistema de reputación soulbound que registra contribuciones y calcula WorkerPoints con decaimiento temporal. Anteriormente llamado WorkerSBT, renombrado para alinearse con la terminología del ecosistema ValuableAction.
- **Arquitectura**:
  - ERC721 no transferible (todas las funciones de transferencia revierten).
  - `workerPoints`, `lifetimeWorkerPoints`, `lastWorkerPointsUpdate`, `achievements`.
  - Subtipo Investment SBT con metadata extendida (`InvestmentMeta`).
- **Funciones Clave**: `mintAndAwardPoints`, `mintInvestmentSBT`, `mintVerifierReward`, `updateWorkerPoints`, `setDecayRate`.
- **Integraciones**: Claims (minting), RevenueRouter (prioridades), CommunityToken (peso salarial), RequestHub (privilegios).

## VerifierElection

- **Rol**: Gestión de conjuntos de verificadores bajo gobernanza timelock; reemplaza bonding económico por elecciones democráticas.
- **Arquitectura**:
  - `VerifierSet` con arrays de verificadores, mapping `powers`, `totalPower`, `lastUpdated`, `lastReasonCID`.
  - Mapas de baneos y timestamps.
  - Sólo timelock puede `setVerifierSet`, `adjustVerifierPower`, `banVerifiers`, `unbanVerifier`.
- **Integraciones**: VerifierPowerToken1155 (mint/burn), VerifierManager (consulta de verificador elegible), ParamController (config), Claims (disciplina).

## VerifierPowerToken1155

- **Rol**: Tokens ERC-1155 por comunidad que representan poder de verificador no transferible.
- **Arquitectura**:
  - Roles: `TIMELOCK_ROLE` (único operador), `DEFAULT_ADMIN_ROLE` revocado del deployer.
  - Estados por comunidad: `totalSupply`, `communityInitialized`.
  - Transferencias deshabilitadas; sólo timelock puede `mint`, `burn`, `batchMint`, `batchBurn`, `adminTransfer`.
- **Integraciones**: VerifierElection (gestión de poder), VerifierManager/Claims (validación de autoridad), CommunityRegistry.

## VerifierManager

- **Rol**: Selección configurable de jurados M-de-N y sistema de reporte de fraude en el VPS.
- **Arquitectura**:
  - `JurorSelection` almacenado por `claimId` con jurados, poderes, semilla y timestamp.
  - Lectura de parámetros comunitarios (`USE_VPT_WEIGHTING`, `MAX_WEIGHT_PER_VERIFIER`, `VERIFIER_PANEL_SIZE`, `VERIFIER_MIN`) desde ParamController.
  - Funciones restringidas a `claimsContract` y `governance` para configuración.
- **Funciones Clave**: `selectJurors`, `reportFraud`, `setClaimsContract`, utilidades internas de selección (uniforme/ponderada).
- **Integraciones**: VerifierElection (pool elegible), ParamController (config dinámica), Claims (workflow), CommunityRegistry (gobernanza).

---

**Notas**:
- Los módulos etiquetados como *stub* aún no tienen lógica completa y sirven como placeholders para futuras fases.
- Todos los contratos de producción usan `Errors.sol` para revertencias consistentes y se alinean con el flujo principal `requests → drafts → proposals → timelock execution`.
- Este documento refleja el estado actual en la rama `beta-release` (diciembre 2025).
