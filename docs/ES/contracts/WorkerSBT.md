# Contrato WorkerSBT

## 🎯 Propósito y Función

El **WorkerSBT** (Soulbound Token de Trabajador) implementa un sistema de reputación no transferible que rastrea contribuciones de trabajo verificado y establece elegibilidad para participación en gobernanza. Como un NFT soulbound (vinculado al alma), el token representa la reputación de trabajo del portador dentro de la comunidad, permitiendo la participación ponderada en las discusiones y decisiones de gobernanza.

## 🏗️ Arquitectura Central

### Estructuras de Datos

```solidity
struct WorkerData {
    uint256 totalWorkerPoints;      // Puntos de trabajo acumulados de por vida
    uint256 effectivePoints;        // Puntos efectivos después de la decadencia
    uint256 lastActiveTimestamp;    // Última vez que se acumularon puntos
    uint256 communityId;            // ID de comunidad asociado
    uint256[] claimIds;             // Reclamos de trabajo aprobados
    uint256 mintedAt;               // Timestamp de creación del token
}

struct DecayParameters {
    uint256 decayRate;              // Tasa de decadencia por período (puntos base)
    uint256 decayPeriod;            // Duración del período de decadencia (segundos)
    uint256 minEffectivePoints;     // Piso mínimo de puntos efectivos
}
```

### Gestión del Estado

- **Datos por Token**: Mapeo de tokenId a WorkerData para rastrear métricas individuales
- **Búsqueda por Propietario**: Mapeo inverso de dirección de propietario a tokenId
- **Parámetros de Decadencia**: Configuración global para cálculos de decadencia de reputación
- **Lista Blanca de Minters**: Control de acceso para acuñación de tokens (típicamente contratos Claims)

## ⚙️ Funciones y Lógica Clave

### Acuñación de Tokens

```solidity
function mintWorkerSBT(address to, uint256 communityId, uint256 initialPoints) 
    external onlyMinter returns (uint256 tokenId)
```

**Propósito**: Crea un nuevo WorkerSBT para un trabajador después de su primera contribución verificada.

**Lógica Clave**:
- Un propietario = un token (enforce unicidad 1:1)
- Establece puntos iniciales de trabajo y timestamp de acuñación
- Vincula el token a una comunidad específica
- Emite evento `WorkerSBTMinted` para indexación

### Sistema de Puntos de Trabajo

```solidity
function addWorkerPoints(address worker, uint256 points, uint256 claimId) 
    external onlyMinter
```

**Propósito**: Agrega puntos de trabajo después de verificación exitosa de reclamos.

**Lógica de Acumulación**:
- Actualiza `totalWorkerPoints` (nunca decae, registro histórico)
- Recalcula `effectivePoints` incorporando decadencia y nuevos puntos
- Actualiza `lastActiveTimestamp` para preservar actividad reciente
- Rastrea `claimIds` para auditoría y verificación

### Cálculo de Decadencia

```solidity
function calculateEffectivePoints(uint256 tokenId) public view returns (uint256)
```

**Modelo de Decadencia Exponencial**:
```solidity
uint256 timeSinceMint = block.timestamp - workerData.mintedAt;
uint256 decayPeriods = timeSinceMint / decayParameters.decayPeriod;
uint256 decayFactor = (10000 - decayParameters.decayRate) ** decayPeriods;
uint256 decayedPoints = (totalPoints * decayFactor) / (10000 ** decayPeriods);
```

**Propósito de la Decadencia**:
- Incentiva contribución continua vs acumulación pasiva
- Previene dominación a largo plazo de trabajadores inactivos
- Mantiene relevancia contemporánea de la reputación
- Proporciona `minEffectivePoints` como red de seguridad

## 🛡️ Características de Seguridad

### Propiedades Soulbound

```solidity
function transferFrom(address from, address to, uint256 tokenId) public pure override {
    revert SoulboundToken();
}

function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) 
    public pure override {
    revert SoulboundToken();
}
```

**Garantías de No Transferibilidad**:
- Los tokens no pueden ser transferidos, vendidos o cedidos
- La reputación permanece vinculada a la identidad original del trabajador
- Previene mercados secundarios y manipulación de reputación

### Mecanismo de Revocación

