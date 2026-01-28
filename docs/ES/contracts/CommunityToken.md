# Contrato CommunityToken

## 🎯 Propósito y Función

El **CommunityToken** implementa un token ERC-20 respaldado 1:1 por USDC que sirve como la moneda estable nativa para comunidades dentro del ecosistema Shift DeSoc. Proporciona liquidez transparente, pagos programables y gestión de tesorería, mientras mantiene estabilidad de precio a través de garantías totales en USDC.

## 🏗️ Arquitectura Central

### Modelo de Respaldo

```solidity
contract CommunityToken is ERC20, ERC20Burnable, AccessControl {
    IERC20 public immutable USDC;
    uint256 public constant BACKING_RATIO = 1e18; // 1:1 respaldo en USDC

    mapping(address => uint256) public reservedFunds;     // Fondos bloqueados para pagos
    mapping(bytes32 => bool) public completedPayments;   // Prevención de doble gasto

    uint256 public totalReserved;                         // Total de fondos reservados
    uint256 public emergencyWithdrawDelay = 7 days;      // Retraso de seguridad
}
```

### Invariantes del Sistema

- **Respaldo Total**: `totalSupply() ≤ USDC.balanceOf(address(this)) - totalReserved`
- **Reservas Válidas**: `totalReserved ≤ USDC.balanceOf(address(this))`
- **Liquidez Garantizada**: Siempre suficiente USDC para honrar canjes de tokens

## ⚙️ Funciones y Lógica Clave

### Acuñación y Canje

```solidity
function mint(uint256 usdcAmount) external {
    require(usdcAmount > 0, "Monto inválido");

    // Transferir USDC como garantía
    USDC.transferFrom(msg.sender, address(this), usdcAmount);

    // Acuñar tokens comunitarios 1:1
    _mint(msg.sender, usdcAmount);

    emit TokensMinted(msg.sender, usdcAmount);
}

function redeem(uint256 tokenAmount) external {
    require(tokenAmount > 0, "Monto inválido");
    require(balanceOf(msg.sender) >= tokenAmount, "Saldo insuficiente");

    // Verificar liquidez disponible
    uint256 availableLiquidity = USDC.balanceOf(address(this)) - totalReserved;
    require(availableLiquidity >= tokenAmount, "Liquidez insuficiente");

    // Quemar tokens y transferir USDC
    _burn(msg.sender, tokenAmount);
    USDC.transfer(msg.sender, tokenAmount);

    emit TokensRedeemed(msg.sender, tokenAmount);
}
```

### Sistema de Pagos Reservados

```solidity
function reserveFunds(bytes32 paymentId, uint256 amount, address recipient)
    external onlyPaymentProcessor {
    require(!completedPayments[paymentId], "Pago ya procesado");
    require(amount > 0 && recipient != address(0), "Parámetros inválidos");

    // Verificar fondos disponibles
    uint256 availableFunds = USDC.balanceOf(address(this)) - totalReserved;
    require(availableFunds >= amount, "Fondos insuficientes");

    // Reservar fondos para pago
    reservedFunds[recipient] += amount;
    totalReserved += amount;

    emit FundsReserved(paymentId, recipient, amount);
}

function executePayment(bytes32 paymentId, address recipient, uint256 amount)
    external onlyPaymentProcessor {
    require(!completedPayments[paymentId], "Pago ya procesado");
    require(reservedFunds[recipient] >= amount, "Reserva insuficiente");

    // Ejecutar pago
    reservedFunds[recipient] -= amount;
    totalReserved -= amount;
    completedPayments[paymentId] = true;

    USDC.transfer(recipient, amount);

    emit PaymentExecuted(paymentId, recipient, amount);
}
```

## 🛡️ Características de Seguridad

### Gestión de Acceso

```solidity
bytes32 public constant PAYMENT_PROCESSOR_ROLE = keccak256("PAYMENT_PROCESSOR_ROLE");
bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

modifier onlyPaymentProcessor() {
    require(hasRole(PAYMENT_PROCESSOR_ROLE, msg.sender), "No autorizado");
    _;
}
```

**Roles de Seguridad**:

- `PAYMENT_PROCESSOR_ROLE`: Contratos autorizados (Compromisos, RevenueRouter) para procesar pagos
- `EMERGENCY_ROLE`: Capacidades de pausa de emergencia y recuperación de fondos
- `DEFAULT_ADMIN_ROLE`: Gestión de roles y actualización de parámetros

### Mecanismos de Protección

```solidity
function emergencyWithdraw(address token, uint256 amount)
    external onlyRole(EMERGENCY_ROLE) {
    require(block.timestamp >= lastEmergencyTime + emergencyWithdrawDelay,
            "En período de espera de emergencia");

    // Solo permitir retirada de tokens no-USDC o exceso de USDC
    if (token == address(USDC)) {
        uint256 requiredUSDC = totalSupply() + totalReserved;
        uint256 currentUSDC = USDC.balanceOf(address(this));
        require(currentUSDC > requiredUSDC && amount <= currentUSDC - requiredUSDC,
                "No se puede retirar USDC requerido");
    }

    IERC20(token).transfer(msg.sender, amount);
    emit EmergencyWithdraw(token, amount);
}
```

