# Contrato Marketplace

## 🎯 Propósito y Función

El contrato Marketplace está diseñado para facilitar **comercio descentralizado dentro de las comunidades Shift DeSoc**, permitiendo a los miembros comprar y vender bienes y servicios usando tokens comunitarios mientras genera ingresos para la tesorería comunitaria a través de tarifas de transacción.

**⚠️ ESTADO ACTUAL: IMPLEMENTACIÓN STUB**

Este contrato es actualmente un marcador de posición mínimo con emisión básica de eventos, planificado para implementación completa en la Fase 2 de la hoja de ruta de desarrollo.

## 🏗️ Arquitectura Planificada

### Estructura de Gestión de Productos

```solidity
// Estructura de implementación planificada
contract Marketplace {
    struct Product {
        uint256 skuId;               // Identificador único de producto
        address seller;              // Vendedor del producto
        address tokenContract;       // Token ERC1155/ERC721 para producto
        uint256 tokenId;            // ID específico del token
        uint256 price;              // Precio en tokens comunitarios
        uint256 priceStable;        // Precio alternativo en USDC
        uint256 quantity;           // Cantidad disponible
        string metadataURI;         // Metadatos del producto (IPFS)
        bool acceptsStable;         // Si acepta pagos USDC
        bool active;                // Disponibilidad del producto
        uint256 createdAt;          // Timestamp de listado
    }

    struct Purchase {
        uint256 purchaseId;         // Identificador único de compra
        uint256 skuId;             // Producto comprado
        address buyer;             // Dirección del comprador
        uint256 quantity;          // Cantidad comprada
        uint256 totalPaid;         // Cantidad total pagada
        address paymentToken;      // Token usado para el pago
        uint256 timestamp;         // Timestamp de compra
        PurchaseStatus status;     // Estado actual
    }

    enum PurchaseStatus {
        PENDING,
        CONFIRMED,
        SHIPPED,
        DELIVERED,
        DISPUTED,
        REFUNDED
    }
}
```

### Estructura de Ingresos y Tarifas

```solidity
// Planificado: Recaudación y distribución de tarifas comunitarias
struct MarketplaceFees {
    uint256 transactionFeeBps;     // Porcentaje de tarifa en puntos base
    uint256 listingFeeBps;         // Tarifa para listar productos
    uint256 disputeFeeBps;         // Tarifa para procesar disputas
    address feeRecipient;          // Destinatario de las tarifas (tesorería comunitaria)
}

struct RevenueDistribution {
    uint256 toSellers;             // Porcentaje para vendedores
    uint256 toCommunity;          // Porcentaje para tesorería comunitaria
    uint256 toWorkers;            // Porcentaje para trabajadores (moderación)
    uint256 toStaking;            // Porcentaje para recompensas de staking
}
```

## ⚙️ Implementación Actual

```solidity
contract Marketplace {
    event ProductListed(
        uint256 indexed skuId,
        address indexed seller,
        uint256 price,
        string metadata
    );

    event ProductPurchased(
        uint256 indexed purchaseId,
        uint256 indexed skuId,
        address indexed buyer,
        uint256 totalPaid
    );

    error NotImplemented();

    // Funciones principales revierten con error de no implementado
    function listProduct(
        address, uint256, uint256, uint256, string calldata, bool
    ) external pure returns (uint256) {
        revert NotImplemented();
    }

    function purchaseProduct(uint256, uint256, address) external pure returns (uint256) {
        revert NotImplemented();
    }
}
```

**Funcionalidad Actual**:

- ✅ Eventos básicos definidos para integración futura
- ❌ Funciones principales revierten con `NotImplemented()`
- ❌ No se soportan transacciones de marketplace
- ❌ Marcador de posición para implementación futura

## 🛡️ Características de Seguridad Planificadas

### Verificación de Productos

- Validación de propiedad de tokens antes del listado
- Verificación de metadatos de productos (anti-spam)
- Moderación comunitaria para productos disputados

### Procesamiento de Pagos

- Integración segura con CommunityToken y USDC
- Protección de escrow para transacciones de alto valor
- Gestión automática de reembolsos para disputas

### Control de Calidad

- Sistema de reputación para vendedores
- Revisiones y calificaciones de compradores
- Moderación basada en WorkerSBT para resolver disputas

## 🏪 Casos de Uso Planificados

### Marketplace de Servicios Digitales

