# Contrato VerifierPool

El contrato VerifierPool gestiona el registro de verificadores, enlace económico y selección pseudo-aleatoria de jurados para el sistema de verificación de trabajo de Shift DeSoc. Proporciona la base para verificación peer descentralizada a través de seguimiento de reputación e incentivos económicos.

## 🎯 Propósito y Función

El VerifierPool sirve como el **sistema de coordinación de verificadores** al:
- Gestionar el registro de verificadores con requisitos de enlace ETH (mínimo 100 ETH)
- Implementar selección pseudo-aleatoria ponderada para paneles de jurados M-de-N
- Rastrear el rendimiento de verificadores a través de puntuación de reputación (0-10000 puntos base)
- Proporcionar seguridad económica mediante enlaces (sistema de slashing pendiente de arreglos en Claims.sol)
- Mantener el pool activo de verificadores calificados para verificación de reclamaciones

**Enfoque de Producción**: Entrega gestión esencial de verificadores con enlace económico probado, mientras el slashing de enlaces espera mejoras del contrato Claims upstream.

## 🏗️ Arquitectura Central

### Estructura de Verificador
```solidity
struct Verifier {
    bool active;                    // Estado de participación actual
    uint256 bondAmount;            // ETH apostado para participación  
    uint256 reputation;            // Puntuación de 0-10000 puntos base
    uint256 totalVerifications;    // Conteo de participación de por vida
    uint256 successfulVerifications; // Conteo de decisiones precisas
    uint64 registeredAt;          // Timestamp de registro
    uint64 lastActiveAt;          // Actividad más reciente
}
```

### Modelo Económico

**Implementación Actual** (Lista para Producción):
- **Enlace**: Stake mínimo de 100 ETH crea seguridad económica
- **Reputación**: Seguimiento de 0-10000 puntos base afecta probabilidad de selección
- **Selección Ponderada**: Mayor reputación + enlace = mayor probabilidad de selección

**Desarrollo Pendiente** (Bloqueado por Claims.sol):
- **Slashing de Enlace**: Penalidades económicas por pobre rendimiento (requiere arreglos del sistema de reputación del contrato Claims)

## ⚙️ Sistema de Registro y Enlace

### Registro de Verificador
#### `registerVerifier()`
**Propósito**: Permite a miembros comunitarios unirse al pool de verificadores apostando ETH.

**Proceso de Registro**:
```solidity
function registerVerifier() external payable {
    // Asegurar enlace adecuado
    if (msg.value < minimumBond) {
        revert Errors.InvalidInput("Cantidad de enlace insuficiente");
    }
    
    // Prevenir doble registro
    if (isVerifier[msg.sender]) {
        revert Errors.InvalidInput("Ya registrado");
    }

    // Crear registro de verificador con reputación base
    verifiers[msg.sender] = Verifier({
        active: true,
        bondAmount: msg.value,
        reputation: baseReputation,     // Comenzar al 50% (5000/10000)
        totalVerifications: 0,
        successfulVerifications: 0,
        registeredAt: uint64(block.timestamp),
        lastActiveAt: uint64(block.timestamp)
    });

    // Agregar al pool de selección activa
    isVerifier[msg.sender] = true;
    verifierIndex[msg.sender] = activeVerifiers.length;
    activeVerifiers.push(msg.sender);
}
```

**Racionalidad Económica**: El requisito de enlace asegura que los verificadores tengan stake económico en la integridad del sistema. Enlaces más altos indican mayor compromiso y reciben pesos de selección mayores.

### Gestión de Enlaces
#### `increaseBond()`
**Propósito**: Permite a verificadores aumentar su stake para mejores probabilidades de selección.

**Implicaciones Estratégicas**:
- Enlaces más altos → Pesos de selección más altos → Más oportunidades de ganancia
- Demuestra compromiso a largo plazo con calidad de verificación
- Proporciona seguridad económica adicional para el sistema

#### `deactivateVerifier(address verifierAddr, string reason)`
**Propósito**: Permite auto-salida o remoción por gobernanza con recuperación de enlace.

**Proceso de Salida**:
```solidity
// Desactivar estado
verifier.active = false;
isVerifier[verifierAddr] = false;

// Remover de selección activa (intercambio y eliminación eficiente)
uint256 index = verifierIndex[verifierAddr];
uint256 lastIndex = activeVerifiers.length - 1;

if (index != lastIndex) {
    address lastVerifier = activeVerifiers[lastIndex];
    activeVerifiers[index] = lastVerifier;
    verifierIndex[lastVerifier] = index;
}

activeVerifiers.pop();
delete verifierIndex[verifierAddr];

// Recuperar enlace
payable(verifierAddr).transfer(verifier.bondAmount);
```

## 🎯 Sistema de Selección Pseudo-Aleatoria

### Algoritmo de Selección Ponderada
#### `selectJurors(uint256 claimId, uint32 panelSize, uint256 seed)`
**Propósito**: Selecciona un panel de verificadores para una reclamación específica usando aleatorización ponderada.

