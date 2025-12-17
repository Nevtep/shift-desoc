# Contrato ActionTypeRegistry

## 🎯 Propósito y Función

El **ActionTypeRegistry** actúa como el registro centralizado de todos los tipos de trabajo disponibles dentro del ecosistema Shift DeSoc. Define las categorías de trabajo que pueden ser realizadas, sus parámetros de verificación, estructuras de recompensa y especificaciones de evidencia. Es fundamental para mantener consistencia en la evaluación del trabajo y permitir que las comunidades configuren sus propios tipos de trabajo personalizados.

## 🏗️ Arquitectura Central

### Estructuras de Datos

```solidity
struct ActionType {
    uint256 id;                     // Identificador único
    uint256 communityId;            // Comunidad propietaria
    string name;                    // Nombre descriptivo del tipo de trabajo
    string description;             // Descripción detallada
    string evidenceSpecCID;         // Especificación IPFS de evidencia requerida
    
    // Parámetros de Verificación
    uint32 jurorsMin;               // Mínimo de aprobaciones de verificadores (M)
    uint32 panelSize;               // Tamaño total del panel de verificadores (N)
    uint32 verifyWindow;            // Ventana de tiempo para verificación (segundos)
    
    // Parámetros Económicos
    uint256 rewardAmount;           // Recompensa en CommunityToken
    uint32 weight;                  // Puntos WorkerSBT otorgados
    uint32 rewardVerify;            // Recompensa para verificadores
    uint32 slashVerifierBps;        // Penalización de verificadores (puntos base)
    
    // Restricciones y Estado
    uint32 cooldown;                // Tiempo mínimo entre reclamos del mismo tipo
    bool active;                    // Estado activo/inactivo
    bool revocable;                 // Si puede ser revocado por gobernanza
    uint256 createdAt;              // Timestamp de creación
    address creator;                // Dirección que creó el tipo
}

struct ActionTypeCategory {
    string name;                    // Nombre de la categoría (ej. "Development", "Content")
    string description;             // Descripción de la categoría
    uint256[] actionTypeIds;        // IDs de ActionTypes en esta categoría
    bool active;                    // Estado de la categoría
}
```

### Gestión del Estado

- **Registro de Tipos**: Mapeo de actionTypeId a estructura ActionType
- **Índices de Comunidad**: Mapeo de communityId a array de actionTypeIds
- **Sistema de Categorías**: Agrupación lógica de ActionTypes relacionados
- **Control de Acceso**: Gestión de permisos para creación y modificación
- **Versionado**: Historial de cambios para auditabilidad

## ⚙️ Funciones y Lógica Clave

### Creación de ActionTypes

```solidity
function createActionType(ActionTypeParams calldata params) 
    external onlyAuthorized(params.communityId) returns (uint256 actionTypeId) {
    
    // Validar parámetros
    require(bytes(params.name).length > 0, "Nombre requerido");
    require(params.jurorsMin > 0 && params.jurorsMin <= params.panelSize, "Configuración de jurados inválida");
    require(params.panelSize <= MAX_PANEL_SIZE, "Panel demasiado grande");
    require(params.verifyWindow >= MIN_VERIFY_WINDOW, "Ventana de verificación muy corta");
    require(params.rewardAmount > 0, "Recompensa debe ser positiva");
    
    // Crear nuevo ActionType
    actionTypeId = ++nextActionTypeId;
    ActionType storage newActionType = actionTypes[actionTypeId];
    
    newActionType.id = actionTypeId;
    newActionType.communityId = params.communityId;
    newActionType.name = params.name;
    newActionType.description = params.description;
    newActionType.evidenceSpecCID = params.evidenceSpecCID;
    
    // Configurar parámetros de verificación
    newActionType.jurorsMin = params.jurorsMin;
    newActionType.panelSize = params.panelSize;
    newActionType.verifyWindow = params.verifyWindow;
    
    // Configurar parámetros económicos
    newActionType.rewardAmount = params.rewardAmount;
    newActionType.weight = params.weight;
    newActionType.rewardVerify = params.rewardVerify;
    newActionType.slashVerifierBps = params.slashVerifierBps;
    
    // Configurar restricciones
    newActionType.cooldown = params.cooldown;
    newActionType.active = true;
    newActionType.revocable = params.revocable;
    newActionType.createdAt = block.timestamp;
    newActionType.creator = msg.sender;
    
    // Actualizar índices
    communityActionTypes[params.communityId].push(actionTypeId);
    
    emit ActionTypeCreated(actionTypeId, params.communityId, params.name);
    
    return actionTypeId;
}
```

