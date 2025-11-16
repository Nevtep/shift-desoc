# Contrato HousingManager

## 🎯 Propósito y Función

El contrato HousingManager está diseñado para gestionar **reservas de co-vivienda y compartir propiedades comunitarias** dentro de las comunidades Shift DeSoc. Permitirá a las comunidades coordinar recursos de vivienda compartida, implementar mecanismos de asignación justos y generar ingresos de la utilización de propiedades.

**⚠️ ESTADO ACTUAL: IMPLEMENTACIÓN STUB**

Este contrato es actualmente un marcador de posición básico con funcionalidad mínima, planificado para implementación completa en la Fase 2 de la hoja de ruta de desarrollo.

## 🏗️ Arquitectura Planificada

### Estructura de Gestión de Propiedades

```solidity
// Estructura de implementación planificada
contract HousingManager {
    struct HousingUnit {
        uint256 unitId;              // Identificador único de unidad
        string name;                 // Nombre/descripción de la unidad
        string location;             // Ubicación física
        uint256 basePricePerNight;   // Precios base en tokens comunitarios
        uint256 maxOccupancy;        // Residentes máximos
        bool active;                 // Disponibilidad de la unidad
        address[] amenities;         // Amenidades disponibles (tokens ERC1155)
        uint256[] availableDates;    // Disponibilidad del calendario
    }
    
    struct Reservation {
        uint256 reservationId;       // ID único de reserva
        uint256 unitId;             // Unidad reservada
        address resident;           // Quien hizo la reserva
        uint256 checkIn;            // Timestamp de check-in
        uint256 checkOut;           // Timestamp de check-out  
        uint256 totalCost;          // Cantidad total de pago
        uint256 workerDiscount;     // Porcentaje de descuento aplicado
        ReservationStatus status;   // Estado actual de la reserva
    }
    
    enum ReservationStatus {
        PENDING,
        CONFIRMED,
        CHECKED_IN,
        CHECKED_OUT,
        CANCELLED
    }
}
```

### Sistema de Prioridad y Precios

```solidity
// Planificado: Precios dinámicos y asignación por prioridad
struct PricingRule {
    uint256 workerSBTDiscount;      // Descuento para portadores de WorkerSBT
    uint256 seniorityMultiplier;    // Precios basados en antigüedad comunitaria
    uint256 demandMultiplier;       // Precios dinámicos basados en demanda
    uint256 seasonalAdjustment;     // Ajustes de precios estacionales
}

struct PriorityConfig {
    uint256 workerPriorityBonus;    // Bono de prioridad para trabajadores activos
    uint256 seniorityWeight;        // Peso de la antigüedad en asignación
    uint256 loyaltyMultiplier;      // Multiplicador por uso histórico
    bool enablePriorityQueues;      // Si habilitar colas de prioridad
}
```

## ⚙️ Implementación Actual

```solidity
contract HousingManager {
    error NotImplemented();
    
    // Todas las funciones principales retornan error de no implementado
    function createReservation(uint256, uint256, uint256) external pure returns (uint256) {
        revert NotImplemented();
    }
    
    function confirmReservation(uint256) external pure {
        revert NotImplemented(); 
    }
    
    function checkIn(uint256) external pure {
        revert NotImplemented();
    }
    
    function checkOut(uint256) external pure {
        revert NotImplemented();
    }
}
```

**Funcionalidad Actual**: 
- ❌ Todas las funciones revierten con error `NotImplemented()`
- ❌ No se soportan reservas de vivienda
- ❌ Marcador de posición para implementación futura

## 🛡️ Características de Seguridad Planificadas

### Control de Acceso de Propiedades
- Autenticación basada en WorkerSBT para descuentos de miembros
- Verificación de elegibilidad por antigüedad comunitaria
- Permisos administrativos para gestores de propiedades

### Validación de Reservas
- Verificación de disponibilidad en tiempo real
- Prevención de doble reserva
- Validación de fechas y ocupación

### Gestión de Pagos
- Integración con CommunityToken para pagos
- Procesamiento de reembolsos para cancelaciones
- Seguimiento de ingresos de propiedades

## 🏠 Casos de Uso Planificados

