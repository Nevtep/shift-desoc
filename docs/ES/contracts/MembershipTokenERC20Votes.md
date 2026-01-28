# Contrato MembershipTokenERC20Votes

## 🎯 Propósito y Función

El **MembershipTokenERC20Votes** sirve como el **token de gobernanza basado puramente en mérito** para comunidades Shift DeSoc. A diferencia de tokens tradicionales que pueden comprarse, los MembershipTokens **solo pueden ganarse completando ValuableActions verificadas**. Esto crea un sistema de gobernanza donde el poder de voto está directamente vinculado a contribuciones probadas en lugar de inversión financiera.

**Principio Central**: "Gobernanza basada puramente en mérito donde el poder de voto se GANA, no se compra" - los tokens se acuñan solo cuando se aprueban Compromisos para completar ValuableActions.

**Estado Actual**: ⚡ **Listo para Producción** - Token de gobernanza simple y seguro con controles de acuñación basados en roles y cobertura de pruebas integral.

## 🏗️ Arquitectura Central

### Sistema de Tokens Solo por Mérito

**Diseño Simple y Seguro**:

```solidity
contract MembershipTokenERC20Votes is ERC20, ERC20Votes, ERC20Permit, AccessControlEnumerable {
    /// @notice Rol para contratos que pueden acuñar tokens (Engagements, CommunityFactory)
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Límite máximo de suministro para prevenir ataques de inflación
    uint256 public constant MAX_SUPPLY = 100_000_000 ether; // 100M tokens máximo

    /// @notice ID de comunidad a la que pertenece este token
    uint256 public immutable communityId;

    /// @notice Poder de voto de gobernanza puro - 1 token = 1 voto
    function getVotes(address account) public view override returns (uint256) {
        return super.getVotes(account); // Delegación estándar ERC20Votes
    }
}
```

**Filosofía de Arquitectura**:

- **Simplicidad sobre complejidad** - Sin sistemas híbridos ni multiplicadores de reputación
- **Mérito sobre capital** - Los tokens solo pueden acuñarse mediante verificación de trabajo completado
- **Seguridad primero** - Control de acceso basado en roles con supervisión de gobernanza
- **Cumplimiento estándar** - Implementación pura de OpenZeppelin para máxima compatibilidad

### Sistema de Delegación de Votos

**Representación Flexible**:

```solidity
// Heredado de ERC20Votes
function delegate(address delegatee) public override {
    _delegate(msg.sender, delegatee);
}

function delegateBySig(
    address delegatee,
    uint256 nonce,
    uint256 expiry,
    uint8 v,
    bytes32 r,
    bytes32 s
) public override {
    // Delegación sin gas mediante firmas
    _delegate(signer, delegatee);
}
```

**Seguimiento de Votos**:

- **Snapshots Históricos**: Pesos de votos en números de bloque específicos para creación de propuestas
- **Cadena de Delegación**: Delegación multinivel con detección de ciclos
- **Actualizaciones en Tiempo Real**: Los pesos de votos se actualizan automáticamente en transferencias de tokens
- **Operaciones Sin Gas**: Integración de permiso EIP-2612 para meta-transacciones

## ⚙️ Funciones y Lógica Clave

### Acuñación de Tokens (Solo Basada en Mérito)

```solidity
function mint(address to, uint256 amount, string calldata reason) external onlyRole(MINTER_ROLE) {
    if (to == address(0)) revert Errors.ZeroAddress();
    if (amount == 0) revert Errors.InvalidInput("Amount cannot be zero");

    // Verificar límite de suministro
    uint256 newTotalSupply = totalSupply() + amount;
    if (newTotalSupply > MAX_SUPPLY) {
        revert Errors.InvalidInput("Would exceed max supply");
    }

    _mint(to, amount);
    emit TokensMintedForWork(to, amount, msg.sender, reason);
}
```

**Mecanismos de Distribución (Solo por Mérito)**:

- **SIN Distribución Inicial** - Suministro de tokens cero al despliegue
- **SOLO Recompensas por Trabajo** - Tokens acuñados cuando Compromisos son aprobados por VPS (VerifierManager + verificación democrática)
- **SIN Mecanismo de Compra** - No puede comprarse con ETH/USDC
- **SIN Recompensas de Staking** - Solo ganados mediante contribuciones verificadas
- **Bootstrap de Fundadores** - CommunityFactory acuña tokens iniciales solo para fundadores durante la creación de comunidad

### Integración de Gobernanza

```solidity
// Sistema estándar de snapshot ERC20Votes (heredado de OpenZeppelin)
function getPastVotes(address account, uint256 blockNumber)
    public view override returns (uint256)
{
    return super.getPastVotes(account, blockNumber);
}

function getPastTotalSupply(uint256 blockNumber)
    public view override returns (uint256)
{
    return super.getPastTotalSupply(blockNumber);
}
```

