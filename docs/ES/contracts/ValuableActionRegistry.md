# Contrato ValuableActionRegistry

El ValuableActionRegistry sirve como el hub central de configuración para definir **Acciones Valiosas** - tipos específicos de trabajo que las comunidades reconocen como valiosos y dignos de verificación dentro del ecosistema Shift DeSoc. Define los parámetros, requisitos y lógica de verificación para diferentes categorías de contribuciones comunitarias.

## 🎯 Propósito y Función

El ValuableActionRegistry actúa como un **sistema democrático de definición de trabajo** que permite a las comunidades definir:

- Qué tipos específicos de trabajo pueden ser sometidos para verificación
- Cuántos verificadores pares se requieren para cada Acción Valiosa
- Qué estándares de evidencia prueban la finalización legítima
- Recompensas económicas y parámetros de verificación

**Concepto Central**: Las comunidades crean democráticamente "Acciones Valiosas" que definen cómo tipos específicos de contribución se traducen en poder de gobernanza, recompensas económicas y reputación portable.

## 🏗️ Arquitectura Central

### Estructura ValuableAction

```solidity
struct ValuableAction {
    uint32 membershipTokenReward;   // Cantidad de MembershipToken minteada al completar
    uint32 communityTokenReward;    // Cantidad de CommunityToken para períodos de salario
    uint32 investorSBTReward;      // Minteo de InvestorSBT para acciones de inversión
    uint32 jurorsMin;              // Aprobaciones mínimas necesarias (M en M-de-N)
    uint32 panelSize;              // Total de jurados seleccionados (N en M-de-N)
    uint32 verifyWindow;           // Límite de tiempo para verificación (segundos)
    uint32 verifierRewardWeight;   // Puntos ganados por verificadores precisos
    uint32 slashVerifierBps;       // Penalidad por verificación imprecisa
    uint32 cooldownPeriod;         // Tiempo mínimo entre reclamaciones
    uint32 maxConcurrent;          // Máximo de reclamaciones activas por persona
    bool revocable;                // ¿Puede la gobernanza revocar este SBT?
    bool requiresGovernanceApproval; // ¿Se necesita voto comunitario para activar?
    bool founderVerified;          // Mecanismo de seguridad de arranque
    string evidenceSpecCID;        // Hash IPFS de requisitos de evidencia
    string titleTemplate;          // Plantilla para títulos de reclamaciones
}
```

### Filosofía de Diseño

El ValuableActionRegistry sigue estos principios clave:

1. **Definición Democrática**: Las comunidades deciden qué trabajo es valioso a través de la gobernanza
2. **Integración Económica**: Cada Acción Valiosa define tasas de conversión de recompensas entre tipos de tokens
3. **Seguridad de Arranque**: La verificación de fundadores permite el lanzamiento comunitario sin retrasos de gobernanza
4. **Estándares de Evidencia**: Las especificaciones basadas en IPFS aseguran requisitos de trabajo transparentes

- **Control de Acceso**: Gestión de permisos para creación y modificación
- **Versionado**: Historial de cambios para auditabilidad

## ⚙️ Funciones y Lógica Clave

## ⚙️ Funciones Clave

### Gestión de Acciones Valiosas

#### `proposeValuableAction(uint256 communityId, Types.ValuableAction calldata params, string calldata ipfsDescription)`

**Propósito**: Crea una nueva Acción Valiosa que define qué trabajo es valioso y cómo se recompensa.

**Proceso**:

1. Valida todos los parámetros están dentro de rangos aceptables
2. Asigna ID único a la Acción Valiosa
3. Determina la ruta de activación (verificación de fundador, aprobación de gobernanza, o activación directa)
4. Emite evento para indexación y actualizaciones de UI

**Tres Rutas de Activación**:

- **Verificado por Fundador**: Evita gobernanza para arranque comunitario
- **Gobernanza Requerida**: Se necesita voto comunitario para activación
- **Activación Directa**: Acciones Valiosas simples se activan inmediatamente

#### `update(uint256 id, Types.ValuableAction calldata params)`

**Propósito**: Modifica parámetros de Acciones Valiosas existentes.

**Seguridad**:

- Solo moderadores pueden actualizar Acciones Valiosas activas
- Valida todos los parámetros antes de aplicar cambios
- Preserva la integridad del sistema con autorización adecuada

### Gestión de Estado

#### `deactivate(uint256 id)`

**Propósito**: Deshabilita Acciones Valiosas sin eliminación, evitando nuevas reclamaciones.

**Casos de Uso**:

- Deshabilitar temporalmente categorías de trabajo problemáticas
- Tipos de trabajo estacionales (deshabilitar durante temporadas bajas)
- Respuesta de emergencia a problemas descubiertos o explotación

#### `activateFromGovernance(uint256 valuableActionId, uint256 approvedProposalId)`

**Propósito**: Activa Acciones Valiosas después de aprobación exitosa de gobernanza.

