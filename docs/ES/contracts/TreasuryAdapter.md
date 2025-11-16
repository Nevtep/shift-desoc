# Contrato TreasuryAdapter

## 🎯 Propósito y Función

El contrato TreasuryAdapter está diseñado para servir como la **interfaz de gestión de tesorería** para las comunidades Shift DeSoc, proporcionando un puente seguro entre la gobernanza comunitaria y los sistemas externos de gestión de tesorería como Gnosis Safe o módulos Zodiac.

**⚠️ ESTADO ACTUAL: IMPLEMENTACIÓN STUB**

Este contrato es actualmente un marcador de posición que será implementado en la Fase 2 de la hoja de ruta de desarrollo de Shift DeSoc.

## 🏗️ Arquitectura Planificada

### Estructura Futura de Gestión de Tesorería

```solidity
// Estructura de implementación planificada
contract TreasuryAdapter {
    struct TreasuryOperation {
        address target;           // Contrato objetivo para la operación
        uint256 value;           // Valor ETH a enviar
        bytes data;              // Datos de llamada de función codificados
        uint8 operation;         // Tipo de llamada (0=call, 1=delegatecall)
        uint256 nonce;           // Nonce de operación
        bool executed;           // Estado de ejecución
    }
    
    struct TreasuryConfig {
        address safeAddress;      // Dirección de Gnosis Safe
        uint256 threshold;        // Firmas requeridas
        address[] owners;         // Firmantes de tesorería
        uint256 dailyLimit;      // Límite de gasto diario
    }
}
```

### Puntos de Integración (Planificados)

El TreasuryAdapter se integrará con:

- **Gnosis Safe**: Gestión de tesorería multi-firma
- **Módulos Zodiac**: Operaciones de tesorería impulsadas por gobernanza
- **Contratos Governor**: Autorización de gasto basada en propuestas
- **CommunityRegistry**: Configuración de tesorería específica de la comunidad

## ⚙️ Implementación Actual

```solidity
contract TreasuryAdapter {
    error NotConfigured();
    
    function execute(address, uint256, bytes calldata, uint8) 
        external pure returns (bool) {
        // Fase 2: Integración Safe/Zodiac
        revert NotConfigured();
    }
}
```

**Funcionalidad Actual**: 
- ❌ Todas las funciones revierten con error `NotConfigured()`
- ❌ No se soportan operaciones de tesorería
- ❌ Marcador de posición para implementación futura

## 🛡️ Características de Seguridad Planificadas

### Seguridad Multi-Firma
- Integración con Gnosis Safe para control de tesorería multi-firma
- Umbrales de firma configurables por comunidad
- Transacciones de alto valor con timelock

### Integración de Gobernanza
- Operaciones de tesorería autorizadas a través de propuestas de gobernanza
- Límites de gasto aplicados automáticamente
- Rastro de auditoría para todas las actividades de tesorería

### Controles de Emergencia
- Funcionalidad de pausa de emergencia para operaciones de tesorería
- Procedimientos de recuperación para claves comprometidas
- Mecanismos de anulación comunitaria para situaciones de emergencia

## 🔄 Integración Futura Planificada

### Con Gnosis Safe
```solidity
// Integración planificada con Safe para operaciones de tesorería
interface IGnosisSafe {
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) external returns (bool success);
}
```

### Con ShiftGovernor
```solidity
// Las propuestas de gobernanza podrán activar operaciones de tesorería
function executeGovernanceProposal(
    uint256 proposalId,
    address[] calldata targets,
    uint256[] calldata values,
    bytes[] calldata calldatas
) external onlyGovernor {
    // Ejecutar operaciones de tesorería autorizadas por gobernanza
}
```

### Con CommunityRegistry
```solidity
// Configuración de tesorería específica de la comunidad
function getTreasuryConfig(uint256 communityId) external view returns (TreasuryConfig memory) {
    // Recuperar configuración de tesorería desde CommunityRegistry
}
```

