# Contrato VerifierPowerToken1155

## 🎯 Propósito y Función

El contrato VerifierPowerToken1155 implementa **tokens de poder de verificador por comunidad** usando el estándar ERC-1155 con control exclusivo de gobernanza timelock. Proporciona la capa fundamental de tokens para el Sistema de Poder de Verificador (VPS) de Shift DeSoc, asegurando que la autoridad de verificador proviene de concesiones democráticas y no puede ser auto-adquirida o comerciada.

## 🏗️ Arquitectura Central

### Diseño de Tokens ERC-1155

```solidity
// Mapeo Token ID = Community ID
// Cada comunidad obtiene su propio tipo de token de poder de verificador
// Balance de token = cantidad de poder de verificador para esa comunidad

contract VerifierPowerToken1155 is ERC1155, AccessControl {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    
    mapping(uint256 => uint256) public totalSupply;              // Poder total de comunidad
    mapping(uint256 => bool) public communityInitialized;       // Estado de configuración de comunidad
}
```

### Modelo de Poder No-Transferible

**Filosofía de Diseño**: El poder de verificador representa confianza comunitaria y autoridad de gobernanza, no valor económico comerciable. Solo la gobernanza timelock puede acuñar, quemar o transferir tokens de poder de verificador.

## ⚙️ Funciones Clave y Lógica

### Inicialización de Comunidad

```solidity
function initializeCommunity(
    uint256 communityId, 
    string calldata metadataURI
) external onlyRole(TIMELOCK_ROLE)
```

**Proceso de Configuración**:
1. **Configuración Inicial**: Previene doble inicialización de sistemas de verificadores de comunidad
2. **Almacenamiento de Metadatos**: Enlaza metadatos IPFS conteniendo políticas de verificadores de comunidad
3. **Preparación de Estado**: Habilita operaciones de acuñación para la nueva comunidad
4. **Emisión de Eventos**: Registra activación de comunidad para indexación y seguimiento de gobernanza

### Concesión de Poder de Verificador

```solidity
function mint(
    address to, 
    uint256 communityId, 
    uint256 amount, 
    string calldata reasonCID
) external onlyRole(TIMELOCK_ROLE)
```

**Acuñación Controlada por Gobernanza**:
- **Verificación de Autorización**: Solo timelock puede ejecutar (requiere aprobación de gobernanza)
- **Validación de Comunidad**: Asegura que la comunidad esté inicializada antes de distribución de poder
- **Requisito de Razón**: Todas las concesiones de poder deben incluir hash de justificación IPFS
- **Seguimiento de Suministro**: Actualiza poder total de comunidad para analíticas y límites

**Operaciones por Lotes**:
```solidity
function batchMint(
    address[] calldata to,
    uint256 communityId,
    uint256[] calldata amounts,
    string calldata reasonCID
) external onlyRole(TIMELOCK_ROLE)
```

### Revocación de Poder de Verificador

```solidity
function burn(
    address from, 
    uint256 communityId, 
    uint256 amount,
    string calldata reasonCID
) external onlyRole(TIMELOCK_ROLE)
```

**Remoción Democrática de Poder**:
1. **Validación de Balance**: Asegura que exista suficiente poder antes del quemado
2. **Requisito de Gobernanza**: Solo la gobernanza comunitaria puede revocar poder de verificador
3. **Transparencia**: Todas las revocaciones deben incluir razonamiento público en IPFS
4. **Ajuste de Suministro**: Disminuye poder total de comunidad acordemente

**Aplicaciones Disciplinarias**:
- **Problemas de Rendimiento**: Remover poder de verificadores consistentemente inexactos
- **Violaciones de Política**: Revocar poder por violar estándares de verificación comunitarios
- **Verificadores Inactivos**: Reclamar poder de miembros comunitarios no participantes

## 🛡️ Características de Seguridad

### Sistema de Prevención de Transferencias

```solidity
function safeTransferFrom() public virtual override {
    revert TransfersDisabled();
}

function safeBatchTransferFrom() public virtual override {
    revert TransfersDisabled();
}
```

**Aplicación Anti-Comercio**:
- **Bloqueo Completo de Transferencias**: Sin comercio de mercado de poder de verificador
- **Protección de Capital Social**: Previene mercantilización de confianza comunitaria
- **Integridad de Gobernanza**: Asegura que la distribución de poder refleje decisiones comunitarias

### Transferencia Administrativa (Solo Gobernanza)

```solidity
function adminTransfer(
    address from,
    address to,
    uint256 communityId,
    uint256 amount,
    string calldata reasonCID
) external onlyRole(TIMELOCK_ROLE)
```

**Casos de Uso de Transferencia Legítima**:
- **Reestructuración de Gobernanza**: Mover poder entre direcciones durante cambios de gobernanza comunitaria
- **Migración de Cuentas**: Ayudar a miembros comunitarios a migrar a nuevas direcciones
- **Acciones Disciplinarias**: Transferir poder como parte de procesos de resolución de disputas

