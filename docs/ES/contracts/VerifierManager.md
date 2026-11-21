# Contrato VerifierManager

## 🎯 Propósito y Función

El contrato VerifierManager orquesta **selección de jurados M-de-N y reporte de fraude** dentro del Sistema de Poder de Verificador (VPS) de Shift DeSoc. Conecta parámetros de verificación específicos de comunidad con distribución democrática de poder de verificador para asegurar procesos de verificación de trabajo justos, eficientes y responsables.

## 🏗️ Arquitectura Central

### Sistema de Selección de Jurados

```solidity
struct JurorSelection {
    address[] selectedJurors;      // Verificadores M-de-N seleccionados
    uint256[] selectedPowers;      // Cantidades de poder correspondientes
    uint256 seed;                  // Semilla de aleatorización para selección
    uint64 selectedAt;            // Timestamp de selección
    bool completed;               // Estado de completitud de selección
}

mapping(uint256 => JurorSelection) public selections; // engagementId => detalles de selección
```

### Marco de Integración

```solidity
contract VerifierManager {
    IVerifierElection public immutable verifierElection;    // Gestión de poder de verificador
    IParamController public immutable paramController;      // Configuración de comunidad
}
```

**Filosofía de Diseño**: Selección flexible de jurados que se adapta a preferencias comunitarias mientras mantiene distribución democrática de poder de verificador y reporte transparente de fraude.

## ⚙️ Funciones Clave y Lógica

### Selección de Jurados M-de-N

```solidity
function selectJurors(
    uint256 engagementId,
    uint256 panelSize,
    uint256 seed,
    bool useWeighting,
    address excluded // engagement participant: never selected, removed before the InsufficientVerifiers checks
) external restricted returns (address[] memory selectedJurors)
```

**Algoritmo de Selección**:

1. **Lectura de Parámetros**: Obtener M, N específicos de comunidad y preferencias de ponderación
2. **Pool Elegible**: Obtener verificadores activos y sus niveles de poder de VerifierElection
3. **Filtrado de Baneos**: Excluir verificadores baneados del pool de selección
4. **Método de Selección**: Elegir entre selección uniforme o ponderada basada en configuración comunitaria
5. **Almacenamiento de Resultado**: Registrar detalles de selección para verificación y reporte de fraude

**Métodos de Selección**:

```solidity
// Selección Uniforme (probabilidad igual independiente del poder)
function _selectUniform(address[] memory verifiers, uint256 panelSize, uint256 seed)
    private pure returns (address[] memory selected)

// Selección Ponderada (probabilidad proporcional al poder de verificador)
function _selectWeighted(
    address[] memory verifiers,
    uint256[] memory powers,
    uint256 panelSize,
    uint256 seed
) private pure returns (address[] memory selected, uint256[] memory selectedPowers)
```

### Sistema de Reporte de Fraude

```solidity
function reportFraud(
    uint256 engagementId,
    uint256 communityId,
    address[] calldata offenders,
    string calldata evidenceCID
) external restricted
```

**Proceso de Reporte de Fraude**:

1. **Validación de Autoridad**: Asegurar que los infractores fueron realmente seleccionados como jurados para este compromiso
2. **Registro de Evidencia**: Almacenar hash IPFS de evidencia de fraude para revisión comunitaria
3. **Notificación de Gobernanza**: Emitir eventos para que el sistema de gobernanza procese acciones disciplinarias
4. **Integridad de Selección**: Mantener historial de selección de jurado para responsabilidad

**Protecciones Anti-Fraude**:
- **Verificación de Selección**: Solo puede reportar fraude contra jurados realmente seleccionados
- **Requisito de Evidencia**: Todos los reportes de fraude deben incluir documentación de evidencia IPFS
- **Revisión de Gobernanza**: La gobernanza comunitaria revisa todos los reportes de fraude antes de acción

### Integración de Parámetros de Comunidad

