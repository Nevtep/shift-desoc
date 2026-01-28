# Contrato PositionManager (Gestor de Posiciones)

> **Gestión del ciclo de vida de roles continuos con SBT de ROL al éxito**

El contrato PositionManager maneja la asignación, seguimiento y cierre de posiciones de trabajo continuas que participan en la distribución de ingresos.

---

## Resumen

| Propiedad | Valor |
|-----------|-------|
| **Capa** | Verificación (Capa 3) |
| **Tipo** | Contrato Gestor |
| **Hereda** | AccessControlUpgradeable |
| **Dependencias** | ValuableActionRegistry, RevenueRouter, CommunityRegistry |
| **SBTs Emitidos** | POSITION (activo), ROLE (al cerrar con éxito) |

---

## Propósito

PositionManager implementa el ciclo de vida completo de roles continuos:

1. Gobernanza/moderador define tipos de posición
2. Candidato aplica con evidencia de cualificación
3. Verificador designado aprueba la aplicación
4. Sistema acuña SBT POSITION y registra con RevenueRouter
5. Titular recibe participación en distribución de ingresos
6. Al cerrar posición con SUCCESS: acuña SBT ROLE (historial certificado)

---

## Arquitectura

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                       PositionManager                                │
├─────────────────────────────────────────────────────────────────────┤
│  Estado:                                                            │
│  • positionTypes: mapping(roleTypeId → PositionTypeDefinition)     │
│  • applications: mapping(appId → PositionApplication)              │
│  • activePositions: mapping(tokenId → PositionData)                │
│  • holderPositions: mapping(holder → mapping(roleTypeId → tokenId))│
├─────────────────────────────────────────────────────────────────────┤
│  Funciones Públicas:                                                │
│  • definePositionType(roleTypeId, communityId, points, active)     │
│  • applyForPosition(roleTypeId, evidence) → appId                  │
│  • approveApplication(appId, metadata) → tokenId                   │
│  • rejectApplication(appId, reason)                                 │
│  • closePosition(tokenId, outcome, evidence) → roleTokenId         │
├─────────────────────────────────────────────────────────────────────┤
│  Dependencias:                                                      │
│  • ValuableActionRegistry: emisión de SBTs                         │
│  • RevenueRouter: registro para distribución                        │
│  • CommunityRegistry: validación de comunidad                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Estructuras de Datos

```solidity
struct PositionTypeDefinition {
    bytes32 roleTypeId;         // Identificador único del tipo
    uint256 communityId;        // Comunidad que ofrece el rol
    address verifier;           // Verificador designado
    uint256 points;             // Puntos base para distribución
    bool active;                // ¿Acepta aplicaciones?
    string metadataCID;         // Descripción, requisitos
    uint256 activeCount;        // Posiciones activas actualmente
    uint256 maxActive;          // Límite de posiciones simultáneas (0 = sin límite)
}

struct PositionApplication {
    uint256 appId;
    bytes32 roleTypeId;
    address applicant;
    string evidenceCID;
    ApplicationStatus status;
    uint64 appliedAt;
    uint64 processedAt;
    string rejectionReason;
    uint256 tokenId;            // SBT POSITION si aprobada
}

struct PositionData {
    uint256 tokenId;            // SBT POSITION
    bytes32 roleTypeId;
    address holder;
    uint256 communityId;
    uint256 points;             // Puntos para distribución
    uint64 startedAt;
    uint64 endedAt;             // 0 mientras activa
    PositionOutcome outcome;    // Al cerrar
    bool active;
}

enum ApplicationStatus {
    PENDING,
    APPROVED,
    REJECTED
}

enum PositionOutcome {
    NONE,       // Posición activa
    SUCCESS,    // Terminó bien → acuña SBT ROLE
    NEUTRAL,    // Terminó sin mérito especial
    NEGATIVE    // Remoción/mala conducta
}
```

---

## Flujos de Trabajo

### Flujo 1: Definición de Tipo de Posición