**Características de Gobernanza**:

- **Integración Estándar OpenZeppelin**: Funciona con cualquier contrato Governor directamente
- **Soporte de Delegación**: Delegación completa ERC20Votes con delegación por firma
- **Snapshots Históricos**: Pesos de votos bloqueados en creación de propuesta previenen manipulación
- **Poder de Voto Simple**: 1 token = 1 voto, sin cálculos complejos

### Acuñación por Lotes para Eficiencia

```solidity
function batchMint(
    address[] calldata recipients,
    uint256[] calldata amounts,
    string calldata reason
) external onlyRole(MINTER_ROLE) {
    // Acuñación por lotes eficiente en gas para distribución de fundadores de CommunityFactory
}
```

**Casos de Uso**:

- **Bootstrap de Comunidad**: CommunityFactory acuña tokens iniciales para fundadores
- **Recompensas Masivas**: Contrato Engagements acuña tokens para múltiples compromisos aprobados
- **Optimización de Gas**: Costos de transacción reducidos para múltiples destinatarios

## 🛡️ Características de Seguridad

### Control de Acceso Estricto

```solidity
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

/// @notice Solo contratos autorizados pueden acuñar tokens
function mint(address to, uint256 amount, string calldata reason) external onlyRole(MINTER_ROLE) {
    // Validación estricta y verificaciones de límite de suministro
}
```

**Gestión de Roles**:

- **MINTER_ROLE**: Solo contrato Engagements y CommunityFactory pueden acuñar tokens
- **GOVERNANCE_ROLE**: Gobernanza comunitaria para gestión de roles y funciones de emergencia
- **DEFAULT_ADMIN_ROLE**: Configuración inicial y operaciones administrativas
- **Sin PAUSER_ROLE**: Sin mecanismo de pausa - los tokens siempre deben ser transferibles para gobernanza

### Protección de Límite de Suministro

```solidity
/// @notice Límite máximo de suministro para prevenir ataques de inflación
uint256 public constant MAX_SUPPLY = 100_000_000 ether; // 100M tokens máximo

function mint(address to, uint256 amount, string calldata reason) external onlyRole(MINTER_ROLE) {
    uint256 newTotalSupply = totalSupply() + amount;
    if (newTotalSupply > MAX_SUPPLY) {
        revert Errors.InvalidInput("Would exceed max supply");
    }
    _mint(to, amount);
}
```

**Mecanismos de Protección**:

- **Límite Duro de Suministro**: No puede acuñarse más de 100M tokens en total
- **Acuñación Solo por Mérito**: Sin mecanismo de compra previene ataques de inflación
- **Control Basado en Roles**: Solo contratos autorizados pueden acuñar
- **Supervisión de Gobernanza**: La comunidad puede revocar permisos de acuñación

### Funciones de Emergencia de Gobernanza

```solidity
function emergencyBurn(address from, uint256 amount) external onlyRole(GOVERNANCE_ROLE) {
    // Quema de emergencia para gobernanza - solo en situaciones extremas
    _burn(from, amount);
}

function grantMinterRole(address account) external onlyRole(GOVERNANCE_ROLE) {
    _grantRole(MINTER_ROLE, account);
}
```

**Poderes de Emergencia**:

- **Quema de Emergencia**: La gobernanza puede quemar tokens si es necesario (ej. cuenta comprometida)
- **Gestión de Roles**: Agregar/remover acuñadores autorizados vía gobernanza
- **Sin Mecanismo de Pausa**: Las transferencias siempre funcionan para prevenir bloqueo de gobernanza

## 🔗 Puntos de Integración

### Integración con Sistema de Compromisos

El MembershipToken se acuña automáticamente cuando los trabajadores completan trabajo verificado:

```solidity
// En Engagements.sol - acuñar tokens de gobernanza en verificación exitosa de trabajo
function approveEngagement(uint256 engagementId) external {
    Engagement storage engagement = engagements[engagementId];

    // Obtener recompensa de configuración de ValuableAction
    ValuableAction memory action = valuableActionRegistry.getAction(engagement.actionId);

    // Acuñar tokens de gobernanza al trabajador basado en valor de trabajo completado
    membershipToken.mint(
        engagement.worker,
        action.membershipTokenReward,
        string(abi.encodePacked("Work verified - Engagement:", engagementId))
    );
}
```

### Integración con Community Factory

