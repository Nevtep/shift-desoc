# Contrato ParamController

## 🎯 Propósito y Función

El contrato ParamController sirve como el **sistema de gestión de configuración dinámica** para las comunidades Shift DeSoc, habilitando ajuste controlado por gobernanza de parámetros de tiempo, reglas de elegibilidad y divisiones económicas sin requerir actualizaciones de contrato. Actúa como un almacén de parámetros centralizado que otros contratos consultan para valores de configuración en tiempo real.

## 🏗️ Arquitectura Central

### Estructura de Categorías de Parámetros

```solidity
struct GovernanceParams {
    uint256 debateWindow;        // Tiempo para discusión de propuesta (segundos)
    uint256 voteWindow;          // Tiempo para período de votación (segundos)
    uint256 executionDelay;      // Retraso de timelock antes de ejecución (segundos)
    uint256 proposalThreshold;   // Tokens necesarios para crear propuestas
    uint256 quorumRequired;      // Participación mínima para votos válidos
}

struct EligibilityParams {
    uint256 minSeniority;        // Edad mínima de cuenta para participación
    uint256 minSBTs;             // Conteo mínimo de WorkerSBT para votar
    uint256 minTokenBalance;     // Balance mínimo de MembershipToken
    uint256 cooldownPeriod;      // Tiempo entre envíos de propuestas
}

struct EconomicParams {
    uint256[3] revenueSplit;     // [trabajadores%, tesorería%, inversionistas%]
    uint256 feeOnWithdraw;       // Porcentaje de tarifa de salida (puntos base)
    uint256 inflationRate;       // Tasa de inflación de tokens (puntos base)
    uint256 burnRate;            // Tasa de quema de tokens por período (puntos base)
}
```

### Gestión de Configuración

```solidity
mapping(uint256 => GovernanceParams) public communityGovernance;
mapping(uint256 => EligibilityParams) public communityEligibility;
mapping(uint256 => EconomicParams) public communityEconomics;

struct ParameterUpdate {
    uint256 communityId;
    bytes32 parameterKey;        // Hash Keccak256 del nombre del parámetro
    uint256 newValue;
    uint256 effectiveTime;       // Cuándo el cambio se vuelve activo
    address proposer;
    bool executed;
}

mapping(uint256 => ParameterUpdate) public pendingUpdates;
```

**Filosofía de Diseño**: Separar la configuración de la lógica central permite a las comunidades evolucionar sus modelos de gobernanza con el tiempo mientras mantienen la seguridad del contrato y la seguridad de actualizaciones.

## ⚙️ Funciones Clave y Lógica

### Actualizaciones de Parámetros vía Gobernanza

```solidity
function proposeParameterUpdate(
    uint256 communityId,
    string calldata parameterName,
    uint256 newValue,
    uint256 delaySeconds
) external returns (uint256 updateId) {
    // Validar que el proponente tenga suficiente poder de gobernanza
    require(_hasProposalAuthority(msg.sender, communityId), "Autoridad insuficiente");

    bytes32 paramKey = keccak256(abi.encodePacked(parameterName));
    updateId = ++lastUpdateId;

    pendingUpdates[updateId] = ParameterUpdate({
        communityId: communityId,
        parameterKey: paramKey,
        newValue: newValue,
        effectiveTime: block.timestamp + delaySeconds,
        proposer: msg.sender,
        executed: false
    });

    emit ParameterUpdateProposed(updateId, communityId, parameterName, newValue, delaySeconds);
}
```

### Ejecución de Cambios de Parámetros