```solidity
function definePositionType(
    bytes32 roleTypeId,
    uint256 communityId,
    address verifier,
    uint256 points,
    uint256 maxActive,
    string calldata metadataCID,
    bool active
) external onlyGovernanceOrModerator(communityId) {
    require(positionTypes[roleTypeId].roleTypeId == bytes32(0), "Type exists");
    require(verifier != address(0), "Verifier required");
    require(points > 0, "Points required");
    
    positionTypes[roleTypeId] = PositionTypeDefinition({
        roleTypeId: roleTypeId,
        communityId: communityId,
        verifier: verifier,
        points: points,
        active: active,
        metadataCID: metadataCID,
        activeCount: 0,
        maxActive: maxActive
    });
    
    emit PositionTypeDefined(roleTypeId, communityId, verifier, points, maxActive, active);
}
```

### Flujo 2: Aplicación

```solidity
function applyForPosition(
    bytes32 roleTypeId,
    string calldata evidenceCID
) external returns (uint256 appId) {
    PositionTypeDefinition storage posType = positionTypes[roleTypeId];
    
    // 1. Validar tipo existe y está activo
    require(posType.roleTypeId != bytes32(0), "Type not found");
    require(posType.active, "Type not accepting applications");
    
    // 2. Verificar límite de posiciones activas
    if (posType.maxActive > 0) {
        require(posType.activeCount < posType.maxActive, "Max positions reached");
    }
    
    // 3. Verificar aplicante no tiene posición activa del mismo tipo
    require(
        holderPositions[msg.sender][roleTypeId] == 0,
        "Already holds this position"
    );
    
    // 4. Verificar no tiene aplicación pendiente
    require(
        !_hasPendingApplication(msg.sender, roleTypeId),
        "Pending application exists"
    );
    
    // 5. Crear aplicación
    appId = ++applicationCounter;
    applications[appId] = PositionApplication({
        appId: appId,
        roleTypeId: roleTypeId,
        applicant: msg.sender,
        evidenceCID: evidenceCID,
        status: ApplicationStatus.PENDING,
        appliedAt: uint64(block.timestamp),
        processedAt: 0,
        rejectionReason: "",
        tokenId: 0
    });
    
    emit ApplicationSubmitted(appId, roleTypeId, msg.sender, evidenceCID);
}
```

### Flujo 3: Aprobación

```solidity
function approveApplication(
    uint256 appId,
    string calldata approvalMetadata
) external returns (uint256 tokenId) {
    PositionApplication storage app = applications[appId];
    PositionTypeDefinition storage posType = positionTypes[app.roleTypeId];
    
    // 1. Validar llamante es verificador
    require(msg.sender == posType.verifier, "Only verifier");
    require(app.status == ApplicationStatus.PENDING, "Not pending");
    
    // 2. Verificar límite no alcanzado durante espera
    if (posType.maxActive > 0) {
        require(posType.activeCount < posType.maxActive, "Max positions reached");
    }
    
    // 3. Actualizar aplicación
    app.status = ApplicationStatus.APPROVED;
    app.processedAt = uint64(block.timestamp);
    
    // 4. Acuñar SBT POSITION via ValuableActionRegistry
    tokenId = registry.issuePosition(
        posType.communityId,
        app.applicant,
        app.roleTypeId,
        posType.points,
        approvalMetadata
    );
    
    app.tokenId = tokenId;
    
    // 5. Crear datos de posición
    activePositions[tokenId] = PositionData({
        tokenId: tokenId,
        roleTypeId: app.roleTypeId,
        holder: app.applicant,
        communityId: posType.communityId,
        points: posType.points,
        startedAt: uint64(block.timestamp),
        endedAt: 0,
        outcome: PositionOutcome.NONE,
        active: true
    });
    
    // 6. Registrar mapping de holder
    holderPositions[app.applicant][app.roleTypeId] = tokenId;
    
    // 7. Incrementar contador
    posType.activeCount++;
    
    // 8. Registrar con RevenueRouter para distribución
    revenueRouter.registerPosition(tokenId);
    
    emit ApplicationApproved(appId, app.applicant, tokenId);
    emit PositionStarted(tokenId, app.applicant, app.roleTypeId, posType.points);
}
```

### Flujo 4: Cierre de Posición

