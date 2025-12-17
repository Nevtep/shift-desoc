# Contrato Claims

## 🎯 Propósito y Función

El **Claims** (Reclamos) es el contrato central para verificación de trabajo en el ecosistema Shift DeSoc. Gestiona el proceso completo desde la presentación de evidencia de trabajo hasta la verificación por jurados y la distribución de recompensas. Actúa como el puente entre el trabajo realizado y el reconocimiento económico y de reputación dentro de la comunidad.

## 🏗️ Arquitectura Central

### Estructuras de Datos

```solidity
struct Claim {
    uint256 id;                     // ID único del reclamo
    address worker;                 // Dirección del trabajador
    uint256 actionTypeId;           // Tipo de acción reclamada
    uint256 communityId;            // Comunidad donde se presenta el reclamo
    string evidenceCID;             // Hash IPFS de la evidencia
    uint256 reward;                 // Cantidad de recompensa en CommunityToken
    ClaimStatus status;             // Estado actual del reclamo
    uint256 submittedAt;            // Timestamp de presentación
    uint256 verificationDeadline;   // Límite para verificación
    address[] assignedVerifiers;    // Jurados asignados
    mapping(address => bool) approvals; // Votos de aprobación de verificadores
    uint256 approvalCount;          // Contador de aprobaciones
    string[] verifierComments;      // Comentarios de verificadores
}

enum ClaimStatus {
    SUBMITTED,      // Presentado, esperando verificadores
    IN_REVIEW,      // En proceso de verificación
    APPROVED,       // Aprobado por suficientes verificadores
    REJECTED,       // Rechazado por verificadores
    APPEALED,       // En apelación
    EXPIRED         // Expiró sin verificación completa
}
```

### Gestión del Estado

- **Almacén de Reclamos**: Mapeo de claimId a estructura Claim
- **Índices de Trabajador**: Mapeo de dirección de trabajador a array de claimIds
- **Índices de Comunidad**: Mapeo de communityId a reclamos activos
- **Pool de Verificadores**: Integración con VerifierPool para selección de jurados
- **Gestión de Recompensas**: Integración con CommunityToken para pagos

## ⚙️ Funciones y Lógica Clave

### Presentación de Reclamos

```solidity
function submitClaim(
    uint256 actionTypeId,
    string calldata evidenceCID,
    bytes calldata additionalData
) external returns (uint256 claimId) {
    // Verificar elegibilidad del trabajador
    require(_isEligibleWorker(msg.sender, actionTypeId), "Trabajador no elegible");
    
    // Obtener ActionType y validar parámetros
    ActionType memory actionType = actionTypeRegistry.getActionType(actionTypeId);
    require(actionType.active, "ActionType no activo");
    
    // Verificar cooldown entre reclamos
    require(
        lastClaimTimestamp[msg.sender] + actionType.cooldown <= block.timestamp,
        "Aún en período de cooldown"
    );
    
    // Crear nuevo reclamo
    claimId = ++nextClaimId;
    Claim storage newClaim = claims[claimId];
    
    newClaim.id = claimId;
    newClaim.worker = msg.sender;
    newClaim.actionTypeId = actionTypeId;
    newClaim.communityId = actionType.communityId;
    newClaim.evidenceCID = evidenceCID;
    newClaim.reward = actionType.rewardAmount;
    newClaim.status = ClaimStatus.SUBMITTED;
    newClaim.submittedAt = block.timestamp;
    newClaim.verificationDeadline = block.timestamp + actionType.verifyWindow;
    
    // Actualizar índices
    workerClaims[msg.sender].push(claimId);
    communityClaims[actionType.communityId].push(claimId);
    lastClaimTimestamp[msg.sender] = block.timestamp;
    
    emit ClaimSubmitted(claimId, msg.sender, actionTypeId, evidenceCID);
    
    // Iniciar proceso de asignación de verificadores
    _assignVerifiers(claimId);
}
```

### Sistema de Verificación

```solidity
function verifyClaimWithEvidence(
    uint256 claimId,
    bool approved,
    string calldata comment,
    bytes calldata verificationData
) external {
    Claim storage claim = claims[claimId];
    
    // Verificar que el llamador es un verificador asignado
    require(_isAssignedVerifier(claimId, msg.sender), "No es verificador asignado");
    require(claim.status == ClaimStatus.IN_REVIEW, "Estado de reclamo inválido");
    require(block.timestamp <= claim.verificationDeadline, "Período de verificación expirado");
    require(!claim.approvals[msg.sender], "Ya verificado por este verificador");
    
    // Registrar verificación
    claim.approvals[msg.sender] = approved;
    if (approved) {
        claim.approvalCount++;
    }
    
    // Agregar comentario de verificador
    claim.verifierComments.push(comment);
    
    emit ClaimVerified(claimId, msg.sender, approved, comment);
    
    // Verificar si se alcanzó el umbral de aprobación
    ActionType memory actionType = actionTypeRegistry.getActionType(claim.actionTypeId);
    if (claim.approvalCount >= actionType.jurorsMin) {
        _approveClaim(claimId);
    } else if (_getRejectionCount(claimId) > actionType.panelSize - actionType.jurorsMin) {
        _rejectClaim(claimId);
    }
}

function _approveClaim(uint256 claimId) internal {
    Claim storage claim = claims[claimId];
    claim.status = ClaimStatus.APPROVED;
    
    // Procesar recompensas
    _processRewards(claimId);
    
    emit ClaimApproved(claimId, claim.worker, claim.reward);
}
```