```solidity
function executeParameterUpdate(uint256 updateId) external {
    ParameterUpdate storage update = pendingUpdates[updateId];
    require(!update.executed, "Actualización ya ejecutada");
    require(block.timestamp >= update.effectiveTime, "Período de retraso no completado");

    // Aplicar cambio según la categoría de parámetro
    if (update.parameterKey == keccak256("debateWindow")) {
        communityGovernance[update.communityId].debateWindow = update.newValue;
    } else if (update.parameterKey == keccak256("voteWindow")) {
        communityGovernance[update.communityId].voteWindow = update.newValue;
    } else if (update.parameterKey == keccak256("executionDelay")) {
        communityGovernance[update.communityId].executionDelay = update.newValue;
    } else if (update.parameterKey == keccak256("proposalThreshold")) {
        communityGovernance[update.communityId].proposalThreshold = update.newValue;
    } else if (update.parameterKey == keccak256("quorumRequired")) {
        communityGovernance[update.communityId].quorumRequired = update.newValue;
    }
    // ... más parámetros económicos y de elegibilidad

    update.executed = true;

    emit ParameterUpdateExecuted(updateId, update.communityId, update.newValue);
}
```

### Consulta de Parámetros en Tiempo Real

```solidity
function getGovernanceParam(uint256 communityId, string calldata paramName)
    external view returns (uint256) {

    bytes32 paramKey = keccak256(abi.encodePacked(paramName));
    GovernanceParams storage params = communityGovernance[communityId];

    if (paramKey == keccak256("debateWindow")) return params.debateWindow;
    if (paramKey == keccak256("voteWindow")) return params.voteWindow;
    if (paramKey == keccak256("executionDelay")) return params.executionDelay;
    if (paramKey == keccak256("proposalThreshold")) return params.proposalThreshold;
    if (paramKey == keccak256("quorumRequired")) return params.quorumRequired;

    revert("Parámetro no encontrado");
}
```

## 🛡️ Características de Seguridad

### Control de Acceso

```solidity
bytes32 public constant PARAM_ADMIN_ROLE = keccak256("PARAM_ADMIN_ROLE");
bytes32 public constant COMMUNITY_MANAGER_ROLE = keccak256("COMMUNITY_MANAGER_ROLE");

modifier onlyAuthorized(uint256 communityId) {
    require(
        hasRole(PARAM_ADMIN_ROLE, msg.sender) ||
        communityRegistry.hasRole(communityId, msg.sender, COMMUNITY_MANAGER_ROLE) ||
        _isGovernanceContract(msg.sender),
        "No autorizado para cambios de parámetros"
    );
    _;
}
```

### Validación de Parámetros

```solidity
function _validateParameterUpdate(
    bytes32 parameterKey,
    uint256 newValue,
    uint256 communityId
) internal view {

    // Validar rangos de parámetros de gobernanza
    if (parameterKey == keccak256("debateWindow")) {
        require(newValue >= 1 hours && newValue <= 30 days, "Ventana de debate fuera de rango");
    } else if (parameterKey == keccak256("voteWindow")) {
        require(newValue >= 1 hours && newValue <= 14 days, "Ventana de voto fuera de rango");
    } else if (parameterKey == keccak256("executionDelay")) {
        require(newValue >= 0 && newValue <= 7 days, "Retraso de ejecución fuera de rango");
    } else if (parameterKey == keccak256("proposalThreshold")) {
        uint256 totalSupply = membershipToken.totalSupply();
        require(newValue <= totalSupply / 10, "Umbral de propuesta demasiado alto"); // Máx 10%
    } else if (parameterKey == keccak256("quorumRequired")) {
        require(newValue >= 1000 && newValue <= 6000, "Quórum debe estar entre 10% y 60%"); // Puntos base
    }

    // Validar parámetros económicos
    else if (parameterKey == keccak256("feeOnWithdraw")) {
        require(newValue <= 1000, "Tarifa de retiro no puede exceder 10%"); // 1000 puntos base = 10%
    } else if (parameterKey == keccak256("inflationRate")) {
        require(newValue <= 2000, "Tasa de inflación no puede exceder 20% anual");
    }

    // Validar división de ingresos suma a 100%
    else if (_isRevenueSplitParameter(parameterKey)) {
        _validateRevenueSplitTotal(communityId);
    }
}
```

### Protección de Timelock

