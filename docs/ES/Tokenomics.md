# Tokenomics de Shift

Este documento describe la economía de tokens completa de Shift DeSoc, incluyendo tipos de tokens, mecánicas de distribución, flujos de ingresos y sistema de cohortes de inversión.

---

## Resumen de Tokens

Shift utiliza un sistema multi-token donde cada token cumple una función específica:

| Token | Tipo | Propósito | Transferible |
|-------|------|-----------|--------------|
| **MembershipTokenERC20Votes** | ERC-20 + Votes | Poder de gobernanza | ✅ Sí (con delegación) |
| **CommunityToken** | ERC-20 | Pagos/Salarios | ✅ Sí |
| **ValuableActionSBT** | ERC-721 | Reputación/Credenciales | ❌ No (soulbound) |
| **VerifierPowerToken1155** | ERC-1155 | Poder de verificación | ❌ No |

---

## Token de Gobernanza (MembershipToken)

### Principio Central

> **"El poder de gobernanza se GANA, no se compra"**

MembershipToken representa el poder de gobernanza comunitaria ganado exclusivamente a través de trabajo verificado.

### Mecánicas de Acuñación

```solidity
// ÚNICA forma de obtener tokens de gobernanza
function onClaimApproved(worker, valuableActionId) internal {
    ValuableAction memory va = registry.getAction(valuableActionId);
    membershipToken.mint(worker, va.membershipTokenReward, "claim-approved");
}
```

**Flujo de Acuñación**:
1. Trabajador envía Compromiso con evidencia
2. Panel de verificadores M-de-N aprueba
3. Sistema acuña MembershipTokens
4. Trabajador ahora puede votar o delegar

### Lo que NO Acuña Tokens

- ❌ Comprar con ETH/USDC
- ❌ Staking o bonding
- ❌ Airdrops o distribuciones gratuitas
- ❌ Inversión en la comunidad
- ❌ Transferencias de otros usuarios (aunque es transferible)

### Delegación de Votos

```solidity
// Fluido democrático habilitado
function delegate(address delegatee) public;
function getPastVotes(address account, uint256 blockNumber) → uint256;
```

**Características**:
- Auto-delegación por defecto
- Delegar a expertos en la comunidad
- Snapshots históricos previenen manipulación
- Poder de voto se snapshota al crear propuesta

### Límites de Concentración

Para prevenir plutocracia, la gobernanza puede establecer:
- Límites máximos de poder de voto por dirección
- Requisitos de diversidad en propuestas
- Umbrales de quórum que favorecen participación amplia

---

## Token de Pagos (CommunityToken)

### Mecánica de Respaldo 1:1

CommunityToken es un stablecoin respaldado por USDC con transparencia completa.

```solidity
// Acuñación: Depositar USDC, obtener CommunityToken
function mint(uint256 usdcAmount) external {
    USDC.transferFrom(msg.sender, address(this), usdcAmount);
    _mint(msg.sender, usdcAmount);
}

// Redención: Quemar CommunityToken, obtener USDC
function redeem(uint256 tokenAmount) external {
    _burn(msg.sender, tokenAmount);
    USDC.transfer(msg.sender, tokenAmount);
}
```

### Casos de Uso

| Uso | Descripción |
|-----|-------------|
| **Pagos de Período** | Compensación de trabajo basada en tiempo |
| **Recompensas de Compromisos** | Bonus por completar ValuableActions |
| **Reservaciones de Vivienda** | Pago por co-vivienda |
| **Compras en Marketplace** | Bienes y servicios |
| **Participación de Inversores** | Inversión comunitaria |

### Seguridad de Tesorería

```solidity
// Controles de retiro de tesorería
function withdrawFromTreasury(
    address recipient,
    uint256 amount,
    string calldata reason
) external onlyRole(TREASURY_ROLE) whenNotPaused {
    // Aplicar límites de TreasuryAdapter
}
```

