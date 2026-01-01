# Contrato Engagements (Compromisos)

> **Verificación de compromisos de trabajo únicos con votación de jurados M-de-N**

El contrato Engagements maneja envíos de trabajo para tareas puntuales que requieren verificación antes de recompensar con tokens de gobernanza, pagos y credenciales de reputación.

---

## Resumen

| Propiedad | Valor |
|-----------|-------|
| **Capa** | Verificación (Capa 3) |
| **Tipo** | Contrato Gestor |
| **Hereda** | AccessControlUpgradeable, ReentrancyGuardUpgradeable |
| **Dependencias** | ValuableActionRegistry, VerifierManager, MembershipToken, CommunityToken |

---

## Propósito

Engagements (Compromisos) implementa el flujo central de verificación de trabajo:

1. Trabajador envía evidencia de trabajo completado
2. Sistema selecciona panel de verificadores M-de-N
3. Verificadores votan aprobar/rechazar
4. Si aprobado: acuña SBT, MembershipTokens y CommunityTokens
5. Si rechazado: trabajador puede apelar

---

## Arquitectura

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Engagements                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Estado:                                                            │
│  • engagements: mapping(engagementId → EngagementData)             │
│  • verifierVotes: mapping(engagementId → mapping(verifier → Vote)) │
│  • workerCooldowns: mapping(worker → mapping(typeId → timestamp))  │
├─────────────────────────────────────────────────────────────────────┤
│  Funciones Públicas:                                                │
│  • submit(typeId, evidenceCID) → engagementId                      │
│  • verify(engagementId, approve)                                    │
│  • submitAppeal(engagementId, reason)                               │
│  • finalizeEngagement(engagementId)                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Dependencias:                                                      │
│  • ValuableActionRegistry: definiciones y parámetros de acciones   │
│  • VerifierManager: selección de panel y seguimiento               │
│  • MembershipToken: acuñación al aprobar                           │
│  • CommunityToken: pago al aprobar                                  │
│  • ValuableActionSBT: credencial de reputación                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Estructuras de Datos

```solidity
struct EngagementData {
    uint256 id;
    uint256 communityId;
    uint256 actionTypeId;         // Referencia a ValuableAction
    address worker;
    string evidenceCID;           // IPFS hash de evidencia
    EngagementStatus status;
    uint64 submittedAt;
    uint64 verifyDeadline;
    uint8 approvalsCount;
    uint8 rejectionsCount;
    uint8 panelSize;              // N total de verificadores
    uint8 requiredApprovals;      // M mínimo para aprobar
    bool appealed;
    string appealReason;
}

enum EngagementStatus {
    PENDING,      // Esperando verificación
    APPROVED,     // M aprobaciones alcanzadas
    REJECTED,     // Mayoría rechazó
    EXPIRED,      // Deadline pasó sin quórum
    APPEALED,     // Trabajador apeló
    FINALIZED     // Recompensas distribuidas
}

struct Vote {
    bool hasVoted;
    bool approved;
    uint64 timestamp;
    string reasonCID;    // Opcional
}
```

---

## Flujos de Trabajo

### Flujo 1: Envío de Compromiso

```solidity
function submit(
    uint256 communityId,
    uint256 actionTypeId,
    string calldata evidenceCID
) external nonReentrant returns (uint256 engagementId) {
    // 1. Validar acción existe y está activa
    ValuableAction memory va = registry.getAction(communityId, actionTypeId);
    require(va.active, "Action not active");
    
    // 2. Verificar cooldown del trabajador
    require(
        block.timestamp >= workerCooldowns[msg.sender][actionTypeId] + va.cooldownPeriod,
        "Cooldown active"
    );
    
    // 3. Verificar límite de compromisos concurrentes
    require(
        getActiveEngagements(msg.sender) < va.maxConcurrent,
        "Too many active engagements"
    );
    
    // 4. Crear compromiso
    engagementId = _createEngagement(communityId, actionTypeId, msg.sender, evidenceCID, va);
    
    // 5. Solicitar panel de verificadores
    address[] memory panel = verifierManager.selectPanel(communityId, va.panelSize);
    _assignPanel(engagementId, panel);
    
    // 6. Actualizar cooldown
    workerCooldowns[msg.sender][actionTypeId] = block.timestamp;
    
    emit EngagementSubmitted(engagementId, communityId, actionTypeId, msg.sender, evidenceCID);
}
```

### Flujo 2: Verificación