**Seguridad**: Solo la gobernanza puede llamar esta función, asegurando control democrático sobre qué trabajo valoran las comunidades.

## 🛡️ Características de Seguridad

### Validación de Entrada

```solidity
function _validateValuableAction(Types.ValuableAction calldata params) internal pure {
    // Asegurar recompensas significativas
    if (params.membershipTokenReward == 0) revert Errors.InvalidInput("MembershipToken reward cannot be zero");

    // Validación M-de-N: M debe ser alcanzable con N
    if (params.jurorsMin > params.panelSize) {
        revert Errors.InvalidInput("Minimum jurors cannot exceed panel size");
    }

    // Las ventanas de tiempo deben ser razonables
    if (params.verifyWindow == 0) revert Errors.InvalidInput("Verify window cannot be zero");
    if (params.slashVerifierBps > 10000) revert Errors.InvalidInput("Slash rate cannot exceed 100%");

    // Requisitos de evidencia
    if (bytes(params.evidenceSpecCID).length == 0) {
        revert Errors.InvalidInput("Evidence spec CID cannot be empty");
    }
}
```

### Control de Acceso

- **Gobernanza**: Control completo sobre el ciclo de vida de Acciones Valiosas y gestión de moderadores
- **Moderadores**: Pueden actualizar y desactivar Acciones Valiosas (nombrados por gobernanza)
- **Fundadores**: Privilegios de arranque para la fase de lanzamiento comunitario
- **Público**: Acceso de solo lectura a todas las configuraciones de Acciones Valiosas

### Seguridad de Arranque

- **Lista Blanca de Fundadores**: Previene Acciones Valiosas de arranque no autorizadas
- **Alcance Comunitario**: Privilegios de fundador limitados a ID de comunidad específica
- **Anulación de Gobernanza**: La comunidad puede revocar el estatus de fundador a través de gobernanza normal

## 📊 Modelo Económico

### Sistema de Triple Recompensa

Cada Acción Valiosa define cómo las reclamaciones aprobadas se traducen en tres tipos de valor:

**Recompensas MembershipToken** (Poder de Gobernanza):

```solidity
membershipTokenReward  // Poder de voto minteado para cada reclamación aprobada
```

**Recompensas CommunityToken** (Valor Económico):

```solidity
communityTokenReward   // Base de salario para distribuciones periódicas
```

**Recompensas InvestorSBT** (Reconocimiento de Capital):

```solidity
investorSBTReward      // Para Acciones Valiosas de tipo inversión
```

### Incentivos para Verificadores

```solidity
verifierRewardWeight   // Puntos ganados por verificadores precisos
slashVerifierBps       // Penalidad por decisiones incorrectas (puntos base)
```

**Estructura de Incentivos Equilibrada**:

- **Recompensas de participación** fomentan participación de verificadores de calidad
- **Penalidades de precisión** aseguran toma de decisiones cuidadosa
- **Construcción de reputación** crea alineación de incentivos a largo plazo

## 🔄 Integración de Flujos de Trabajo

### 1. Creación de Acciones Valiosas

```
Necesidad Comunitaria → Propuesta de Gobernanza → Voto → Timelock → Acción Valiosa Activada
Alternativa: Fundador → Acción Valiosa de Arranque → Activación Inmediata
```

### 2. Flujo de Envío de Trabajo

```
Trabajador verifica requisitos de Acción Valiosa → Envía reclamación → Comienza verificación
```

### 3. Uso de Parámetros de Verificación

```
Contrato Claims lee Acción Valiosa → Configura verificación M-de-N → Selecciona jurados
```

### 4. Integración Económica

```
Reclamación Aprobada → Mintear MembershipTokens → Actualizar base de salario CommunityToken → Mintear WorkerSBT
```

## 📈 Características Avanzadas

### Especificaciones de Evidencia (IPFS)

Cada Acción Valiosa referencia un documento IPFS describiendo:

- Prueba requerida de finalización de trabajo
- Estándares de calidad y criterios de aceptación
- Requisitos de formato de envío
- Evidencia de ejemplo para claridad

### Sistema de Arranque

**Verificación de Fundadores** permite a las comunidades lanzarse sin retrasos de gobernanza:

```solidity
mapping(address => mapping(uint256 => bool)) public founderWhitelist;
mapping(uint256 => address[]) public communityFounders;
```

### Integración de Gobernanza

**Sistema Pendiente** para aprobación de Acciones Valiosas controladas por la comunidad:

```solidity
mapping(uint256 => uint256) public pendingValuableActions; // valuableActionId => proposalId
```

### Funciones de Consulta

Getters esenciales para integración de frontend:

- `getActiveValuableActions()` - Todas las Acciones Valiosas actualmente activas
- `getCommunityFounders(uint256 communityId)` - Lista de fundadores por comunidad
- `isValuableActionActive(uint256 id)` - Verificación rápida de estado