### Actualización de Parámetros

```solidity
function updateActionTypeParameters(
    uint256 actionTypeId,
    ActionTypeUpdate calldata update
) external onlyGovernanceOrCreator(actionTypeId) {
    ActionType storage actionType = actionTypes[actionTypeId];
    require(actionType.id != 0, "ActionType no existe");
    require(actionType.active, "ActionType inactivo");
    
    // Validar cambios propuestos
    if (update.updateReward) {
        require(update.newRewardAmount > 0, "Recompensa inválida");
        require(_isReasonableRewardChange(actionType.rewardAmount, update.newRewardAmount),
                "Cambio de recompensa muy drástico");
        actionType.rewardAmount = update.newRewardAmount;
    }
    
    if (update.updateVerification) {
        require(update.newJurorsMin > 0 && update.newJurorsMin <= update.newPanelSize,
                "Configuración de verificación inválida");
        actionType.jurorsMin = update.newJurorsMin;
        actionType.panelSize = update.newPanelSize;
        actionType.verifyWindow = update.newVerifyWindow;
    }
    
    if (update.updateEvidence) {
        actionType.evidenceSpecCID = update.newEvidenceSpecCID;
    }
    
    emit ActionTypeUpdated(actionTypeId, msg.sender, update);
}
```

### Sistema de Categorías

```solidity
function createCategory(
    string calldata name,
    string calldata description,
    uint256 communityId
) external onlyAuthorized(communityId) returns (uint256 categoryId) {
    categoryId = ++nextCategoryId;
    
    ActionTypeCategory storage newCategory = categories[categoryId];
    newCategory.name = name;
    newCategory.description = description;
    newCategory.active = true;
    
    communityCategorіes[communityId].push(categoryId);
    
    emit CategoryCreated(categoryId, name, communityId);
}

function assignToCategory(uint256 actionTypeId, uint256 categoryId) 
    external onlyActionTypeManager(actionTypeId) {
    require(categories[categoryId].active, "Categoría inactiva");
    require(actionTypes[actionTypeId].active, "ActionType inactivo");
    
    categories[categoryId].actionTypeIds.push(actionTypeId);
    actionTypeCategory[actionTypeId] = categoryId;
    
    emit ActionTypeAssignedToCategory(actionTypeId, categoryId);
}
```

## 🛡️ Características de Seguridad

### Control de Acceso Granular

```solidity
modifier onlyAuthorized(uint256 communityId) {
    require(
        hasRole(REGISTRY_ADMIN_ROLE, msg.sender) ||
        communityRegistry.hasRole(communityId, msg.sender, COMMUNITY_MANAGER_ROLE) ||
        msg.sender == address(draftsManager), // Permitir creación via propuestas aprobadas
        "No autorizado"
    );
    _;
}

modifier onlyGovernanceOrCreator(uint256 actionTypeId) {
    ActionType storage actionType = actionTypes[actionTypeId];
    require(
        msg.sender == actionType.creator ||
        hasRole(GOVERNANCE_ROLE, msg.sender) ||
        communityRegistry.hasRole(actionType.communityId, msg.sender, COMMUNITY_ADMIN_ROLE),
        "No autorizado para modificar"
    );
    _;
}
```

### Validación de Parámetros

```solidity
function _validateActionTypeParameters(ActionTypeParams calldata params) internal pure {
    // Validación de configuración de jurados
    require(params.jurorsMin >= 1, "Mínimo 1 jurado requerido");
    require(params.jurorsMin <= params.panelSize, "Min jurados no puede exceder panel");
    require(params.panelSize >= 3 && params.panelSize <= 15, "Tamaño de panel fuera de rango");
    
    // Validación de tiempos
    require(params.verifyWindow >= 1 hours && params.verifyWindow <= 30 days,
            "Ventana de verificación fuera de rango");
    require(params.cooldown <= 7 days, "Cooldown muy largo");
    
    // Validación económica
    require(params.rewardAmount >= 1e6 && params.rewardAmount <= 10000e6,
            "Recompensa fuera de rango"); // 1 USDC - 10k USDC
    require(params.weight >= 1 && params.weight <= 1000, "Peso fuera de rango");
    require(params.slashVerifierBps <= 5000, "Slashing muy alto"); // Máx 50%
}
```