### Co-vivienda Comunitaria
```solidity
// Configurar unidad de vivienda comunitaria
HousingUnit memory colivingSpace = HousingUnit({
    unitId: 1,
    name: "Casa Comunitaria Centro",
    location: "123 Main Street, Ciudad",
    basePricePerNight: 50e18,      // 50 tokens comunitarios por noche
    maxOccupancy: 8,               // Máximo 8 residentes
    active: true,
    amenities: [wifiToken, kitchenToken, laundryToken],
    availableDates: [] // Se actualiza dinámicamente
});

// Crear reserva con descuento de trabajador
makeReservation({
    unitId: 1,
    checkIn: block.timestamp + 7 days,
    checkOut: block.timestamp + 14 days,
    workerSBTDiscount: 2000        // 20% descuento para portadores de WorkerSBT
});
```

### Espacios de Trabajo Compartidos
```solidity
// Oficinas de co-trabajo para trabajadores remotos
HousingUnit memory coworkingOffice = HousingUnit({
    unitId: 2,
    name: "Oficina de Co-trabajo Tech Hub",
    location: "456 Innovation Ave, Ciudad",
    basePricePerNight: 25e18,      // 25 tokens por día
    maxOccupancy: 20,              // 20 estaciones de trabajo
    active: true,
    amenities: [highSpeedInternetToken, meetingRoomsToken, printerToken],
    availableDates: []
});
```

### Propiedades de Inversión
```solidity
// Propiedades generadoras de ingresos para la comunidad
HousingUnit memory rentalProperty = HousingUnit({
    unitId: 3,
    name: "Apartamento de Inversión Downtown",
    location: "789 Business District, Ciudad", 
    basePricePerNight: 100e18,     // Precios de mercado para no miembros
    maxOccupancy: 4,
    active: true,
    amenities: [premiumAmenitiesToken],
    availableDates: []
});
```

## 💰 Modelo Económico Planificado

### Estructura de Precios Dinámicos
```solidity
// Cálculo de precio basado en múltiples factores
function calculatePrice(
    uint256 unitId,
    uint256 checkIn,
    uint256 checkOut,
    address resident
) external view returns (uint256 totalPrice) {
    
    HousingUnit memory unit = housingUnits[unitId];
    uint256 nights = (checkOut - checkIn) / 1 days;
    uint256 basePrice = unit.basePricePerNight * nights;
    
    // Aplicar descuento de WorkerSBT
    if (workerSBT.balanceOf(resident) > 0) {
        uint256 discount = (basePrice * workerSBTDiscount) / 10000;
        basePrice -= discount;
    }
    
    // Ajuste de demanda estacional
    uint256 demandMultiplier = _calculateDemandMultiplier(unitId, checkIn);
    basePrice = (basePrice * demandMultiplier) / 10000;
    
    // Descuento por antigüedad
    uint256 seniority = _getCommunitySeniority(resident);
    if (seniority > 365 days) {
        uint256 seniorityDiscount = (basePrice * 500) / 10000; // 5% descuento
        basePrice -= seniorityDiscount;
    }
    
    return basePrice;
}
```

### Distribución de Ingresos
```solidity
// Los ingresos de vivienda se integran con RevenueRouter
function distributeHousingRevenue(uint256 totalRevenue) external {
    // 40% para trabajadores (mantenimiento y gestión)
    // 35% para tesorería comunitaria
    // 25% para inversionistas de propiedades
    
    revenueRouter.distributeRevenue(totalRevenue);
}
```

## 🔄 Integración Futura Planificada

### Con WorkerSBT
```solidity
// Descuentos y prioridad basados en contribuciones de trabajo
function getWorkerBenefits(address worker) external view returns (
    uint256 discountPercentage,
    uint256 priorityLevel
) {
    uint256 workerPoints = workerSBT.getWorkerPoints(worker);
    
    // Más WorkerPoints = mayores descuentos
    discountPercentage = Math.min(workerPoints / 100, 3000); // Máximo 30% descuento
    
    // Nivel de prioridad para reservas disputadas
    priorityLevel = workerPoints / 500; // Cada 500 puntos = +1 nivel de prioridad
}
```