### Procesamiento de Recompensas

```solidity
function _processRewards(uint256 claimId) internal {
    Claim storage claim = claims[claimId];
    ActionType memory actionType = actionTypeRegistry.getActionType(claim.actionTypeId);
    
    // Pagar recompensa al trabajador
    bytes32 paymentId = keccak256(abi.encodePacked("claim_reward", claimId));
    communityToken.executePayment(paymentId, claim.worker, claim.reward);
    
    // Acuñar o actualizar WorkerSBT
    if (workerSBT.balanceOf(claim.worker) == 0) {
        // Acuñar primer SBT
        workerSBT.mintWorkerSBT(claim.worker, claim.communityId, actionType.weight);
    } else {
        // Agregar puntos de trabajo
        workerSBT.addWorkerPoints(claim.worker, actionType.weight, claimId);
    }
    
    // Recompensar verificadores
    _rewardVerifiers(claimId);
    
    emit RewardsProcessed(claimId, claim.worker, claim.reward);
}

function _rewardVerifiers(uint256 claimId) internal {
    Claim storage claim = claims[claimId];
    ActionType memory actionType = actionTypeRegistry.getActionType(claim.actionTypeId);
    
    uint256 verifierReward = actionType.rewardVerify;
    
    for (uint256 i = 0; i < claim.assignedVerifiers.length; i++) {
        address verifier = claim.assignedVerifiers[i];
        
        if (claim.approvals[verifier]) {
            // Recompensar verificadores que aprobaron correctamente
            communityToken.mint(verifier, verifierReward);
            
            // Actualizar reputación de verificador en VerifierPool
            verifierPool.updateVerifierReputation(verifier, true);
        } else {
            // Penalizar verificadores que rechazaron incorrectamente
            verifierPool.slashVerifier(verifier, actionType.slashVerifierBps);
        }
    }
}
```

## 🛡️ Características de Seguridad

### Prevención de Fraude

```solidity
// Verificar duplicación de evidencia
mapping(string => bool) public usedEvidenceCIDs;

function submitClaim(...) external returns (uint256 claimId) {
    require(!usedEvidenceCIDs[evidenceCID], "Evidencia ya utilizada");
    usedEvidenceCIDs[evidenceCID] = true;
    
    // ... resto de la lógica
}

// Prevenir auto-verificación
function _assignVerifiers(uint256 claimId) internal {
    Claim storage claim = claims[claimId];
    ActionType memory actionType = actionTypeRegistry.getActionType(claim.actionTypeId);
    
    // Excluir al trabajador de la selección de verificadores
    address[] memory excludedAddresses = new address[](1);
    excludedAddresses[0] = claim.worker;
    
    address[] memory selectedVerifiers = verifierPool.selectVerifiersForClaim(
        claimId,
        actionType.panelSize,
        actionType.communityId,
        excludedAddresses
    );
    
    claim.assignedVerifiers = selectedVerifiers;
    claim.status = ClaimStatus.IN_REVIEW;
}
```

### Sistema de Apelaciones

```solidity
function appealClaimDecision(uint256 claimId, string calldata appealReason) 
    external payable {
    Claim storage claim = claims[claimId];
    
    require(claim.worker == msg.sender, "Solo el trabajador puede apelar");
    require(claim.status == ClaimStatus.REJECTED, "Solo reclamos rechazados pueden ser apelados");
    require(msg.value >= APPEAL_FEE, "Comisión de apelación insuficiente");
    
    claim.status = ClaimStatus.APPEALED;
    
    // Transferir a nueva ronda de verificación con panel expandido
    _initiateAppealProcess(claimId, appealReason);
    
    emit ClaimAppealed(claimId, msg.sender, appealReason);
}
```

## 🔗 Puntos de Integración

### Con ActionTypeRegistry

```solidity
// Obtener configuración de tipo de acción para validación
ActionType memory actionType = actionTypeRegistry.getActionType(actionTypeId);
require(actionType.active && !actionType.deprecated, "ActionType no válido");

// Verificar requisitos específicos de evidencia
require(
    _validateEvidence(evidenceCID, actionType.evidenceSpecCID),
    "Evidencia no cumple especificaciones"
);
```

### Con VerifierPool

```solidity
// Selección pseudo-aleatoria de verificadores
address[] memory verifiers = verifierPool.selectVerifiersForClaim(
    claimId,
    actionType.panelSize,
    communityId,
    excludedAddresses
);

// Actualización de reputación de verificadores
verifierPool.updateVerifierReputation(verifier, verificationAccurate);
```

