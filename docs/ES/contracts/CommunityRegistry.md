# Contrato CommunityRegistry

## 🎯 Propósito y Función

El **CommunityRegistry** sirve como la única fuente de verdad para metadatos de comunidad, parámetros de gobernanza, direcciones de módulos y relaciones inter-comunitarias en el ecosistema Shift DeSoc. Actúa como el centro de coordinación central que permite a las comunidades configurar sus sistemas de gobernanza, gestionar su estructura organizacional y establecer relaciones con otras comunidades.

## 🏗️ Arquitectura Central

### Estructuras de Datos

```solidity
struct Community {
    string name;
    string description;
    string metadataURI;

    // Parámetros de Gobernanza
    uint256 debateWindow;
    uint256 voteWindow;
    uint256 executionDelay;

    // Reglas de Elegibilidad
    uint256 minSeniority;
    uint256 minSBTs;
    uint256 proposalThreshold;

    // Parámetros Económicos
    uint256[3] revenueSplit;     // [trabajadores%, tesoro%, inversores%]
    uint256 feeOnWithdraw;
    address[] backingAssets;     // Tokens de garantía aprobados

    // Direcciones de Módulos
    address governor;
    address timelock;
    address requestHub;
    address draftsManager;
    address engagementsManager;
    address actionTypeRegistry;
    address verifierPool;
    address workerSBT;
    address treasuryAdapter;

    // Estado y Relaciones
    CommunityStatus status;
    uint256 parentCommunityId;   // Soporte de federación/jerarquía
    uint256[] allyCommunityIds;  // Relaciones de alianza
}
```

### Gestión del Estado

- **Almacenamiento de Comunidades**: Mapeo de ID de comunidad a estructura Community
- **Gestión de Roles**: Control de acceso jerárquico con roles específicos de comunidad
- **Validación de Parámetros**: Restricciones aplicadas en parámetros de gobernanza y económicos
- **Seguimiento de Relaciones**: Jerarquías padre-hijo y redes de alianzas

## ⚙️ Funciones y Lógica Clave

### Registro de Comunidad

```solidity
function registerCommunity(CommunityParams calldata params)
    external returns (uint256 communityId)
```

**Propósito**: Crea una nueva comunidad con parámetros iniciales y estructura de gobernanza.

**Lógica Clave**:

- Valida unicidad del nombre de comunidad y restricciones de parámetros
- Asigna ID de comunidad secuencial y establece parámetros de gobernanza por defecto
- Establece rol de admin inicial para el registrante
- Permite relaciones padre-hijo para federaciones de comunidades
- Emite evento `CommunityRegistered` para indexación

### Gestión de Parámetros

```solidity
function updateParameters(uint256 communityId, ParameterUpdate[] calldata updates)
    external onlyAdmin(communityId)
```

**Propósito**: Permite a los administradores de comunidad modificar parámetros de gobernanza y económicos.

**Parámetros Soportados**:

- **Tiempos de Gobernanza**: `debateWindow`, `voteWindow`, `executionDelay`
- **Reglas de Elegibilidad**: `minSeniority`, `minSBTs`, `proposalThreshold`
- **Divisiones Económicas**: Ratios de `revenueSplit`, `feeOnWithdraw`
- **Gestión de Activos**: Lista blanca de `backingAssets`

**Lógica de Validación**:

- Las divisiones de ingresos deben sumar 100%
- Las ventanas de tiempo deben estar dentro de límites razonables (1 hora a 30 días)
- Las tasas de comisión no pueden exceder el 10%
- Las direcciones de activos deben ser contratos ERC-20 válidos

## 🛡️ Características de Seguridad

### Matriz de Control de Acceso

```solidity
// Verificaciones de rol específicas de comunidad
modifier onlyAdmin(uint256 communityId) {
    require(
        hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
        hasRole(communityAdmins[communityId], msg.sender),
        "No autorizado"
    );
}
```

### Validación de Parámetros

