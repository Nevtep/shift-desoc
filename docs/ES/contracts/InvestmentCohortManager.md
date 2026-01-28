# Contrato InvestmentCohortManager (Gestor de Cohortes de Inversión)

> **Coordinación del ciclo de vida de cohortes y emisión de SBT de inversión**

El contrato InvestmentCohortManager maneja la creación de cohortes de inversión, registro de inversores y emisión de SBTs de tipo INVESTMENT.

---

## Resumen

| Propiedad | Valor |
|-----------|-------|
| **Capa** | Económica (Capa 4) |
| **Tipo** | Contrato Gestor |
| **Hereda** | AccessControlUpgradeable |
| **Dependencias** | ValuableActionRegistry, CohortRegistry, CommunityToken |
| **SBT Emitido** | INVESTMENT |

---

## Propósito

InvestmentCohortManager coordina el sistema de inversión comunitaria:

1. Gobernanza crea cohortes con ROI objetivo inmutable
2. Inversores contribuyen capital a cohortes activas
3. Sistema acuña SBT INVESTMENT registrando participación
4. CohortRegistry rastrea progreso hacia ROI objetivo
5. RevenueRouter distribuye ingresos a inversores proporcionalmente

---

## Arquitectura

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                    InvestmentCohortManager                           │
├─────────────────────────────────────────────────────────────────────┤
│  Estado:                                                            │
│  • cohorts: delegado a CohortRegistry                               │
│  • investments: mapping(tokenId → InvestmentData)                   │
│  • investorCohorts: mapping(investor → mapping(cohortId → tokenId)) │
├─────────────────────────────────────────────────────────────────────┤
│  Funciones Públicas:                                                │
│  • createCohort(...) → cohortId                                     │
│  • setCohortActive(cohortId, active)                                │
│  • issueInvestment(to, cohortId, amount, weight, metadata) → tokenId│
│  • getInvestorInfo(cohortId, investor) → InvestmentData             │
├─────────────────────────────────────────────────────────────────────┤
│  Dependencias:                                                      │
│  • ValuableActionRegistry: emisión de SBT INVESTMENT               │
│  • CohortRegistry: almacenamiento de cohortes                       │
│  • CommunityToken: recepción de capital                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Estructuras de Datos

```solidity
// Delegado a CohortRegistry
struct Cohort {
    uint256 id;
    uint256 communityId;
    uint16 targetRoiBps;      // ej: 15000 = 150% (INMUTABLE)
    uint32 priorityWeight;    // Prioridad en distribución (1-1000)
    uint256 investedTotal;    // Capital total invertido
    uint256 recoveredTotal;   // Ingresos distribuidos hasta ahora
    bool active;              // Auto-desactiva al alcanzar ROI
    bytes32 termsHash;        // Hash de términos inmutables
    uint64 startAt;           // Inicio de período de inversión
    uint64 endAt;             // Fin de período de inversión
}

// Gestionado por InvestmentCohortManager
struct InvestmentData {
    uint256 tokenId;          // SBT INVESTMENT
    uint256 cohortId;
    address investor;
    uint256 invested;         // Capital contribuido
    uint256 weight;           // Peso en distribución (puede diferir de invested)
    uint256 recovered;        // Ingresos recibidos hasta ahora
    uint64 investedAt;
}
```

---

## Flujos de Trabajo

### Flujo 1: Creación de Cohorte

```solidity
function createCohort(
    uint256 communityId,
    uint16 targetRoiBps,
    uint32 priorityWeight,
    bytes32 termsHash,
    uint64 startAt,
    uint64 endAt,
    bool active
) external onlyGovernance returns (uint256 cohortId) {
    // 1. Validar parámetros
    require(targetRoiBps > 0, "ROI must be positive");
    require(targetRoiBps <= 50000, "ROI too high"); // Máx 500%
    require(priorityWeight > 0 && priorityWeight <= 1000, "Invalid weight");
    require(endAt > startAt || endAt == 0, "Invalid period");
    
    // 2. Crear en CohortRegistry
    cohortId = cohortRegistry.createCohort(
        communityId,
        targetRoiBps,
        priorityWeight,
        termsHash,
        startAt,
        endAt,
        active
    );
    
    emit CohortCreated(cohortId, communityId, targetRoiBps, priorityWeight, termsHash);
}
```

**Inmutabilidad del ROI**: Una vez creada la cohorte, `targetRoiBps` NUNCA puede cambiar.

### Flujo 2: Emisión de Inversión