**Protecciones**:
- Solo TREASURY_ROLE puede retirar
- Pausa de emergencia disponible
- Retiro de emergencia con timelock
- Ratio de respaldo siempre verificable

---

## Tokens de Reputación (ValuableActionSBT)

### Sistema de 5 Tipos

Tokens soulbound que representan todas las contribuciones verificadas:

```solidity
enum TokenKind {
    WORK,        // Compromiso de trabajo único completado
    ROLE,        // Rol pasado certificado (de cierre de Posición)
    CREDENTIAL,  // Certificación de curso/formación
    POSITION,    // Rol activo en curso
    INVESTMENT   // Membresía de cohorte de inversión
}
```

### Acuñación por Tipo

| Tipo | Acuñador | Trigger |
|------|----------|---------|
| `WORK` | Engagements | Compromiso aprobado |
| `ROLE` | PositionManager | Posición cerrada con SUCCESS |
| `CREDENTIAL` | CredentialManager | Aplicación aprobada |
| `POSITION` | PositionManager | Aplicación aprobada |
| `INVESTMENT` | InvestmentCohortManager | Inversión registrada |

### WorkerPoints y Decaimiento

```solidity
struct WorkerPointsInfo {
    uint256 cumulativePoints;   // Puntos históricos totales
    uint256 lastUpdateTime;     // Para cálculo de decaimiento
    uint256 decayRate;          // Puntos perdidos por segundo
}

// EMA (Exponential Moving Average) para relevancia reciente
function getActivePoints(address worker) → uint256 {
    return calculateEMA(workerInfo[worker], block.timestamp);
}
```

**Propósito del Decaimiento**:
- Prioriza contribuciones recientes
- Previene acumulación sin actividad
- Mantiene verificadores activos relevantes

### Revocación

```solidity
// Solo gobernanza puede revocar SBTs
function revoke(uint256 tokenId, string calldata reason) 
    external 
    onlyRole(GOVERNANCE_ROLE);
```

**Razones de Revocación**:
- Fraude descubierto post-aprobación
- Violación de términos comunitarios
- Decisión de gobernanza

---

## Token de Verificador (VerifierPowerToken1155)

### Diseño Por Comunidad

```solidity
// ERC-1155 donde tokenId = communityId
function balanceOf(address verifier, uint256 communityId) → uint256 power;

// Solo timelock puede modificar poder
function mint(address to, uint256 communityId, uint256 amount) onlyTimelock;
function burn(address from, uint256 communityId, uint256 amount) onlyTimelock;
```

### Características

| Propiedad | Valor |
|-----------|-------|
| Transferible | ❌ No |
| Stakeable | ❌ No |
| Comprable | ❌ No |
| Otorgable | ✅ Solo via gobernanza |
| Revocable | ✅ Solo via gobernanza |

### Uso en Selección de Panel

```solidity
// VerifierManager usa poder para selección
function selectPanel(uint256 communityId, uint256 panelSize) → address[] {
    // Peso = balanceOf(verifier, communityId)
    // Selección aleatoria ponderada
}
```

---

## Sistema de Distribución de Ingresos

### RevenueRouter: Cascada de Distribución

Todos los ingresos fluyen a través del RevenueRouter con orden determinístico:

```
Ingresos Entrantes
       ↓
┌──────────────────┐
│ 1. Pool Trabajadores │ → Porción garantizada (ej: 40%)
└──────────────────┘
       ↓
┌──────────────────┐
│ 2. Reserva Tesorería │ → Operaciones comunitarias
└──────────────────┘
       ↓
┌──────────────────┐
│ 3. Pool Inversores │ → Distribuido a cohortes activas
└──────────────────┘
       ↓
┌──────────────────┐
│ 4. Excedente      │ → Según política de gobernanza
└──────────────────┘
```

### Configuración de Splits

```solidity
// Leído desde ParamController
struct RevenueSplit {
    uint16 workersBps;     // ej: 4000 = 40%
    uint16 treasuryBps;    // ej: 3000 = 30%
    uint16 investorsBps;   // ej: 3000 = 30%
}

// Total debe = 10000 bps (100%)
```