```solidity
// Desarrolladores vendiendo servicios de codificación
Product memory devService = Product({
    skuId: 1,
    seller: developerAddress,
    tokenContract: serviceNFTContract,
    tokenId: 123,
    price: 1000e18,              // 1000 tokens comunitarios
    priceStable: 500e6,          // $500 USDC alternativo
    quantity: 1,                 // Servicio único
    metadataURI: "ipfs://QmDevService...",
    acceptsStable: true,         // Acepta ambos tipos de pago
    active: true,
    createdAt: block.timestamp
});

// Diseñadores vendiendo activos creativos
Product memory designAsset = Product({
    skuId: 2,
    seller: designerAddress,
    tokenContract: artNFTContract,
    tokenId: 456,
    price: 200e18,               // 200 tokens comunitarios
    priceStable: 100e6,          // $100 USDC
    quantity: 10,                // Licencias múltiples disponibles
    metadataURI: "ipfs://QmDesignAsset...",
    acceptsStable: true,
    active: true,
    createdAt: block.timestamp
});
```

### Marketplace de Productos Físicos

```solidity
// Artesanos vendiendo productos hechos a mano
Product memory handmadeGoods = Product({
    skuId: 3,
    seller: artisanAddress,
    tokenContract: physicalGoodsContract,
    tokenId: 789,
    price: 50e18,                // 50 tokens comunitarios
    priceStable: 25e6,           // $25 USDC
    quantity: 5,                 // Stock limitado
    metadataURI: "ipfs://QmHandmade...",
    acceptsStable: true,
    active: true,
    createdAt: block.timestamp
});
```

### Marketplace de Recursos Educativos

```solidity
// Educadores vendiendo cursos y materiales
Product memory eduCourse = Product({
    skuId: 4,
    seller: educatorAddress,
    tokenContract: courseNFTContract,
    tokenId: 101,
    price: 300e18,               // 300 tokens comunitarios
    priceStable: 150e6,          // $150 USDC
    quantity: 100,               // Acceso múltiple al curso
    metadataURI: "ipfs://QmEducourse...",
    acceptsStable: true,
    active: true,
    createdAt: block.timestamp
});
```

## 💰 Modelo Económico Planificado

### Estructura de Tarifas Escalonadas

```solidity
// Tarifas basadas en volumen de ventas del vendedor
function calculateTransactionFee(
    address seller,
    uint256 transactionAmount
) external view returns (uint256 feeAmount) {

    uint256 sellerVolume = getSellerMonthlyVolume(seller);
    uint256 feeBps;

    if (sellerVolume < 1000e18) {
        feeBps = 500;       // 5% para vendedores nuevos
    } else if (sellerVolume < 10000e18) {
        feeBps = 300;       // 3% para vendedores establecidos
    } else {
        feeBps = 150;       // 1.5% para vendedores de alto volumen
    }

    feeAmount = (transactionAmount * feeBps) / 10000;
}
```

### Distribución de Ingresos

```solidity
// Ingresos del marketplace se integran con RevenueRouter
function distributeMarketplaceRevenue(uint256 totalFees) external {
    // 30% para trabajadores (moderación y soporte)
    uint256 workersShare = (totalFees * 3000) / 10000;

    // 50% para tesorería comunitaria
    uint256 treasuryShare = (totalFees * 5000) / 10000;

    // 20% para inversionistas
    uint256 investorsShare = (totalFees * 2000) / 10000;

    revenueRouter.distributeRevenue(totalFees);
}
```

### Incentivos de Reputación

```solidity
// Descuentos de tarifas basados en reputación de WorkerSBT
function getSellerFeeDiscount(address seller) external view returns (uint256) {
    uint256 workerPoints = workerSBT.getWorkerPoints(seller);

    // Hasta 50% de descuento en tarifas para contribuyentes activos
    uint256 discountBps = Math.min(workerPoints / 10, 5000);
    return discountBps;
}
```

## 🔄 Integración Futura Planificada

### Con WorkerSBT

```solidity
// Moderación de marketplace basada en WorkerSBT
function reportProduct(
    uint256 skuId,
    string calldata reason
) external {
    require(workerSBT.balanceOf(msg.sender) > 0, "Requiere WorkerSBT para reportar");

    productReports[skuId].push(ProductReport({
        reporter: msg.sender,
        reason: reason,
        timestamp: block.timestamp,
        workerPoints: workerSBT.getWorkerPoints(msg.sender)
    }));

    // Auto-suspender productos con múltiples reportes de trabajadores de alta reputación
    if (_shouldAutoSuspend(skuId)) {
        products[skuId].active = false;
        emit ProductSuspended(skuId, "Multiple reports from high-reputation workers");
    }
}
```

### Con CommunityToken

```solidity
// Pagos en tokens comunitarios respaldados por USDC
function processCommunityTokenPayment(
    uint256 purchaseId,
    uint256 amount
) external {
    require(communityToken.balanceOf(msg.sender) >= amount, "Saldo insuficiente");

    Purchase storage purchase = purchases[purchaseId];
    Product storage product = products[purchase.skuId];

    // Transferir pago (menos tarifa) al vendedor
    uint256 fee = calculateTransactionFee(product.seller, amount);
    uint256 sellerAmount = amount - fee;

    communityToken.transferFrom(msg.sender, product.seller, sellerAmount);
    communityToken.transferFrom(msg.sender, address(this), fee);

    purchase.status = PurchaseStatus.CONFIRMED;

    emit PaymentProcessed(purchaseId, amount, fee);
}
```