### Con CommunityToken
```solidity
// Pagos en tokens comunitarios respaldados por USDC
function processPayment(
    uint256 reservationId,
    uint256 amount
) external {
    require(communityToken.balanceOf(msg.sender) >= amount, "Saldo insuficiente");
    
    // Transferir tokens de pago
    communityToken.transferFrom(msg.sender, address(this), amount);
    
    // Actualizar estado de reserva
    reservations[reservationId].status = ReservationStatus.CONFIRMED;
    
    emit PaymentProcessed(reservationId, msg.sender, amount);
}
```

### Con Marketplace
```solidity
// Listar propiedades en marketplace para reserva externa
function listOnMarketplace(
    uint256 unitId,
    uint256 startDate,
    uint256 endDate,
    uint256 externalPrice
) external onlyPropertyManager(unitId) {
    
    marketplace.createListing({
        propertyId: unitId,
        serviceType: "accommodation",
        price: externalPrice,
        availability: [startDate, endDate],
        provider: address(this)
    });
}
```

## 📅 Sistema de Reservas Planificado

### Cola de Prioridad
```solidity
// Gestionar reservas disputadas con sistema de prioridad justo
struct PriorityQueue {
    address[] waitlist;
    mapping(address => uint256) priorityScores;
    mapping(address => uint256) waitlistPosition;
}

function addToWaitlist(uint256 unitId, uint256 checkIn, address resident) external {
    uint256 priorityScore = _calculatePriorityScore(resident);
    
    // Insertar en posición correcta basada en prioridad
    _insertByPriority(unitId, checkIn, resident, priorityScore);
}
```

### Cancelaciones y Reembolsos
```solidity
// Política de cancelación con penalidades escalonadas
function cancelReservation(uint256 reservationId) external {
    Reservation storage reservation = reservations[reservationId];
    require(reservation.resident == msg.sender, "No autorizado");
    
    uint256 timeUntilCheckIn = reservation.checkIn - block.timestamp;
    uint256 refundPercentage;
    
    if (timeUntilCheckIn > 7 days) {
        refundPercentage = 10000;      // 100% reembolso
    } else if (timeUntilCheckIn > 3 days) {
        refundPercentage = 7500;       // 75% reembolso
    } else if (timeUntilCheckIn > 1 days) {
        refundPercentage = 5000;       // 50% reembolso
    } else {
        refundPercentage = 0;          // No reembolso
    }
    
    uint256 refundAmount = (reservation.totalCost * refundPercentage) / 10000;
    communityToken.transfer(msg.sender, refundAmount);
    
    reservation.status = ReservationStatus.CANCELLED;
}
```

## 🔍 Métricas Planificadas

### Análisis de Utilización
```solidity
function getUtilizationMetrics(uint256 unitId) external view returns (
    uint256 occupancyRate,          // % de noches reservadas
    uint256 averageLengthOfStay,    // Duración promedio de estadía
    uint256 revenuePerNight,        // Ingresos promedio por noche
    uint256 workerVsExternalRatio   // Ratio de uso interno vs externo
) {
    // Análisis de rendimiento de propiedades para optimización
}
```

### Análisis de Miembros
```solidity
function getMemberHousingAnalytics(address member) external view returns (
    uint256 totalNightsStayed,
    uint256 totalAmountSpent,
    uint256 averageDiscountReceived,
    uint256 membershipTier
) {
    // Seguimiento de patrones de uso para recompensas de lealtad
}
```

## 📋 Hoja de Ruta de Implementación

### Fase 1 (Actual)
- ✅ Contrato stub creado
- ✅ Interfaces básicas definidas
- ⏳ Integración con otros contratos pendiente

### Fase 2 (Planificada)
- 🔄 Sistema de reservas básico
- 🔄 Integración con WorkerSBT para descuentos
- 🔄 Procesamiento de pagos con CommunityToken
- 🔄 Gestión básica de propiedades

### Fase 3 (Futura)
- 🔄 Precios dinámicos y análisis de demanda
- 🔄 Sistema de prioridad avanzado
- 🔄 Integración con plataformas externas (Airbnb, etc.)
- 🔄 Análisis predictivo para optimización de ingresos

**Estado de Desarrollo**: HousingManager está en fase conceptual con implementación stub. La funcionalidad completa será desarrollada después de completar los contratos centrales de gobernanza y trabajo.

---

*Esta documentación describe la visión futura para la gestión de co-vivienda comunitaria y generación de ingresos de propiedades dentro del ecosistema Shift DeSoc.*