```solidity
function _calculateMinDelay(bytes32 parameterKey) internal pure returns (uint256) {
    // Parámetros críticos requieren retrasos más largos
    if (parameterKey == keccak256("proposalThreshold") ||
        parameterKey == keccak256("quorumRequired")) {
        return 7 days; // Cambios críticos de gobernanza
    } else if (_isEconomicParameter(parameterKey)) {
        return 3 days; // Cambios económicos
    } else {
        return 1 days; // Cambios operacionales
    }
}
```

## 📊 Integración de Sistemas

### Con ShiftGovernor

```solidity
// ShiftGovernor consulta parámetros de tiempo dinámicamente
function votingDelay() public view override returns (uint256) {
    return paramController.getGovernanceParam(communityId, "debateWindow");
}

function votingPeriod() public view override returns (uint256) {
    return paramController.getGovernanceParam(communityId, "voteWindow");
}

function proposalThreshold() public view override returns (uint256) {
    return paramController.getGovernanceParam(communityId, "proposalThreshold");
}
```

### Con CommunityRegistry

```solidity
// CommunityRegistry almacena referencia a parámetros específicos de la comunidad
function setCommunityParamController(uint256 communityId, address paramControllerAddr)
    external onlyCommunityAdmin(communityId) {

    communities[communityId].paramController = paramControllerAddr;
    emit CommunityParamControllerSet(communityId, paramControllerAddr);
}
```

### Con RevenueRouter

```solidity
// RevenueRouter usa división de ingresos dinámicos
function getRevenueSplit(uint256 communityId) external view returns (uint256[3] memory) {
    return paramController.getEconomicParams(communityId).revenueSplit;
}

// Actualizar división cuando los parámetros cambien
function updateRevenueSplitFromParams(uint256 communityId) external {
    uint256[3] memory newSplit = paramController.getRevenueSplit(communityId);
    _setRevenueSplit(communityId, newSplit);
}
```

## 🎯 Casos de Uso Prácticos

### Ajuste de Participación de Gobernanza

```solidity
// La comunidad decide reducir el umbral de propuesta para aumentar participación
proposeParameterUpdate(
    communityId,
    "proposalThreshold",
    500e18,           // Reducir de 1000 a 500 tokens
    3 days            // Retraso de 3 días para cambio de gobernanza
);

// También ajustar el quórum requerido
proposeParameterUpdate(
    communityId,
    "quorumRequired",
    1500,             // Reducir a 15% (1500 puntos base)
    3 days
);
```

### Optimización de Tiempos de Votación

```solidity
// Comunidad ágil quiere votación más rápida
proposeParameterUpdate(communityId, "debateWindow", 1 days, 1 days);    // Debate de 1 día
proposeParameterUpdate(communityId, "voteWindow", 3 days, 1 days);      // Voto de 3 días

// Comunidad conservadora quiere más deliberación
proposeParameterUpdate(communityId, "debateWindow", 7 days, 1 days);    // Debate de 1 semana
proposeParameterUpdate(communityId, "voteWindow", 10 days, 1 days);     // Voto de 10 días
```

### Rebalance Económico

```solidity
// Ajustar división de ingresos después de que los inversionistas alcancen objetivos ROI
function rebalanceRevenueSplit(uint256 communityId) external {
    // Aumentar participación de trabajadores del 60% al 75%
    proposeParameterUpdate(communityId, "workersShare", 7500, 3 days);

    // Aumentar participación de tesorería del 20% al 25%
    proposeParameterUpdate(communityId, "treasuryShare", 2500, 3 days);

    // Reducir participación de inversionistas del 20% al 0%
    proposeParameterUpdate(communityId, "investorsShare", 0, 3 days);
}
```

## 📈 Características Avanzadas

### Programación de Parámetros

```solidity
struct ScheduledUpdate {
    uint256 communityId;
    bytes32 parameterKey;
    uint256[] values;            // Valores escalonados
    uint256[] timestamps;        // Tiempos de activación
    uint256 currentIndex;        // Índice actual en la secuencia
}

mapping(uint256 => ScheduledUpdate) public scheduledUpdates;

function scheduleParameterSequence(
    uint256 communityId,
    string calldata parameterName,
    uint256[] calldata values,
    uint256[] calldata intervals
) external onlyAuthorized(communityId) {
    // Permitir cambios programados (ej: reducir gradualmente el quórum)
}
```

