# TreasuryAdapter · Module Specification (v1)

**Status:** Draft  
**Scope:** Community Treasury Spending Policy + Safe Integration  
**Depends on:** Safe (Gnosis Safe), ShiftGovernor + Timelock, RequestHub, DraftManager, ParamController, RevenueRouter

---

## 1. Purpose

TreasuryAdapter define la **política de gasto** del tesoro de cada comunidad:

- El tesoro (solo stablecoins) vive en un **Safe** (Gnosis Safe).
- Todos los gastos pasan por **gobernanza on-chain** (ShiftGovernor + Timelock).
- Se aplican **guardrails duros**:
  - Máx. **1 pago por semana**.
  - Máx. **10% del saldo del token** por pago.
- Soporta **pausa de emergencia** y **withdraw de emergencia**.
- Se integra con el flujo social de propuestas:
  - Drafts en `DraftManager`.
  - Discusión / elevación en `RequestHub`.
  - Propuesta formal en `ShiftGovernor` (MembershipToken holders).

---

## 2. Architecture

Por cada comunidad:

- `Safe` (smart contract wallet) = **único holder del tesoro** (solo stablecoins).
- `TreasuryAdapter` = módulo/policy gobernado por ShiftGovernor + Timelock.

Flujo:

1. Un miembro con `MembershipToken` crea un Draft de gasto en `DraftManager`.
2. Se discute y se eleva via `RequestHub` a una Proposal del Governor.
3. Si la Proposal pasa y el Timelock expira, el Timelock ejecuta en `TreasuryAdapter`:
   - `executePayment(token, to, amount, reasonURI)`.

TreasuryAdapter:

- Verifica límites de guardrails.
- Ejecuta la transferencia **desde el Safe** al destinatario usando la API de módulos del Safe.

---

## 3. Core Data & Roles

### 3.1 Estado principal

Para un TreasuryAdapter (por comunidad, o configurado per comunidad):

```solidity
address public safe;                     // Dirección del Safe del tesoro.
mapping(address => bool) public isAllowedStablecoin;

uint256 public lastSpendAt;              // Timestamp del último pago normal ejecutado.

uint256 public constant WEEK = 7 days;
uint256 public constant MAX_SPEND_BPS = 1000; // 10% (1000 / 10_000)
```

- `safe`: smart wallet donde realmente están los fondos (Gnosis Safe).
- `isAllowedStablecoin[token]`:
  - Solo estos tokens pueden ser gastados desde TreasuryAdapter.

### 3.2 Roles

- `onlyGovernorOrTimelock`:
  - Puede llamar `executePayment`.
  - Normalmente será el contrato `TimelockController` conectado al `ShiftGovernor`.
- `onlyGovernorOrGuardian`:
  - Puede llamar `pause` y `emergencyWithdraw`.
  - Guardian puede ser una multi-sig de emergencia designada por la comunidad, o el propio Safe en configuración temprana.
- `onlyGovernor`:
  - Puede hacer `unpause`.
  - Puede cambiar parámetros críticos (en caso de configuración).

---

## 4. Spending Guardrails

### 4.1 Límite de frecuencia: máx. 1 pago por semana

Regla:

- Un pago “normal” (no emergencia) solo puede ejecutarse si:
  - `block.timestamp >= lastSpendAt + WEEK`
- Tras ejecutar:
  - `lastSpendAt = block.timestamp;`

Efecto:

- Aunque haya múltiples propuestas aprobadas, el tesoro **solo puede ejecutar un pago normal por semana** desde este adapter.

### 4.2 Límite de tamaño: máx. 10% por token

Definición:

- Para cada ejecución de pago:
  - `balance = IERC20(token).balanceOf(address(safe));`
  - `require(amount <= balance * MAX_SPEND_BPS / 10_000, "Amount > 10% of token balance");`

Notas:

- Límite se aplica **por stablecoin**, no sobre el total agregado del tesoro.
- Es simple, fácil de testear, y evita que se vacíe un token de golpe.

---

## 5. Main Functions

### 5.1 executePayment

```solidity
function executePayment(
    address token,
    address to,
    uint256 amount,
    string calldata reasonURI
) external onlyGovernorOrTimelock whenNotPaused;
```

**Checks:**

- `require(isAllowedStablecoin[token], "Token not allowed");`
- `require(block.timestamp >= lastSpendAt + WEEK, "Spend too frequent");`
- `uint256 balance = IERC20(token).balanceOf(address(safe));`
- `require(amount <= balance * MAX_SPEND_BPS / 10_000, "Amount > 10%");`
- `require(to != address(0), "Invalid recipient");`
- `require(amount > 0, "Zero amount");`

**Efectos:**

1. `lastSpendAt = block.timestamp;`
2. Construir `data` de transferencia:
   ```solidity
   bytes memory data = abi.encodeWithSelector(
       IERC20(token).transfer.selector,
       to,
       amount
   );
   ```
3. Llamar a la función de módulo del Safe (patrón Zodiac module):
   ```solidity
   bool success = ISafe(safe).execTransactionFromModule(
       token,
       0,
       data,
       Enum.Operation.Call
   );
   require(success, "Safe exec failed");
   ```

*(La firma exacta de `execTransactionFromModule` depende de la versión de Safe usada; Copilot debe importar la interfaz oficial de Safe y usarla.)*

**Event:**

```solidity
event PaymentExecuted(
    address indexed token,
    address indexed to,
    uint256 amount,
    string reasonURI,
    uint256 timestamp
);
```