## 🔗 Puntos de Integración

### Con Sistema Compromisos

```solidity
// Contrato Compromisos usa pagos reservados para pagos de trabajadores
function approveWorkerEngagement(uint256 engagementId) external {
    bytes32 paymentId = keccak256(abi.encodePacked("engagement", engagementId));
    uint256 reward = engagements[engagementId].reward;
    address worker = engagements[engagementId].worker;

    // Reservar fondos inmediatamente al aprobar
    communityToken.reserveFunds(paymentId, reward, worker);

    // Ejecutar pago después de completar verificación
    communityToken.executePayment(paymentId, worker, reward);
}
```

### Con RevenueRouter

```solidity
// RevenueRouter distribuye ingresos usando transferencias directas
function distributeRevenue(uint256 totalRevenue) external {
    uint256 workerShare = (totalRevenue * workerSplit) / 10000;
    uint256 treasuryShare = (totalRevenue * treasurySplit) / 10000;
    uint256 investorShare = totalRevenue - workerShare - treasuryShare;

    communityToken.transfer(workerPool, workerShare);
    communityToken.transfer(treasury, treasuryShare);
    communityToken.transfer(investorPool, investorShare);
}
```

## 📊 Modelo Económico

### Flujos de Valor

**Entrada de Liquidez**:

1. Miembros de comunidad intercambian USDC por CommunityTokens
2. Inversores aportan USDC para participación en ingresos
3. Clientes pagan servicios de comunidad en USDC

**Distribución de Pagos**:

1. Sistema de verificación de trabajo paga recompensas a trabajadores
2. División de ingresos automática entre trabajadores/tesorería/inversores
3. Servicios de comunidad (vivienda, marketplace) procesados a través de tokens

### Estabilidad de Precio

```solidity
// Siempre intercambiable 1:1 con USDC
function getExchangeRate() external pure returns (uint256) {
    return 1e18; // Siempre 1.0
}

function getBackingRatio() external view returns (uint256) {
    uint256 totalBacking = USDC.balanceOf(address(this));
    return totalSupply() > 0 ? (totalBacking * 1e18) / totalSupply() : 1e18;
}
```

## 🎛️ Ejemplos de Configuración

### Configuración Inicial de Comunidad

```solidity
// Desplegar CommunityToken para nueva comunidad
CommunityToken token = new CommunityToken(
    "DevCommunity Token",
    "DEVC",
    USDC_ADDRESS,
    communityAdmin
);

// Configurar procesadores de pago autorizados
token.grantRole(PAYMENT_PROCESSOR_ROLE, engagementsContract);
token.grantRole(PAYMENT_PROCESSOR_ROLE, revenueRouter);
token.grantRole(EMERGENCY_ROLE, emergencyMultisig);

// Liquidez inicial de bootstrap
token.mint(100000e6); // Acuñar con 100k USDC
```

### Integración de Pagos

```solidity
// Procesamiento de pago de trabajo verificado
function processWorkerPayment(address worker, uint256 amount) external {
    bytes32 paymentId = keccak256(abi.encodePacked(
        "worker_payment",
        worker,
        block.timestamp
    ));

    // Sistema de dos fases para pagos grandes
    communityToken.reserveFunds(paymentId, amount, worker);

    // Verificación adicional para pagos grandes
    if (amount > LARGE_PAYMENT_THRESHOLD) {
        require(verifyLargePayment(worker, amount), "Verificación de pago fallida");
    }

    communityToken.executePayment(paymentId, worker, amount);
}
```

## 🚀 Características Avanzadas

### Análisis de Tesorería

**Métricas de Liquidez**:

- Ratio de respaldo en tiempo real vs suministro de tokens
- Utilización de reservas y patrones de flujo de efectivo
- Análisis de distribución de tenencia de tokens
- Proyección de requisitos de liquidez

### Integración DeFi

**Estrategias de Rendimiento**:

```solidity
function investIdleFunds(address yieldProtocol, uint256 amount)
    external onlyRole(TREASURY_MANAGER_ROLE) {
    uint256 availableFunds = USDC.balanceOf(address(this)) - totalReserved - minLiquidityBuffer;
    require(amount <= availableFunds, "Fondos insuficientes para inversión");

    // Invertir exceso de USDC en protocolos de rendimiento aprobados
    USDC.approve(yieldProtocol, amount);
    IYieldProtocol(yieldProtocol).deposit(amount);
}
```

**Gestión de Riesgo**:

- Buffer de liquidez mínimo para canjes inmediatos
- Lista blanca de protocolos DeFi para inversión de excesos
- Límites de exposición y diversificación automática

### Capacidades de Gobernanza

**Ajustes de Parámetros**:

- Modificación de retrasos de retiro de emergencia
- Actualización de buffers de liquidez mínima
- Gestión de roles de procesador de pagos autorizado

El CommunityToken proporciona la infraestructura económica estable requerida para el ecosistema Shift DeSoc, permitiendo pagos confiables a trabajadores, gestión de tesorería transparente y liquidez garantizada para todos los participantes.