### Control de Acceso Basado en Roles

| Rol | Permisos | Modelo de Seguridad |
|-----|----------|---------------------|
| **TIMELOCK_ROLE** | Todas las operaciones de tokens | Solo gobernanza comunitaria |
| **DEFAULT_ADMIN_ROLE** | Gestión de roles | Revocado del desplegador |
| **Público** | Solo funciones de vista | Acceso de solo lectura |

## 🔗 Puntos de Integración

### Padrón canónico de verificadores (SHI-135)

El padrón activo del token (`getCommunityVerifiers`, `getCommunityStats`) es el único padrón canónico; `VerifierElection` deriva de él la
elegibilidad y las estadísticas. Un `mint`/`batchMint` directo o el destino de `adminTransfer` hace elegible a la dirección de inmediato; un
vetado sigue excluido porque `VerifierElection` filtra los vetos. Las llamadas directas solo emiten `VerifierGranted`/`VerifierRevoked`.

### Sincronización VerifierElection

```solidity
// VerifierElection llama funciones VPT para mantener distribución de poder
interface IVPT1155 {
    function mint(address to, uint256 id, uint256 amount, string calldata reasonCID) external;
    function burn(address from, uint256 id, uint256 amount, string calldata reasonCID) external;
}

// Operaciones sincronizadas aseguran consistencia
function updateVerifierPower(address verifier, uint256 newPower) {
    // VerifierElection computa delta de poder y llama mint/burn acordemente
    if (newPower > currentPower) {
        vpt.mint(verifier, communityId, newPower - currentPower, reasonCID);
    }
}
```

### Integración de Selección VerifierManager

```solidity
function hasVerifierPower(address account, uint256 communityId) external view returns (bool) {
    return balanceOf(account, communityId) > 0;
}

function getCommunityStats(uint256 communityId) external view returns (
    uint256 activeVerifiers,
    uint256 totalPower,
    bool initialized
) {
    // Usado por VerifierManager para evaluación de pool de selección
}
```

### Autorización de Contrato Compromisos

```solidity
// Contrato Compromisos verifica autorización de verificador vía balance VPT
function verifyEngagementVPS(uint256 engagementId, bool approved) external {
    uint256 communityId = _getEngagementCommunity(engagementId);
    require(vpt.balanceOf(msg.sender, communityId) > 0, "No verifier power");
    // Procesar verificación con autoridad concedida por gobernanza
}
```

## 📊 Modelo Económico

### Sistema de Valor No-Económico

**Características de Tokens VPS**:

| Aspecto | Token Tradicional | Token VPT |
|---------|------------------|-----------|
| **Adquisición** | Compra/minería | Concesión de gobernanza |
| **Transferencia** | Comercio libre | Solo gobernanza |
| **Fuente de Valor** | Precio de mercado | Confianza comunitaria |
| **Mecanismo de Pérdida** | Venta/quemado | Revocación de gobernanza |

### Distribución Controlada por Comunidad

**Patrones de Asignación de Poder**:

```solidity
// Ejemplo de distribuciones de poder de verificador comunitario

// Democracia Igualitaria (todos los verificadores con poder igual)
batchMint([alice, bob, charlie], communityId, [100, 100, 100], "democracia-igualitaria");

// Basado en Mérito (el poder refleja contribución)
batchMint([senior, junior, novato], communityId, [200, 100, 50], "basado-en-merito");

// Roles Especializados (diferentes dominios de verificación)
batchMint([revisorTecnico, moderadorContenido, aseguramientoCalidad], communityId, [150, 100, 175], "roles-especializados");
```

### Gestión Dinámica de Poder

**Gobernanza Comunitaria Responsiva**:
- **Recompensas de Rendimiento**: Incrementar poder para verificadores consistentemente precisos
- **Gestión de Calidad**: Disminuir poder por precisión de verificación decreciente
- **Incentivos de Participación**: Conceder poder adicional por involucramiento comunitario activo
- **Acciones Disciplinarias**: Remover poder por violaciones de política o comportamiento dañino

## 🎛️ Ejemplos de Configuración

### Bootstrap de Nueva Comunidad

```solidity
// 1. Inicializar sistema de verificadores de comunidad
initializeCommunity(communityId, "QmVerifierPolicy123...");

// 2. Conceder conjunto de verificadores fundadores
address[] memory founders = [founder1, founder2, founder3];
uint256[] memory powers = [100, 100, 100];
batchMint(founders, communityId, powers, "QmFoundingSet456...");
```

### Gestión de Comunidad Establecida

```solidity
// Añadir nuevos verificadores después del crecimiento comunitario
mint(candidatoCalificado, communityId, 75, "QmNewVerifier789...");

// Ajustar poder de verificador existente basado en rendimiento
burn(verificadorBajoRendimiento, communityId, 25, "QmPerformanceAdjustment...");
mint(verificadorBajoRendimiento, communityId, 50, "QmAdjustedPower..."); // Disminución neta de 100 a 75
```