### Con RequestHub (Sistema de Recompensas)

```solidity
// Vincular reclamos a discusiones de RequestHub
function submitBountyClaim(
    uint256 requestId,
    uint256 actionTypeId,
    string calldata evidenceCID
) external returns (uint256 claimId) {
    // Verificar que la request existe y tiene recompensa
    require(requestHub.hasActiveBounty(requestId), "No hay recompensa activa");
    
    claimId = submitClaim(actionTypeId, evidenceCID, "");
    
    // Vincular reclamo a request
    claimToRequest[claimId] = requestId;
    requestClaims[requestId].push(claimId);
    
    emit BountyClaimSubmitted(requestId, claimId, msg.sender);
}
```

## 📊 Modelo Económico

### Estructura de Incentivos

**Recompensas de Trabajadores**:
- Recompensa base definida por ActionType (ej. 50-500 USDC)
- Bonos por calidad y rapidez de entrega
- Puntos de WorkerSBT para influencia de gobernanza futura

**Incentivos de Verificadores**:
```solidity
struct VerifierIncentives {
    uint256 baseReward;          // Recompensa base por verificación
    uint256 accuracyBonus;       // Bono por verificaciones precisas
    uint256 slashingPenalty;     // Penalización por verificaciones incorrectas
    uint256 reputationWeight;    // Peso de reputación para selección futura
}
```

### Análisis de Costos

**Costos por Reclamo**:
- Recompensa de trabajador: Variable por ActionType
- Recompensas de verificadores: ~10-20% de recompensa de trabajador
- Costos de gas: ~0.01-0.05 ETH por reclamo completo
- Comisiones de apelación: 0.1 ETH (reembolsable si se aprueba)

## 🎛️ Ejemplos de Configuración

### Configuración para Desarrollo de Software

```solidity
// ActionType para revisión de código
ActionType memory codeReview = ActionType({
    weight: 25,              // 25 WorkerPoints
    jurorsMin: 2,            // 2 de 3 aprobaciones requeridas
    panelSize: 3,            // 3 verificadores totales
    verifyWindow: 48 hours,  // 48 horas para verificar
    cooldown: 4 hours,       // 4 horas entre reclamos
    rewardVerify: 5e18,      // 5 tokens para verificadores
    slashVerifierBps: 1000,  // 10% slashing por verificación incorrecta
    rewardAmount: 100e6,     // 100 USDC para trabajador
    evidenceSpecCID: "QmCodeReviewSpec..."
});
```

### Configuración para Creación de Contenido

```solidity
// ActionType para creación de artículos
ActionType memory articleCreation = ActionType({
    weight: 40,              // 40 WorkerPoints (trabajo más complejo)
    jurorsMin: 3,            // 3 de 5 aprobaciones (más subjetivo)
    panelSize: 5,            // Panel más grande para contenido
    verifyWindow: 7 days,    // Más tiempo para revisión de calidad
    cooldown: 24 hours,      // Cooldown diario
    rewardVerify: 10e18,     // Mayor recompensa de verificadores
    slashVerifierBps: 500,   // 5% slashing (menos severo para contenido)
    rewardAmount: 200e6,     // 200 USDC para artículo
    evidenceSpecCID: "QmArticleSpec..."
});
```

## 🚀 Características Avanzadas

### Verificación de Calidad Automatizada

```solidity
function submitClaimWithAutomatedChecks(
    uint256 actionTypeId,
    string calldata evidenceCID,
    bytes calldata automatedCheckResults
) external returns (uint256 claimId) {
    // Ejecutar verificaciones automatizadas primero
    require(_passesAutomatedChecks(evidenceCID, automatedCheckResults), 
            "Falla en verificaciones automatizadas");
    
    claimId = submitClaim(actionTypeId, evidenceCID, "");
    
    // Reducir panel de verificadores si pasa verificaciones automatizadas
    _adjustVerificationRequirements(claimId, automatedCheckResults);
}
```

### Métricas de Rendimiento

```solidity
function getWorkerStats(address worker) external view returns (
    uint256 totalClaims,
    uint256 approvedClaims,
    uint256 totalRewards,
    uint256 averageApprovalTime,
    uint256 workerRating
) {
    uint256[] memory workerClaimIds = workerClaims[worker];
    
    totalClaims = workerClaimIds.length;
    // ... calcular otras estadísticas
    
    workerRating = _calculateWorkerRating(worker);
}

function getCommunityMetrics(uint256 communityId) external view returns (
    uint256 totalClaimsProcessed,
    uint256 totalValuePaid,
    uint256 averageProcessingTime,
    uint256 verifierAccuracyRate
) {
    // ... calcular métricas de la comunidad
}
```

El contrato Claims forma el corazón del sistema de verificación de trabajo de Shift DeSoc, proporcionando un proceso transparente, justo y económicamente sostenible para validar contribuciones y distribuir recompensas dentro de las comunidades descentralizadas.