**Algoritmo de Selección**:
```solidity
function selectJurors(
    uint256 claimId, 
    uint32 panelSize, 
    uint256 seed
) external view returns (address[] memory selectedJurors) {
    
    require(panelSize <= activeVerifiers.length, "Panel size excede verificadores activos");
    require(panelSize > 0, "Panel size debe ser positivo");
    
    selectedJurors = new address[](panelSize);
    uint256 totalWeight = _calculateTotalWeight();
    
    for (uint256 i = 0; i < panelSize; i++) {
        // Generar peso aleatorio target
        uint256 randomWeight = uint256(keccak256(abi.encode(seed, claimId, i))) % totalWeight;
        
        // Encontrar verificador correspondiente al peso
        address selectedVerifier = _findVerifierByWeight(randomWeight);
        selectedJurors[i] = selectedVerifier;
        
        // Remover del cálculo de peso para evitar duplicados
        totalWeight -= _getVerifierWeight(selectedVerifier);
    }
    
    return selectedJurors;
}
```

### Cálculo de Peso
```solidity
function _getVerifierWeight(address verifier) internal view returns (uint256) {
    Verifier storage v = verifiers[verifier];
    if (!v.active) return 0;
    
    // Peso = enlace * multiplicador de reputación
    uint256 bondWeight = v.bondAmount / 1 ether; // Normalizar a ETH
    uint256 reputationMultiplier = v.reputation; // 0-10000 puntos base
    
    // Peso base: 1000, reputación multiplica de 0% a 100%
    return bondWeight * (1000 + reputationMultiplier);
}
```

**Características de Equidad**:
- **Sin Duplicados**: Cada verificador solo puede ser seleccionado una vez por panel
- **Selección Ponderada**: Verificadores con mejor reputación y enlaces más altos tienen mayor probabilidad
- **Determinística**: La misma semilla produce los mismos resultados para transparencia

## 🔄 Sistema de Reputación

### Actualización de Rendimiento
#### `updateVerifierPerformance(address verifier, bool successful)`
**Propósito**: Actualiza la reputación de verificadores basada en la precisión de sus decisiones.

**Sistema de Puntuación**:
```solidity
function updateVerifierPerformance(address verifier, bool successful) external {
    require(msg.sender == claimsContract, "Solo Claims puede actualizar");
    
    Verifier storage v = verifiers[verifier];
    require(v.active, "Verificador no activo");
    
    v.totalVerifications++;
    v.lastActiveAt = uint64(block.timestamp);
    
    if (successful) {
        v.successfulVerifications++;
    }
    
    // Calcular nueva reputación basada en tasa de éxito
    uint256 successRate = (v.successfulVerifications * 10000) / v.totalVerifications;
    
    // Aplicar media móvil para suavizar cambios de reputación
    v.reputation = (v.reputation * 7 + successRate * 3) / 10; // 70% histórico, 30% actual
    
    emit VerifierPerformanceUpdated(verifier, successful, v.reputation);
}
```

### Métricas de Reputación
```solidity
function getVerifierReputation(address verifier) external view returns (
    uint256 reputation,      // 0-10000 puntos base
    uint256 successRate,     // Porcentaje de verificaciones correctas
    uint256 totalCount,      // Total de verificaciones realizadas
    bool isEligible         // Si es elegible para selección
) {
    Verifier storage v = verifiers[verifier];
    
    reputation = v.reputation;
    totalCount = v.totalVerifications;
    
    if (totalCount > 0) {
        successRate = (v.successfulVerifications * 10000) / totalCount;
    }
    
    // Elegibilidad basada en reputación mínima y actividad reciente
    isEligible = v.active && 
                v.reputation >= minimumReputation &&
                (block.timestamp - v.lastActiveAt) <= maxInactivityPeriod;
}
```

## 🛡️ Características de Seguridad

### Control de Acceso
```solidity
modifier onlyClaims() {
    require(msg.sender == claimsContract, "Solo contrato Claims autorizado");
    _;
}

modifier onlyGovernance() {
    require(msg.sender == governanceContract, "Solo gobernanza autorizada");
    _;
}
```

### Validación de Parámetros
```solidity
function _validateRegistration() internal view {
    require(msg.value >= minimumBond, "Enlace por debajo del mínimo");
    require(!isVerifier[msg.sender], "Ya registrado como verificador");
    require(activeVerifiers.length < maxVerifiers, "Pool de verificadores lleno");
}
```

### Protección de Slashing (Pendiente)
```solidity
// 🚧 TODO: Implementar después de arreglar sistema de reputación Claims.sol
function slashVerifierBond(address verifier, uint256 amount, string calldata reason) external onlyClaims {
    Verifier storage v = verifiers[verifier];
    require(v.bondAmount >= amount, "Enlace insuficiente para slash");
    
    v.bondAmount -= amount;
    
    // Si el enlace cae por debajo del mínimo, desactivar verificador
    if (v.bondAmount < minimumBond) {
        deactivateVerifier(verifier, "Enlace insuficiente después de slash");
    }
    
    emit VerifierSlashed(verifier, amount, reason);
}
```

