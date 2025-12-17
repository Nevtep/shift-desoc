# Contrato ProjectFactory

## 🎯 Propósito y Función

El contrato ProjectFactory habilita **creación de proyectos descentralizada y crowdfunding** dentro de las comunidades Shift DeSoc. Proporciona infraestructura para lanzar proyectos comunitarios, gestionar campañas de crowdfunding ERC-1155 y coordinar desarrollo basado en hitos con mecanismos de protección de inversionistas.

## 🏗️ Arquitectura Central

### Estructura de Gestión de Proyectos

```solidity
struct Project {
    address creator;             // Iniciador del proyecto
    string cid;                 // Identificador de contenido IPFS
    address token1155;          // Token ERC-1155 de crowdfunding
    bool active;                // Estado del proyecto
}

mapping(uint256 => Project) public projects;
uint256 public lastId;
```

**Diseño Actual**: El contrato implementa un registro de proyectos mínimo viable con vinculación básica de metadatos IPFS y asociación de tokens ERC-1155 para futura integración de crowdfunding.

## ⚙️ Funciones Clave y Lógica

### Creación de Proyectos

```solidity
function create(string calldata cid, address token1155)
    external returns (uint256 id) {

    id = ++lastId;
    projects[id] = Project(msg.sender, cid, token1155, true);

    emit ProjectCreated(id, msg.sender, cid, token1155);
}
```

**Funcionalidad Actual**:

- ✅ Registro de proyectos con metadatos IPFS
- ✅ Asociación de tokens ERC-1155 para crowdfunding
- ✅ Atribución de creador y seguimiento de proyectos
- ✅ Generación de ID único de proyecto

**Funcionalidad Faltante** (Planificada para Mejoras Futuras):

- ❌ Gestión y validación de hitos
- ❌ Mecánicas de crowdfunding y protección de inversionistas
- ❌ Sistemas de seguimiento de progreso y reportes
- ❌ Distribución de ingresos a inversionistas

## 🛡️ Características de Seguridad

### Control de Acceso

- **Atribución de Creador**: Cada proyecto está permanentemente vinculado a su creador
- **Estado de Proyecto**: El estado activo/inactivo previene modificaciones no autorizadas
- **Registros Inmutables**: Los registros de creación de proyectos son permanentes en cadena

### Integridad de Datos

- **Integración IPFS**: Almacenamiento de metadatos descentralizado previene censura
- **Validación de Token**: Verificación de direcciones de contratos ERC-1155 válidos
- **Seguimiento de Eventos**: Registro completo de auditoría para todas las acciones del proyecto

## 📊 Casos de Uso Actuales

### Registro de Proyecto Básico

```solidity
// Crear nuevo proyecto con metadatos IPFS
uint256 projectId = projectFactory.create(
    "QmProjectMetadata123...",    // Hash IPFS con detalles del proyecto
    tokenContract1155Address     // Contrato de token para crowdfunding
);

// Resultado: Proyecto registrado con ID único, listo para desarrollo futuro
```

### Seguimiento de Proyectos Comunitarios

```solidity
// Los miembros de la comunidad pueden ver todos los proyectos
Project memory project = projectFactory.projects(projectId);

// Verificar creador y estado
require(project.active, "Proyecto no activo");
require(project.creator == expectedCreator, "Creador incorrecto");

// Acceder a metadatos del proyecto vía IPFS
string memory projectMetadataURI = string(abi.encodePacked("ipfs://", project.cid));
```

## 🚀 Características Planificadas (Expansión Futura)

### Sistema de Crowdfunding ERC-1155

```solidity
// Estructura planificada para crowdfunding avanzado
struct CrowdfundingCampaign {
    uint256 projectId;              // Proyecto asociado
    uint256 fundingGoal;           // Meta de financiamiento en USDC
    uint256 totalRaised;           // Cantidad total recaudada
    uint256 campaignDeadline;      // Fecha límite de la campaña
    uint256 minContribution;       // Contribución mínima requerida
    uint256[] milestoneTargets;    // Metas de financiamiento por hito
    bool[] milestoneReached;       // Estado de logro de hitos
    mapping(address => uint256) contributions; // Contribuciones por inversionista
}
```

### Sistema de Gestión de Hitos