```solidity
function closePosition(
    uint256 tokenId,
    PositionOutcome outcome,
    string calldata evidenceCID
) external onlyGovernanceOrVerifier(tokenId) returns (uint256 roleTokenId) {
    PositionData storage pos = activePositions[tokenId];
    
    require(pos.active, "Position not active");
    require(outcome != PositionOutcome.NONE, "Must specify outcome");
    
    // 1. Marcar posición como inactiva
    pos.active = false;
    pos.endedAt = uint64(block.timestamp);
    pos.outcome = outcome;
    
    // 2. Decrementar contador
    PositionTypeDefinition storage posType = positionTypes[pos.roleTypeId];
    posType.activeCount--;
    
    // 3. Limpiar mapping de holder
    delete holderPositions[pos.holder][pos.roleTypeId];
    
    // 4. Desregistrar de RevenueRouter
    revenueRouter.unregisterPosition(tokenId);
    
    // 5. Si SUCCESS, acuñar SBT ROLE como historial certificado
    if (outcome == PositionOutcome.SUCCESS) {
        roleTokenId = registry.issueRoleFromPosition(
            pos.communityId,
            pos.holder,
            pos.roleTypeId,
            pos.points,
            pos.startedAt,
            pos.endedAt,
            evidenceCID
        );
        emit RoleCredentialIssued(roleTokenId, pos.holder, pos.roleTypeId);
    }
    
    // 6. Cerrar token POSITION en registry
    registry.closePositionToken(pos.communityId, tokenId, outcome);
    
    emit PositionClosed(tokenId, pos.holder, outcome, evidenceCID);
}
```

---

## Resultados de Cierre

| Resultado | Efecto en SBT | Uso |
|-----------|---------------|-----|
| `SUCCESS` | Acuña SBT ROLE | Servicio completado satisfactoriamente |
| `NEUTRAL` | Sin nuevo SBT | Renuncia voluntaria, reestructuración |
| `NEGATIVE` | Sin nuevo SBT | Mala conducta, remoción forzada |

### Ejemplo de Cierre con SUCCESS

```solidity
// Coordinador cierra posición de desarrollador tras proyecto exitoso
closePosition(
    positionTokenId,
    PositionOutcome.SUCCESS,
    "ipfs://Qm...evaluation-report"
);

// Resultado:
// 1. SBT POSITION marcado como cerrado
// 2. Desregistrado de distribución de ingresos
// 3. SBT ROLE acuñado como historial certificado
// 4. Holder puede mostrar experiencia verificada
```

---

## Integración con RevenueRouter

### Registro al Aprobar

```solidity
// PositionManager notifica a RevenueRouter
revenueRouter.registerPosition(tokenId);

// RevenueRouter almacena:
struct RegisteredPosition {
    uint256 tokenId;
    uint256 communityId;
    address holder;
    uint256 points;
    bool active;
}
```

### Distribución de Ingresos

```solidity
// En RevenueRouter._distributeToWorkers()
function _distributeToWorkers(uint256 communityId, address token, uint256 amount) internal {
    RegisteredPosition[] memory positions = getActivePositions(communityId);
    uint256 totalPoints = _sumPoints(positions);
    
    for (uint i = 0; i < positions.length; i++) {
        uint256 share = (amount * positions[i].points) / totalPoints;
        _transfer(token, positions[i].holder, share);
    }
}
```

### Desregistro al Cerrar

```solidity
// PositionManager notifica cierre
revenueRouter.unregisterPosition(tokenId);

// RevenueRouter marca posición como inactiva
// Futura distribución excluye esta posición
```

---

## Eventos

```solidity
event PositionTypeDefined(
    bytes32 indexed roleTypeId,
    uint256 indexed communityId,
    address verifier,
    uint256 points,
    uint256 maxActive,
    bool active
);

event ApplicationSubmitted(
    uint256 indexed appId,
    bytes32 indexed roleTypeId,
    address indexed applicant,
    string evidenceCID
);

event ApplicationApproved(
    uint256 indexed appId,
    address indexed applicant,
    uint256 tokenId
);

event ApplicationRejected(
    uint256 indexed appId,
    address indexed applicant,
    string reason
);

event PositionStarted(
    uint256 indexed tokenId,
    address indexed holder,
    bytes32 indexed roleTypeId,
    uint256 points
);

event PositionClosed(
    uint256 indexed tokenId,
    address indexed holder,
    PositionOutcome outcome,
    string evidenceCID
);

event RoleCredentialIssued(
    uint256 indexed roleTokenId,
    address indexed holder,
    bytes32 indexed roleTypeId
);
```

