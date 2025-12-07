# Contrato VerifierElection

## 🎯 Propósito y Función

El contrato VerifierElection implementa **gestión de conjuntos de verificadores controlada por gobernanza** para el Sistema de Poder de Verificador (VPS) de Shift DeSoc. Gestiona la distribución de poder de verificador a través de gobernanza timelock en lugar de bonding económico, asegurando control democrático sobre la calidad de verificación de trabajo mientras mantiene la responsabilidad comunitaria.

## 🏗️ Arquitectura Central

### Estructura de Gestión de Conjuntos de Verificadores

```solidity
struct VerifierSet {
    address[] verifiers;              // Direcciones de verificadores actuales
    mapping(address => uint256) powers; // Cantidades de poder de verificadores
    uint256 totalPower;              // Poder total distribuido
    uint64 lastUpdated;             // Timestamp de última actualización
    string lastReasonCID;           // Hash IPFS de razón de actualización
}

mapping(uint256 => VerifierSet) public verifierSets;           // Conjuntos de verificadores por comunidad
mapping(uint256 => mapping(address => bool)) public bannedVerifiers;     // Verificadores baneados por comunidad
mapping(uint256 => mapping(address => uint64)) public bannedTimestamp;  // Timestamps de baneo para lógica de cooldown
```

### Modelo de Gobernanza Solo-Timelock

**Filosofía de Diseño**: Toda la gestión de verificadores requiere aprobación de gobernanza comunitaria a través de ejecución timelock, asegurando supervisión democrática sin barreras económicas para la participación.

## ⚙️ Funciones Clave y Lógica

### Gestión Completa de Conjuntos de Verificadores

```solidity
function setVerifierSet(
    uint256 communityId,
    address[] calldata addrs,
    uint256[] calldata weights,
    string calldata reasonCID
) external onlyTimelock
```

**Lógica de Implementación**:
1. **Validación**: Asegura coincidencia de longitud de arrays y pesos positivos
2. **Reconciliación de Poder**: Acuña poder faltante, quema poder exceso vía VerifierPowerToken1155
3. **Actualización de Estado**: Actualiza conjunto de verificadores con nuevas direcciones y distribución de poder
4. **Emisión de Eventos**: Registra cambio con hash de razón IPFS para transparencia

**Casos de Uso**:
- **Configuración Inicial**: Establecer conjunto de verificadores fundadores para nueva comunidad
- **Gestión de Calidad**: Remover verificadores con bajo rendimiento, añadir candidatos calificados
- **Rebalanceo de Poder**: Ajustar influencia de verificadores basada en reputación y actividad

### Ajuste Individual de Poder de Verificador

```solidity
function adjustVerifierPower(
    uint256 communityId,
    address verifier,
    uint256 newPower,
    string calldata reasonCID
) external onlyTimelock
```

**Operaciones de Precisión**:
- **Incrementar Poder**: Acuña tokens VPT adicionales al verificador
- **Decrementar Poder**: Quema tokens VPT exceso del verificador
- **Poder Cero**: Remueve verificador del conjunto activo preservando historial

### Sistema de Disciplina de Verificadores

```solidity
function banVerifiers(
    uint256 communityId,
    address[] calldata offenders,
    string calldata reasonCID
) external onlyTimelock
```

**Proceso Disciplinario**:
1. **Revocación de Poder**: Quema todos los tokens VPT de verificadores baneados
2. **Marcado de Exclusión**: Añade al mapeo de baneados para exclusión en selecciones futuras
3. **Registro de Timestamp**: Rastrea tiempo de baneo para períodos de cooldown potenciales
4. **Transparencia de Gobernanza**: Requiere hash de evidencia IPFS para responsabilidad

**Proceso de Restauración**:
```solidity
function unbanVerifier(
    uint256 communityId,
    address verifier,
    string calldata reasonCID
) external onlyTimelock
```

## 🛡️ Características de Seguridad

### Arquitectura de Control de Acceso

| Actor | Permisos | Aplicación |
|-------|----------|------------|
| **Solo Timelock** | Todas las funciones de gestión de verificadores | Modificador `onlyTimelock` |
| **Vista Pública** | Estado de verificadores y estadísticas de comunidad | Sin restricciones |
| **Sin Auto-Servicio** | Los verificadores no pueden modificar su propio poder | Requisito de gobernanza |