---

### 5.2 emergencyWithdraw

```solidity
function emergencyWithdraw(
    address token,
    address to,
    uint256 amount
) external onlyGovernorOrGuardian;
```

**Checks:**

- `require(isAllowedStablecoin[token], "Token not allowed");`
- `require(to != address(0), "Invalid recipient");`
- `require(amount > 0, "Zero amount");`
- No límite de frecuencia.
- No límite de 10%.

**Efectos:**

- Ejecutar `transfer` vía Safe exactamente igual que en `executePayment`, pero:
  - Sin actualizar `lastSpendAt`.
  - Sin aplicar `MAX_SPEND_BPS`.

**Event:**

```solidity
event EmergencyWithdrawExecuted(
    address indexed token,
    address indexed to,
    uint256 amount,
    address indexed triggeredBy,
    uint256 timestamp
);
```

Uso típico:

- Mandar fondos a:
  - Otro Safe de backup,
  - Un contrato de migración,
  - O una cuenta de recuperación bajo control de la comunidad.

---

### 5.3 Pausa / unpause

```solidity
function pause() external onlyGovernorOrGuardian;
function unpause() external onlyGovernor;
```

- `whenNotPaused` se aplica a `executePayment`.
- `emergencyWithdraw` puede seguir funcionando en modo pausado (diseño intencional para rescate).

**Event:**

```solidity
event Paused(address indexed triggeredBy);
event Unpaused(address indexed triggeredBy);
```

---

## 6. Allowed Stablecoins Management

TreasuryAdapter mantiene una whitelist de stablecoins por tesoro:

```solidity
function setAllowedStablecoin(address token, bool allowed)
    external
    onlyGovernor;
```

**Checks:**

- `token != address(0)`.
- (Opcional) verificar que `token` esté registrado como stablecoin en ParamController, e.g.:
  - `require(paramController.isStablecoin(token), "Not registered stable");`

**Event:**

```solidity
event StablecoinUpdated(address indexed token, bool allowed);
```

Invariante:

- `executePayment` y `emergencyWithdraw` solo funcionan si `isAllowedStablecoin[token] == true`.

---

## 7. Integration with Governance Flow

### 7.1 Proposals via RequestHub & DraftManager

Flujo social-técnico:

1. Usuario con `MembershipToken` crea un Draft:
   - `reasonURI` apunta a descripción larga (IPFS / off-chain).
   - Incluye parámetros propuestos (`token`, `to`, `amount`).
2. RequestHub permite soporte, debate, y finalmente elevación a “lista para gobernanza”.
3. Se genera una Proposal en `ShiftGovernor` que incluye una acción:
   - `call(TreasuryAdapter.executePayment(token, to, amount, reasonURI))`.
4. Si pasa, el Timelock la ejecuta:
   - Llamando directamente la función en el adapter.

Resultado:

- No hay forma de gastar el tesoro sin:
  - Propuesta → votación → timelock.
- TreasuryAdapter está totalmente subordinado a la gobernanza on-chain.

---

## 8. Invariants & Safety

### 8.1 Invariantes críticas

- Todos los gastos “normales”:
  - Máx. 1/semana (`lastSpendAt`).
  - Máx. 10% del saldo del token en Safe.
- Solo tokens marcados como stablecoins permitidos pueden ser gastados.
- Solo Governor/Timelock puede llamar `executePayment`.
- EmergencyWithdraw solo por Governor/Guardian.
- TreasuryAdapter nunca “posee” fondos significativos:
  - Siempre opera a través del Safe.

### 8.2 Riesgos y mitigaciones

- **Bug en límites / lógica de adapter**:
  - Safe sigue siendo capa de seguridad; podemos:
    - Pausar adapter,
    - Usar EmergencyWithdraw para mover fondos a un Safe nuevo.
- **Captura de gobernanza**:
  - Guardrail on-chain limita el daño por pago (10%).
  - Frequency limit reduce la velocidad de drenaje (1 semana).
- **Errores de configuración de stablecoins**:
  - Se recomienda:
    - Validar tokens contra ParamController.
    - Tener tests que cubran actualización de la whitelist.

---

## 9. Testing Plan (resumen)

### 9.1 Unit tests

- `executePayment`:
  - Falla si:
    - No es stablecoin permitido.
    - No pasó una semana.
    - Monto > 10% balance.
  - Éxito:
    - Llama a `execTransactionFromModule` en Safe con datos correctos.
    - Actualiza `lastSpendAt`.
- `emergencyWithdraw`:
  - Solo roles correctos.
  - Sin límites de 10% ni tiempo.
- `pause` / `unpause`:
  - `executePayment` revierte en pausa.
  - `emergencyWithdraw` sigue funcionando.

### 9.2 Integration-ish tests

- Gobernanza:
  - Propuesta → Timelock → `executePayment` se ejecuta bien.
- Guardrails:
  - Dos propuestas aprobadas seguidas:
    - Solo la primera se puede ejecutar dentro de la misma semana.

---

## 10. Open Questions / Future ADRs

- ¿Debería haber distintos adapters por “bucket” (ops, housing, grants) o uno único con categorías?
- ¿Se necesita un módulo Zodiac Delay extra, además del Timelock, para muchas capas de defensa?
- ¿Se quiere, en el futuro, tracking de gasto semanal acumulado, en vez de 1 pago fijo por semana?

---