```solidity
// Planificado: Seguimiento de progreso del proyecto
struct ProjectMilestone {
    string description;            // Descripción del hito
    uint256 fundingRequired;       // Financiamiento requerido para este hito
    uint256 estimatedCompletion;   // Fecha estimada de finalización
    string deliverablesCID;        // Hash IPFS de entregables esperados
    bool completed;                // Si el hito fue completado
    uint256 completedAt;          // Cuándo se completó
    address[] validators;          // Quién validó la finalización
}

mapping(uint256 => ProjectMilestone[]) public projectMilestones;
```

### Protección de Inversionistas

```solidity
// Planificado: Mecanismos de escrow y reembolso
struct InvestorProtection {
    uint256 escrowPeriod;         // Período de retención de fondos
    uint256 refundThreshold;      // Umbral para reembolsos automáticos
    bool enableVoting;            // Si los inversionistas pueden votar en decisiones
    uint256 votingPower;          // Poder de voto por token poseído
}
```

## 🔄 Integración Futura Planificada

### Con CommunityToken

```solidity
// Los proyectos generarán ingresos en tokens comunitarios
function distributeProjectRevenue(
    uint256 projectId,
    uint256 revenue
) external {
    Project storage project = projects[projectId];
    require(project.active, "Proyecto inactivo");

    // Distribuir ingresos entre creador, inversionistas y comunidad
    uint256 creatorShare = (revenue * 4000) / 10000;      // 40% creador
    uint256 investorShare = (revenue * 4500) / 10000;     // 45% inversionistas
    uint256 communityShare = (revenue * 1500) / 10000;    // 15% comunidad

    // Integrar con RevenueRouter para distribución
    revenueRouter.distributeRevenue(revenue);
}
```

### Con WorkerSBT

```solidity
// Contribuyentes al proyecto ganan WorkerPoints
function rewardProjectContribution(
    uint256 projectId,
    address contributor,
    uint256 contributionType,
    string calldata evidence
) external {
    // Crear reclamación para contribución al proyecto
    claims.submitClaim(
        contributor,
        projectContributionActionId,
        abi.encode(projectId, contributionType, evidence),
        "Contribución al proyecto"
    );
}
```

### Con ValuableActionRegistry

```solidity
// Diferentes tipos de contribuciones al proyecto
function setupProjectContributionTypes() external {
    // Desarrollo de código
    valuableActionRegistry.proposeValuableAction(
        communityId,
        ValuableAction({
            membershipTokenReward: 500,
            communityTokenReward: 300,
            // ... otros parámetros
        }),
        "Contribución de desarrollo de proyecto"
    );

    // Gestión de proyecto
    valuableActionRegistry.proposeValuableAction(
        communityId,
        ValuableAction({
            membershipTokenReward: 300,
            communityTokenReward: 200,
            // ... otros parámetros
        }),
        "Gestión y coordinación de proyecto"
    );
}
```

## 📈 Métricas y Análisis Planificados

### Análisis de Rendimiento del Proyecto

```solidity
// Métricas planificadas para seguimiento de proyectos
function getProjectAnalytics(uint256 projectId) external view returns (
    uint256 totalFunding,
    uint256 milestonesCompleted,
    uint256 averageCompletionTime,
    uint256 investorCount,
    uint256 roiPercentage
) {
    // Análisis integral de rendimiento del proyecto
}
```

### Análisis de Cartera de Inversionistas

```solidity
// Seguimiento de inversiones de inversionistas a través de proyectos
function getInvestorPortfolio(address investor) external view returns (
    uint256[] memory projectIds,
    uint256[] memory investments,
    uint256[] memory currentValues,
    uint256 totalROI
) {
    // Análisis de rendimiento de inversión del inversionista
}
```

## 🎯 Casos de Uso de Ejemplo

### Proyecto de Desarrollo de Software

```solidity
// Crear proyecto para nueva aplicación comunitaria
uint256 projectId = projectFactory.create(
    "QmSoftwareProject123...",     // Metadatos IPFS: especificaciones, roadmap, equipo
    crowdfundingTokenAddress      // Token ERC-1155 para inversionistas
);

// Configurar hitos de financiamiento
// Hito 1: $10k para MVP (3 meses)
// Hito 2: $25k para características completas (6 meses)
// Hito 3: $15k para lanzamiento y marketing (9 meses)
```

### Proyecto de Contenido Educativo