### Con Sistema de Compromisos (Engagements)

```solidity
// Crear ValuableActions para ventas exitosas
function rewardSuccessfulSales(address seller, uint256 saleAmount) external {
    // Los vendedores exitosos pueden ganar WorkerPoints por actividad de marketplace
    if (saleAmount > 100e18) { // Ventas de $100+
        engagements.submitEngagement(
            seller,
            marketplaceSalesActionId,
            abi.encode(saleAmount, block.timestamp),
            "Venta exitosa de marketplace"
        );
    }
}
```

## 🔍 Sistema de Reputación Planificado

### Calificaciones de Vendedor

```solidity
struct SellerRating {
    uint256 totalSales;
    uint256 successfulDeliveries;
    uint256 averageRating;        // 1-5 estrellas (escalado por 1000)
    uint256 totalReviews;
    uint256 disputeRate;          // Porcentaje de ventas disputadas
    bool verifiedSeller;          // Estado de vendedor verificado
}

mapping(address => SellerRating) public sellerRatings;
```

### Sistema de Revisiones

```solidity
struct ProductReview {
    address reviewer;
    uint256 rating;               // 1-5 estrellas
    string reviewText;
    uint256 timestamp;
    bool verifiedPurchase;        // Si el revisor realmente compró el producto
}

mapping(uint256 => ProductReview[]) public productReviews;
```

## 📊 Análisis y Métricas Planificadas

### Análisis de Marketplace

```solidity
function getMarketplaceMetrics() external view returns (
    uint256 totalProducts,
    uint256 totalSales,
    uint256 totalRevenue,
    uint256 averageTransactionSize,
    uint256 activeVendors
) {
    // Análisis integral de rendimiento de marketplace
}
```

### Análisis de Vendedores

```solidity
function getSellerAnalytics(address seller) external view returns (
    uint256 totalListings,
    uint256 successRate,
    uint256 averageDeliveryTime,
    uint256 customerSatisfaction,
    uint256 revenueGenerated
) {
    // Métricas detalladas del rendimiento del vendedor
}
```

## 🔧 Características Avanzadas Planificadas

### Sistema de Escrow Automático

```solidity
// Escrow automático para transacciones de alto valor
function createEscrowPurchase(
    uint256 skuId,
    uint256 quantity
) external payable returns (uint256 escrowId) {

    uint256 totalAmount = calculateTotalPrice(skuId, quantity);
    require(msg.value >= totalAmount, "Pago insuficiente");

    // Mantener fondos en escrow hasta confirmación de entrega
    escrowHoldings[escrowId] = EscrowHolding({
        buyer: msg.sender,
        seller: products[skuId].seller,
        amount: totalAmount,
        releaseTime: block.timestamp + 30 days, // Auto-release después de 30 días
        status: EscrowStatus.ACTIVE
    });
}
```

### Integración con Oráculos

```solidity
// Precios dinámicos basados en oráculos externos para productos físicos
function updateProductPricing(uint256 skuId) external {
    Product storage product = products[skuId];

    // Obtener precio actualizado de commodities/materials
    uint256 marketPrice = priceOracle.getPrice(product.category);

    // Ajustar precio del producto basado en condiciones del mercado
    product.price = (product.baseCost * marketPrice) / baseMarketPrice;

    emit ProductPriceUpdated(skuId, product.price);
}
```

## 📋 Hoja de Ruta de Implementación

### Fase 1 (Actual)

- ✅ Contrato stub con eventos básicos
- ✅ Interfaces de marketplace definidas
- ⏳ Integración con tokens comunitarios pendiente

### Fase 2 (Planificada)

- 🔄 Sistema básico de listado y compra
- 🔄 Integración con CommunityToken para pagos
- 🔄 Sistema de tarifas y distribución de ingresos
- 🔄 Moderación básica con WorkerSBT

### Fase 3 (Futura)

- 🔄 Sistema avanzado de reputación y revisiones
- 🔄 Escrow automático y resolución de disputas
- 🔄 Integración con plataformas externas (Shopify, etc.)
- 🔄 Análisis predictivo y recomendaciones

**Estado de Desarrollo**: Marketplace está en fase conceptual con stub básico. La implementación completa será desarrollada después de completar la infraestructura de tokens y gobernanza.

---

_Esta documentación describe la visión futura para un marketplace descentralizado que genere ingresos comunitarios mientras facilite el comercio de bienes y servicios dentro del ecosistema Shift DeSoc._