### Función de Ruteo

```solidity
function routeRevenue(
    uint256 communityId,
    address token,
    uint256 amount
) external onlyRole(DISTRIBUTOR_ROLE) {
    RevenueSplit memory split = paramController.getRevenueSplit(communityId);
    
    // 1. Trabajadores
    uint256 workersShare = (amount * split.workersBps) / 10000;
    _distributeToWorkers(communityId, token, workersShare);
    
    // 2. Tesorería
    uint256 treasuryShare = (amount * split.treasuryBps) / 10000;
    _sendToTreasury(communityId, token, treasuryShare);
    
    // 3. Inversores
    uint256 investorsShare = (amount * split.investorsBps) / 10000;
    _distributeToCohorts(communityId, token, investorsShare);
}
```

---

## Sistema de Cohortes de Inversión

### Concepto

Una **cohorte** es un grupo de inversores que entraron en la misma ronda de financiación con términos idénticos.

### Estructura de Cohorte

```solidity
struct Cohort {
    uint256 id;
    uint256 communityId;
    uint16 targetRoiBps;      // ej: 15000 = 150% ROI objetivo
    uint32 priorityWeight;    // 1-1000, mayor = más prioridad
    uint256 investedTotal;    // Capital total invertido
    uint256 recoveredTotal;   // Ingresos distribuidos hasta ahora
    bool active;              // Auto-desactiva cuando ROI alcanzado
    bytes32 termsHash;        // Hash de términos inmutables
}
```

### ROI Objetivo Inmutable

```solidity
// El ROI objetivo NUNCA puede cambiar después de creación
function createCohort(
    uint256 communityId,
    uint16 targetRoiBps,      // Bloqueado permanentemente
    uint32 priorityWeight,
    bytes32 termsHash,
    uint64 startAt,
    uint64 endAt,
    bool active
) external returns (uint256 cohortId);
```

**Ejemplo**:
- Cohorte con 150% ROI objetivo
- Inversión total: 100,000 USDC
- Objetivo de recuperación: 150,000 USDC
- Cuando recoveredTotal ≥ 150,000: cohorte se auto-desactiva

### Prioridad por Peso

```solidity
// Distribución proporcional al peso
function _distributeToCohorts(uint256 communityId, address token, uint256 amount) {
    Cohort[] memory activeCohorts = getActiveCohorts(communityId);
    uint256 totalWeight = sumWeights(activeCohorts);
    
    for (uint i = 0; i < activeCohorts.length; i++) {
        uint256 share = (amount * activeCohorts[i].priorityWeight) / totalWeight;
        _distributeToInvestors(activeCohorts[i].id, token, share);
    }
}
```

### Ciclo de Vida de Inversión

```
1. Comunidad crea Cohorte
   └─→ Define ROI objetivo, peso, términos

2. Inversor contribuye capital
   └─→ InvestmentCohortManager.issueInvestment()
   └─→ SBT INVESTMENT acuñado
   └─→ Peso del inversor registrado

3. Ingresos generados
   └─→ RevenueRouter distribuye a cohortes activas
   └─→ Inversores reciben proporcionalmente a peso

4. ROI objetivo alcanzado
   └─→ Cohorte auto-desactiva
   └─→ Futuros ingresos van a otras cohortes/excedente

5. SBT INVESTMENT permanece (historial)
```

### Tracking de Inversores

```solidity
// Registro individual de inversor
struct InvestorInfo {
    uint256 cohortId;
    uint256 invested;         // Capital contribuido
    uint256 weight;           // Peso en distribución (puede diferir de invested)
    uint256 recovered;        // Ingresos recibidos hasta ahora
    uint256 tokenId;          // SBT INVESTMENT
}
```

---

## Guardrails de Tesorería

### TreasuryAdapter Limits