### Mecanismo de Revocación

```solidity
function revokeActionType(uint256 actionTypeId, string calldata reason) 
    external onlyGovernance {
    ActionType storage actionType = actionTypes[actionTypeId];
    require(actionType.active, "Ya inactivo");
    require(actionType.revocable, "No revocable");
    
    actionType.active = false;
    
    // Rechazar reclamos pendientes de este tipo
    _rejectPendingClaims(actionTypeId);
    
    emit ActionTypeRevoked(actionTypeId, msg.sender, reason);
}
```

## 🔗 Puntos de Integración

### Con Claims Contract

```solidity
// Claims consulta ActionType para validación de reclamos
function getActionTypeForClaim(uint256 actionTypeId) 
    external view returns (ActionType memory) {
    ActionType memory actionType = actionTypes[actionTypeId];
    require(actionType.active, "ActionType inactivo");
    return actionType;
}

// Verificar elegibilidad de reclamo
function isClaimEligible(address worker, uint256 actionTypeId) 
    external view returns (bool) {
    ActionType memory actionType = actionTypes[actionTypeId];
    
    // Verificar cooldown
    uint256 lastClaim = workerLastClaim[worker][actionTypeId];
    if (lastClaim + actionType.cooldown > block.timestamp) {
        return false;
    }
    
    // Verificar otros criterios de elegibilidad
    return _checkWorkerEligibility(worker, actionType);
}
```

### Con DraftsManager

```solidity
// DraftsManager puede proponer nuevos ActionTypes
function proposeActionType(ActionTypeParams calldata params, uint256 draftId) 
    external onlyDraftsManager returns (uint256 proposalActionTypeId) {
    
    // Crear ActionType en estado "propuesto" (inactivo)
    proposalActionTypeId = _createProposalActionType(params);
    proposalDrafts[proposalActionTypeId] = draftId;
    
    emit ActionTypeProposed(proposalActionTypeId, draftId);
}

function activateProposedActionType(uint256 actionTypeId, uint256 approvedProposalId) 
    external onlyGovernance {
    ActionType storage actionType = actionTypes[actionTypeId];
    require(!actionType.active, "Ya activo");
    require(proposalDrafts[actionTypeId] != 0, "No es ActionType propuesto");
    
    // Activar después de aprobación de gobernanza
    actionType.active = true;
    
    emit ActionTypeActivated(actionTypeId, approvedProposalId);
}
```

## 📊 Modelo Económico

### Estructura de Recompensas

```solidity
struct EconomicModel {
    uint256 baseReward;          // Recompensa base del tipo de trabajo
    uint256 complexityMultiplier; // Multiplicador basado en complejidad (1x-10x)
    uint256 marketDemand;        // Ajuste basado en demanda del mercado
    uint256 communityTreasury;   // Disponibilidad de fondos de la comunidad
}

function calculateDynamicReward(uint256 actionTypeId) 
    external view returns (uint256 adjustedReward) {
    ActionType memory actionType = actionTypes[actionTypeId];
    
    // Recompensa base del ActionType
    adjustedReward = actionType.rewardAmount;
    
    // Ajustar por demanda del mercado
    uint256 supplyDemandRatio = _getSupplyDemandRatio(actionTypeId);
    if (supplyDemandRatio < 5000) { // Más demanda que oferta
        adjustedReward = (adjustedReward * 12000) / 10000; // +20% bono
    }
    
    // Ajustar por fondos de tesorería
    uint256 treasuryHealth = _getTreasuryHealth(actionType.communityId);
    adjustedReward = (adjustedReward * treasuryHealth) / 10000;
}
```

## 🎛️ Ejemplos de Configuración

### ActionTypes para Desarrollo de Software