### Acciones Disciplinarias

```solidity
// Revocación completa de poder por violaciones de política
uint256 revokedPower = balanceOf(verificadorViolador, communityId);
burn(verificadorViolador, communityId, revokedPower, "QmDisciplinaryAction...");

// Transferir poder durante resolución de disputas
adminTransfer(verificadorEnDisputa, tenedorTemporal, communityId, 100, "QmDisputeResolution...");
```

## 🚀 Características Avanzadas

### Analíticas e Insights de Comunidad

```solidity
function getCommunityStats(uint256 communityId) external view returns (
    uint256 totalActiveVerifiers,    // Número de direcciones con poder > 0
    uint256 totalPowerDistributed,   // Suma de todo el poder de verificador
    uint256 averagePowerPerVerifier, // Distribución media de poder
    bool isInitialized              // Estado de configuración de comunidad
) {
    // Proporciona métricas de salud comunitaria a gobernanza
}
```

### Consultas de Estado de Verificadores

```solidity
function getVerifierPowerDetails(address verifier, uint256 communityId) external view returns (
    uint256 currentPower,           // Balance de poder de verificador actual
    bool hasAnyPower,              // Verificación rápida de autorización
    uint256 communityTotalPower,   // Contexto para influencia relativa
    uint256 relativeInfluence     // Porcentaje de poder comunitario (puntos base)
) {
    // Estado integral de verificador para UI y análisis de gobernanza
}
```

### Seguimiento de Verificadores Multi-Comunidad

```solidity
function getVerifierCommunities(address verifier) external view returns (
    uint256[] memory communityIds,     // Comunidades donde el verificador tiene poder
    uint256[] memory powerAmounts,     // Cantidad de poder en cada comunidad
    uint256 totalCommunities          // Número de comunidades con poder de verificador
) {
    // Análisis de influencia de verificador inter-comunitario
}
```

## Notas de Implementación

### Estrategias de Optimización de Gas

**Operaciones por Lotes Eficientes**:
```solidity
// La acuñación por lotes minimiza costos de transacción
function batchMint() usa bucle único con:
- Cantidad total pre-calculada
- Actualización única de totalSupply
- Operaciones de mint individuales
- Emisiones de eventos consolidadas
```

**Optimización de Patrón de Almacenamiento**:
```solidity
// Minimizar lecturas/escrituras de almacenamiento
uint256 currentTotal = totalSupply[communityId];  // SLOAD único
currentTotal += totalAmount;                      // Operación de memoria
totalSupply[communityId] = currentTotal;         // SSTORE único
```

### Detalles de Implementación de Seguridad

**Modelo de Seguridad de Roles**:
```solidity
constructor(address timelock) {
    _grantRole(DEFAULT_ADMIN_ROLE, timelock);     // Control de gobernanza
    _grantRole(TIMELOCK_ROLE, timelock);          // Control operacional
    _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);  // Remover privilegios de desplegador
}
```

**Patrones de Validación de Input**:
```solidity
// Validación integral en todas las operaciones
if (to == address(0)) revert Errors.ZeroAddress();
if (amount == 0) revert InvalidAmount(amount);
if (!communityInitialized[communityId]) revert CommunityNotInitialized(communityId);
```

### Requisitos de Integración

**Dependencias Requeridas**:
- **OpenZeppelin ERC1155**: Implementación de estándar de tokens
- **OpenZeppelin AccessControl**: Sistema de permisos basado en roles
- **Timelock Controller**: Control de retraso y ejecución de gobernanza

**Contratos de Integración**:
- **VerifierElection**: Gestión de distribución de poder y sincronización
- **VerifierManager**: Verificaciones de autorización para selección de jurados
- **Contrato Compromisos**: Validación de poder de verificador para procesamiento de compromisos

### Consideraciones de Despliegue

**Secuencia de Inicialización**:
1. Desplegar VerifierPowerToken1155 con dirección de timelock
2. Verificar que timelock tiene TIMELOCK_ROLE
3. Inicializar comunidades vía propuestas de gobernanza
4. Configurar VerifierElection con dirección VPT
5. Configurar VerifierManager para leer balances VPT

**Integración de Gobernanza**:
- Asegurar que el contrato timelock tenga configuraciones de retraso apropiadas
- Configurar propuestas de gobernanza para cambios de poder de verificador
- Establecer infraestructura IPFS para documentación de razonamiento
- Configurar monitoreo para analíticas de distribución de poder de verificador

---

El contrato VerifierPowerToken1155 proporciona la **fundación democrática** para autoridad de verificador en Shift DeSoc, asegurando que el poder de verificación proviene de confianza comunitaria en lugar de capacidad económica, habilitando sistemas de verificación de trabajo equitativos y responsables.