## 📊 Análisis de Pool

### Métricas de Pool
```solidity
function getPoolMetrics() external view returns (
    uint256 totalVerifiers,
    uint256 activeVerifiers,
    uint256 totalBondValue,
    uint256 averageReputation,
    uint256 averageSuccessRate
) {
    totalVerifiers = activeVerifiers.length;
    
    uint256 totalRep = 0;
    uint256 totalSuccessful = 0;
    uint256 totalVerifications = 0;
    
    for (uint256 i = 0; i < activeVerifiers.length; i++) {
        Verifier storage v = verifiers[activeVerifiers[i]];
        totalBondValue += v.bondAmount;
        totalRep += v.reputation;
        totalSuccessful += v.successfulVerifications;
        totalVerifications += v.totalVerifications;
    }
    
    if (totalVerifiers > 0) {
        averageReputation = totalRep / totalVerifiers;
    }
    
    if (totalVerifications > 0) {
        averageSuccessRate = (totalSuccessful * 10000) / totalVerifications;
    }
}
```

### Distribución de Rendimiento
```solidity
function getPerformanceBuckets() external view returns (
    uint256 excellent,    // 90%+ tasa de éxito
    uint256 good,        // 70-90% tasa de éxito
    uint256 average,     // 50-70% tasa de éxito
    uint256 poor         // <50% tasa de éxito
) {
    for (uint256 i = 0; i < activeVerifiers.length; i++) {
        Verifier storage v = verifiers[activeVerifiers[i]];
        
        if (v.totalVerifications > 0) {
            uint256 successRate = (v.successfulVerifications * 10000) / v.totalVerifications;
            
            if (successRate >= 9000) excellent++;
            else if (successRate >= 7000) good++;
            else if (successRate >= 5000) average++;
            else poor++;
        }
    }
}
```

## 🔍 Integración Frontend

### Getters Esenciales para UI
```solidity
// Estado del verificador
function getVerifier(address verifier) external view returns (Verifier memory)
function isActiveVerifier(address verifier) external view returns (bool)
function getVerifierCount() external view returns (uint256)

// Métricas de selección
function getVerifierWeight(address verifier) external view returns (uint256)
function getSelectionProbability(address verifier) external view returns (uint256)

// Análisis de pool
function getTopVerifiers(uint256 count) external view returns (address[] memory)
function getVerifierRanking(address verifier) external view returns (uint256 rank)
```

### Eventos para Monitoreo
```solidity
event VerifierRegistered(address indexed verifier, uint256 bondAmount);
event VerifierDeactivated(address indexed verifier, string reason);
event BondIncreased(address indexed verifier, uint256 additionalAmount);
event VerifierPerformanceUpdated(address indexed verifier, bool successful, uint256 newReputation);
event JurorSelected(uint256 indexed claimId, address indexed juror, uint256 selectionWeight);
```

## 🎛️ Configuración de Parámetros

### Parámetros del Sistema
```solidity
uint256 public minimumBond = 100 ether;        // ETH mínimo para registro
uint256 public baseReputation = 5000;          // Reputación inicial (50%)
uint256 public minimumReputation = 2000;       // Mínimo para eligibilidad (20%)
uint256 public maxInactivityPeriod = 90 days;  // Período máximo de inactividad
uint256 public maxVerifiers = 1000;            // Tamaño máximo de pool
```

### Configuración Económica
```solidity
struct BondingConfig {
    uint256 minimumBond;          // Enlace mínimo requerido
    uint256 bondingCooldown;      // Tiempo antes de retirar enlaces
    uint256 slashingThreshold;    // Rendimiento mínimo antes de slashing
    uint256 maxSlashPercentage;   // Máximo % de enlace que se puede hacer slash
}
```

## 📋 Flujo de Trabajo de Producción

### 1. Registro de Verificador
```solidity
// Miembro comunitario se une al pool
function registerAsVerifier() external payable {
    require(msg.value >= 100 ether, "100 ETH mínimo requerido");
    registerVerifier();
}
```

### 2. Selección para Verificación
```solidity
// Sistema Claims solicita panel de jurados
address[] memory jurors = verifierPool.selectJurors(
    claimId,
    5,          // Tamaño de panel
    blockhash(block.number - 1) // Semilla pseudo-aleatoria
);
```

### 3. Actualización de Rendimiento
```solidity
// Claims actualiza reputación después de verificación
verifierPool.updateVerifierPerformance(juror, wasAccurate);
```

**Estado de Implementación**: El VerifierPool está listo para producción con funcionalidad esencial de registro, selección y seguimiento de reputación. El slashing de enlaces está bloqueado pendiente de arreglos en el sistema de reputación de Claims.sol.

---

*Esta documentación refleja la implementación de producción con características de enlace económico robustas y selección pseudo-aleatoria, esperando mejoras upstream para habilitar funcionalidad completa de slashing.*