```solidity
function issueInvestment(
    address to,
    uint256 cohortId,
    uint256 amount,
    uint256 weight,
    string calldata metadata
) external onlyGovernanceOrTreasury returns (uint256 tokenId) {
    Cohort memory cohort = cohortRegistry.getCohort(cohortId);
    
    // 1. Validar cohorte existe y está activa
    require(cohort.id != 0, "Cohort not found");
    require(cohort.active, "Cohort not active");
    
    // 2. Validar período de inversión
    require(
        block.timestamp >= cohort.startAt,
        "Investment period not started"
    );
    require(
        cohort.endAt == 0 || block.timestamp <= cohort.endAt,
        "Investment period ended"
    );
    
    // 3. Validar inversor no tiene inversión previa en esta cohorte
    require(
        investorCohorts[to][cohortId] == 0,
        "Already invested in cohort"
    );
    
    // 4. Recibir capital (si amount > 0)
    if (amount > 0) {
        communityToken.transferFrom(msg.sender, address(this), amount);
    }
    
    // 5. Acuñar SBT INVESTMENT via ValuableActionRegistry
    tokenId = registry.issueInvestment(
        cohort.communityId,
        to,
        cohortId,
        weight,
        metadata
    );
    
    // 6. Registrar datos de inversión
    investments[tokenId] = InvestmentData({
        tokenId: tokenId,
        cohortId: cohortId,
        investor: to,
        invested: amount,
        weight: weight,
        recovered: 0,
        investedAt: uint64(block.timestamp)
    });
    
    // 7. Registrar mapping de inversor
    investorCohorts[to][cohortId] = tokenId;
    
    // 8. Actualizar totales en CohortRegistry
    cohortRegistry.addInvestment(cohortId, to, amount, tokenId);
    
    emit InvestmentIssued(tokenId, to, cohortId, amount, weight);
}
```

### Flujo 3: Activación/Desactivación de Cohorte

```solidity
function setCohortActive(
    uint256 cohortId,
    bool active
) external onlyGovernance {
    Cohort memory cohort = cohortRegistry.getCohort(cohortId);
    require(cohort.id != 0, "Cohort not found");
    
    // No permitir reactivar cohorte que alcanzó ROI
    if (active) {
        require(
            !_hasReachedTarget(cohortId),
            "Cohort completed ROI target"
        );
    }
    
    cohortRegistry.setCohortActive(cohortId, active);
    
    emit CohortStatusChanged(cohortId, active);
}

function _hasReachedTarget(uint256 cohortId) internal view returns (bool) {
    Cohort memory cohort = cohortRegistry.getCohort(cohortId);
    uint256 targetAmount = (cohort.investedTotal * cohort.targetRoiBps) / 10000;
    return cohort.recoveredTotal >= targetAmount;
}
```

---

## Integración con CohortRegistry

### Delegación de Estado

```solidity
// InvestmentCohortManager delega almacenamiento de cohortes
interface ICohortRegistry {
    function createCohort(...) external returns (uint256);
    function getCohort(uint256 cohortId) external view returns (Cohort memory);
    function addInvestment(uint256 cohortId, address investor, uint256 amount, uint256 tokenId) external;
    function markRecovered(uint256 cohortId, uint256 amount) external;
    function setCohortActive(uint256 cohortId, bool active) external;
    function getActiveCohorts(uint256 communityId) external view returns (Cohort[] memory);
}
```

### Tracking de Recuperación

```solidity
// Llamado por RevenueRouter al distribuir a inversores
function markRecovered(uint256 cohortId, uint256 amount) external onlyRevenueRouter {
    cohortRegistry.markRecovered(cohortId, amount);
    
    // Verificar si se alcanzó ROI objetivo
    if (_hasReachedTarget(cohortId)) {
        cohortRegistry.setCohortActive(cohortId, false);
        emit CohortCompleted(cohortId);
    }
}
```

---

## Integración con RevenueRouter

### Distribución a Inversores

```solidity
// En RevenueRouter._distributeToCohorts()
function _distributeToCohorts(uint256 communityId, address token, uint256 amount) internal {
    Cohort[] memory activeCohorts = cohortRegistry.getActiveCohorts(communityId);
    if (activeCohorts.length == 0) return;
    
    uint256 totalWeight = _sumWeights(activeCohorts);
    
    for (uint i = 0; i < activeCohorts.length; i++) {
        // Distribución proporcional al peso de prioridad
        uint256 cohortShare = (amount * activeCohorts[i].priorityWeight) / totalWeight;
        _distributeToInvestors(activeCohorts[i].id, token, cohortShare);
        
        // Marcar como recuperado
        investmentCohortManager.markRecovered(activeCohorts[i].id, cohortShare);
    }
}

function _distributeToInvestors(uint256 cohortId, address token, uint256 amount) internal {
    InvestmentData[] memory investors = getCohortsInvestors(cohortId);
    uint256 totalInvestorWeight = _sumInvestorWeights(investors);
    
    for (uint i = 0; i < investors.length; i++) {
        uint256 investorShare = (amount * investors[i].weight) / totalInvestorWeight;
        _transfer(token, investors[i].investor, investorShare);
        
        // Actualizar recovered del inversor
        investments[investors[i].tokenId].recovered += investorShare;
    }
}
```

---

## Eventos

```solidity
event CohortCreated(
    uint256 indexed cohortId,
    uint256 indexed communityId,
    uint16 targetRoiBps,
    uint32 priorityWeight,
    bytes32 termsHash
);

event CohortStatusChanged(
    uint256 indexed cohortId,
    bool active
);

event CohortCompleted(
    uint256 indexed cohortId
);

event InvestmentIssued(
    uint256 indexed tokenId,
    address indexed investor,
    uint256 indexed cohortId,
    uint256 amount,
    uint256 weight
);

event InvestmentRecovered(
    uint256 indexed tokenId,
    address indexed investor,
    uint256 amount,
    uint256 totalRecovered
);
```