```solidity
function verify(
    uint256 engagementId,
    bool approve,
    string calldata reasonCID
) external nonReentrant {
    EngagementData storage eng = engagements[engagementId];
    
    // 1. Validar estado y deadline
    require(eng.status == EngagementStatus.PENDING, "Not pending");
    require(block.timestamp <= eng.verifyDeadline, "Verification expired");
    
    // 2. Validar verificador está en panel
    require(verifierManager.isInPanel(engagementId, msg.sender), "Not in panel");
    
    // 3. Validar no ha votado
    require(!verifierVotes[engagementId][msg.sender].hasVoted, "Already voted");
    
    // 4. Registrar voto
    verifierVotes[engagementId][msg.sender] = Vote({
        hasVoted: true,
        approved: approve,
        timestamp: uint64(block.timestamp),
        reasonCID: reasonCID
    });
    
    // 5. Actualizar contadores
    if (approve) {
        eng.approvalsCount++;
    } else {
        eng.rejectionsCount++;
    }
    
    // 6. Verificar si se alcanzó umbral
    if (eng.approvalsCount >= eng.requiredApprovals) {
        eng.status = EngagementStatus.APPROVED;
        emit EngagementApproved(engagementId);
    } else if (eng.rejectionsCount > (eng.panelSize - eng.requiredApprovals)) {
        eng.status = EngagementStatus.REJECTED;
        emit EngagementRejected(engagementId);
    }
    
    emit VerifierVoted(engagementId, msg.sender, approve, reasonCID);
}
```

### Flujo 3: Finalización

```solidity
function finalizeEngagement(uint256 engagementId) external nonReentrant {
    EngagementData storage eng = engagements[engagementId];
    
    require(
        eng.status == EngagementStatus.APPROVED || 
        eng.status == EngagementStatus.REJECTED,
        "Not ready to finalize"
    );
    require(eng.status != EngagementStatus.FINALIZED, "Already finalized");
    
    if (eng.status == EngagementStatus.APPROVED) {
        _distributeRewards(eng);
    }
    
    eng.status = EngagementStatus.FINALIZED;
    emit EngagementFinalized(engagementId, eng.status);
}

function _distributeRewards(EngagementData memory eng) internal {
    ValuableAction memory va = registry.getAction(eng.communityId, eng.actionTypeId);
    
    // 1. Acuñar MembershipToken (poder de gobernanza)
    membershipToken.mint(eng.worker, va.membershipTokenReward, "engagement-approved");
    
    // 2. Transferir CommunityToken (pago)
    if (va.communityTokenReward > 0) {
        communityToken.transfer(eng.worker, va.communityTokenReward);
    }
    
    // 3. Acuñar SBT WORK (reputación)
    registry.issueEngagement(
        eng.communityId,
        eng.worker,
        TokenKind.WORK,
        eng.actionTypeId,
        _buildMetadata(eng)
    );
    
    emit RewardsDistributed(eng.id, eng.worker, va.membershipTokenReward, va.communityTokenReward);
}
```

### Flujo 4: Apelación

```solidity
function submitAppeal(
    uint256 engagementId,
    string calldata appealReasonCID
) external nonReentrant {
    EngagementData storage eng = engagements[engagementId];
    
    // Solo trabajador puede apelar
    require(msg.sender == eng.worker, "Only worker can appeal");
    
    // Solo compromisos rechazados pueden apelarse
    require(eng.status == EngagementStatus.REJECTED, "Can only appeal rejected");
    
    // Solo una apelación permitida
    require(!eng.appealed, "Already appealed");
    
    // Verificar ventana de apelación
    ValuableAction memory va = registry.getAction(eng.communityId, eng.actionTypeId);
    require(
        block.timestamp <= eng.verifyDeadline + va.appealWindow,
        "Appeal window closed"
    );
    
    eng.appealed = true;
    eng.appealReason = appealReasonCID;
    eng.status = EngagementStatus.APPEALED;
    
    // Seleccionar nuevo panel (excluyendo verificadores originales)
    address[] memory appealPanel = verifierManager.selectAppealPanel(
        eng.communityId,
        va.panelSize,
        _getOriginalPanel(engagementId)
    );
    _assignAppealPanel(engagementId, appealPanel);
    
    emit AppealSubmitted(engagementId, appealReasonCID);
}
```

---

## Modelo de Privacidad

### Doble Capa

El sistema implementa privacidad de doble capa para votos de verificadores:

