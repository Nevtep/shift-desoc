# Contrato CommerceDisputes

## 🎯 Propósito y Función

El contrato **CommerceDisputes** proporciona un sistema dedicado de resolución de disputas para transacciones comerciales dentro del ecosistema Shift DeSoc, manejando específicamente disputas de los módulos Marketplace y HousingManager. A diferencia del contrato Compromisos (que maneja verificación de trabajo), CommerceDisputes se enfoca en disputas de transacciones comprador-vendedor con resolución de escrow.

**Separación Clave de Responsabilidades:**
- **Contrato Compromisos**: Verificación de trabajo y completación de ValuableAction
- **CommerceDisputes**: Resolución de disputas de transacciones comerciales (órdenes, reservaciones)

Esta separación asegura que la resolución de disputas comerciales no interfiera con el sistema de verificación de trabajo y permite flujos de trabajo especializados apropiados para cada dominio.

## 🏗️ Arquitectura Central

### Estructuras de Datos

```solidity
enum DisputeType {
    MARKETPLACE_ORDER,      // Disputa sobre orden de servicio en marketplace
    HOUSING_RESERVATION     // Disputa sobre reservación de vivienda
}

enum DisputeOutcome {
    NONE,                   // Aún no decidido
    REFUND_BUYER,          // Reembolso completo al comprador
    PAY_SELLER             // Pago completo al vendedor
}

enum DisputeStatus {
    OPEN,                   // Esperando resolución
    RESOLVED,              // Resultado decidido y ejecutado
    CANCELLED              // Disputa cancelada (raro)
}

struct Dispute {
    uint256 disputeId;
    uint256 communityId;
    DisputeType disputeType;
    uint256 relatedId;      // orderId o reservationId
    address buyer;
    address seller;
    uint256 amount;         // Cantidad en escrow
    string evidenceURI;     // Referencia de evidencia IPFS
    DisputeOutcome outcome;
    DisputeStatus status;
    uint64 createdAt;
    uint64 resolvedAt;
}
```

### Gestión de Estado

```solidity
// Almacenamiento de disputas
mapping(uint256 => Dispute) public disputes;
uint256 public nextDisputeId;

// Control de acceso
address public owner;
address public disputeReceiver;                      // Marketplace o contrato receptor

// Prevenir disputas duplicadas
mapping(DisputeType => mapping(uint256 => uint256)) public activeDisputeFor;
```

## ⚙️ Funciones Clave y Lógica

### Apertura de Disputas

```solidity
function openDispute(
    uint256 communityId,
    DisputeType disputeType,
    uint256 relatedId,
    address buyer,
    address seller,
    uint256 amount,
    string calldata evidenceURI
) external restricted returns (uint256 disputeId)
```

**Proceso:**
1. AccessManager aplica el rol de llamador (Marketplace, HousingManager)
2. Verificar que no existe disputa duplicada para este recurso
3. Crear nueva disputa con estado OPEN
4. Rastrear como disputa activa para el recurso
5. Emitir evento `DisputeOpened`

**Ejemplo de Uso (Marketplace):**
```solidity
// Comprador abre disputa sobre orden
uint256 disputeId = commerceDisputes.openDispute(
    communityId,
    DisputeType.MARKETPLACE_ORDER,
    orderId,
    buyer,
    seller,
    orderAmount,
    evidenceIPFSHash
);
```

### Resolución de Disputas

```solidity
function finalizeDispute(
    uint256 disputeId,
    DisputeOutcome outcome
) external onlyOwner
```

**Implementación MVP:**
- Resolución solo por admin (owner decide resultado)
- Resultados binarios: REFUND_BUYER o PAY_SELLER
- Callbacks a contrato receptor para ejecutar decisión económica

**Mejora Futura:**
Integración con VerifierManager para resolución basada en jurados:
```solidity
// FUTURO: Resolución basada en verificadores
function submitDisputeVote(uint256 disputeId, DisputeOutcome vote) external onlyVerifier
function tallyDisputeVotes(uint256 disputeId) internal returns (DisputeOutcome)
```

### Callbacks de Disputas

El contrato usa la interfaz `IDisputeReceiver` para notificar a los módulos de la resolución:

```solidity
interface IDisputeReceiver {
    function onDisputeResolved(uint256 disputeId, uint8 outcome) external;
}
```

**Flujo de Trabajo:**
1. CommerceDisputes resuelve disputa con resultado
2. Llama `disputeReceiver.onDisputeResolved(disputeId, outcome)`
3. Receptor (Marketplace) ejecuta acción económica:
   - `REFUND_BUYER`: Devolver fondos en escrow al comprador
   - `PAY_SELLER`: Liberar pago al vendedor vía RevenueRouter