```solidity
// Bug Fix - Trabajo de complejidad media
ActionTypeParams memory bugFix = ActionTypeParams({
    communityId: devCommunityId,
    name: "Bug Fix",
    description: "Corregir bug reportado con evidencia de testing",
    evidenceSpecCID: "QmBugFixSpec...",
    jurorsMin: 2,                // 2 de 3 aprobaciones
    panelSize: 3,                // Panel pequeño para trabajo rutinario
    verifyWindow: 48 hours,      // Verificación rápida
    rewardAmount: 75e6,          // 75 USDC
    weight: 15,                  // 15 WorkerPoints
    rewardVerify: 5e18,          // 5 tokens para verificadores
    slashVerifierBps: 1000,      // 10% slashing
    cooldown: 2 hours,           // Permitir múltiples bug fixes por día
    revocable: true
});

// Architecture Design - Trabajo de alta complejidad
ActionTypeParams memory architectureDesign = ActionTypeParams({
    communityId: devCommunityId,
    name: "Architecture Design",
    description: "Diseño de arquitectura de sistema con documentación completa",
    evidenceSpecCID: "QmArchitectureSpec...",
    jurorsMin: 4,                // 4 de 5 aprobaciones (más riguroso)
    panelSize: 5,                // Panel más grande para decisiones importantes
    verifyWindow: 7 days,        // Más tiempo para revisión detallada
    rewardAmount: 500e6,         // 500 USDC (trabajo complejo)
    weight: 100,                 // 100 WorkerPoints (alta recompensa de reputación)
    rewardVerify: 25e18,         // 25 tokens para verificadores
    slashVerifierBps: 1500,      // 15% slashing (consecuencias más altas)
    cooldown: 30 days,           // Cooldown largo para trabajo especializado
    revocable: false             // No revocable una vez establecido
});
```

### ActionTypes para Creación de Contenido

```solidity
// Tutorial Article - Contenido educativo
ActionTypeParams memory tutorialArticle = ActionTypeParams({
    communityId: contentCommunityId,
    name: "Tutorial Article",
    description: "Artículo tutorial técnico con ejemplos de código",
    evidenceSpecCID: "QmTutorialSpec...",
    jurorsMin: 3,                // 3 de 5 (contenido más subjetivo)
    panelSize: 5,
    verifyWindow: 5 days,        // Tiempo para revisión de calidad
    rewardAmount: 150e6,         // 150 USDC
    weight: 30,                  // 30 WorkerPoints
    rewardVerify: 10e18,         // 10 tokens para verificadores
    slashVerifierBps: 500,       // 5% slashing (menos severo para contenido)
    cooldown: 7 days,            // Un artículo por semana
    revocable: true
});
```

## 🚀 Características Avanzadas

### Análisis y Métricas

```solidity
function getActionTypeMetrics(uint256 actionTypeId) 
    external view returns (ActionTypeMetrics memory) {
    return ActionTypeMetrics({
        totalClaims: actionTypeClaimCounts[actionTypeId],
        approvedClaims: actionTypeApprovals[actionTypeId],
        averageVerificationTime: _calculateAvgVerificationTime(actionTypeId),
        totalRewardsPaid: actionTypeTotalRewards[actionTypeId],
        verifierAccuracyRate: _calculateVerifierAccuracy(actionTypeId),
        demandScore: _calculateDemandScore(actionTypeId)
    });
}
```

### Configuración Dinámica de Parámetros

```solidity
function adjustParametersBasedOnMetrics(uint256 actionTypeId) 
    external onlyGovernance {
    ActionTypeMetrics memory metrics = getActionTypeMetrics(actionTypeId);
    
    // Ajustar recompensa basada en demanda
    if (metrics.demandScore > 8000) { // Alta demanda, poca oferta
        _increaseReward(actionTypeId, 1100); // +10%
    } else if (metrics.demandScore < 2000) { // Baja demanda, mucha oferta
        _decreaseReward(actionTypeId, 900);  // -10%
    }
    
    // Ajustar panel de verificadores basado en precisión
    if (metrics.verifierAccuracyRate < 7000) { // <70% precisión
        _increasePanelSize(actionTypeId, 1); // Panel más grande
    }
}
```

El ActionTypeRegistry proporciona la flexibilidad y estructura necesaria para que las comunidades definan y gestionen sus propios tipos de trabajo, manteniendo consistencia en la evaluación mientras permite personalización local.