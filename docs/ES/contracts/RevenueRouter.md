# Contrato RevenueRouter

## 🎯 Propósito y Función

El contrato RevenueRouter implementa el innovador **sistema de distribución de ingresos basado en cohortes** de Shift DeSoc que utiliza distribución por cascada para garantizar retornos de inversores organizados en cohortes mientras prioriza a los trabajadores y el crecimiento comunitario. Este sistema reemplaza el modelo ROI individual con un enfoque de **cohortes con ROI garantizado** y **graduación automática**.

## 🏗️ Arquitectura Central

### Modelo de Distribución por Cascada

```solidity
// Flujo de Cascada de Ingresos (Prioridad Estricta)
// 1. Participación Mínima de Trabajadores (ej. 40% de ingresos totales)
// 2. Asignación Base de Tesorería (ej. 20% de ingresos totales)
// 3. Pool de Inversores Activos (ej. 40% de ingresos totales)
// 4. Desbordamiento Comunitario (después de completar todas las cohortes)

struct DistributionResult {
    uint256 workersAmount;         // Cantidad asignada a trabajadores
    uint256 treasuryAmount;        // Cantidad asignada a tesorería
    uint256 investorsAmount;       // Cantidad asignada al pool de inversores
    uint256[] cohortShares;        // Distribución por cohorte
    uint256[] cohortIds;           // IDs de cohorte correspondientes a participaciones
}
```

### Integración con CohortRegistry

```solidity
interface ICohortRegistry {
    struct Cohort {
        uint256 communityId;           // Comunidad que creó esta cohorte
        uint16 targetROIBps;           // ROI objetivo en puntos base (12000 = 120%)
        uint16 priorityWeight;         // Peso de distribución de ingresos
        uint256 totalInvested;         // Cantidad total invertida actual
        uint256 totalReturned;         // Total devuelto a inversores
        bool isCompleted;              // Si la cohorte alcanzó el ROI objetivo
        // ... otros campos
    }

    function getActiveCohorts(uint256 communityId) external view returns (uint256[] memory);
    function getCohort(uint256 cohortId) external view returns (Cohort memory);
    function getCohortWeight(uint256 cohortId) external view returns (uint256);
}
```

**Filosofía de Diseño**: Distribución transparente y matemáticamente precisa que garantiza retornos de inversores mientras mantiene prioridad para trabajadores y sostenibilidad comunitaria a largo plazo.

## ⚙️ Funciones Clave y Lógica

### Registro de Inversionistas

```solidity
function registerInvestor(
    address investor,
    uint256 investedAmount,
    uint256 targetROI,
    uint256 initialShare
) external onlyRole(INVESTOR_MANAGER_ROLE) {
    require(investor != address(0), "Dirección de inversionista inválida");
    require(investedAmount > 0, "La inversión debe ser positiva");
    require(targetROI > 0 && targetROI <= 50000, "Objetivo ROI inválido"); // Máx 500%

    investors[investor] = InvestorData({
        totalInvested: investedAmount,
        targetROI: targetROI,
        cumulativeRevenue: 0,
        currentShare: initialShare,
        lastRevenueTime: block.timestamp,
        active: true
    });

    activeInvestors.push(investor);

    emit InvestorRegistered(investor, investedAmount, targetROI, initialShare);
}
```

### Cálculo Dinámico de Ingresos

```solidity
function calculateInvestorShare(address investor) external view returns (uint256) {
    InvestorData memory inv = investors[investor];

    if (!inv.active) return 0;

    // Calcular porcentaje de ROI actual alcanzado
    uint256 currentROI = (inv.cumulativeRevenue * 10000) / inv.totalInvested;

    if (currentROI >= inv.targetROI) {
        return 0; // Objetivo ROI alcanzado, no más ingresos
    }

    // Decaimiento lineal: la participación disminuye a medida que ROI se acerca al objetivo
    uint256 progress = (currentROI * 10000) / inv.targetROI;
    uint256 remainingShare = inv.currentShare * (10000 - progress) / 10000;

    return remainingShare;
}
```

### Proceso de Distribución de Ingresos