---

## Control de Acceso

| Rol | Permisos |
|-----|----------|
| `ANYONE` | Aplicar a posiciones activas |
| `POSITION_VERIFIER` | Aprobar/rechazar aplicaciones |
| `GOVERNANCE` | Definir tipos, cerrar posiciones, modificar parámetros |
| `MODERATOR` | Definir tipos, activar/desactivar |

---

## Consultas

```solidity
// Tipo de posición
function getPositionType(bytes32 roleTypeId) external view returns (PositionTypeDefinition memory);

// Aplicación
function getApplication(uint256 appId) external view returns (PositionApplication memory);

// Posición activa
function getPosition(uint256 tokenId) external view returns (PositionData memory);

// Verificar si holder tiene posición activa
function hasActivePosition(address holder, bytes32 roleTypeId) external view returns (bool) {
    uint256 tokenId = holderPositions[holder][roleTypeId];
    return tokenId != 0 && activePositions[tokenId].active;
}

// Listar posiciones activas por comunidad
function getCommunityActivePositions(uint256 communityId) external view returns (uint256[] memory tokenIds);

// Obtener puntos totales activos por comunidad
function getCommunityTotalPoints(uint256 communityId) external view returns (uint256 totalPoints);
```

---

## Comparación con Otros Gestores

| Aspecto | PositionManager | Engagements | CredentialManager |
|---------|-----------------|-------------|-------------------|
| Duración | Continuo | Tarea única | Permanente |
| Verificación | Un verificador | Panel M-de-N | Un verificador |
| SBT Inicial | POSITION | WORK | CREDENTIAL |
| SBT Final | ROLE (al cerrar) | — | — |
| Ingresos | Participación continua | Pago único | Sin pago |
| Cierre | Explícito | Automático | Revocación |

---

## Casos de Uso

### 1. Desarrollador de Proyecto

```
Tipo: "Lead Developer"
Puntos: 100
Proceso:
  1. Desarrollador aplica con portfolio
  2. CTO aprueba → SBT POSITION
  3. Recibe 100 puntos de participación en ingresos
  4. Cada período de pago recibe proporción
  5. Al completar proyecto exitosamente → SBT ROLE
```

### 2. Coordinador Comunitario

```
Tipo: "Community Coordinator"
Puntos: 80
maxActive: 3 (máx 3 coordinadores)
Proceso:
  1. Candidato presenta experiencia
  2. Gobernanza aprueba
  3. Participa en distribución de ingresos
  4. Período de servicio de 6 meses
  5. Cierre con SUCCESS → SBT ROLE certificando servicio
```

### 3. Verificador Temporal

```
Tipo: "Seasonal Verifier"
Puntos: 50
Proceso:
  1. Verificador solicita posición
  2. VerifierElection (via verificador designado) aprueba
  3. Verifica compromisos durante temporada
  4. Al terminar temporada → cierre SUCCESS o NEUTRAL
```

---

## Seguridad

### Protecciones

| Vector | Mitigación |
|--------|------------|
| Posición duplicada | Una por tipo por holder |
| Inflación de puntos | Solo gobernanza modifica puntos |
| Acaparamiento | maxActive limita posiciones por tipo |
| Ingresos post-cierre | Desregistro inmediato de RevenueRouter |

### Invariantes

1. Un holder solo puede tener una posición activa por tipo
2. Posiciones cerradas no reciben ingresos
3. Solo SUCCESS acuña SBT ROLE
4. Puntos no pueden ser cero
5. Verificador no puede aprobar su propia aplicación

---

## Integración

```
PositionManager
    ├── ValuableActionRegistry (emisión SBTs)
    │   └── ValuableActionSBT (almacenamiento)
    ├── RevenueRouter (registro/desregistro)
    │   └── Distribución proporcional a puntos
    └── CommunityRegistry (validación comunidad)
```
