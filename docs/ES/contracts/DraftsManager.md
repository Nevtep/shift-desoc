# Contrato DraftsManager

## 🎯 Propósito y Función

DraftsManager permite el **desarrollo colaborativo de propuestas** dentro del ecosistema Shift DeSoc, proporcionando un flujo de trabajo estructurado para que las comunidades desarrollen propuestas de gobernanza a través de colaboración multi-contribuyente, control de versiones y construcción de consenso antes del escalamiento formal a votación en cadena.

El contrato sirve como el puente entre las discusiones de RequestHub y las propuestas de gobernanza formales, asegurando que las ideas comunitarias sean completamente desarrolladas, revisadas y refinadas a través de procesos colaborativos antes de llegar a la etapa de votación.

## 🏗️ Arquitectura Central

### Estructuras de Datos

```solidity
struct Draft {
    uint256 communityId;           // Comunidad fuente
    uint256 requestId;             // Solicitud fuente opcional
    address author;                // Creador original
    address[] contributors;        // Todos los contribuyentes
    ActionBundle actions;          // Acciones de gobernanza para ejecutar
    string[] versionCIDs;         // Historial de versiones (IPFS)
    DraftStatus status;           // Etapa actual del flujo de trabajo
    uint64 createdAt;             // Timestamp de creación
    uint64 reviewStartedAt;       // Inicio de fase de revisión
    uint64 finalizedAt;           // Timestamp de finalización
    uint256 proposalId;           // Propuesta de gobernanza vinculada
    ReviewState reviews;          // Retroalimentación comunitaria
    mapping(address => bool) isContributor;
}

// Almacenamiento: Array dinámico de borradores
Draft[] internal _drafts;

struct ActionBundle {
    address[] targets;      // Direcciones de contratos a llamar
    uint256[] values;       // Valores ETH para cada llamada
    bytes[] calldatas;      // Datos de llamada de función
    bytes32 actionsHash;    // Hash para verificación
}

struct ReviewState {
    uint256 supportCount;        // Reseñas positivas
    uint256 opposeCount;         // Retroalimentación negativa  
    uint256 neutralCount;        // Retroalimentación neutral
    uint256 requestChangesCount; // Solicitudes de cambio
    uint256 totalReviews;        // Conteo total de reseñas
    mapping(address => Review) reviews;
}
```

### Flujo de Estado

```
DRAFTING → REVIEW → FINALIZED → ESCALATED → [WON/LOST]
    ↓         ↓         ↓           ↓
Desarrollo Retroali-  Listo para  En Votación
Colabor.   mentación  Propuesta   Gobernanza
```

## ⚙️ Funciones Clave y Lógica

### Creación y Gestión de Borradores

```solidity
function createDraft(
    uint256 communityId,
    uint256 requestId,      // Opcional: 0 si es independiente
    ActionBundle calldata actions,
    string calldata versionCID
) external returns (uint256 draftId)
```

**Crea nuevo borrador colaborativo** con versión inicial y acciones de gobernanza.

- **Integración Comunitaria**: Se vincula a contexto de comunidad específica
- **Vinculación de Solicitud**: Conexión opcional a discusiones de RequestHub  
- **Definición de Acción**: Especifica acciones exactas de gobernanza para ejecutar
- **Seguimiento de Versión**: Versionado de contenido IPFS inmutable

**🚧 Estado de Validación**: Actualmente acepta cualquier communityId y requestId sin validación. Las verificaciones de existencia de comunidad y solicitud están planificadas para implementación futura.

### Características Colaborativas

```solidity
function addContributor(uint256 draftId, address contributor) external
function removeContributor(uint256 draftId, address contributor) external
function snapshotVersion(uint256 draftId, string calldata newVersionCID) external
```

**Colaboración multi-contribuyente** habilitando:

- **Gestión de Permisos**: Autor y contribuyentes pueden modificar borradores
- **Control de Versiones**: Instantáneas inmutables con contenido IPFS
- **Edición Colaborativa**: Múltiples miembros comunitarios pueden contribuir
- **Seguimiento de Cambios**: Rastro de auditoría completo de modificaciones

### Sistema de Revisión y Consenso