```solidity
function distributeRevenue(uint256 totalRevenue)
    external onlyRole(DISTRIBUTOR_ROLE) nonReentrant {

    require(totalRevenue > 0, "No hay ingresos para distribuir");

    // Calcular participaciones dinámicas para cada grupo
    (uint256 workersAmount, uint256 treasuryAmount, uint256 investorsAmount) =
        _calculateShares(totalRevenue);

    // Distribuir a trabajadores
    if (workersAmount > 0) {
        _distributeToWorkers(workersAmount);
    }

    // Distribuir a tesorería
    if (treasuryAmount > 0) {
        _distributeToTreasury(treasuryAmount);
    }

    // Distribuir a inversionistas con decaimiento de ROI
    if (investorsAmount > 0) {
        _distributeToInvestors(investorsAmount);
    }

    emit RevenueDistributed(totalRevenue, workersAmount, treasuryAmount, investorsAmount);
}
```

### Algoritmo de Decaimiento de ROI

```solidity
function _distributeToInvestors(uint256 totalInvestorAmount) internal {
    uint256 totalActiveShares = 0;

    // Primera pasada: calcular participaciones activas totales
    for (uint256 i = 0; i < activeInvestors.length; i++) {
        address investor = activeInvestors[i];
        uint256 share = calculateInvestorShare(investor);
        totalActiveShares += share;
    }

    if (totalActiveShares == 0) {
        // No inversionistas activos, redireccionar a tesorería
        _distributeToTreasury(totalInvestorAmount);
        return;
    }

    // Segunda pasada: distribuir proporcional a participaciones activas
    for (uint256 i = 0; i < activeInvestors.length; i++) {
        address investor = activeInvestors[i];
        uint256 share = calculateInvestorShare(investor);

        if (share > 0) {
            uint256 amount = (totalInvestorAmount * share) / totalActiveShares;

            // Actualizar datos del inversionista
            investors[investor].cumulativeRevenue += amount;
            investors[investor].lastRevenueTime = block.timestamp;

            // Transferir ingresos
            payable(investor).transfer(amount);

            // Verificar si se alcanzó el objetivo ROI
            uint256 currentROI = (investors[investor].cumulativeRevenue * 10000) /
                               investors[investor].totalInvested;

            if (currentROI >= investors[investor].targetROI) {
                investors[investor].active = false;
                _removeFromActiveInvestors(investor);
                emit InvestorROIReached(investor, investors[investor].cumulativeRevenue);
            }

            emit InvestorPaid(investor, amount, currentROI);
        }
    }
}
```

## 🛡️ Características de Seguridad

### Control de Acceso

```solidity
bytes32 public constant INVESTOR_MANAGER_ROLE = keccak256("INVESTOR_MANAGER_ROLE");
bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

modifier onlyRole(bytes32 role) {
    require(hasRole(role, msg.sender), "Acceso denegado para este rol");
    _;
}
```

### Validación de Parámetros

```solidity
function _validateDistributionParams(uint256 totalRevenue) internal pure {
    require(totalRevenue > 0, "Los ingresos deben ser positivos");
    require(totalRevenue <= type(uint128).max, "Ingresos exceden límite máximo");
}

function _validateROITarget(uint256 targetROI) internal pure {
    require(targetROI > 0, "El objetivo ROI debe ser positivo");
    require(targetROI <= 50000, "El objetivo ROI no puede exceder 500%"); // 50000 puntos base = 500%
}
```

### Protección contra Reentrancia

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract RevenueRouter is ReentrancyGuard, AccessControl {
    // Las funciones de distribución usan modificador nonReentrant
}
```

## 📊 Modelo Económico

### Configuración de Ejemplo: Startup Tecnológica

```solidity
// Inversionista Semilla: 300% ROI objetivo sobre 50 ETH
registerInvestor(
    seedInvestor,
    50 ether,        // Inversión inicial
    30000,           // 300% ROI objetivo (30000 puntos base)
    3000             // 30% participación inicial en ingresos
);

// Inversionista Serie A: 200% ROI objetivo sobre 200 ETH
registerInvestor(
    seriesAInvestor,
    200 ether,       // Inversión más grande
    20000,           // 200% ROI objetivo
    4000             // 40% participación inicial (más grande por mayor inversión)
);
```

### Progresión de Decaimiento

```solidity
// Ejemplo: Inversionista con objetivo 300% ROI
// Inversión inicial: 100 ETH, Participación inicial: 30%

