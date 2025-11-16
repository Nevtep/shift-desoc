# Contrato ShiftGovernor

ShiftGovernor es el contrato de gobernanza listo para producción de Shift DeSoc que extiende el Governor de OpenZeppelin con capacidades de votación multi-opción. Proporciona tanto votación binaria tradicional como votación innovadora de múltiples opciones de preferencia para la toma de decisiones comunitarias matizadas.

## 🎯 Propósito y Función

ShiftGovernor sirve como el **motor de toma de decisiones democrático** de las comunidades Shift DeSoc al:
- Gestionar la creación de propuestas, votación y ejecución segura a través de timelock
- Soportar tanto votación binaria (sí/no) como multi-opción (distribución de preferencias)
- Integrarse perfectamente con CountingMultiChoice para recuento avanzado de votos
- Coordinarse con MembershipTokenERC20Votes para poder de voto basado en méritos
- Proporcionar interfaces limpias para aplicaciones frontend de gobernanza

**Enfoque de Producción**: Entrega funcionalidad de gobernanza esencial con fundamentos de seguridad probados de OpenZeppelin en lugar de características experimentales.

## 🏗️ Arquitectura Central

### Sistema de Votación Dual

ShiftGovernor soporta dos modos de votación dentro de la misma infraestructura de gobernanza:

**Votación Binaria** (Tradicional):
```solidity
// Votación estándar del Governor de OpenZeppelin
function castVote(uint256 proposalId, uint8 support) external
// support: 0=En Contra, 1=A Favor, 2=Abstención
```

**Votación Multi-Opción** (Innovación):
```solidity
// Distribuir poder de voto entre múltiples opciones
function castVoteMultiChoice(
    uint256 proposalId, 
    uint256[] calldata weights,
    string calldata reason
) external
```

### Implementación Multi-Opción

#### Creación de Propuestas
```solidity
function proposeMultiChoice(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description,
    uint8 numOptions
) public returns (uint256 proposalId) {
    proposalId = propose(targets, values, calldatas, description);
    _numOptions[proposalId] = numOptions;
    
    if (multiCounter != address(0)) {
        ICountingMultiChoice(multiCounter).enableMulti(proposalId, numOptions);
    }
}
```

**Características Clave**:
- Extiende las propuestas estándar de OpenZeppelin con capacidad multi-opción
- Mantiene total compatibilidad con la infraestructura Governor existente
- Separación limpia entre creación de propuestas y conteo de votos

## ⚙️ Flujo de Trabajo de Gobernanza

### 1. Ciclo de Vida de Propuestas

```solidity
// Propuesta binaria (heredada de OpenZeppelin)
uint256 proposalId = propose(targets, values, calldatas, "Decisión simple");

// Propuesta multi-opción (Innovación Shift)  
uint256 multiId = proposeMultiChoice(
    targets, values, calldatas, 
    "Decisión compleja con opciones", 
    4  // Número de opciones de voto
);
```

### 2. Proceso de Votación

**Votación Binaria**:
```solidity
// Votación estándar de OpenZeppelin
castVote(proposalId, 1); // A Favor
castVote(proposalId, 0); // En Contra  
castVote(proposalId, 2); // Abstención
```

**Votación Multi-Opción**:
```solidity
// Distribuir 100% del poder de voto entre opciones
uint256[] memory weights = new uint256[](4);
weights[0] = 0.5e18;  // 50% a Opción A
weights[1] = 0.3e18;  // 30% a Opción B  
weights[2] = 0.2e18;  // 20% a Opción C
weights[3] = 0;       // 0% a Opción D

castVoteMultiChoice(proposalId, weights, "Mi razonamiento");
```

### 3. Ejecución de Propuestas

```solidity
// Ambos tipos de propuestas usan el mismo mecanismo de ejecución
execute(
    targets,
    values, 
    calldatas,
    keccak256(bytes(description))
);
```

**Seguridad de Timelock**: Todas las propuestas aprobadas pasan por un retraso de timelock antes de la ejecución, proporcionando seguridad contra decisiones apresuradas.

## 🛡️ Características de Seguridad

### Integración OpenZeppelin Probada
```solidity
contract ShiftGovernor is Governor, GovernorSettings, GovernorCountingSimple, 
                          GovernorVotes, GovernorVotesQuorumFraction, 
                          GovernorTimelockControl {
    
    // Toda la lógica central se basa en contratos OpenZeppelin auditados
    // Extensiones personalizadas mínimas y enfocadas
}
```

