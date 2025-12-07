# Contrato CohortRegistry

## 🎯 Propósito y Función

El contrato CohortRegistry es el **sistema de gestión de cohortes de inversión** de Shift DeSoc que organiza a los inversores en grupos con términos de ROI garantizado y distribuición automática basada en peso. Este contrato permite a las comunidades crear oportunidades de inversión estructuradas mientras mantiene transparencia completa y progreso automático hacia la graduación de cohortes.

## 🏗️ Arquitectura Central

### Estructura de Cohorte de Inversión

```solidity
struct Cohort {
    uint256 communityId;           // Comunidad que creó esta cohorte
    uint16 targetROIBps;           // ROI objetivo en puntos base (12000 = 120%)
    uint16 priorityWeight;         // Peso de distribución de ingresos
    uint32 maxInvestors;           // Número máximo de inversores permitidos
    uint256 minInvestment;         // Inversión mínima por persona (USDC)
    uint256 maxTotalRaise;         // Inversión máxima total (USDC)
    uint256 totalInvested;         // Cantidad total invertida actual
    uint256 totalReturned;         // Total devuelto a inversores
    uint256 investorCount;         // Número de inversores actuales
    bool active;                   // Si la cohorte acepta nuevas inversiones
    bool isCompleted;              // Si la cohorte alcanzó el ROI objetivo
    bytes32 termsHash;             // Hash IPFS inmutable de términos de inversión
    uint64 createdAt;              // Timestamp de creación
    uint64 completedAt;            // Timestamp de completación (0 si no completada)
    string termsURI;               // Ubicación de términos legibles
    address valuableActionSBT;     // Contrato SBT para acuñar Investment SBTs
}
```

### Registro de Inversores Individuales

```solidity
struct InvestorRecord {
    address investor;              // Dirección del inversor
    uint256 amountInvested;        // Inversión total por este inversor
    uint256 amountReturned;        // Total devuelto a este inversor
    uint256 sbtId;                 // ID del Investment SBT asociado
    uint64 joinedAt;               // Timestamp de inversión
}

mapping(uint256 => mapping(address => InvestorRecord)) public investorRecords;
mapping(uint256 => address[]) public cohortInvestors; // Lista de inversores por cohorte
```

## ⚙️ Funciones Clave y Lógica

### Creación de Cohortes

```solidity
function createCohort(CohortParams calldata params) external returns (uint256 cohortId) {
    // Validar autorización comunitaria
    require(
        paramController.isAuthorizedForCommunity(params.communityId, msg.sender),
        "No autorizado para esta comunidad"
    );

    // Validar parámetros de cohorte
    require(params.targetROIBps >= 10000 && params.targetROIBps <= 50000, "ROI objetivo inválido");
    require(params.priorityWeight > 0 && params.priorityWeight <= 10000, "Peso de prioridad inválido");
    require(params.minInvestment > 0, "Inversión mínima debe ser positiva");

    // Crear nueva cohorte
    cohortId = ++nextCohortId;
    cohorts[cohortId] = Cohort({
        communityId: params.communityId,
        targetROIBps: params.targetROIBps,
        priorityWeight: params.priorityWeight,
        maxInvestors: params.maxInvestors,
        minInvestment: params.minInvestment,
        maxTotalRaise: params.maxTotalRaise,
        totalInvested: 0,
        totalReturned: 0,
        investorCount: 0,
        active: true,
        isCompleted: false,
        termsHash: params.termsHash,
        createdAt: uint64(block.timestamp),
        completedAt: 0,
        termsURI: params.termsURI,
        valuableActionSBT: params.valuableActionSBT
    });

    emit CohortCreated(cohortId, params.communityId, params.targetROIBps, params.priorityWeight);
}
```

### Adición de Inversiones