## 🛡️ Características de Seguridad

### Control de Acceso

```solidity
modifier onlyOwner() {
    if (msg.sender != owner) revert UnauthorizedCaller();
    _;
}

modifier onlyAuthorized() {
    if (!authorizedCallers[msg.sender]) revert UnauthorizedCaller();
    _;
}
```

**Modelo de Seguridad de Tres Niveles:**
1. **Owner**: Puede finalizar disputas, gestionar llamadores autorizados, establecer receptor
2. **Llamadores Autorizados**: Módulos (Marketplace, HousingManager) pueden abrir disputas
3. **Contrato Receptor**: Ejecuta resultados económicos vía callback

### Prevención de Duplicados

```solidity
// Previene múltiples disputas para el mismo recurso
uint256 existing = activeDisputeFor[disputeType][relatedId];
if (existing != 0 && disputes[existing].status == DisputeStatus.OPEN) {
    revert DisputeAlreadyExists(existing);
}
```

**Justificación:** Solo una disputa activa por orden/reservación a la vez para prevenir confusión y doble procesamiento.

### Inmutabilidad de Evidencia

- URI de evidencia almacenada on-chain (hash IPFS)
- No puede ser modificada después de la creación de disputa
- Asegura resolución transparente basada en evidencia original

## 🔗 Puntos de Integración

### Integración con Marketplace

```solidity
contract Marketplace is IDisputeReceiver {
    CommerceDisputes public disputes;
    
    // Abrir disputa cuando comprador se queja
    function openOrderDispute(uint256 orderId, string calldata evidenceURI) external {
        Order memory order = orders[orderId];
        require(msg.sender == order.buyer, "Solo comprador puede disputar");
        
        disputes.openDispute(
            order.communityId,
            DisputeType.MARKETPLACE_ORDER,
            orderId,
            order.buyer,
            order.seller,
            order.price,
            evidenceURI
        );
    }
    
    // Callback desde CommerceDisputes
    function onDisputeResolved(uint256 disputeId, uint8 outcome) external override {
        require(msg.sender == address(disputes), "Solo contrato disputes");
        
        Dispute memory dispute = disputes.getDispute(disputeId);
        Order storage order = orders[dispute.relatedId];
        
        if (outcome == 1) { // REFUND_BUYER
            // Devolver fondos en escrow al comprador
            communityToken.transfer(dispute.buyer, dispute.amount);
        } else if (outcome == 2) { // PAY_SELLER
            // Liberar pago al vendedor vía RevenueRouter
            revenueRouter.distributeSaleRevenue(dispute.amount, dispute.seller);
        }
        
        order.status = OrderStatus.DISPUTED_RESOLVED;
    }
}
```

### Integración con HousingManager

```solidity
contract HousingManager is IDisputeReceiver {
    // Patrón similar para disputas de reservaciones de vivienda
    function openReservationDispute(uint256 reservationId, string calldata evidenceURI) external {
        // Abrir disputa para reservación de vivienda
    }
    
    function onDisputeResolved(uint256 disputeId, uint8 outcome) external override {
        // Manejar resolución de disputa de vivienda
    }
}
```

## 📊 Modelo Económico

### Flujo de Escrow

```
Compra del Comprador → Escrow Retenido → Disputa Abierta
                                              ↓
                                Decisión de Resolución Admin
                                              ↓
                          ┌───────────────────┴───────────────────┐
                          ↓                                       ↓
                    REFUND_BUYER                            PAY_SELLER
                          ↓                                       ↓
                Fondos → Comprador                      Fondos → RevenueRouter
                                                                  ↓
                                                    Distribuido según revenueSplit
```

**Nota de Seguridad:** Los fondos permanecen en escrow (retenidos por Marketplace/HousingManager) hasta la resolución de disputa, previniendo retiros fraudulentos durante el período de disputa.

## 🎛️ Ejemplos de Configuración

### Configuración Inicial

```typescript
// Desplegar CommerceDisputes
const disputes = await CommerceDisputes.deploy(governanceAddress);

// Autorizar Marketplace para abrir disputas
// AccessManager
bytes4[] memory disputeCaller = new bytes4[](1);
disputeCaller[0] = disputes.openDispute.selector;
accessManager.setTargetFunctionRole(address(disputes), disputeCaller, Roles.COMMERCE_DISPUTES_CALLER_ROLE);
accessManager.grantRole(Roles.COMMERCE_DISPUTES_CALLER_ROLE, marketplaceAddress, 0);
accessManager.grantRole(Roles.COMMERCE_DISPUTES_CALLER_ROLE, housingManagerAddress, 0);

// Establecer Marketplace como receptor de disputas
await disputes.setDisputeReceiver(marketplaceAddress);
```