### Integración de Gobernanza Democrática

- **Proceso de Propuestas**: Todos los cambios requieren propuesta y votación de gobernanza
- **Retraso de Ejecución**: El retraso timelock permite revisión comunitaria de decisiones
- **Requisito de Transparencia**: Todas las acciones deben incluir evidencia/razonamiento IPFS
- **Historial Inmutable**: Todos los cambios de verificadores registrados permanentemente en cadena

### Protecciones Anti-Manipulación

```solidity
// Prevenir participación de verificadores baneados
if (bannedVerifiers[communityId][verifier]) {
    revert Errors.VerifierBanned(verifier, communityId);
}

// Prevenir asignaciones de poder cero sin remoción explícita
if (weight == 0 && !isRemoval) {
    revert Errors.InvalidInput("Use removal process for zero power");
}
```

## 🔗 Puntos de Integración

### Integración VerifierPowerToken1155

```solidity
interface IVPT1155 {
    function mint(address to, uint256 id, uint256 amount, string calldata reasonCID) external;
    function burn(address from, uint256 id, uint256 amount, string calldata reasonCID) external;
    function batchMint(address[] calldata to, uint256 id, uint256[] calldata amounts, string calldata reasonCID) external;
    function batchBurn(address[] calldata from, uint256 id, uint256[] calldata amounts, string calldata reasonCID) external;
}

// Gestión de poder sincronizada
function _syncVerifierPower(uint256 communityId, address verifier, uint256 currentPower, uint256 targetPower) private {
    if (targetPower > currentPower) {
        vpt.mint(verifier, communityId, targetPower - currentPower, reasonCID);
    } else if (targetPower < currentPower) {
        vpt.burn(verifier, communityId, currentPower - targetPower, reasonCID);
    }
}
```

### Integración de Selección VerifierManager

```solidity
function getEligibleVerifiers(uint256 communityId) external view returns (
    address[] memory eligibleVerifiers,
    uint256[] memory eligiblePowers
) {
    // Retorna verificadores no baneados con sus niveles de poder actuales
    // Usado por VerifierManager para selección de jurados M-de-N
}
```

### Integración de Parámetros de Comunidad

- **CommunityRegistry**: Lee requisitos de verificadores específicos de comunidad
- **ParamController**: Accede a parámetros de verificación establecidos por gobernanza
- **Contrato Claims**: Recibe reportes de fraude y recomendaciones disciplinarias

## 📊 Modelo Económico

### Estructura de Incentivos No-Económicos

**VPS vs Bonding Tradicional**:

| Bonding Tradicional | VPS (Sistema de Poder de Verificador) |
|---------------------|------------------------------|
| Stake económico requerido | Participación basada en mérito |
| Registro auto-bonding | Nominación por gobernanza |
| Slashing económico | Responsabilidad social |
| Influencia basada en riqueza | Poder controlado por comunidad |

### Aseguramiento de Calidad Controlado por Comunidad

**Mecanismos de Reputación**:
- **Seguimiento de Rendimiento**: VerifierManager reporta estadísticas de precisión
- **Revisión por Pares**: Evaluación comunitaria de calidad de verificación
- **Supervisión de Gobernanza**: Revisión y ajuste regular de conjuntos de verificadores
- **Disciplina Transparente**: Todos los baneos y cambios de poder requieren justificación pública

### Modelo de Participación Sostenible

**Incentivos a Largo Plazo**:
- **Reconocimiento**: Estado de verificador como señal de reputación comunitaria
- **Poder de Gobernanza**: Influencia de votación potencial basada en contribución de verificación
- **Recompensas Futuras**: Recompensas de tokens por trabajo de verificación preciso
- **Posición Comunitaria**: Construcción de capital social y confianza

## 🎛️ Ejemplos de Configuración

### Bootstrapping de Nueva Comunidad

```solidity
// Conjunto inicial de verificadores con miembros fundadores
address[] memory founders = [alice, bob, charlie];
uint256[] memory powers = [100, 100, 100];  // Poder inicial igual
string memory reason = "QmABC123...";        // IPFS: "Conjunto de verificadores fundadores de comunidad"

setVerifierSet(communityId, founders, powers, reason);
```