```solidity
function addInvestment(
    uint256 cohortId,
    address investor,
    uint256 amount
) external onlyRole(INVESTMENT_MANAGER_ROLE) returns (uint256 sbtId) {
    Cohort storage cohort = cohorts[cohortId];

    // Validaciones de elegibilidad
    require(cohort.active, "Cohorte no activa");
    require(!cohort.isCompleted, "Cohorte ya completada");
    require(amount >= cohort.minInvestment, "Cantidad por debajo del mínimo");
    require(
        cohort.totalInvested + amount <= cohort.maxTotalRaise,
        "Excede máximo de recaudación"
    );
    require(
        investorRecords[cohortId][investor].investor == address(0),
        "Inversor ya en esta cohorte"
    );

    // Validar límite de inversores
    if (cohort.investorCount >= cohort.maxInvestors) {
        revert("Cohorte llena");
    }

    // Actualizar registro de cohorte
    cohort.totalInvested += amount;
    cohort.investorCount += 1;

    // Acuñar Investment SBT
    sbtId = IValuableActionSBT(cohort.valuableActionSBT).mintInvestmentSBT(
        investor,
        cohort.communityId,
        cohortId,
        amount,
        cohort.termsURI
    );

    // Registrar inversor
    investorRecords[cohortId][investor] = InvestorRecord({
        investor: investor,
        amountInvested: amount,
        amountReturned: 0,
        sbtId: sbtId,
        joinedAt: uint64(block.timestamp)
    });

    cohortInvestors[cohortId].push(investor);

    emit InvestmentAdded(cohortId, investor, amount, sbtId);
}
```

### Seguimiento de Recuperación y Completación

```solidity
function markRecovered(
    uint256 cohortId,
    address investor,
    uint256 amount
) external onlyRole(REVENUE_DISTRIBUTOR_ROLE) {
    Cohort storage cohort = cohorts[cohortId];
    InvestorRecord storage record = investorRecords[cohortId][investor];

    // Validaciones
    require(record.investor == investor, "Registro de inversor no encontrado");
    require(!cohort.isCompleted, "Cohorte ya completada");

    // Actualizar totales
    record.amountReturned += amount;
    cohort.totalReturned += amount;

    // Verificar completación de cohorte
    uint256 targetTotal = (cohort.totalInvested * cohort.targetROIBps) / 10000;
    if (cohort.totalReturned >= targetTotal) {
        cohort.isCompleted = true;
        cohort.active = false;
        cohort.completedAt = uint64(block.timestamp);

        emit CohortCompleted(cohortId, cohort.totalInvested, cohort.totalReturned);
    }

    emit InvestmentReturned(cohortId, investor, amount);
}
```

### Cálculo de Pesos para Distribución

```solidity
function getCohortWeight(uint256 cohortId) external view returns (uint256) {
    Cohort memory cohort = cohorts[cohortId];

    // Solo cohortes activas y no completadas tienen peso
    if (!cohort.active || cohort.isCompleted) {
        return 0;
    }

    // El peso se basa en la inversión total y el peso de prioridad
    // Fórmula: totalInvested * priorityWeight / 10000
    return (cohort.totalInvested * cohort.priorityWeight) / 10000;
}

function getActiveCohorts(uint256 communityId) external view returns (uint256[] memory) {
    uint256[] memory allCohorts = communityCohorts[communityId];
    uint256[] memory temp = new uint256[](allCohorts.length);
    uint256 activeCount = 0;

    for (uint256 i = 0; i < allCohorts.length; i++) {
        uint256 cohortId = allCohorts[i];
        Cohort memory cohort = cohorts[cohortId];

        if (cohort.active && !cohort.isCompleted) {
            temp[activeCount] = cohortId;
            activeCount++;
        }
    }

    // Crear array del tamaño correcto
    uint256[] memory activeCohorts = new uint256[](activeCount);
    for (uint256 i = 0; i < activeCount; i++) {
        activeCohorts[i] = temp[i];
    }

    return activeCohorts;
}
```

## 🛡️ Características de Seguridad

### Control de Acceso Basado en Roles

```solidity
// Roles de acceso definidos
bytes32 public constant COHORT_CREATOR_ROLE = keccak256("COHORT_CREATOR_ROLE");
bytes32 public constant INVESTMENT_MANAGER_ROLE = keccak256("INVESTMENT_MANAGER_ROLE");
bytes32 public constant REVENUE_DISTRIBUTOR_ROLE = keccak256("REVENUE_DISTRIBUTOR_ROLE");

modifier onlyCohortCreator(uint256 communityId) {
    require(
        hasRole(COHORT_CREATOR_ROLE, msg.sender) ||
        paramController.isAuthorizedForCommunity(communityId, msg.sender),
        "Creación de cohorte no autorizada"
    );
    _;
}
```