```solidity
// En CommunityFactory.sol - fundadores obtienen tokens iniciales para gobernanza de bootstrap
function createCommunity(CommunityParams calldata params) external returns (uint256 communityId) {
    // Desplegar MembershipToken para la nueva comunidad
    MembershipTokenERC20Votes membershipToken = new MembershipTokenERC20Votes(
        communityId,
        params.name,
        params.symbol
    );

    // Otorgar tokens iniciales a fundadores para gobernanza de bootstrap
    for (uint i = 0; i < params.founders.length; i++) {
        membershipToken.mint(params.founders[i], params.founderTokens, "Community founder");
    }
}
```

### Con ShiftGovernor

```solidity
// ShiftGovernor consulta elegibilidad y poder de voto
function getVotes(address account, uint256 blockNumber) public view returns (uint256) {
    // Relación simple 1:1 de token a poder de voto - solo basado en mérito
    return membershipToken.getPastVotes(account, blockNumber);
}

function propose(...) public returns (uint256) {
    // Debe haber ganado tokens mínimos mediante trabajo para proponer
    require(
        getVotes(msg.sender, block.number - 1) >= proposalThreshold(),
        "Insufficient governance tokens from completed work"
    );

    return super.propose(targets, values, calldatas, description);
}
```

### Integración con Operaciones de Tesorería

```solidity
// En TreasuryAdapter.sol - gobernanza controla gastos
function spendFunds(address recipient, uint256 amount, string calldata purpose)
    external
    onlyRole(TREASURER_ROLE)
{
    require(
        membershipToken.getVotes(msg.sender) >= minimumTreasurerTokens,
        "Insufficient governance tokens for treasurer role"
    );

    // Ejecutar gasto autorizado
    communityToken.transfer(recipient, amount);
    emit FundsSpent(recipient, amount, purpose);
}
```

## 📊 Modelo Económico

### Distribución de Tokens Solo por Mérito

**Sin Suministro Inicial**: A diferencia de tokens tradicionales, los MembershipTokens tienen cero asignación inicial:

```solidity
constructor(uint256 _communityId, string memory name, string memory symbol)
    ERC20(name, symbol)
    ERC20Permit(name)
{
    communityId = _communityId;
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    // Sin acuñación inicial - todos los tokens deben ganarse
}
```

**Emisión Basada en Trabajo**:

- **✅ Compromisos Verificados**: Tokens acuñados cuando la comunidad aprueba trabajo completado
- **✅ Bootstrap de Fundadores**: Asignación inicial mínima para inicio de comunidad
- **❌ Sin Compras**: No se puede comprar poder de gobernanza con dinero
- **❌ Sin Airdrops**: Sin distribución gratuita - debe contribuirse valor

### Economía de Gobernanza

**Requisitos de Participación**:

```solidity
function proposalThreshold() public view override returns (uint256) {
    uint256 totalSupply = membershipToken.totalSupply();

    // Comenzar bajo para comunidades pequeñas, escalar con crecimiento
    if (totalSupply < 1000e18) return 10e18;        // 10 tokens mínimo
    if (totalSupply < 10000e18) return 100e18;      // 100 tokens cuando mediana
    return (totalSupply * 100) / 10000;             // 1% para comunidades grandes
}
```

**Modelo de Gobernanza Simple**:

- **Votación 1:1**: Un token = un voto, sin cálculos complejos
- **Basado en Mérito**: El poder de voto debe ganarse mediante trabajo verificado
- **Suministro Limitado**: Máximo 100M tokens previene ataques de inflación
- **Sin Ruta de Compra**: No se puede comprar influencia de gobernanza con dinero

### Protección Anti-Plutocracia

**Defensa de Límite de Suministro**:

```solidity
uint256 public constant MAX_SUPPLY = 100_000_000 ether; // Límite duro previene concentración

function mint(address to, uint256 amount, string calldata reason) external onlyRole(MINTER_ROLE) {
    require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds maximum supply");
    _mint(to, amount);
    emit TokensMinted(to, amount, reason);
}
```

**Acceso Solo por Mérito**:

- **Verificación de Trabajo Requerida**: Todos los tokens ganados mediante sistema de Compromisos
- **Sin Mercado Secundario**: Enfoque en contribución, no especulación
- **Control de Gobernanza**: La comunidad puede revocar permisos de acuñación
- **Asignación Transparente**: Todos los eventos de acuñación registrados con razones

## 🎛️ Ejemplos de Configuración

### Despliegue Básico de Comunidad

```solidity
// Desplegar vía CommunityFactory para nueva comunidad
CommunityFactory factory = new CommunityFactory();

CommunityParams memory params = CommunityParams({
    name: "Dev Collective",
    symbol: "DEVC",
    founders: [founder1, founder2, founder3],
    founderTokens: 1000e18,  // 1000 tokens cada uno para gobernanza inicial
    initialValuableActions: [codeReview, bugFix, documentation]
});

uint256 communityId = factory.createCommunity(params);
```

### Distribución de Tokens Basada en Trabajo