## 🎛️ Ejemplos de Configuración

### Desarrollo de Software Senior

```solidity
ValuableAction({
    membershipTokenReward: 2000,     // Poder de gobernanza sustancial
    communityTokenReward: 1500,      // Alto peso de base salarial
    investorSBTReward: 0,           // No es una acción de inversión
    jurorsMin: 3,                   // Requiere 3 aprobaciones
    panelSize: 5,                   // De un pool de 5 verificadores técnicos
    verifyWindow: 259200,           // 3 días para verificar calidad de código
    verifierRewardWeight: 50,       // Recompensa modesta para verificador
    slashVerifierBps: 100,          // 1% de penalidad de reputación por errores
    cooldownPeriod: 86400,          // Límite de contribución diaria
    maxConcurrent: 2,               // Máximo 2 reclamaciones de código activas
    revocable: true,                // Gobernanza puede revocar si se encuentran bugs
    requiresGovernanceApproval: true, // Se requiere voto comunitario
    founderVerified: false,         // No es una acción de arranque
    evidenceSpecCID: "QmX...",      // Hash IPFS de estándares de codificación
    titleTemplate: "Contribución de Código: {descripción}"
})
```

### Moderación Comunitaria

```solidity
ValuableAction({
    membershipTokenReward: 300,      // Poder de gobernanza moderado
    communityTokenReward: 200,       // Menor peso salarial
    investorSBTReward: 0,           // No es una acción de inversión
    jurorsMin: 2,                   // Mayoría simple de 3
    panelSize: 3,                   // Panel más pequeño para eficiencia
    verifyWindow: 86400,            // 24 horas para respuesta rápida
    verifierRewardWeight: 25,       // Menor recompensa de verificador (mayor volumen)
    slashVerifierBps: 200,          // 2% de penalidad (decisiones subjetivas)
    cooldownPeriod: 3600,           // 1 hora entre reclamaciones de moderación
    maxConcurrent: 5,               // Permitir múltiples moderaciones concurrentes
    revocable: false,               // Las decisiones de moderación deberían ser finales
    requiresGovernanceApproval: false, // Activación directa
    founderVerified: false,         // Acción comunitaria, no de arranque
    evidenceSpecCID: "QmY...",      // Referencia de pautas comunitarias
    titleTemplate: "Moderación: {tipo_violación}"
})
```

## 🔍 Integración de Frontend

### Getters Esenciales

```solidity
// Verificar si una Acción Valiosa existe y está activa
function isValuableActionActive(uint256 id) external view returns (bool)

// Obtener configuración completa para mostrar en UI
function getValuableAction(uint256 id) external view returns (Types.ValuableAction memory)

// Listar todas las Acciones Valiosas activas para UI de selección
function getActiveValuableActions() external view returns (uint256[] memory)

// Gestión de fundadores comunitarios
function getCommunityFounders(uint256 communityId) external view returns (address[] memory)
```

### Seguimiento de Eventos

```solidity
event ValuableActionCreated(uint256 indexed id, Types.ValuableAction valuableAction, address indexed creator);
event ValuableActionActivated(uint256 indexed id, uint256 indexed proposalId);
event ValuableActionDeactivated(uint256 indexed id, address indexed deactivator);
event ModeratorUpdated(address indexed account, bool isModerator, address indexed updater);
```

## 📋 Ejemplos de Uso

### Creando una Acción Valiosa de Arranque

```solidity
// Fundador crea Acción Valiosa inmediata para lanzamiento comunitario
proposeValuableAction(
    communityId,
    ValuableAction({
        membershipTokenReward: 1000,
        communityTokenReward: 500,
        // ... otros parámetros
        founderVerified: true,  // Evitar gobernanza
        requiresGovernanceApproval: false
    }),
    "ipfs://QmBootstrap..."
);
// Resultado: Inmediatamente activa, lista para reclamaciones
```

### Creando una Acción Valiosa Controlada por Gobernanza

```solidity
// Miembro comunitario propone nueva categoría de trabajo
proposeValuableAction(
    communityId,
    ValuableAction({
        membershipTokenReward: 2000,
        communityTokenReward: 1500,
        // ... otros parámetros
        founderVerified: false,
        requiresGovernanceApproval: true  // Requiere voto comunitario
    }),
    "ipfs://QmPropuesta..."
);
// Resultado: Pendiente de aprobación de gobernanza, aún no activa
```

**Listo para Producción**: ValuableActionRegistry proporciona la infraestructura democrática para que las comunidades definan sus propios sistemas de valores mientras mantienen seguridad a través de verificación de fundadores para arranque y aprobación de gobernanza para evolución continua.

---

_Esta documentación refleja la implementación real usando la terminología correcta "ValuableAction" en lugar de las referencias obsoletas "ActionType", asegurando alineación con la visión del proyecto y la base de código._