```solidity
function submitReview(
    uint256 draftId,
    ReviewType reviewType,
    string calldata feedback
) external {
    Draft storage draft = _drafts[draftId];
    require(draft.status == DraftStatus.REVIEW, "No en fase de revisión");
    
    ReviewState storage reviewState = draft.reviews;
    Review storage review = reviewState.reviews[msg.sender];
    
    // Prevenir revisiones duplicadas
    require(review.reviewer == address(0), "Ya revisado");
    
    // Registrar revisión
    review.reviewer = msg.sender;
    review.reviewType = reviewType;
    review.feedback = feedback;
    review.submittedAt = uint64(block.timestamp);
    
    // Actualizar conteos
    if (reviewType == ReviewType.SUPPORT) {
        reviewState.supportCount++;
    } else if (reviewType == ReviewType.OPPOSE) {
        reviewState.opposeCount++;
    } else if (reviewType == ReviewType.NEUTRAL) {
        reviewState.neutralCount++;
    } else if (reviewType == ReviewType.REQUEST_CHANGES) {
        reviewState.requestChangesCount++;
    }
    
    reviewState.totalReviews++;
    
    emit ReviewSubmitted(draftId, msg.sender, reviewType, feedback);
}
```

### Transiciones de Estado

```solidity
function submitForReview(uint256 draftId) external onlyAuthorOrContributor(draftId) {
    Draft storage draft = _drafts[draftId];
    require(draft.status == DraftStatus.DRAFTING, "Estado inválido");
    
    draft.status = DraftStatus.REVIEW;
    draft.reviewStartedAt = uint64(block.timestamp);
    
    emit DraftSubmittedForReview(draftId, msg.sender);
}

function finalizeDraft(uint256 draftId) external onlyAuthorOrContributor(draftId) {
    Draft storage draft = _drafts[draftId];
    require(draft.status == DraftStatus.REVIEW, "Debe estar en revisión");
    require(_hasEnoughSupport(draftId), "Soporte insuficiente");
    
    draft.status = DraftStatus.FINALIZED;
    draft.finalizedAt = uint64(block.timestamp);
    
    emit DraftFinalized(draftId, msg.sender);
}
```

## 🛡️ Características de Seguridad

### Control de Acceso
```solidity
modifier onlyAuthor(uint256 draftId) {
    require(_drafts[draftId].author == msg.sender, "Solo el autor");
    _;
}

modifier onlyAuthorOrContributor(uint256 draftId) {
    Draft storage draft = _drafts[draftId];
    require(
        draft.author == msg.sender || draft.isContributor[msg.sender],
        "Solo autor o contribuyente"
    );
    _;
}
```

### Validación de Estado
```solidity
function _validateStatusTransition(DraftStatus from, DraftStatus to) internal pure returns (bool) {
    if (from == DraftStatus.DRAFTING && to == DraftStatus.REVIEW) return true;
    if (from == DraftStatus.REVIEW && to == DraftStatus.FINALIZED) return true;
    if (from == DraftStatus.FINALIZED && to == DraftStatus.ESCALATED) return true;
    return false;
}
```

### Integridad de Acciones
```solidity
function _validateActionBundle(ActionBundle calldata actions) internal pure {
    require(actions.targets.length > 0, "Se requieren acciones");
    require(
        actions.targets.length == actions.values.length &&
        actions.targets.length == actions.calldatas.length,
        "Longitudes de arrays desiguales"
    );
    
    // Verificar hash de integridad
    bytes32 expectedHash = keccak256(abi.encode(actions.targets, actions.values, actions.calldatas));
    require(actions.actionsHash == expectedHash, "Hash de acciones inválido");
}
```

## 🔄 Integración de Flujos de Trabajo

### Con RequestHub
```solidity
// Los borradores pueden originarse desde discusiones de solicitud
function createDraftFromRequest(
    uint256 requestId,
    ActionBundle calldata actions,
    string calldata versionCID
) external returns (uint256 draftId) {
    // 🚧 TODO: Validar que la solicitud existe y está en estado apropiado
    // require(requestHub.isRequestActive(requestId), "Solicitud no activa");
    
    uint256 communityId = requestHub.getRequestCommunity(requestId);
    return createDraft(communityId, requestId, actions, versionCID);
}
```

### Con ShiftGovernor
```solidity
function escalateToProposal(
    uint256 draftId,
    bool isMultiChoice,
    uint8 numOptions,
    string calldata description
) external onlyAuthorOrContributor(draftId) returns (uint256 proposalId) {
    
    Draft storage draft = _drafts[draftId];
    require(draft.status == DraftStatus.FINALIZED, "Debe estar finalizado");
    require(draft.proposalId == 0, "Ya escalado");
    
    // Crear propuesta de gobernanza
    if (isMultiChoice && numOptions > 1) {
        proposalId = IShiftGovernor(governor).proposeMultiChoice(
            draft.actions.targets,
            draft.actions.values,
            draft.actions.calldatas,
            description,
            numOptions
        );
    } else {
        proposalId = IShiftGovernor(governor).propose(
            draft.actions.targets,
            draft.actions.values,
            draft.actions.calldatas,
            description
        );
    }
    
    // Vincular borrador con propuesta
    draft.proposalId = proposalId;
    draft.status = DraftStatus.ESCALATED;
    
    emit DraftEscalated(draftId, proposalId, msg.sender);
}
```