### Flujo de Trabajo de Resolución de Disputas

```typescript
// 1. Comprador abre disputa a través de UI de Marketplace
await marketplace.openOrderDispute(orderId, evidenceIPFSHash);

// 2. Admin revisa evidencia off-chain
const dispute = await disputes.getDispute(disputeId);
const evidence = await ipfs.cat(dispute.evidenceURI);

// 3. Admin decide resultado
if (evidenceSupportsRefund) {
    await disputes.finalizeDispute(disputeId, DisputeOutcome.REFUND_BUYER);
} else {
    await disputes.finalizeDispute(disputeId, DisputeOutcome.PAY_SELLER);
}

// 4. Marketplace ejecuta resultado automáticamente vía callback
```

## 🚀 Características Avanzadas

### Mejoras Futuras (Post-MVP)

#### Resolución Basada en Verificadores

```solidity
// FUTURO: Resolución democrática de disputas
struct DisputeVoting {
    mapping(address => DisputeOutcome) votes;
    uint256 refundVotes;
    uint256 paySellerVotes;
    uint64 votingDeadline;
}

function submitDisputeVote(uint256 disputeId, DisputeOutcome vote) external onlyVerifier {
    // Verificadores votan sobre resultado
    // Integración con VerifierManager para resolución M-de-N
}
```

#### Resultados Parciales

```solidity
enum DisputeOutcome {
    NONE,
    REFUND_BUYER,
    PAY_SELLER,
    SPLIT_50_50,           // 50% reembolso, 50% al vendedor
    SPLIT_CUSTOM           // División de porcentaje personalizado
}

struct CustomSplit {
    uint256 buyerPercentage;  // Puntos base
    uint256 sellerPercentage; // Puntos base
}
```

#### Mecanismo de Apelación

```solidity
function appealDispute(uint256 disputeId, string calldata appealEvidenceURI) external payable {
    // Apelar a autoridad superior (gobernanza)
    // Requiere tarifa de apelación (previene spam)
}
```

#### Auto-Resolución Basada en Tiempo

```solidity
function autoResolveExpiredDispute(uint256 disputeId) external {
    // Si el vendedor no responde dentro de X días, auto-reembolsar al comprador
    // Previene bloqueo indefinido de escrow
}
```

## 🔍 Valor de Negocio

### Para Compradores

- **Protección**: El escrow asegura que los fondos no se liberen hasta que el servicio sea entregado
- **Resolución Justa**: Proceso de disputa independiente para transacciones insatisfactorias
- **Basado en Evidencia**: La evidencia IPFS asegura toma de decisiones transparente

### Para Vendedores

- **Garantía de Pago**: La entrega legítima de servicio asegura liberación de pago
- **Protección de Reputación**: Disputas falsas pueden ser defendidas con evidencia
- **Resolución Rápida**: Proceso de disputa claro previene demoras en pagos

### Para Comunidades

- **Infraestructura de Confianza**: Habilita comercio sin intermediarios centralizados
- **Seguridad Económica**: Protege tesorería comunitaria del fraude
- **Integración de Gobernanza**: Futura resolución basada en verificadores alinea con valores DAO

### Ventajas Competitivas

**vs Servicios de Escrow Tradicionales:**
- Descentralizado (sin tarifas de intermediario)
- Rastro de evidencia transparente
- Integración de gobernanza comunitaria
- Resultados programables

**vs Otros Marketplaces Web3:**
- Integrado con sistema de verificación de trabajo
- Manejo de disputas específico por comunidad
- Opciones de resultado flexibles (futuro)
- Camino de resolución democrática (futuro)

## 📝 Resumen

CommerceDisputes proporciona **infraestructura esencial para comercio confiable** dentro de las comunidades Shift DeSoc. Al separar disputas comerciales de verificación de trabajo, el sistema mantiene claridad mientras habilita mejoras futuras como resolución basada en verificadores, resultados parciales y apelaciones de gobernanza.

**Estado Actual:** MVP con resolución de admin
**Siguiente Fase:** Integración de verificadores para resolución democrática de disputas
**Visión a Largo Plazo:** Resolución de disputas completamente autónoma con revisión de evidencia asistida por IA y supervisión de gobernanza

Este contrato demuestra cómo la **tecnología blockchain habilita comercio sin confianza** reemplazando servicios de escrow centralizados con mecanismos de resolución de disputas transparentes y programables que se alinean con los valores comunitarios.