```solidity
// PÚBLICO: Solo agregados
function getEngagementStatus(uint256 engagementId) external view returns (
    EngagementStatus status,
    uint8 approvalsCount,
    uint8 rejectionsCount,
    uint8 panelSize
);

// INTERNO: Votos individuales (solo para verificadores del panel)
function getVerifierVote(uint256 engagementId, address verifier) 
    external view 
    onlyPanelMember(engagementId)
    returns (Vote memory);
```

**Propósito**:
- Previene presión social sobre verificadores
- Mantiene transparencia de resultados
- Permite auditoría por partes relevantes

---

## Integración con VPS

### Selección de Panel

```solidity
// Engagements solicita panel de VerifierManager
address[] memory panel = verifierManager.selectPanel(
    communityId,
    panelSize
);

// VerifierManager usa pesos de VerifierPowerToken1155
// No hay staking o bonding - solo poder otorgado por gobernanza
```

### Reporte de Fraude

```solidity
// Si se detecta comportamiento fraudulento
function reportFraud(
    uint256 engagementId,
    address verifier,
    string calldata evidenceCID
) external onlyRole(MODERATOR_ROLE) {
    verifierManager.reportFraud(verifier, engagementId, evidenceCID);
    // VerifierManager notifica a VerifierElection para acción de gobernanza
}
```

---

## Eventos

```solidity
event EngagementSubmitted(
    uint256 indexed engagementId,
    uint256 indexed communityId,
    uint256 indexed actionTypeId,
    address worker,
    string evidenceCID
);

event VerifierVoted(
    uint256 indexed engagementId,
    address indexed verifier,
    bool approved,
    string reasonCID
);

event EngagementApproved(uint256 indexed engagementId);

event EngagementRejected(uint256 indexed engagementId);

event EngagementFinalized(
    uint256 indexed engagementId,
    EngagementStatus status
);

event RewardsDistributed(
    uint256 indexed engagementId,
    address indexed worker,
    uint256 membershipTokenAmount,
    uint256 communityTokenAmount
);

event AppealSubmitted(
    uint256 indexed engagementId,
    string appealReasonCID
);
```

---

## Parámetros de Configuración

Leídos desde `ValuableActionRegistry`:

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `panelSize` | Tamaño total del panel (N) | 5 |
| `jurorsMin` | Aprobaciones mínimas (M) | 3 |
| `verifyWindow` | Tiempo para verificar | 72 horas |
| `cooldownPeriod` | Tiempo entre compromisos | 24 horas |
| `maxConcurrent` | Compromisos activos máximos | 3 |
| `appealWindow` | Tiempo para apelar | 48 horas |
| `membershipTokenReward` | Tokens de gobernanza | 100 |
| `communityTokenReward` | Pago en CommunityToken | 50 |

---

## Control de Acceso

| Rol | Permisos |
|-----|----------|
| `WORKER` | Enviar compromisos, apelar rechazos |
| `VERIFIER` | Votar en compromisos asignados |
| `MODERATOR` | Reportar fraude, forzar expiración |
| `GOVERNANCE` | Actualizar parámetros via timelock |

---

## Seguridad

### Protecciones Implementadas

| Vector | Mitigación |
|--------|------------|
| Spam de envíos | Cooldowns + límites concurrentes |
| Colusión de verificadores | Selección aleatoria ponderada |
| Manipulación de votos | Snapshots + no cambio post-voto |
| Reentrancia | ReentrancyGuard en todas las funciones |
| Votos duplicados | Mapping hasVoted por verificador |

### Invariantes

1. Un compromiso solo puede ser finalizado una vez
2. Un verificador solo puede votar una vez por compromiso
3. Apelaciones solo permiten un intento
4. Recompensas solo se distribuyen al aprobar
5. Panel debe completarse antes de expiración

---

## Relación con Otros Contratos

```
Engagements
    ├── ValuableActionRegistry (definiciones de acciones)
    ├── VerifierManager (selección de panel)
    │   └── VerifierPowerToken1155 (pesos de poder)
    ├── MembershipToken (acuñación al aprobar)
    ├── CommunityToken (pago al aprobar)
    └── ValuableActionSBT (credencial de reputación)
```

---

## Diferencias con Posiciones

| Aspecto | Engagements (Compromisos) | Positions (Posiciones) |
|---------|---------------------------|------------------------|
| Duración | Tarea única | Rol continuo |
| Verificación | Panel M-de-N | Verificador designado |
| Salario | Pago único al aprobar | Participación en ingresos |
| SBT | WORK (inmediato) | POSITION → ROLE (al cerrar) |
| Apelación | Sí (panel nuevo) | Via gobernanza |