```solidity
// Lectura dinámica de parámetros desde ParamController
function _getCommunityParams(uint256 communityId) private view returns (
    bool useWeighting,      // USE_VPT_WEIGHTING: selección ponderada vs uniforme
    uint256 maxWeight,      // MAX_WEIGHT_PER_VERIFIER: tope de poder por verificador
    uint256 panelSize,      // VERIFIER_PANEL_SIZE: N (jurados totales)
    uint256 minRequired     // VERIFIER_MIN: M (aprobaciones mínimas necesarias)
) {
    useWeighting = paramController.getBool(communityId, USE_VPT_WEIGHTING);
    maxWeight = paramController.getUint256(communityId, MAX_WEIGHT_PER_VERIFIER);
    panelSize = paramController.getUint256(communityId, VERIFIER_PANEL_SIZE);
    minRequired = paramController.getUint256(communityId, VERIFIER_MIN);
}
```

## 🛡️ Características de Seguridad

### Sistema de Control de Acceso

| Rol | Funciones | Propósito |
|-----|-----------|-----------|
| **Rol AccessManager `VERIFIER_MANAGER_CALLER_ROLE`** | `selectJurors()`, `reportFraud()` | Integración de flujo de trabajo de verificación (caller Engagements) |
| **Público** | Funciones de vista | Transparencia y analíticas |

### Mecanismos de Integridad de Selección

```solidity
// Prevenir doble selección para el mismo compromiso
if (selections[engagementId].selectedAt != 0) {
    revert Errors.AlreadySelected(engagementId);
}

// Asegurar verificadores suficientes disponibles
if (eligibleCount < panelSize) {
    revert Errors.InsufficientVerifiers(eligibleCount, panelSize);
}

// Validar autoridad de reporte de fraude
if (!_isSelectedJuror(engagementId, offender)) {
    revert Errors.NotSelectedJuror(offender, engagementId);
}
```

### Seguridad de Aleatorización

```solidity
// Selección determinística pero impredecible
function _generateSelection(uint256 seed, uint256 poolSize, uint256 selectCount) private pure {
    // Usa semilla + iteración + dirección de verificador para resultados consistentes pero impredecibles
    // Previene manipulación mientras permite verificación de justicia de selección
}
```

## 🔗 Puntos de Integración

### Integración VerifierElection

```solidity
interface IVerifierElection {
    function getEligibleVerifiers(uint256 communityId) external view returns (
        address[] memory eligibleVerifiers,
        uint256[] memory eligiblePowers
    );
    
    function getVerifierStatus(uint256 communityId, address verifier) external view returns (
        bool isVerifier,
        uint256 power,
        bool isBanned
    );
}

// Verificación de elegibilidad de verificadores en tiempo real
function _getEligiblePool(uint256 communityId) private view returns (
    address[] memory eligible,
    uint256[] memory powers
) {
    (address[] memory all, uint256[] memory allPowers) = verifierElection.getEligibleVerifiers(communityId);
    // Filtrar verificadores baneados y aplicar topes de poder
}
```

### Flujo de Trabajo de Contrato Compromisos

```solidity
// Contrato Compromisos llama VerifierManager para selección de jurado
function _selectVerificationJury(uint256 engagementId) external {
    uint256 communityId = _getEngagementCommunity(engagementId);
    uint256 seed = _generateEngagementSeed(engagementId);
    
    (address[] memory jurors, uint256[] memory powers) = 
        verifierManager.selectJurors(engagementId, communityId, seed);
    
    // Almacenar jurados seleccionados para proceso de verificación
}

// Integración de detección y reporte de fraude
function _reportVerifierMisconduct(uint256 engagementId, address[] calldata offenders) external {
    verifierManager.reportFraud(engagementId, community, offenders, evidenceCID);
}
```

### Configuración ParamController

```solidity
// La gobernanza comunitaria puede configurar parámetros de verificación
bytes32 public constant USE_VPT_WEIGHTING = keccak256("USE_VPT_WEIGHTING");
bytes32 public constant MAX_WEIGHT_PER_VERIFIER = keccak256("MAX_WEIGHT_PER_VERIFIER");
bytes32 public constant VERIFIER_PANEL_SIZE = keccak256("VERIFIER_PANEL_SIZE");
bytes32 public constant VERIFIER_MIN = keccak256("VERIFIER_MIN");

// Las actualizaciones dinámicas de parámetros afectan selecciones subsecuentes
function _adaptToNewParameters(uint256 communityId) {
    // El algoritmo de selección automáticamente usa parámetros más recientes
    // No se necesita migración - se aplica a nuevas selecciones inmediatamente
}
```