### Validación de Entrada y Límites

```solidity
// Constantes de seguridad
uint256 public constant MAX_ROI_BPS = 50000;          // 500% ROI máximo
uint256 public constant MIN_ROI_BPS = 10000;          // 100% ROI mínimo (sin ganancia)
uint256 public constant MAX_PRIORITY_WEIGHT = 10000;   // 100% peso máximo
uint256 public constant MAX_INVESTORS_PER_COHORT = 1000; // 1000 inversores máximo

function _validateCohortParams(CohortParams memory params) internal pure {
    require(params.targetROIBps >= MIN_ROI_BPS && params.targetROIBps <= MAX_ROI_BPS, "ROI fuera de rango");
    require(params.priorityWeight > 0 && params.priorityWeight <= MAX_PRIORITY_WEIGHT, "Peso inválido");
    require(params.maxInvestors <= MAX_INVESTORS_PER_COHORT, "Demasiados inversores");
    require(params.minInvestment > 0, "Inversión mínima debe ser positiva");
    require(params.maxTotalRaise >= params.minInvestment, "Máximo debe ser >= mínimo");
}
```

### Prevención de Ataques de Reentrada

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract CohortRegistry is AccessControl, ReentrancyGuard {

    function addInvestment(
        uint256 cohortId,
        address investor,
        uint256 amount
    ) external onlyRole(INVESTMENT_MANAGER_ROLE) nonReentrant returns (uint256 sbtId) {
        // Implementación protegida contra reentrada
    }
}
```

## 🔗 Puntos de Integración

### Integración con ValuableActionSBT (Investment SBTs)

```solidity
// El CohortRegistry trabaja estrechamente con ValuableActionSBT para acuñar Investment SBTs
interface IValuableActionSBT {
    function mintInvestmentSBT(
        address investor,
        uint256 communityId,
        uint256 cohortId,
        uint256 amount,
        string calldata evidenceURI
    ) external returns (uint256 sbtId);
}

// Cada inversión automáticamente acuña un Investment SBT con metadatos de cohorte
function _mintInvestmentCredential(
    uint256 cohortId,
    address investor,
    uint256 amount
) internal returns (uint256 sbtId) {
    Cohort memory cohort = cohorts[cohortId];

    sbtId = IValuableActionSBT(cohort.valuableActionSBT).mintInvestmentSBT(
        investor,
        cohort.communityId,
        cohortId,
        amount,
        cohort.termsURI // Evidencia = términos de inversión
    );

    return sbtId;
}
```

### Integración con RevenueRouter

```solidity
// CohortRegistry proporciona datos para distribución de ingresos
interface ICohortRegistry {
    function getActiveCohorts(uint256 communityId) external view returns (uint256[] memory);
    function getCohortWeight(uint256 cohortId) external view returns (uint256);
    function markRecovered(uint256 cohortId, address investor, uint256 amount) external;
}

// RevenueRouter llama a estas funciones para distribución automática
```

### Integración con ParamController

```solidity
// Lectura de políticas de ingresos comunitarios
interface IParamController {
    function getRevenuePolicy(uint256 communityId) external view returns (RevenuePolicy memory);
    function isAuthorizedForCommunity(uint256 communityId, address user) external view returns (bool);
}

// Autorización basada en configuración de gobernanza comunitaria
```

## 📊 Modelo Económico

### Distribución Basada en Peso

```solidity
// Ejemplo: Cálculo de participación de cohorte en pool de inversores
function calculateCohortShare(
    uint256 cohortId,
    uint256 totalInvestorAmount,
    uint256 totalActiveWeight
) external view returns (uint256) {
    uint256 cohortWeight = getCohortWeight(cohortId);

    if (totalActiveWeight == 0) {
        return 0;
    }

    return (totalInvestorAmount * cohortWeight) / totalActiveWeight;
}

