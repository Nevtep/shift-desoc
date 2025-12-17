# Contrato MembershipTokenERC20Votes

## 🎯 Propósito y Función

El **MembershipTokenERC20Votes** implementa el token de gobernanza central para comunidades Shift DeSoc, combinando funcionalidad estándar ERC-20 con capacidades de votación ponderadas por reputación. Habilita participación democrática en la toma de decisiones comunitarias mientras otorga influencia adicional a contribuyentes verificados del trabajo.

## 🏗️ Arquitectura Central

### Modelo de Votación Híbrido

```solidity
contract MembershipTokenERC20Votes is ERC20, ERC20Permit, ERC20Votes, AccessControl {
    IWorkerSBT public immutable workerSBT;
    uint256 public constant BASE_VOTING_POWER = 1e18;      // 1 token = 1 voto base
    uint256 public constant MAX_SBT_MULTIPLIER = 5e18;     // Hasta 5x multiplicador SBT
    uint256 public constant SBT_SCALING_FACTOR = 100e18;   // Factor de escalamiento de puntos SBT
    
    mapping(address => bool) public eligibleVoters;        // Lista blanca de votantes
    mapping(address => uint256) public lastVoteTimestamp;  // Anti-spam de votación
    
    uint256 public minVotingBalance = 10e18;               // Balance mínimo para votar
    uint256 public proposalThreshold = 100e18;             // Tokens requeridos para proponer
}
```

### Estructura de Delegación

```solidity
// Heredado de ERC20Votes - delegación estándar de OpenZeppelin
function delegate(address delegatee) public virtual override {
    require(eligibleVoters[delegatee], "Delegado no elegible");
    _delegate(_msgSender(), delegatee);
}

// Poder de voto personalizado incluye multiplicador SBT
function getVotes(address account) public view virtual override returns (uint256) {
    uint256 baseVotes = super.getVotes(account);
    return _applyReputationMultiplier(account, baseVotes);
}
```

## ⚙️ Funciones y Lógica Clave

### Cálculo de Poder de Voto Ponderado por Reputación

```solidity
function _applyReputationMultiplier(address voter, uint256 baseVotes) 
    internal view returns (uint256) {
    if (baseVotes == 0) return 0;
    
    // Obtener puntos efectivos de WorkerSBT
    uint256 sbtPoints = 0;
    if (workerSBT.balanceOf(voter) > 0) {
        uint256 tokenId = workerSBT.tokenOfOwnerByIndex(voter, 0);
        sbtPoints = workerSBT.calculateEffectivePoints(tokenId);
    }
    
    // Calcular multiplicador basado en puntos SBT
    uint256 multiplier = BASE_VOTING_POWER;
    if (sbtPoints > 0) {
        uint256 sbtBonus = (sbtPoints * 1e18) / SBT_SCALING_FACTOR;
        multiplier = BASE_VOTING_POWER + sbtBonus;
        
        // Limitar al multiplicador máximo
        if (multiplier > MAX_SBT_MULTIPLIER) {
            multiplier = MAX_SBT_MULTIPLIER;
        }
    }
    
    return (baseVotes * multiplier) / BASE_VOTING_POWER;
}
```

### Gestión de Elegibilidad de Votantes

```solidity
function setVoterEligibility(address voter, bool eligible) 
    external onlyRole(GOVERNANCE_ROLE) {
    eligibleVoters[voter] = eligible;
    emit VoterEligibilityChanged(voter, eligible);
}

function batchSetEligibility(address[] calldata voters, bool[] calldata eligibility)
    external onlyRole(GOVERNANCE_ROLE) {
    require(voters.length == eligibility.length, "Arrays desiguales");
    
    for (uint256 i = 0; i < voters.length; i++) {
        eligibleVoters[voters[i]] = eligibility[i];
        emit VoterEligibilityChanged(voters[i], eligibility[i]);
    }
}
```

### Acuñación y Distribución Controladas