- **Restricciones Económicas**: Divisiones de ingresos validadas para sumar exactamente 100%
- **Límites de Tiempo**: Ventanas de gobernanza deben estar entre 1 hora y 30 días
- **Validación de Direcciones**: Direcciones de módulos verificadas por existencia de contrato
- **Prevención de Referencias Circulares**: Relaciones padre-hijo no pueden formar ciclos

## 🔗 Puntos de Integración

### Con Contratos de Gobernanza

```solidity
// ShiftGovernor consulta parámetros de comunidad
CommunityRegistry registry = CommunityRegistry(communityRegistryAddress);
(uint256 debateWindow, uint256 voteWindow, uint256 executionDelay) =
    registry.getGovernanceParameters(communityId);
```

### Con RequestHub y DraftsManager

```solidity
// Verificaciones de control de acceso
require(
    registry.hasRole(communityId, msg.sender, MODERATOR_ROLE),
    "No autorizado para moderar"
);
```

## 📊 Modelo Económico

### Configuración de División de Ingresos

Las comunidades pueden configurar distribución de ingresos en tres partes:

```solidity
struct EconomicParameters {
    uint256[3] revenueSplit;  // [trabajadores%, tesoro%, inversores%] puntos base (debe sumar 10000)
    uint256 feeOnWithdraw;    // Comisión de retiro en puntos base (máx 1000 = 10%)
    address[] backingAssets;  // Tokens de garantía en lista blanca
}
```

**Configuración por Defecto**:

- Trabajadores: 70% (7000 pb) - Recompensas por trabajo verificado
- Tesoro: 20% (2000 pb) - Fondo de desarrollo comunitario
- Inversores: 10% (1000 pb) - Retorno para supporters de la comunidad

## 🎛️ Ejemplos de Configuración

### Configuración Básica de Comunidad

```solidity
CommunityParams memory params = CommunityParams({
    name: "DeveloperDAO",
    description: "Comunidad descentralizada para desarrolladores Web3",
    metadataURI: "ipfs://QmCommunityMetadata...",

    // Tiempos estándar de gobernanza
    debateWindow: 3 days,
    voteWindow: 7 days,
    executionDelay: 2 days,

    // Elegibilidad de miembros
    minSeniority: 30 days,
    minSBTs: 1,
    proposalThreshold: 100e18, // 100 tokens de gobernanza

    // Asignación de ingresos
    revenueSplit: [7000, 2000, 1000], // 70% trabajadores, 20% tesoro, 10% inversores
    feeOnWithdraw: 250, // 2.5% comisión de retiro
    backingAssets: [USDC_ADDRESS, DAI_ADDRESS], // Aceptar stablecoins

    // Sin comunidad padre
    parentCommunityId: 0
});

uint256 communityId = registry.registerCommunity(params);
```

## 🚀 Características Avanzadas

### Federación de Comunidades

**Gobernanza Jerárquica**:

- Comunidades hijas pueden heredar políticas de los padres
- Comunidades padre pueden establecer restricciones vinculantes en hijas
- La votación federal puede afectar múltiples comunidades simultáneamente

**Redes de Alianza**:

- Comunidades pares pueden formar alianzas para compartir recursos
- Miembros de alianza obtienen trato preferencial en trabajo inter-comunitario
- Sistemas compartidos de resolución de disputas y reputación

### Flujos de Trabajo Inter-Comunitarios

**Gobernanza Federada**:

- Propuestas pueden afectar múltiples comunidades en una federación
- Reputación y verificación de trabajo inter-comunitaria
- Tesorerías y fondos de recursos compartidos

**Beneficios de Alianza**:

- Comisiones de transacción reducidas entre comunidades aliadas
- Bibliotecas de ActionType compartidas y pools de verificación
- Financiación y ejecución colaborativa de proyectos

El CommunityRegistry forma la capa fundamental que permite que todo el ecosistema Shift DeSoc escale mientras mantiene la descentralización y autonomía comunitaria.