// Múltiples cohortes compiten por pool de inversores basándose en sus pesos
// Cohortes con mayor inversión y prioridad reciben mayor participación
```

### Graduación Automática de Cohortes

```solidity
// Las cohortes se gradúan automáticamente al alcanzar el ROI objetivo
function _checkCohortCompletion(uint256 cohortId) internal {
    Cohort storage cohort = cohorts[cohortId];

    uint256 targetTotal = (cohort.totalInvested * cohort.targetROIBps) / 10000;

    if (cohort.totalReturned >= targetTotal && !cohort.isCompleted) {
        cohort.isCompleted = true;
        cohort.active = false;
        cohort.completedAt = uint64(block.timestamp);

        // Las cohortes graduadas ya no reciben distribuciones futuras
        // Su porción del pool de inversores se redistribuye a cohortes activas

        emit CohortCompleted(cohortId, cohort.totalInvested, cohort.totalReturned);
    }
}
```

## 🎛️ Ejemplos de Configuración

### Cohorte Conservadora (Cooperativa)

```solidity
CohortParams memory conservativeParams = CohortParams({
    communityId: 1,
    targetROIBps: 11000,           // 110% ROI (10% ganancia)
    priorityWeight: 1000,          // Peso bajo
    maxInvestors: 50,
    minInvestment: 1000e6,         // $1,000 USDC mínimo
    maxTotalRaise: 100000e6,       // $100,000 máximo
    termsHash: keccak256("Conservative investment terms"),
    termsURI: "ipfs://Qm...",
    valuableActionSBT: valuableActionSBTAddress
});
```

### Cohorte de Crecimiento (Modelo VC)

```solidity
CohortParams memory growthParams = CohortParams({
    communityId: 1,
    targetROIBps: 15000,           // 150% ROI (50% ganancia)
    priorityWeight: 3000,          // Peso alto
    maxInvestors: 10,
    minInvestment: 25000e6,        // $25,000 USDC mínimo
    maxTotalRaise: 500000e6,       // $500,000 máximo
    termsHash: keccak256("Growth investment terms"),
    termsURI: "ipfs://Qm...",
    valuableActionSBT: valuableActionSBTAddress
});
```

## 🚀 Características Avanzadas

### Consulta de Estado de Cohorte

```solidity
function getCohortInfo(uint256 cohortId) external view returns (
    Cohort memory cohort,
    uint256 currentROI,
    uint256 progressPercentage,
    uint256 monthsToCompletion
) {
    cohort = cohorts[cohortId];

    if (cohort.totalInvested > 0) {
        currentROI = (cohort.totalReturned * 10000) / cohort.totalInvested;
        progressPercentage = (cohort.totalReturned * 10000) /
                           ((cohort.totalInvested * cohort.targetROIBps) / 10000);
    }

    // Estimación simple basada en tasa de retorno promedio
    if (!cohort.isCompleted && progressPercentage > 0) {
        uint256 remainingAmount = ((cohort.totalInvested * cohort.targetROIBps) / 10000) - cohort.totalReturned;
        uint256 monthlyRate = cohort.totalReturned / ((block.timestamp - cohort.createdAt) / 30 days + 1);

        if (monthlyRate > 0) {
            monthsToCompletion = remainingAmount / monthlyRate;
        }
    }
}
```

### Migración y Actualización

```solidity
// Capacidades de migración para actualizaciones del sistema
function migrateCohort(
    uint256 cohortId,
    address newCohortRegistry
) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(newCohortRegistry != address(0), "Nueva dirección inválida");

    Cohort memory cohort = cohorts[cohortId];
    require(!cohort.isCompleted, "No se pueden migrar cohortes completadas");

    // Transferir estado de cohorte al nuevo contrato
    ICohortRegistry(newCohortRegistry).importCohort(cohortId, cohort);

    // Marcar como migrada en contrato actual
    cohorts[cohortId].active = false;

    emit CohortMigrated(cohortId, newCohortRegistry);
}
```

El contrato CohortRegistry proporciona la infraestructura fundamental para el sistema de inversión basado en cohortes de Shift DeSoc, permitiendo la gestión transparente y automatizada de grupos de inversores con términos garantizados y graduación automática al alcanzar objetivos de ROI.