```solidity
function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
    require(to != address(0), "Dirección inválida");
    require(amount > 0, "Monto inválido");
    
    _mint(to, amount);
    
    // Habilitar automáticamente eligibilidad de votante para nuevos holders
    if (!eligibleVoters[to] && balanceOf(to) >= minVotingBalance) {
        eligibleVoters[to] = true;
        emit VoterEligibilityChanged(to, true);
    }
}

function burnFrom(address account, uint256 amount) public virtual override {
    require(hasRole(BURNER_ROLE, _msgSender()) || account == _msgSender(), 
            "No autorizado para quemar");
    
    _spendAllowance(account, _msgSender(), amount);
    _burn(account, amount);
    
    // Remover elegibilidad si balance cae por debajo del mínimo
    if (balanceOf(account) < minVotingBalance) {
        eligibleVoters[account] = false;
        emit VoterEligibilityChanged(account, false);
    }
}
```

## 🛡️ Características de Seguridad

### Control de Acceso Granular

```solidity
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

// Solo la gobernanza puede ajustar parámetros críticos
function updateVotingParameters(
    uint256 newMinBalance,
    uint256 newProposalThreshold
) external onlyRole(GOVERNANCE_ROLE) {
    require(newMinBalance > 0 && newProposalThreshold >= newMinBalance, 
            "Parámetros inválidos");
    
    minVotingBalance = newMinBalance;
    proposalThreshold = newProposalThreshold;
    
    emit VotingParametersUpdated(newMinBalance, newProposalThreshold);
}
```

### Prevención de Manipulación de Votación

```solidity
function _beforeTokenTransfer(address from, address to, uint256 amount) 
    internal virtual override(ERC20, ERC20Votes) {
    super._beforeTokenTransfer(from, to, amount);
    
    // Prevenir transferencias durante votación activa para prevenir manipulación
    if (from != address(0) && to != address(0)) {
        require(block.timestamp > lastVoteTimestamp[from] + VOTE_COOLDOWN,
                "Transferencia bloqueada durante cooldown de votación");
    }
}

// Registrar timestamp de votación para cooldown
function _afterTokenTransfer(address from, address to, uint256 amount)
    internal virtual override(ERC20, ERC20Votes) {
    super._afterTokenTransfer(from, to, amount);
    
    // Actualizar elegibilidad basada en nuevos balances
    _updateVoterEligibility(from);
    _updateVoterEligibility(to);
}
```

## 🔗 Puntos de Integración

### Con ShiftGovernor

```solidity
// ShiftGovernor consulta elegibilidad y poder de voto
function hasVotes(address account, uint256 blockNumber) external view returns (uint256) {
    if (!eligibleVoters[account]) return 0;
    
    uint256 historicalVotes = getPastVotes(account, blockNumber);
    return _applyReputationMultiplier(account, historicalVotes);
}

// Verificar umbral de propuesta
function meetsProposalThreshold(address proposer) external view returns (bool) {
    return eligibleVoters[proposer] && 
           getVotes(proposer) >= proposalThreshold;
}
```

### Con WorkerSBT (Multiplicador de Reputación)

```solidity
// Escuchar eventos de cambio de WorkerSBT para recalcular poder de voto
function onWorkerSBTUpdate(address worker, uint256 newPoints) external {
    require(msg.sender == address(workerSBT), "Solo WorkerSBT");
    
    // Emitir evento para actualización de UI
    emit ReputationMultiplierUpdated(worker, newPoints);
    
    // Recalcular checkpoints de delegación si es necesario
    _writeCheckpoint(_delegates[worker], _subtract, _applyReputationMultiplier(worker, 0));
}
```

## 📊 Modelo Económico

### Distribución de Suministro

**Suministro Inicial**:
```solidity
constructor(
    string memory name,
    string memory symbol,
    address workerSBTAddress,
    address initialAdmin
) ERC20(name, symbol) ERC20Permit(name) {
    workerSBT = IWorkerSBT(workerSBTAddress);
    
    _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    _grantRole(GOVERNANCE_ROLE, initialAdmin);
    
    // Acuñar suministro inicial para bootstrap de gobernanza
    _mint(initialAdmin, INITIAL_SUPPLY);
}
```