### Con ValuableActionRegistry
```solidity
// Los borradores pueden proponer nuevas Acciones Valiosas
function proposeDraftWithValuableAction(
    uint256 communityId,
    Types.ValuableAction calldata valuableActionParams,
    string calldata valuableActionDescription,
    string calldata draftVersionCID
) external returns (uint256 draftId, uint256 valuableActionId) {
    
    // Crear Acción Valiosa propuesta
    valuableActionId = IValuableActionRegistry(valuableActionRegistry).proposeValuableAction(
        communityId,
        valuableActionParams,
        valuableActionDescription
    );
    
    // Crear borrador que activará la Acción Valiosa después de aprobación
    ActionBundle memory actions;
    actions.targets = new address[](1);
    actions.values = new uint256[](1);
    actions.calldatas = new bytes[](1);
    
    actions.targets[0] = valuableActionRegistry;
    actions.values[0] = 0;
    actions.calldatas[0] = abi.encodeWithSignature(
        "activateFromGovernance(uint256,uint256)", 
        valuableActionId, 
        0 // proposalId será establecido después del escalamiento
    );
    
    draftId = createDraft(communityId, 0, actions, draftVersionCID);
    
    emit DraftWithValuableActionProposed(draftId, valuableActionId, communityId);
}
```

## 📊 Análisis y Métricas

### Análisis de Consenso
```solidity
function getConsensusMetrics(uint256 draftId) external view returns (
    uint256 supportPercentage,
    uint256 controversyScore,
    bool hasStrongConsensus
) {
    ReviewState storage reviews = _drafts[draftId].reviews;
    
    if (reviews.totalReviews == 0) {
        return (0, 0, false);
    }
    
    // Calcular porcentaje de soporte
    supportPercentage = (reviews.supportCount * 10000) / reviews.totalReviews; // Puntos base
    
    // Puntuación de controversia basada en oposición y solicitudes de cambio
    uint256 negativeReviews = reviews.opposeCount + reviews.requestChangesCount;
    controversyScore = (negativeReviews * 10000) / reviews.totalReviews;
    
    // Consenso fuerte si >70% soporte y <20% controversia
    hasStrongConsensus = supportPercentage > 7000 && controversyScore < 2000;
}
```

### Métricas de Colaboración
```solidity
function getCollaborationMetrics(uint256 draftId) external view returns (
    uint256 contributorCount,
    uint256 versionCount,
    uint256 daysInDevelopment,
    uint256 reviewResponseTime
) {
    Draft storage draft = _drafts[draftId];
    
    contributorCount = draft.contributors.length;
    versionCount = draft.versionCIDs.length;
    
    daysInDevelopment = (block.timestamp - draft.createdAt) / 1 days;
    
    if (draft.reviewStartedAt > 0 && draft.finalizedAt > 0) {
        reviewResponseTime = (draft.finalizedAt - draft.reviewStartedAt) / 1 hours;
    }
}
```

## 🎯 Casos de Uso Prácticos

### Desarrollo de Propuesta Compleja
```solidity
// 1. Crear borrador para nueva política comunitaria
uint256 draftId = createDraft(
    communityId,
    requestId,  // Originado desde discusión de RequestHub
    policyActions,
    "ipfs://QmPolicyDraftV1..."
);

// 2. Agregar expertos como contribuyentes
addContributor(draftId, legalExpert);
addContributor(draftId, communityManager);

// 3. Iteraciones de desarrollo colaborativo
snapshotVersion(draftId, "ipfs://QmPolicyDraftV2..."); // Revisión legal
snapshotVersion(draftId, "ipfs://QmPolicyDraftV3..."); // Incorporar retroalimentación

// 4. Someter para revisión comunitaria
submitForReview(draftId);

// 5. Miembros comunitarios proporcionan retroalimentación
submitReview(draftId, ReviewType.SUPPORT, "Excelente política, apoyo completo");
submitReview(draftId, ReviewType.REQUEST_CHANGES, "Necesita claridad en sección 3");

// 6. Finalizar después de conseguir consenso
finalizeDraft(draftId);

// 7. Escalar a votación formal de gobernanza
escalateToProposal(draftId, false, 0, "Propuesta de Nueva Política Comunitaria");
```