```solidity
// Crear proyecto para serie de cursos de programación
uint256 projectId = projectFactory.create(
    "QmEducationProject456...",    // Metadatos: currículo, instructores, cronograma
    educationTokenAddress         // Token específico para contenido educativo
);

// Los inversionistas reciben acceso a contenido premium más dividendos de ingresos
```

### Proyecto de Investigación y Desarrollo

```solidity
// Crear proyecto para investigación de protocolo blockchain
uint256 projectId = projectFactory.create(
    "QmResearchProject789...",     // Metadatos: propuesta de investigación, metodología
    researchTokenAddress          // Token que otorga derechos de IP y regalías
);

// Financiamiento basado en hitos de investigación y publicación
```

## 🔍 Integración Frontend

### Getters Esenciales para UI

```solidity
// Información básica del proyecto
function getProject(uint256 projectId) external view returns (Project memory)
function getProjectCount() external view returns (uint256)
function getProjectsByCreator(address creator) external view returns (uint256[] memory)

// Análisis de proyectos
function getActiveProjects() external view returns (uint256[] memory)
function getProjectMetadata(uint256 projectId) external view returns (string memory)
```

### Eventos para Monitoreo

```solidity
event ProjectCreated(uint256 indexed projectId, address indexed creator, string cid, address token1155);
event ProjectUpdated(uint256 indexed projectId, string newCid);
event ProjectStatusChanged(uint256 indexed projectId, bool active);
```

## 📋 Hoja de Ruta de Implementación

### Fase 1 (Actual - ✅ Completada)

- ✅ Registro básico de proyectos
- ✅ Integración IPFS para metadatos
- ✅ Asociación de tokens ERC-1155
- ✅ Atribución de creadores y seguimiento

### Fase 2 (Planificada)

- 🔄 Sistema de crowdfunding con hitos
- 🔄 Validación y progreso de hitos
- 🔄 Mecanismos básicos de protección de inversionistas
- 🔄 Integración con CommunityToken para financiamiento

### Fase 3 (Futura)

- 🔄 Análisis avanzado de rendimiento de proyectos
- 🔄 Herramientas de gestión de cartera para inversionistas
- 🔄 Integración con plataformas externas (GitHub, GitLab)
- 🔄 Sistemas automatizados de validación de hitos

### Fase 4 (Avanzada)

- 🔄 Mercados secundarios para tokens de proyecto
- 🔄 Derivados financieros y seguros de proyecto
- 🔄 IA para evaluación de riesgo de proyectos
- 🔄 Oráculos para validación automática de entregables

## 📊 Estado de Implementación

### Funcionalidad Actual

```solidity
// Implementación production-ready para registro básico
function create(string calldata cid, address token1155) external returns (uint256 id) {
    require(bytes(cid).length > 0, "CID requerido");
    require(token1155 != address(0), "Token address requerida");

    id = ++lastId;
    projects[id] = Project({
        creator: msg.sender,
        cid: cid,
        token1155: token1155,
        active: true
    });

    emit ProjectCreated(id, msg.sender, cid, token1155);
}
```

### Limitaciones Actuales

- **Sin Validación de Hitos**: Los proyectos no tienen seguimiento de progreso automatizado
- **Sin Crowdfunding**: Los tokens ERC-1155 están asociados pero sin mecánicas de financiamiento
- **Sin Protección de Inversionistas**: No hay escrow ni mecanismos de reembolso
- **Metadatos Estáticos**: No hay actualizaciones de progreso del proyecto integradas

## 💡 Consideraciones de Diseño

### Escalabilidad

- **Almacenamiento Eficiente**: Usar IPFS para datos grandes, solo referencias en cadena
- **Gas Optimizado**: Estructura de datos mínima para reducir costos de transacción
- **Indexación**: Eventos emitidos para indexación off-chain eficiente

### Interoperabilidad

- **Estándares ERC**: Compatibilidad total con ERC-1155 para tokens de proyecto
- **Integración Cross-Contract**: Diseñado para trabajar con todo el ecosistema Shift DeSoc
- **Metadatos Flexibles**: Estructura IPFS permite evolución de esquemas de datos

**Estado de Producción**: ProjectFactory está en producción con funcionalidad básica de registro. Las características avanzadas de crowdfunding y gestión de hitos serán desarrolladas en fases futuras basadas en las necesidades de la comunidad.

---

_Esta documentación refleja el estado actual de producción con visión futura para crowdfunding descentralizado robusto y gestión de proyectos comunitarios dentro del ecosistema Shift DeSoc._