**Estrategia de Distribución**:
- Miembros fundadores: 30% (bootstrap de gobernanza inicial)
- Pool de contribuyentes: 50% (distribuido a través de trabajo verificado)
- Tesorería de comunidad: 15% (desarrollo de ecosistema)
- Reserva futura: 5% (expansión de comunidad)

### Incentivos de Participación

**Recompensas de Votación**:
```solidity
function rewardActiveVoter(address voter, uint256 proposalId) external onlyGovernor {
    if (hasVotedOnProposal[proposalId][voter]) {
        uint256 reward = VOTING_REWARD_AMOUNT;
        _mint(voter, reward);
        emit VotingRewardPaid(voter, proposalId, reward);
    }
}
```

## 🎛️ Ejemplos de Configuración

### Configuración de Comunidad de Desarrollo

```solidity
// Parámetros para comunidad de desarrollo de software
MembershipTokenERC20Votes devToken = new MembershipTokenERC20Votes(
    "DevCommunity Governance",
    "DEVCGOV",
    workerSBTAddress,
    communityMultisig
);

// Configurar parámetros de votación específicos para desarrolladores
devToken.updateVotingParameters(
    25e18,   // 25 tokens mínimo para votar (evitar spammers)
    250e18   // 250 tokens para crear propuestas (participantes serios)
);

// Configurar límites de multiplicador más altos para comunidad técnica
devToken.updateMultiplierParameters(
    200e18,  // Factor de escalamiento más alto (más sensible a experiencia)
    10e18    // Multiplicador máximo más alto (hasta 10x para expertos)
);
```

### Configuración de Comunidad de Contenido

```solidity
// Parámetros para comunidad de creación de contenido
MembershipTokenERC20Votes contentToken = new MembershipTokenERC20Votes(
    "ContentCreator Governance",
    "CCGOV",
    workerSBTAddress,
    contentDAO
);

// Umbrales más bajos para participación más amplia
contentToken.updateVotingParameters(
    5e18,    // Solo 5 tokens para votar (más inclusivo)
    50e18    // 50 tokens para propuestas (barrera de entrada más baja)
);
```

## 🚀 Características Avanzadas

### Delegación Líquida

**Delegación Multi-Nivel**:
```solidity
function liquidDelegate(address primaryDelegate, address fallbackDelegate) 
    external {
    require(eligibleVoters[primaryDelegate] && eligibleVoters[fallbackDelegate],
            "Delegados no elegibles");
    
    // Establecer delegación primaria con fallback para ausencias
    _delegate(_msgSender(), primaryDelegate);
    
    emit LiquidDelegationSet(_msgSender(), primaryDelegate, fallbackDelegate);
}
```

### Análisis de Participación de Gobernanza

**Métricas de Participación**:
```solidity
function getGovernanceMetrics(address account) external view returns (
    uint256 votingPower,
    uint256 reputationMultiplier,
    uint256 proposalsCreated,
    uint256 votesParticipated,
    bool isEligible
) {
    votingPower = getVotes(account);
    reputationMultiplier = _getReputationMultiplier(account);
    proposalsCreated = proposalCounts[account];
    votesParticipated = voteCounts[account];
    isEligible = eligibleVoters[account];
}
```

### Integración de Snapshot de Votación

**Capacidades de Snapshot**:
- Snapshot automático de balances en la creación de propuestas
- Prevención de manipulación de poder de voto post-propuesta
- Consulta histórica de distribución de poder de voto
- Compatibilidad con herramientas de votación off-chain

El MembershipTokenERC20Votes proporciona la infraestructura de gobernanza democrática pero meritocrática necesaria para comunidades Shift DeSoc, equilibrando participación amplia con recompensas por contribución verificada.