### Análisis de Impacto de Parámetros

```solidity
function analyzeParameterImpact(
    uint256 communityId,
    string calldata parameterName,
    uint256 proposedValue
) external view returns (
    uint256 currentParticipation,
    uint256 projectedParticipation,
    uint256 governanceHealthScore
) {
    // Proyectar el impacto de los cambios de parámetros en las métricas de gobernanza
}
```

### Configuración de Parámetros de Emergencia

```solidity
mapping(uint256 => bool) public emergencyMode;

function activateEmergencyParameters(uint256 communityId)
    external onlyRole(EMERGENCY_ROLE) {

    emergencyMode[communityId] = true;

    // Aplicar configuración de emergencia
    communityGovernance[communityId].voteWindow = 6 hours;      // Votación rápida
    communityGovernance[communityId].proposalThreshold = 100e18; // Umbral bajo
    communityGovernance[communityId].quorumRequired = 500;       // 5% quórum

    emit EmergencyParametersActivated(communityId, block.timestamp);
}
```

## 🔍 Integración Frontend

### Getters Esenciales para UI

```solidity
// Obtener configuración completa de la comunidad
function getCommunityConfig(uint256 communityId) external view returns (
    GovernanceParams memory governance,
    EligibilityParams memory eligibility,
    EconomicParams memory economics
)

// Verificar actualizaciones pendientes
function getPendingUpdates(uint256 communityId) external view returns (ParameterUpdate[] memory)

// Comparar configuraciones
function compareWithDefaults(uint256 communityId) external view returns (
    string[] memory differences,
    uint256[] memory currentValues,
    uint256[] memory defaultValues
)
```

### Eventos para Monitoreo

```solidity
event ParameterUpdateProposed(uint256 indexed updateId, uint256 indexed communityId, string parameterName, uint256 newValue, uint256 delay);
event ParameterUpdateExecuted(uint256 indexed updateId, uint256 indexed communityId, uint256 newValue);
event EmergencyParametersActivated(uint256 indexed communityId, uint256 timestamp);
event ParameterValidationFailed(uint256 indexed communityId, string parameterName, uint256 proposedValue, string reason);
```

## 🎛️ Configuraciones por Defecto

### Comunidad de Desarrollo Ágil

```solidity
GovernanceParams memory agileDev = GovernanceParams({
    debateWindow: 1 days,        // Debate rápido
    voteWindow: 3 days,          // Votación corta
    executionDelay: 1 days,      // Ejecución rápida
    proposalThreshold: 100e18,   // Barrera baja para propuestas
    quorumRequired: 1000         // 10% quórum
});
```

### Comunidad Conservadora

```solidity
GovernanceParams memory conservative = GovernanceParams({
    debateWindow: 7 days,        // Debate extendido
    voteWindow: 14 days,         // Votación larga
    executionDelay: 3 days,      // Retraso de seguridad
    proposalThreshold: 1000e18,  // Barrera alta para propuestas
    quorumRequired: 2500         // 25% quórum
});
```

### Parámetros Económicos Balanceados

```solidity
EconomicParams memory balanced = EconomicParams({
    revenueSplit: [6000, 2500, 1500],  // 60% trabajadores, 25% tesorería, 15% inversionistas
    feeOnWithdraw: 200,                // 2% tarifa de salida
    inflationRate: 500,                // 5% inflación anual
    burnRate: 100                      // 1% tasa de quema
});
```

**Listo para Producción**: ParamController proporciona gestión de configuración robusta y segura que permite a las comunidades evolucionar sus parámetros de gobernanza y económicos de manera controlada, manteniendo la integridad del sistema mientras habilita flexibilidad operacional.

---

_Esta documentación refleja la implementación de producción para gestión de parámetros dinámicos con características de seguridad y validación robustas, habilitando evolución de gobernanza comunitaria._