---

## Consultas

```solidity
// Obtener cohorte
function getCohort(uint256 cohortId) external view returns (Cohort memory) {
    return cohortRegistry.getCohort(cohortId);
}

// Obtener inversión por token
function getInvestment(uint256 tokenId) external view returns (InvestmentData memory) {
    return investments[tokenId];
}

// Obtener inversión de un inversor en una cohorte
function getInvestorInfo(
    uint256 cohortId,
    address investor
) external view returns (InvestmentData memory) {
    uint256 tokenId = investorCohorts[investor][cohortId];
    if (tokenId == 0) return InvestmentData(0, 0, address(0), 0, 0, 0, 0);
    return investments[tokenId];
}

// Verificar si inversor está en cohorte
function isInvestor(uint256 cohortId, address investor) external view returns (bool) {
    return investorCohorts[investor][cohortId] != 0;
}

// Listar cohortes activas de comunidad
function getActiveCohorts(uint256 communityId) external view returns (Cohort[] memory) {
    return cohortRegistry.getActiveCohorts(communityId);
}

// Progreso de ROI de cohorte
function getCohortProgress(uint256 cohortId) external view returns (
    uint256 invested,
    uint256 recovered,
    uint256 targetAmount,
    uint16 progressBps
) {
    Cohort memory cohort = cohortRegistry.getCohort(cohortId);
    invested = cohort.investedTotal;
    recovered = cohort.recoveredTotal;
    targetAmount = (invested * cohort.targetRoiBps) / 10000;
    
    if (targetAmount > 0) {
        progressBps = uint16((recovered * 10000) / targetAmount);
    }
}
```

---

## Control de Acceso

| Rol | Permisos |
|-----|----------|
| `GOVERNANCE` | Crear cohortes, activar/desactivar, emitir inversiones |
| `TREASURY_ROLE` | Emitir inversiones (cuando recibe capital) |
| `REVENUE_ROUTER` | Marcar recuperación de ingresos |

---

## Ejemplo de Ciclo de Vida

```
1. Gobernanza crea Cohorte
   └─→ createCohort(communityId=1, targetRoiBps=15000, weight=100, ...)
   └─→ cohortId = 1

2. Período de inversión abierto
   └─→ Inversor A: issueInvestment(A, 1, 10000, 100, ...) → tokenId=1
   └─→ Inversor B: issueInvestment(B, 1, 5000, 50, ...) → tokenId=2
   └─→ investedTotal = 15000

3. Target ROI
   └─→ 15000 * 150% = 22500 USDC objetivo

4. Ingresos generados (mensuales)
   └─→ Mes 1: RevenueRouter distribuye 3000 a cohorte
       └─→ A recibe: 3000 * 100/150 = 2000
       └─→ B recibe: 3000 * 50/150 = 1000
       └─→ recoveredTotal = 3000

5. Progreso continúa...
   └─→ Mes 6: recoveredTotal = 18000
   └─→ Mes 8: recoveredTotal = 22500 (objetivo alcanzado!)

6. Auto-completación
   └─→ setCohortActive(1, false) automático
   └─→ Futuros ingresos van a otras cohortes/excedente

7. SBTs INVESTMENT permanecen
   └─→ Historial verificable de participación
```

---

## Seguridad

### Protecciones

| Vector | Mitigación |
|--------|------------|
| Cambio de ROI | targetRoiBps inmutable post-creación |
| Inversión duplicada | Una por inversor por cohorte |
| Reactivación inválida | Cohorte completada no puede reactivarse |
| Distribución incorrecta | Solo RevenueRouter puede marcar recuperación |

### Invariantes

1. ROI objetivo NUNCA puede cambiar después de creación
2. Un inversor solo puede tener una inversión por cohorte
3. Cohortes que alcanzaron ROI no pueden reactivarse
4. Solo RevenueRouter actualiza recovered
5. SBT INVESTMENT permanece aunque cohorte complete

---

## Diferencias con Otros Gestores

| Aspecto | InvestmentCohortManager | PositionManager | Engagements |
|---------|-------------------------|-----------------|-------------|
| SBT | INVESTMENT | POSITION → ROLE | WORK |
| Verificación | Gobernanza | Un verificador | Panel M-de-N |
| Ingresos | Participación ROI-limitada | Participación continua | Pago único |
| Finalización | Auto al ROI objetivo | Cierre explícito | Automática |
| Capital | Requiere inversión | Sin capital | Sin capital |

---

## Integración

```
InvestmentCohortManager
    ├── CohortRegistry (almacenamiento cohortes)
    ├── ValuableActionRegistry (emisión SBT)
    │   └── ValuableActionSBT (almacenamiento)
    ├── CommunityToken (recepción capital)
    └── RevenueRouter (notificación recuperación)
```