### Escalado de Comunidad Establecida

```solidity
// Añadir verificadores experimentados con niveles de poder variados
address[] memory verifiers = [existing1, existing2, newVerifier1, newVerifier2];
uint256[] memory powers = [150, 200, 50, 75];  // Distribución de poder basada en mérito
string memory reason = "QmDEF456...";          // IPFS: "Revisión de rendimiento de verificadores Q4"

setVerifierSet(communityId, verifiers, powers, reason);
```

### Respuesta de Gestión de Calidad

```solidity
// Remover verificadores con bajo rendimiento
address[] memory offenders = [badVerifier1, badVerifier2];
string memory evidence = "QmGHI789...";  // IPFS: Evidencia de baja precisión de verificación

banVerifiers(communityId, offenders, evidence);
```

## 🚀 Características Avanzadas

### Operaciones por Lotes para Eficiencia

```solidity
// Actualizaciones eficientes de conjuntos de verificadores
function setVerifierSet() soporta:
- Acuñación por lotes para nuevos verificadores
- Quemado por lotes para verificadores removidos  
- Transacción única para cambios completos de conjunto
- Reconciliación de poder optimizada para gas
```

### Estadísticas y Analíticas de Comunidad

```solidity
function getCommunityStats(uint256 communityId) external view returns (
    uint256 totalVerifiers,
    uint256 totalPower,
    uint256 bannedCount,
    uint64 lastUpdated
) {
    // Proporciona métricas de salud comunitaria para decisiones de gobernanza
}
```

### Seguimiento de Estado de Verificadores

```solidity
function getVerifierStatus(uint256 communityId, address verifier) external view returns (
    bool isVerifier,      // Actualmente tiene poder
    uint256 power,        // Cantidad de poder actual
    bool isBanned         // Estado de baneo
) {
    // Usado por VerifierManager para verificaciones de elegibilidad
}
```

## Notas de Implementación

### Estrategias de Optimización de Gas

**Reconciliación Eficiente de Poder**:
```solidity
// Minimizar operaciones de tokens VPT
if (oldPower > newPower) {
    vpt.burn(verifier, communityId, oldPower - newPower, reasonCID);
} else if (newPower > oldPower) {
    vpt.mint(verifier, communityId, newPower - oldPower, reasonCID);
}
// Sin operación si los poderes son iguales
```

**Beneficios del Procesamiento por Lotes**:
- Transacción única para múltiples cambios de verificadores
- Costos de gas reducidos comparado con operaciones individuales
- Actualizaciones atómicas previenen estados intermedios inconsistentes

### Requisitos de Integración

**Dependencias Requeridas**:
- **VerifierPowerToken1155**: Operaciones de acuñación y quemado de tokens VPT
- **Timelock Controller**: Control de retraso y ejecución de gobernanza
- **Infraestructura IPFS**: Almacenamiento descentralizado para razonamiento y evidencia

**Integraciones Opcionales**:
- **VerifierManager**: Selección de jurados y reporte de fraude
- **Contrato Claims**: Seguimiento de resultados de verificación y métricas de calidad
- **Panel de Analíticas**: Monitoreo de rendimiento de verificadores comunitarios

### Consideraciones de Despliegue

**Inicialización de Comunidad**:
1. Desplegar VerifierElection con direcciones de timelock y VPT
2. Inicializar comunidad en VerifierPowerToken1155
3. Establecer conjunto inicial de verificadores a través de propuesta de gobernanza
4. Configurar VerifierManager para usar VerifierElection para selección

**Configuración de Gobernanza**:
- Asegurar que timelock tenga TIMELOCK_ROLE en VerifierPowerToken1155
- Configurar retrasos apropiados de timelock para cambios de verificadores
- Establecer procedimientos de gobernanza comunitaria para gestión de verificadores
- Configurar infraestructura IPFS para documentación transparente de decisiones

---

El contrato VerifierElection establece **gobernanza de verificadores democrática** que prioriza el control comunitario y la responsabilidad social sobre las barreras económicas, habilitando sistemas de verificación de trabajo sostenibles y equitativos.