```solidity
// Configuración de ValuableAction impulsa distribución de tokens
ValuableAction memory codeReview = ValuableAction({
    membershipTokenReward: 100e18,    // 100 tokens de gobernanza por revisión de código
    communityTokenReward: 50e18,      // 50 USDC crédito salarial equivalente
    jurorsMin: 2,                     // 2 revisores deben aprobar
    panelSize: 3,                     // De pool de 3 revisores potenciales
    evidenceTypes: GITHUB_PR | IPFS_REPORT,
    cooldownPeriod: 1 days           // Máximo 1 revisión por día por persona
});

// Tokens acuñados automáticamente cuando compromisos son aprobados
// Sin distribución manual necesaria
```

### Configuración Simple de Gobernanza

```solidity
// ShiftGovernor usa Governor estándar de OpenZeppelin con MembershipToken
ShiftGovernor governor = new ShiftGovernor(
    IVotes(membershipToken),    // Poder de voto de tokens ganados
    timelock,                   // 48 horas de retraso de ejecución
    7200,                       // 1 día de retraso de votación
    50400,                      // 1 semana de período de votación
    100e18,                     // 100 tokens para proponer (ganados mediante trabajo)
    1000e18                     // 1000 tokens quórum mínimo
);

// Sin cálculos complejos de reputación - votación simple basada en mérito
```

## 🚀 Características Avanzadas

### Soporte de Permiso EIP-2612

El token incluye soporte de transacciones sin gas vía EIP-2612:

```solidity
// Funcionalidad de permiso incorporada de ERC20Permit
function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external;

// Habilita delegación y transferencias sin gas
function delegateBySig(
    address delegatee,
    uint256 nonce,
    uint256 expiry,
    uint8 v,
    bytes32 r,
    bytes32 s
) external;
```

**Beneficios**:

- **Gobernanza Sin Gas**: Los usuarios pueden votar sin tener ETH
- **Accesibilidad Móvil**: Participación más fácil desde billeteras móviles
- **Mejora de Onboarding**: Eliminar barreras de gas para nuevos miembros

### Operaciones por Lotes

```solidity
function batchMint(
    address[] calldata recipients,
    uint256[] calldata amounts,
    string[] calldata reasons
) external onlyRole(MINTER_ROLE) {
    require(recipients.length == amounts.length && amounts.length == reasons.length,
           "Array length mismatch");

    for (uint256 i = 0; i < recipients.length; i++) {
        mint(recipients[i], amounts[i], reasons[i]);
    }
}
```

**Características de Optimización**:

- **Eficiente en Gas**: Agrupar múltiples operaciones en una sola transacción
- **Rastro de Auditoría**: Razones individuales para cada acuñación de token
- **Seguridad de Roles**: Mismos controles de acceso que operaciones individuales

## 📈 Consideraciones Futuras

### Patrones de Crecimiento de Comunidad

**Desafíos de Escalado**:

- **Distribución de Tokens**: Cómo mantener distribución justa mientras la comunidad crece
- **Participación en Gobernanza**: Prevenir apatía de votantes en comunidades grandes
- **Verificación de Mérito**: Escalar el sistema de Compromisos con membresía incrementada
- **Sostenibilidad Económica**: Equilibrar recompensas de tokens con tesorería comunitaria

### Oportunidades de Integración

**Compatibilidad Cross-Protocolo**:

```solidity
// ERC20Votes estándar habilita integración con herramientas de gobernanza existentes
interface IGovernanceIntegration {
    function getVotingPower(address token, address account) external view returns (uint256);
    function delegateAcrossProtocols(address token, address delegate) external;
}
```

**Mejoras Potenciales**:

- **Votación Multi-Comunidad**: Gobernanza federada entre comunidades relacionadas
- **Votación Cuadrática**: Mecanismos de votación alternativos para tipos específicos de propuestas
- **Votación Ponderada por Tiempo**: Miembros más antiguos obtienen influencia ligeramente mayor
- **Integración de Reputación**: Futura integración con sistema de reputación ValuableActionSBT

### Consideraciones de Seguridad

**Robustez a Largo Plazo**:

- **Protección de Límite de Suministro**: Límite de 100M tokens previene ataques de inflación
- **Gestión de Roles**: La gobernanza controla todos los permisos críticos
- **Procedimientos de Emergencia**: Poderes de emergencia mínimos para prevenir captura de gobernanza
- **Ruta de Actualización**: Considerar patrones de proxy para correcciones de bugs críticos

El contrato MembershipTokenERC20Votes proporciona una base sólida para gobernanza basada en mérito que puede evolucionar con las necesidades de la comunidad mientras mantiene el principio central: **el poder de gobernanza debe ganarse mediante contribuciones valiosas, no comprarse con dinero**.