// Año 1: 0 ETH recibidos → 30% participación completa
// Año 2: 50 ETH recibidos (50% progreso hacia objetivo) → 15% participación
// Año 3: 150 ETH recibidos (150% progreso) → 7.5% participación
// Año 4: 250 ETH recibidos (250% progreso) → 2.5% participación
// Año 5: 300+ ETH recibidos (objetivo alcanzado) → 0% participación, se convierte en inactivo
```

### Transición de Propiedad Comunitaria

```solidity
function getCommunityOwnershipPercentage() external view returns (uint256) {
    uint256 totalInvestorShares = 0;

    for (uint256 i = 0; i < activeInvestors.length; i++) {
        totalInvestorShares += calculateInvestorShare(activeInvestors[i]);
    }

    // A medida que las participaciones de inversionistas disminuyen, la propiedad comunitaria aumenta
    return 10000 - totalInvestorShares; // 10000 puntos base = 100%
}
```

## 🔄 Integración con Otros Contratos

### Con CommunityToken (Tesorería)

```solidity
function _distributeToTreasury(uint256 amount) internal {
    address treasuryAddress = communityRegistry.getTreasuryAddress(communityId);

    // Acuñar tokens comunitarios 1:1 con USDC para la tesorería
    ICommunityToken(communityToken).mintToTreasury(treasuryAddress, amount);

    emit TreasuryFunded(treasuryAddress, amount);
}
```

### Con WorkerSBT (Distribución de Trabajadores)

```solidity
function _distributeToWorkers(uint256 amount) internal {
    // Obtener todos los trabajadores activos y sus pesos de WorkerPoints
    address[] memory activeWorkers = workerSBT.getActiveWorkers(communityId);

    if (activeWorkers.length == 0) {
        // No hay trabajadores activos, redireccionar a tesorería
        _distributeToTreasury(amount);
        return;
    }

    uint256 totalWorkerPoints = workerSBT.getTotalActivePoints(communityId);

    // Distribuir proporcional a WorkerPoints
    for (uint256 i = 0; i < activeWorkers.length; i++) {
        address worker = activeWorkers[i];
        uint256 workerPoints = workerSBT.getWorkerPoints(worker);
        uint256 workerShare = (amount * workerPoints) / totalWorkerPoints;

        if (workerShare > 0) {
            payable(worker).transfer(workerShare);
            emit WorkerPaid(worker, workerShare, workerPoints);
        }
    }
}
```

### Con Marketplace (Fuente de Ingresos)

```solidity
// Marketplace llama a esta función cuando los servicios generan ingresos
function recordMarketplaceRevenue(
    uint256 serviceId,
    uint256 revenue,
    address serviceProvider
) external onlyRole(MARKETPLACE_ROLE) {

    // Registrar fuente de ingresos para auditoría
    emit RevenueSourceRecorded("marketplace", serviceId, revenue, serviceProvider);

    // Activar distribución automática si se alcanza el umbral
    if (revenue >= autoDistributionThreshold) {
        distributeRevenue(revenue);
    } else {
        // Acumular en pool pendiente
        pendingRevenue += revenue;
    }
}
```

## 📈 Características Avanzadas

### Distribución Automática por Umbral

```solidity
uint256 public autoDistributionThreshold = 10000e6; // 10,000 USDC
uint256 public pendingRevenue;

function triggerDistributionIfReady() external {
    if (pendingRevenue >= autoDistributionThreshold) {
        distributeRevenue(pendingRevenue);
        pendingRevenue = 0;
    }
}
```

### Análisis de Proyecciones de ROI

```solidity
function getROIProjections(address investor) external view returns (
    uint256 remainingToTarget,     // Cantidad restante para alcanzar objetivo
    uint256 estimatedMonthsToTarget, // Tiempo estimado basado en ingresos actuales
    uint256 projectedFinalROI      // ROI final proyectado si las tendencias continúan
) {
    InvestorData memory inv = investors[investor];

    remainingToTarget = (inv.totalInvested * inv.targetROI / 10000) - inv.cumulativeRevenue;

    // Calcular ingreso mensual promedio basado en los últimos 6 meses
    uint256 recentMonthlyRevenue = _calculateRecentMonthlyRevenue(investor);

    if (recentMonthlyRevenue > 0) {
        estimatedMonthsToTarget = remainingToTarget / recentMonthlyRevenue;
    }

    projectedFinalROI = _projectFinalROI(investor);
}
```

### Análisis de Equidad Comunitaria

```solidity
function getCommunityEquityAnalysis() external view returns (
    uint256 currentCommunityOwnership,  // % actual de propiedad comunitaria
    uint256 projectedOwnershipIn1Year,  // Proyección a 1 año
    uint256 projectedOwnershipIn5Years, // Proyección a 5 años
    uint256 totalInvestorCommitments    // Capital total de inversionistas
) {
    currentCommunityOwnership = getCommunityOwnershipPercentage();

    // Modelar el crecimiento de propiedad comunitaria basado en tendencias de ROI
    projectedOwnershipIn1Year = _projectOwnershipGrowth(12 months);
    projectedOwnershipIn5Years = _projectOwnershipGrowth(60 months);

    for (uint256 i = 0; i < activeInvestors.length; i++) {
        totalInvestorCommitments += investors[activeInvestors[i]].totalInvested;
    }
}
```

## 🔍 Integración Frontend

### Getters Esenciales para UI

```solidity
// Información del inversionista
function getInvestorData(address investor) external view returns (InvestorData memory)
function getInvestorROIProgress(address investor) external view returns (uint256 percentage)
function getAllActiveInvestors() external view returns (address[] memory)