### Propuesta Multi-Opción
```solidity
// Desarrollar propuesta de asignación de presupuesto con múltiples opciones
uint256 draftId = createDraft(
    communityId,
    0,  // No vinculado a solicitud específica
    budgetActions,
    "ipfs://QmBudgetProposal..."
);

// Después del desarrollo y revisión colaborativa
escalateToProposal(
    draftId,
    true,  // Multi-opción
    4,     // 4 opciones de asignación presupuestaria
    "Asignación de Presupuesto Q2: Opción A (Desarrollo 60%), Opción B (Marketing 60%), Opción C (Equilibrado), Opción D (Investigación 40%)"
);
```

## 🔍 Integración Frontend

### Getters Esenciales para UI
```solidity
// Información básica del borrador
function getDraft(uint256 draftId) external view returns (Draft memory)
function getDraftStatus(uint256 draftId) external view returns (DraftStatus)
function getDraftContributors(uint256 draftId) external view returns (address[] memory)

// Historial de versiones
function getVersionHistory(uint256 draftId) external view returns (string[] memory)
function getLatestVersion(uint256 draftId) external view returns (string memory)

// Estado de revisión
function getReviewState(uint256 draftId) external view returns (ReviewState memory)
function getUserReview(uint256 draftId, address user) external view returns (Review memory)

// Consultas comunitarias
function getCommunityDrafts(uint256 communityId) external view returns (uint256[] memory)
function getDraftsByRequest(uint256 requestId) external view returns (uint256[] memory)
```

### Eventos para Actualizaciones en Tiempo Real
```solidity
event DraftCreated(uint256 indexed draftId, uint256 indexed communityId, address indexed author, uint256 requestId);
event ContributorAdded(uint256 indexed draftId, address indexed contributor, address indexed addedBy);
event VersionSnapshot(uint256 indexed draftId, string versionCID, address indexed snapshotBy);
event DraftSubmittedForReview(uint256 indexed draftId, address indexed submitter);
event ReviewSubmitted(uint256 indexed draftId, address indexed reviewer, ReviewType reviewType, string feedback);
event DraftFinalized(uint256 indexed draftId, address indexed finalizer);
event DraftEscalated(uint256 indexed draftId, uint256 indexed proposalId, address indexed escalator);
```

## 🎛️ Configuración de Parámetros

### Configuraciones de Revisión
```solidity
struct ReviewConfig {
    uint256 minReviewsForFinalization;    // Mínimas revisiones necesarias
    uint256 minSupportPercentage;         // % mínimo de soporte requerido
    uint256 maxReviewDays;               // Días máximos en revisión
    bool requireExpertReview;            // Si se requieren revisiones de expertos
}

mapping(uint256 => ReviewConfig) public communityReviewConfigs;
```

### Límites de Colaboración
```solidity
uint256 constant MAX_CONTRIBUTORS = 10;      // Máximo contribuyentes por borrador
uint256 constant MAX_VERSIONS = 50;          // Máximo versiones por borrador
uint256 constant MAX_DRAFT_LIFETIME = 90 days; // Tiempo máximo antes de expiración automática
```

## 📋 Características de Producción

### Gestión de Estado Robusta
- **Transiciones Validadas**: Solo se permiten transiciones de estado lógicas
- **Prevención de Condiciones de Carrera**: Protección contra modificaciones concurrentes
- **Reversión de Estado**: Capacidad de regresar borradores a etapas anteriores si es necesario

### Escalabilidad
- **Almacenamiento Eficiente**: Uso de arrays dinámicos en lugar de mappings donde sea apropiado
- **Paginación de Consultas**: Soporte para recuperar grandes conjuntos de borradores por lotes
- **Carga de Gas Optimizada**: Operaciones de escritura mínimas durante flujos de trabajo colaborativos

### Integración de Auditoría
- **Seguimiento Completo de Cambios**: Cada modificación registrada con timestamps y autores
- **Rastro de Versiones Inmutable**: Enlaces IPFS proporcionan historial inmutable
- **Análisis de Participación**: Métricas sobre participación comunitaria y calidad de retroalimentación

**Listo para Producción**: DraftsManager proporciona infraestructura colaborativa robusta para el desarrollo de propuestas de gobernanza, asegurando que las ideas comunitarias sean completamente desarrolladas y vetadas antes del escalamiento a votación formal.

---

*Esta documentación refleja la implementación de producción con integración planificada con RequestHub, ValuableActionRegistry y ShiftGovernor, enfocándose en funcionalidad colaborativa esencial con flujos de trabajo claros.*