## 📊 Economía de Verificación

### Comparación de Métodos de Selección

**Beneficios de Selección Uniforme**:
- **Igualdad Democrática**: Cada verificador tiene probabilidad igual de selección
- **Anti-Plutocracia**: Previene que concentración de poder domine verificación
- **Justicia Simple**: Fácil de entender y verificar proceso de selección

**Beneficios de Selección Ponderada**:
- **Reconocimiento de Mérito**: Verificadores con mayor poder seleccionados más frecuentemente
- **Optimización de Calidad**: Las comunidades pueden ponderar selección hacia verificadores probados
- **Gobernanza Flexible**: Balance entre democracia y meritocracia

### Patrones de Configuración de Comunidad

```solidity
// Comunidad Democrática (participación igual)
paramController.setBool(communityId, USE_VPT_WEIGHTING, false);
paramController.setUint256(communityId, VERIFIER_PANEL_SIZE, 5);
paramController.setUint256(communityId, VERIFIER_MIN, 3);

// Comunidad Basada en Mérito (ponderada por rendimiento)  
paramController.setBool(communityId, USE_VPT_WEIGHTING, true);
paramController.setUint256(comunityId, MAX_WEIGHT_PER_VERIFIER, 200);
paramController.setUint256(comunityId, VERIFIER_PANEL_SIZE, 7);
paramController.setUint256(communityId, VERIFIER_MIN, 5);

// Comunidad de Alta Seguridad (paneles más grandes, mayor consenso)
paramController.setUint256(comunityId, VERIFIER_PANEL_SIZE, 11);
paramController.setUint256(comunityId, VERIFIER_MIN, 8);
```

## 🎛️ Ejemplos de Casos de Uso

### Verificación Estándar de Compromisos

```solidity
// 1. Contrato Compromisos inicia verificación
uint256 engagementId = engagements.submitEngagement(communityId, valuableActionId, evidenceCID);

// 2. VerifierManager selecciona jurado 5-de-7
(address[] memory jurors, uint256[] memory powers) = 
    verifierManager.selectJurors(engagementId, communityId, blockSeed);

// 3. Jurados seleccionados revisan evidencia y votan
for (uint i = 0; i < jurors.length; i++) {
    engagements.verifyEngagementVPS(engagementId, jurors[i], approved);
}

// 4. Compromisos alcanza umbral de 5 aprobaciones y aprueba
engagements.finalizeVerification(engagementId, true);
```

### Detección y Respuesta de Fraude

```solidity
// 1. Contrato Compromisos detecta patrón de verificación inconsistente
address[] memory suspiciousJurors = [juror1, juror3, juror5];

// 2. Reportar fraude con evidencia
verifierManager.reportFraud(engagementId, communityId, suspiciousJurors, "QmFraudEvidence123...");

// 3. Gobernanza comunitaria revisa reporte de fraude
// 4. VerifierElection implementa acción disciplinaria (baneo/reducción de poder)
verifierElection.banVerifiers(communityId, confirmedOffenders, "QmDisciplinaryAction456...");
```

### Optimización de Parámetros de Comunidad

```solidity
// Comunidad experimenta con diferentes enfoques de verificación

// Fase 1: Enfoque democrático (3-de-5, uniforme)
paramController.setBool(communityId, USE_VPT_WEIGHTING, false);
paramController.setUint256(comunityId, VERIFIER_PANEL_SIZE, 5);

// Fase 2: Enfoque basado en mérito (5-de-7, ponderado)
paramController.setBool(communityId, USE_VPT_WEIGHTING, true);
paramController.setUint256(comunityId, VERIFIER_PANEL_SIZE, 7);

// Fase 3: Enfoque de alta seguridad (7-de-9, ponderado con topes)
paramController.setUint256(comunityId, MAX_WEIGHT_PER_VERIFIER, 150);
paramController.setUint256(comunityId, VERIFIER_PANEL_SIZE, 9);
```