### Control de Acceso Multi-Opción
```solidity
modifier onlyMultiCounter() {
    if (msg.sender != multiCounter) {
        revert Errors.UnauthorizedAccess(msg.sender, "Multi counter only");
    }
    _;
}
```

### Validación de Parámetros
- **Validación de pesos**: Los pesos de votación multi-opción deben sumar ≤ 100%
- **Límites de opciones**: El número de opciones está limitado para prevenir ataques de complejidad
- **Verificaciones de estado**: Solo se permite votación durante períodos de votación activos

## 🔄 Integración de Sistemas

### Con CountingMultiChoice
```solidity
// ShiftGovernor delega el conteo multi-opción a un contrato especializado
function _countVote(
    uint256 proposalId,
    address account,
    uint8 support,
    uint256 weight,
    bytes memory params
) internal virtual override returns (uint256) {
    if (_isMultiChoice(proposalId) && multiCounter != address(0)) {
        return ICountingMultiChoice(multiCounter).countVote(
            proposalId, account, support, weight, params
        );
    }
    
    return super._countVote(proposalId, account, support, weight, params);
}
```

### Con MembershipTokenERC20Votes
```solidity
// El poder de voto se deriva de tokens de gobernanza basados en méritos
constructor(
    IVotes _token,    // MembershipTokenERC20Votes
    TimelockController _timelock
) Governor("ShiftGovernor") 
  GovernorVotes(_token)
  GovernorTimelockControl(_timelock) {
    
    // El poder de voto se basa en contribuciones verificadas de trabajo
}
```

### Con DraftsManager
```solidity
// Las propuestas pueden originarse desde borradores comunitarios
function proposeFromDraft(
    uint256 draftId,
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description,
    bool isMultiChoice,
    uint8 numOptions
) external returns (uint256 proposalId) {
    
    // Verificar que el borrador está listo para escalamiento
    require(draftsManager.isDraftReadyForProposal(draftId), "Draft not ready");
    
    if (isMultiChoice && numOptions > 1) {
        proposalId = proposeMultiChoice(targets, values, calldatas, description, numOptions);
    } else {
        proposalId = propose(targets, values, calldatas, description);
    }
    
    // Vincular propuesta con borrador de origen
    draftProposals[draftId] = proposalId;
}
```

## 📊 Casos de Uso Multi-Opción

### Selección de Proveedores
```solidity
// Votar entre múltiples proveedores con distribución de preferencias
string memory description = "Selección de Proveedor de Desarrollo: "
    "Opción A: TechCorp ($50k, 3 meses), "
    "Opción B: DevStudio ($40k, 4 meses), "
    "Opción C: FreelanceTeam ($35k, 5 meses), "
    "Opción D: Desarrollo Interno ($60k, 2 meses)";

uint256 proposalId = proposeMultiChoice(
    targets,      // Contratos para ejecutar después de la decisión
    values,       // Valores a pasar
    calldatas,    // Datos de llamada de función
    description,
    4            // 4 opciones de proveedor
);
```

### Asignación de Presupuesto
```solidity
// Distribuir presupuesto comunitario entre categorías
string memory description = "Asignación de Presupuesto Q1 ($100k total): "
    "Opción A: Desarrollo (40%), "
    "Opción B: Marketing (25%), " 
    "Opción C: Operaciones (20%), "
    "Opción D: Reservas (15%)";

// Los votantes pueden expresar preferencias por múltiples categorías
```

### Características de Producto
```solidity
// Priorización de características con preferencias matizadas
string memory description = "Prioridades de Desarrollo Q2: "
    "Opción A: Aplicación Móvil, "
    "Opción B: Integración de IA, "
    "Opción C: Herramientas de Análisis, "
    "Opción D: Mejoras de UI/UX";

// Permite a la comunidad expresar preferencias complejas
```

## 🔍 Integración Frontend

### Getters Esenciales para UI
```solidity
// Verificar tipo de propuesta
function isMultiChoice(uint256 proposalId) external view returns (bool)
function getNumOptions(uint256 proposalId) external view returns (uint8)

// Estado de propuesta y cronometraje
function state(uint256 proposalId) public view override returns (ProposalState)
function proposalDeadline(uint256 proposalId) public view override returns (uint256)
function proposalSnapshot(uint256 proposalId) public view override returns (uint256)

// Poder de voto y participación
function getVotes(address account, uint256 timepoint) public view override returns (uint256)
function hasVoted(uint256 proposalId, address account) public view override returns (bool)
```