## 📊 Casos de Uso Planificados

### Gestión de Tesorería Comunitaria
- Pagos automatizados de salarios a trabajadores
- Distribución de ingresos según configuración de RevenueRouter
- Financiamiento de propuestas aprobadas por gobernanza
- Gestión de reservas y inversiones comunitarias

### Operaciones Multi-Firma
- Transacciones de alto valor requieren múltiples firmas
- Límites de gasto diario para operaciones rutinarias
- Aprobación de gobernanza para gastos extraordinarios

### Integración con DeFi
- Participación en protocolos de préstamos/yield farming
- Gestión de colateral para CommunityToken
- Diversificación de activos de tesorería

## 🎛️ Configuración Planificada

### Parámetros de Tesorería
```solidity
struct TreasuryParams {
    uint256 dailySpendLimit;        // Límite de gasto diario sin gobernanza
    uint256 highValueThreshold;     // Umbral para transacciones de alto valor
    uint256 emergencyReserve;       // Reserva mínima de emergencia
    address[] authorizedAssets;     // Activos autorizados para la tesorería
}
```

### Roles y Permisos
```solidity
bytes32 public constant TREASURY_MANAGER_ROLE = keccak256("TREASURY_MANAGER_ROLE");
bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
```

## 📋 Hoja de Ruta de Desarrollo

### Fase 1 (Actual)
- ✅ Contrato stub implementado
- ✅ Interfaz básica definida
- ⏳ Integración con CommunityRegistry pendiente

### Fase 2 (Planificada)
- 🔄 Integración con Gnosis Safe
- 🔄 Implementación de operaciones multi-firma
- 🔄 Sistema de límites de gasto
- 🔄 Integración con gobernanza ShiftGovernor

### Fase 3 (Futura)
- 🔄 Módulos Zodiac para automatización
- 🔄 Integración DeFi avanzada
- 🔄 Herramientas de análisis de tesorería
- 🔄 Gestión multi-cadena

## 🔍 Estado de Implementación

### Funcionalidad Actual
```solidity
// Todas las funciones principales están marcadas como stub
function execute(address target, uint256 value, bytes calldata data, uint8 operation) 
    external pure returns (bool) {
    revert NotConfigured();
}

function isExecutor(address account) external pure returns (bool) {
    revert NotConfigured();
}

function configure(TreasuryConfig calldata config) external pure {
    revert NotConfigured();
}
```

### Dependencias de Integración
- **CommunityRegistry**: Configuración de tesorería por comunidad
- **ShiftGovernor**: Autorización de propuestas de gasto
- **RevenueRouter**: Recepción de distribuciones de ingresos
- **CommunityToken**: Gestión de activos comunitarios

## 📝 Notas de Desarrollo

### Consideraciones de Diseño
1. **Seguridad First**: Toda operación de tesorería debe ser verificada y autorizada
2. **Flexibilidad**: Soporte para múltiples tipos de tesorería (Safe, EOA, contratos personalizados)
3. **Transparencia**: Todas las operaciones deben ser auditables y rastreables
4. **Escalabilidad**: Diseño para soportar múltiples comunidades con configuraciones diferentes

### Riesgos de Implementación
- **Integración Compleja**: Gnosis Safe tiene API compleja que requiere manejo cuidadoso
- **Gestión de Claves**: Multi-firma requiere gestión segura de claves privadas
- **Limits de Gas**: Operaciones complejas pueden exceder límites de gas de bloque
- **Atomicidad**: Operaciones de tesorería deben ser atómicas para evitar estados inconsistentes

**Estado de Producción**: TreasuryAdapter está en fase de planificación con implementación stub. La funcionalidad completa será desarrollada en Fase 2 después de completar la integración con CommunityRegistry y establecer patrones de gobernanza.

---

*Esta documentación describe el estado actual del stub y la visión futura para la gestión de tesorería robusta y segura en el ecosistema Shift DeSoc.*