## 🚀 Características Avanzadas

### Analíticas y Monitoreo de Selección

```solidity
function getSelectionStats(uint256 communityId) external view returns (
    uint256 totalSelections,           // Selecciones totales de jurado para comunidad
    uint256 uniqueVerifiersSelected,   // Número de verificadores diferentes seleccionados
    uint256 averagePanelSize,         // Tamaño medio de jurado
    uint256 fraudReportsCount         // Número de reportes de fraude archivados
) {
    // Métricas de salud de verificación comunitaria
}
```

### Seguimiento de Rendimiento de Verificadores

```solidity
function getVerifierSelectionHistory(address verifier, uint256 communityId) external view returns (
    uint256[] memory engagementIds,   // Compromisos donde el verificador fue seleccionado
    uint256 totalSelections,          // Veces totales seleccionado como jurado
    uint256 recentSelections,         // Selecciones en últimos 30 días
    bool hasActiveFraudReports        // Reportes de fraude pendientes
) {
    // Análisis de actividad de verificador individual
}
```

### Patrones de Selección Inter-Comunitarios

```solidity
function getVerifierCommunityActivity(address verifier) external view returns (
    uint256[] memory activeCommunities,  // Comunidades donde el verificador participa
    uint256[] memory selectionCounts,    // Selecciones por comunidad
    uint256 totalCrossCommunitySel       // Selecciones totales a través de todas las comunidades
) {
    // Análisis de engagement de verificador multi-comunitario
}
```

## Notas de Implementación

### Estrategias de Optimización de Gas

**Algoritmo de Selección Eficiente**:
```solidity
// Minimizar operaciones de almacenamiento durante selección
address[] memory selected = new address[](panelSize);
uint256[] memory powers = new uint256[](panelSize);

// Actualización única de struct de selección
selections[engagementId] = JurorSelection({
    selectedJurors: selected,
    selectedPowers: powers,
    seed: seed,
    selectedAt: uint64(block.timestamp),
    completed: true
});
```

**Caché de Parámetros**:
```solidity
// Caché de parámetros accedidos frecuentemente
struct CommunityConfig {
    bool useWeighting;
    uint256 maxWeight;
    uint256 panelSize;
    uint256 minRequired;
}

// Cargar una vez, usar múltiples veces en lógica de selección
```

### Requisitos de Integración

**Dependencias Requeridas**:
- **VerifierElection**: Datos de elegibilidad y poder de verificadores
- **ParamController**: Parámetros de configuración específicos de comunidad
- **Contrato Compromisos**: Coordinación de flujo de trabajo de verificación

**Integraciones Opcionales**:
- **Panel de Analíticas**: Monitoreo de patrones de selección e insights comunitarios
- **Sistemas de Notificación**: Actualizaciones en tiempo real para jurados seleccionados
- **Sistemas de Reputación**: Seguimiento de rendimiento de verificadores inter-comunitarios

### Consideraciones de Despliegue

**Secuencia de Inicialización**:
1. Desplegar VerifierManager con direcciones de VerifierElection y ParamController
2. Establecer dirección inicial de contrato Compromisos (puede actualizarse después)
3. Configurar parámetros de verificación comunitarios vía ParamController
4. Inicializar conjuntos de verificadores vía VerifierElection
5. Comenzar procesamiento de compromisos con selección de jurados integrada

**Configuración de Comunidad**:
- Establecer estándares de parámetros de verificación para experiencia consistente
- Configurar procedimientos de reporte de fraude y protocolos de respuesta comunitaria
- Configurar monitoreo y analíticas para justicia de selección y rendimiento de verificadores
- Planificar ciclos de optimización de parámetros basados en experiencia de verificación comunitaria

---

El contrato VerifierManager proporciona **selección de jurados democrática y configurable** que balancea justicia, eficiencia y autonomía comunitaria en verificación de trabajo, habilitando a las comunidades a optimizar sus procesos de verificación mientras mantienen sistemas transparentes y responsables de control de calidad.