```solidity
// Límites codificados en TreasuryAdapter
uint256 public constant MAX_SPEND_FREQUENCY = 1 weeks;
uint256 public constant MAX_SPEND_PERCENT = 1000; // 10% en bps

// Tokens permitidos
mapping(address => bool) public allowedTokens; // Solo stablecoins

// Tracking de gasto
mapping(uint256 => uint256) public lastSpendTime; // por comunidad
```

### Ejecución de Pago

```solidity
function executePayment(
    address token,
    address to,
    uint256 amount,
    string calldata reasonURI
) external onlyTimelock whenNotPaused {
    require(allowedTokens[token], "Token not allowed");
    require(block.timestamp >= lastSpendTime[communityId] + MAX_SPEND_FREQUENCY, "Too frequent");
    require(amount <= getMaxSpendAmount(token), "Exceeds 10%");
    
    lastSpendTime[communityId] = block.timestamp;
    _executeViaModule(token, to, amount);
    
    emit PaymentExecuted(token, to, amount, reasonURI);
}
```

### Caminos de Emergencia

```solidity
// Pausa inmediata (gobernanza o guardian)
function pause() external onlyGovernorOrGuardian;
function unpause() external onlyGovernor; // Solo gobernanza puede reanudar

// Retiro de emergencia con destino limitado
function emergencyWithdraw(
    address token,
    address to,          // Debe ser dirección aprobada
    uint256 amount
) external onlyGovernorOrGuardian;
```

---

## Flujos Económicos Completos

### Flujo 1: Trabajo → Recompensa

```
Trabajador envía Compromiso
        ↓
Panel M-de-N verifica
        ↓
┌───────────────────────────────┐
│ Al aprobar:                    │
│ • MembershipToken acuñado      │ → Poder de gobernanza
│ • CommunityToken transferido   │ → Pago
│ • SBT WORK acuñado             │ → Reputación
└───────────────────────────────┘
```

### Flujo 2: Posición → Salario

```
Trabajador recibe Posición
        ↓
PositionManager registra con RevenueRouter
        ↓
Cada período de pago:
┌───────────────────────────────┐
│ RevenueRouter.distributeToWorkers() │
│ • Calcula share por puntos     │
│ • Transfiere CommunityToken    │
└───────────────────────────────┘
```

### Flujo 3: Comercio → Distribución

```
Compra en Marketplace
        ↓
Período de disputa (72h)
        ↓
Liquidación:
┌───────────────────────────────┐
│ RevenueRouter.routeRevenue()   │
│ 1. 40% → Pool trabajadores    │
│ 2. 30% → Tesorería            │
│ 3. 30% → Cohortes inversores  │
└───────────────────────────────┘
```

### Flujo 4: Inversión → ROI

```
Inversor contribuye capital
        ↓
SBT INVESTMENT acuñado
        ↓
Ingresos generados por comunidad
        ↓
Distribución proporcional a peso
        ↓
ROI objetivo alcanzado → Cohorte desactiva
```

---

## Resumen de Seguridad Económica

| Componente | Protección |
|------------|------------|
| MembershipToken | Solo acuñable via compromisos aprobados |
| CommunityToken | Respaldo 1:1 siempre verificable |
| ValuableActionSBT | No transferible, revocable por gobernanza |
| VerifierPowerToken | No transferible, solo timelock modifica |
| RevenueRouter | Splits determinísticos, solo DISTRIBUTOR_ROLE |
| TreasuryAdapter | 1 pago/semana, 10% máx, stablecoins only |
| Cohortes | ROI objetivo inmutable, auto-desactivación |

---

## Invariantes del Sistema

1. **Mérito sobre Capital**: MembershipToken solo de trabajo verificado
2. **Transparencia de Respaldo**: CommunityToken siempre ≥ 1:1 USDC
3. **Distribución Determinística**: RevenueRouter sigue splits exactos
4. **Protección de Inversores**: ROI objetivo inmutable después de creación
5. **Seguridad de Tesorería**: Límites de gasto codificados, no bypasseables
6. **Decaimiento de Reputación**: WorkerPoints incentiva actividad reciente