// Métricas de distribución
function getRevenueDistributionHistory(uint256 fromTimestamp) external view returns (RevenueDistribution[] memory)
function getPendingDistributionAmount() external view returns (uint256)

// Análisis comunitario
function getCommunityRevenueBreakdown() external view returns (uint256 workers, uint256 treasury, uint256 investors)
```

### Eventos para Monitoreo

```solidity
event InvestorRegistered(address indexed investor, uint256 investedAmount, uint256 targetROI, uint256 initialShare);
event RevenueDistributed(uint256 totalRevenue, uint256 workersAmount, uint256 treasuryAmount, uint256 investorsAmount);
event InvestorPaid(address indexed investor, uint256 amount, uint256 currentROI);
event InvestorROIReached(address indexed investor, uint256 totalReceived);
event WorkerPaid(address indexed worker, uint256 amount, uint256 workerPoints);
event TreasuryFunded(address indexed treasury, uint256 amount);
```

## 🎛️ Configuración de Parámetros

### Configuraciones Económicas

```solidity
struct EconomicConfig {
    uint256 maxROITarget;              // ROI máximo permitido (puntos base)
    uint256 autoDistributionThreshold; // Umbral para distribución automática
    uint256 minInvestmentAmount;       // Inversión mínima para participar
    uint256 maxInvestorShare;          // Participación máxima por inversionista
}
```

### Configuración de Comunidad

```solidity
// Cada comunidad puede tener configuración de distribución personalizada
struct CommunityDistributionConfig {
    uint256 defaultWorkersShare;    // % por defecto para trabajadores
    uint256 defaultTreasuryShare;   // % por defecto para tesorería
    uint256 defaultInvestorsShare;  // % por defecto para inversionistas
    bool dynamicAdjustment;         // Si ajustar dinámicamente basado en participación de inversionistas
}
```

## 📋 Casos de Uso de Ejemplo

### Comunidad de Desarrollo de Software

```solidity
// Configuración: 60% trabajadores, 20% tesorería, 20% inversionistas inicialmente
// A medida que los inversionistas alcanzan objetivos ROI, su 20% se redistribuye a trabajadores y tesorería

// Mes 1: $10,000 en ingresos de servicios
distributeRevenue(10000e6);
// Distribución: $6,000 trabajadores, $2,000 tesorería, $2,000 inversionistas

// Mes 24: Algunos inversionistas alcanzan objetivos, propiedad comunitaria aumenta
// Distribución: $7,500 trabajadores, $2,500 tesorería, $0 inversionistas restantes
```

### Comunidad de Contenido Creativo

```solidity
// Configuración: 70% creadores, 15% tesorería, 15% inversionistas inicialmente
// Enfoque en recompensar creación de contenido mientras se transiciona a propiedad comunitaria

// Inversionistas de contenido con objetivos ROI más conservadores (150-250%)
// Transición más rápida a propiedad completa de la comunidad
```

**Listo para Producción**: RevenueRouter proporciona un modelo económico sostenible que equilibra retornos de inversionistas con crecimiento de propiedad comunitaria a largo plazo, asegurando transiciones económicas predecibles y equitativas.

---

_Esta documentación refleja el modelo económico de producción que crea incentivos alineados para inversionistas mientras garantiza la eventual propiedad y control comunitario del ecosistema Shift DeSoc._