### Seguimiento de Eventos
```solidity
// Eventos estándar del Governor (heredados)
event ProposalCreated(uint256 indexed proposalId, address indexed proposer, ...);
event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason);

// Eventos específicos de multi-opción
event MultiChoiceProposalCreated(uint256 indexed proposalId, uint8 numOptions);
event MultiChoiceVoteCast(address indexed voter, uint256 indexed proposalId, uint256[] weights, string reason);
```

## 📈 Características Avanzadas

### Configuración Dinámica
```solidity
// Parámetros configurables por gobernanza
function setVotingDelay(uint256 newVotingDelay) public override onlyGovernance
function setVotingPeriod(uint256 newVotingPeriod) public override onlyGovernance
function setProposalThreshold(uint256 newProposalThreshold) public override onlyGovernance

// Gestión del módulo multi-opción
function setMultiCounter(address _multiCounter) external onlyGovernance
```

### Análisis de Votación
```solidity
// Las métricas de participación están disponibles a través de CountingMultiChoice
function getVotingAnalytics(uint256 proposalId) external view returns (
    uint256 totalVotes,
    uint256 participationRate, 
    uint256[] memory optionTotals,
    bool quorumReached
) {
    if (_isMultiChoice(proposalId)) {
        return ICountingMultiChoice(multiCounter).getProposalAnalytics(proposalId);
    }
    
    // Retornar análisis de votación binaria
    return _getBinaryVotingAnalytics(proposalId);
}
```

### Integración de Timelock
```solidity
// Control completo de timelock con retrasos configurables
function updateTimelock(TimelockController newTimelock) external onlyGovernance
function proposalEta(uint256 proposalId) public view override returns (uint256)

// Las propuestas ejecutadas pasan por seguridad de timelock
```

## 🎛️ Ejemplos de Configuración

### Gobernanza de Desarrollo Ágil
```solidity
// Parámetros optimizados para iteración rápida
ShiftGovernor governor = new ShiftGovernor({
    token: membershipToken,
    timelock: timelockController,
    initialVotingDelay: 1 days,      // Inicio de voto rápido
    initialVotingPeriod: 3 days,     // Ventana de voto corta
    initialProposalThreshold: 100e18, // 100 tokens para proponer
    quorumFraction: 10               // 10% de quórum
});
```

### Gobernanza de Consenso Comunitario
```solidity
// Parámetros para decisiones consideradas
ShiftGovernor governor = new ShiftGovernor({
    token: membershipToken,
    timelock: timelockController,
    initialVotingDelay: 3 days,      // Más tiempo para debate
    initialVotingPeriod: 7 days,     // Ventana de voto extendida
    initialProposalThreshold: 1000e18, // Mayor barrera para proponer
    quorumFraction: 25               // 25% de quórum para legitimidad
});
```

## 📋 Flujo de Trabajo de Producción

### 1. Creación de Propuesta Estándar
```solidity
// Para decisiones binarias simples
uint256 proposalId = propose(
    [treasuryAddress],
    [0],
    [abi.encodeWithSignature("transfer(address,uint256)", recipient, amount)],
    "Transferir 1000 USDC a equipo de desarrollo"
);
```

### 2. Creación de Propuesta Multi-Opción
```solidity
// Para decisiones complejas con múltiples alternativas
uint256 proposalId = proposeMultiChoice(
    [registryAddress, registryAddress, registryAddress],
    [0, 0, 0],
    [
        abi.encodeWithSignature("setParameter(string,uint256)", "param1", value1),
        abi.encodeWithSignature("setParameter(string,uint256)", "param2", value2), 
        abi.encodeWithSignature("setParameter(string,uint256)", "param3", value3)
    ],
    "Configuración de Parámetros Comunitarios: Opción A (Conservador), Opción B (Moderado), Opción C (Agresivo)",
    3
);
```

**Listo para Producción**: ShiftGovernor proporciona gobernanza democrática robusta con extensiones multi-opción innovadoras, construido sobre fundamentos de seguridad probados de OpenZeppelin mientras habilita la expresión de preferencias comunitarias matizadas.

---

*Esta documentación refleja la implementación de producción enfocada en funcionalidad esencial de gobernanza con extensiones multi-opción, en lugar de características teóricas no implementadas.*