```solidity
function revokeWorkerSBT(uint256 tokenId) external onlyGovernor
```

**Controles de Gobernanza**:
- Solo la gobernanza comunitaria puede revocar tokens
- Permite corrección de fraude o comportamiento malicioso
- Mantiene integridad del sistema de reputación
- Proporciona recurso para controversias

## 🔗 Puntos de Integración

### Con Sistema de Reclamos

```solidity
// El contrato Claims llama después de verificación exitosa
function addWorkerPoints(address worker, uint256 points, uint256 claimId) external onlyMinter {
    if (balanceOf(worker) == 0) {
        // Acuñar primer SBT para nuevo trabajador
        mintWorkerSBT(worker, communityId, points);
    } else {
        // Agregar puntos a SBT existente
        _addPointsToExisting(worker, points, claimId);
    }
}
```

### Con Gobernanza (Elegibilidad de Votación)

```solidity
// ShiftGovernor consulta elegibilidad de votantes
function hasVotingEligibility(address voter) external view returns (bool) {
    if (balanceOf(voter) == 0) return false;
    uint256 tokenId = tokenOfOwnerByIndex(voter, 0);
    return calculateEffectivePoints(tokenId) >= MIN_VOTING_POINTS;
}
```

## 📊 Modelo Económico

### Estructura de Incentivos

**Acumulación de Puntos**:
- Los puntos se otorgan basándose en el peso de ActionType (complejidad del trabajo)
- Los trabajadores de mayor contribución obtienen más influencia de gobernanza
- La actividad continua mantiene altos puntos efectivos

**Incentivos de Decadencia**:
```solidity
// Configuración de ejemplo
DecayParameters({
    decayRate: 500,          // 5% de decadencia por período
    decayPeriod: 90 days,    // Períodos trimestrales
    minEffectivePoints: 10   // Piso de 10 puntos para miembros veteranos
});
```

## 🎛️ Ejemplos de Configuración

### Configuración de Parámetros de Reputación

```solidity
// Para comunidad de desarrollo de software activa
DecayParameters memory devParams = DecayParameters({
    decayRate: 250,          // 2.5% decadencia/período (más lenta para retener talento)
    decayPeriod: 120 days,   // Períodos de 4 meses
    minEffectivePoints: 25   // Piso más alto para desarrolladores senior
});

// Para comunidad de contenido con alta rotación
DecayParameters memory contentParams = DecayParameters({
    decayRate: 750,          // 7.5% decadencia/período (más rápida para frescura)
    decayPeriod: 60 days,    // Períodos de 2 meses
    minEffectivePoints: 5    // Piso más bajo para nuevos contribuyentes
});
```

## 🚀 Características Avanzadas

### Análisis de Patrones de Actividad

**Métricas de Trabajador**:
- Frecuencia de contribución (reclamos por período de tiempo)
- Tipos de trabajo diversidad (múltiples ActionTypes)
- Tasa de retención (tiempo entre primera y última contribución)
- Consistencia de calidad (tasa de aprobación de verificación)

### Capacidades de Consulta

```solidity
// Obtener trabajadores top por puntos efectivos
function getTopWorkers(uint256 limit) external view returns (address[] memory)

// Calcular distribución de reputación de comunidad
function getReputationDistribution() external view returns (uint256[] memory)

// Rastrear progreso de trabajador a lo largo del tiempo
function getWorkerHistory(address worker) external view returns (WorkerSnapshot[] memory)
```

### Elegibilidad Dinámica de Gobernanza

**Votación Ponderada por Reputación**:
- El poder de voto escala con puntos efectivos (límite superior configurado)
- Los trabajadores más activos obtienen más influencia en la toma de decisiones
- Los patrones de contribución reciente tienen prioridad sobre la historia antigua

**Umbrales de Participación**:
- Umbrales mínimos de puntos efectivos para crear propuestas
- Requisitos escalonados para diferentes tipos de propuestas (parámetros vs presupuesto)
- Períodos de carencia para nuevos trabajadores

El WorkerSBT forma la columna vertebral del sistema de reputación meritocrático de Shift DeSoc, asegurando que la influencia de gobernanza refleje contribuciones verificadas de trabajo mientras incentiva participación continua.