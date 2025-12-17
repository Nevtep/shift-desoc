# Contrato RequestHub

## 🎯 Propósito y Función

El **RequestHub** implementa un foro de discusión descentralizado completamente en cadena donde los miembros de la comunidad publican necesidades, ideas y colaboran en el desarrollo de soluciones que eventualmente se convierten en propuestas accionables. Sirve como punto de entrada para toda la actividad comunitaria, proporcionando el espacio de deliberación colaborativa que alimenta el pipeline de gobernanza de Shift DeSoc.

## 🏗️ Arquitectura Central

### Estructuras de Datos

```solidity
struct RequestMeta {
    uint256 id;                     // ID único de la request
    uint256 communityId;            // Comunidad donde se publica
    address author;                 // Creador de la request
    string title;                   // Título descriptivo
    string contentCID;              // Contenido principal en IPFS
    RequestStatus status;           // Estado actual
    uint256 createdAt;              // Timestamp de creación
    uint256 lastActivityAt;         // Última actividad (comentarios/actualizaciones)
    string[] tags;                  // Tags para categorización y descubrimiento
    uint256 upvotes;               // Votos de apoyo de la comunidad
    uint256 bountyAmount;          // Recompensa opcional adjunta
    uint256 linkedActionTypeId;    // ActionType asociado para reclamos
    uint256[] linkedDraftIds;      // Borradores derivados de esta request
}

enum RequestStatus {
    OPEN_DEBATE,    // Abierta para discusión activa
    FROZEN,         // Congelada por moderadores (sin nuevos comentarios)
    ARCHIVED,       // Archivada (inactiva pero visible)
    RESOLVED        // Resuelta através de draft/propuesta aprobada
}

struct Comment {
    uint256 id;                     // ID único del comentario
    uint256 requestId;              // Request padre
    uint256 parentCommentId;        // Comentario padre (0 si es raíz)
    address author;                 // Autor del comentario
    string contentCID;              // Contenido en IPFS
    uint256 createdAt;              // Timestamp de creación
    uint256 upvotes;               // Votos de apoyo
    bool hidden;                    // Oculto por moderación
}
```

### Sistema de Threads

- **Estructura Jerárquica**: Comentarios anidados con referencias padre-hijo
- **Indexación Temporal**: Ordenamiento cronológico de actividad
- **Categorización**: Sistema de tags flexible para organización
- **Moderación**: Controles granulares de contenido y spam

## ⚙️ Funciones y Lógica Clave

### Creación de Requests

```solidity
function createRequest(
    string calldata title,
    string calldata contentCID,
    string[] calldata tags,
    uint256 bountyAmount,
    uint256 actionTypeId
) external payable returns (uint256 requestId) {
    
    // Verificar elegibilidad del autor
    require(_isEligibleToPost(msg.sender), "No elegible para publicar");
    require(bytes(title).length > 0 && bytes(title).length <= 200, "Título inválido");
    require(tags.length <= MAX_TAGS, "Demasiados tags");
    
    // Verificar stake anti-spam si es requerido
    if (postingStakeRequired) {
        require(msg.value >= POSTING_STAKE, "Stake insuficiente");
        postingStakes[msg.sender] += msg.value;
    }
    
    // Crear nueva request
    requestId = ++nextRequestId;
    RequestMeta storage newRequest = requests[requestId];
    
    newRequest.id = requestId;
    newRequest.communityId = _getCommunityId(msg.sender);
    newRequest.author = msg.sender;
    newRequest.title = title;
    newRequest.contentCID = contentCID;
    newRequest.status = RequestStatus.OPEN_DEBATE;
    newRequest.createdAt = block.timestamp;
    newRequest.lastActivityAt = block.timestamp;
    newRequest.tags = tags;
    newRequest.bountyAmount = bountyAmount;
    newRequest.linkedActionTypeId = actionTypeId;
    
    // Actualizar índices
    authorRequests[msg.sender].push(requestId);
    communityRequests[newRequest.communityId].push(requestId);
    
    // Actualizar rate limiting
    lastPostTime[msg.sender] = block.timestamp;
    
    emit RequestCreated(requestId, msg.sender, title, contentCID);
    
    // Configurar bounty si se especifica
    if (bountyAmount > 0 && actionTypeId != 0) {
        _setupBounty(requestId, bountyAmount, actionTypeId);
    }
    
    return requestId;
}
```

### Sistema de Comentarios

```solidity
function postComment(
    uint256 requestId,
    uint256 parentCommentId,
    string calldata contentCID
) external returns (uint256 commentId) {
    
    RequestMeta storage request = requests[requestId];
    require(request.id != 0, "Request no existe");
    require(request.status == RequestStatus.OPEN_DEBATE, "Request cerrada para comentarios");
    require(_canComment(msg.sender, requestId), "No autorizado para comentar");
    
    // Verificar rate limiting
    require(
        lastCommentTime[msg.sender] + COMMENT_COOLDOWN <= block.timestamp,
        "En cooldown de comentarios"
    );
    
    // Verificar comentario padre si existe
    if (parentCommentId != 0) {
        require(comments[parentCommentId].requestId == requestId, "Comentario padre inválido");
    }
    
    // Crear nuevo comentario
    commentId = ++nextCommentId;
    Comment storage newComment = comments[commentId];
    
    newComment.id = commentId;
    newComment.requestId = requestId;
    newComment.parentCommentId = parentCommentId;
    newComment.author = msg.sender;
    newComment.contentCID = contentCID;
    newComment.createdAt = block.timestamp;
    
    // Actualizar actividad de request
    request.lastActivityAt = block.timestamp;
    
    // Actualizar índices
    requestComments[requestId].push(commentId);
    authorComments[msg.sender].push(commentId);
    
    // Actualizar rate limiting
    lastCommentTime[msg.sender] = block.timestamp;
    
    emit CommentPosted(commentId, requestId, msg.sender, parentCommentId, contentCID);
    
    return commentId;
}
```

### Sistema de Votación de Apoyo

```solidity
function upvoteRequest(uint256 requestId) external {
    RequestMeta storage request = requests[requestId];
    require(request.id != 0, "Request no existe");
    require(!hasUpvoted[requestId][msg.sender], "Ya votaste");
    require(_canVote(msg.sender), "No elegible para votar");
    
    hasUpvoted[requestId][msg.sender] = true;
    request.upvotes++;
    
    // Otorgar reputación al autor si alcanza umbral
    if (request.upvotes == UPVOTE_REPUTATION_THRESHOLD) {
        _rewardAuthor(request.author, UPVOTE_REPUTATION_REWARD);
    }
    
    emit RequestUpvoted(requestId, msg.sender, request.upvotes);
}

function upvoteComment(uint256 commentId) external {
    Comment storage comment = comments[commentId];
    require(comment.id != 0, "Comentario no existe");
    require(!hasUpvotedComment[commentId][msg.sender], "Ya votaste");
    require(_canVote(msg.sender), "No elegible para votar");
    
    hasUpvotedComment[commentId][msg.sender] = true;
    comment.upvotes++;
    
    emit CommentUpvoted(commentId, msg.sender, comment.upvotes);
}
```

## 🛡️ Características de Seguridad

### Control de Spam y Moderación

```solidity
// Moderación basada en roles
modifier onlyModerator(uint256 requestId) {
    uint256 communityId = requests[requestId].communityId;
    require(
        hasRole(GLOBAL_MODERATOR_ROLE, msg.sender) ||
        communityRegistry.hasRole(communityId, msg.sender, COMMUNITY_MODERATOR_ROLE),
        "No es moderador"
    );
    _;
}

function freezeRequest(uint256 requestId, string calldata reason) 
    external onlyModerator(requestId) {
    RequestMeta storage request = requests[requestId];
    require(request.status == RequestStatus.OPEN_DEBATE, "Solo requests abiertas pueden congelarse");
    
    request.status = RequestStatus.FROZEN;
    
    emit RequestFrozen(requestId, msg.sender, reason);
}

function hideComment(uint256 commentId, string calldata reason) 
    external onlyModerator(comments[commentId].requestId) {
    Comment storage comment = comments[commentId];
    require(!comment.hidden, "Comentario ya oculto");
    
    comment.hidden = true;
    
    emit CommentHidden(commentId, msg.sender, reason);
}
```

### Rate Limiting y Anti-Spam

```solidity
function _isEligibleToPost(address user) internal view returns (bool) {
    // Verificar rate limiting
    if (lastPostTime[user] + POST_COOLDOWN > block.timestamp) {
        return false;
    }
    
    // Verificar requisitos de membership
    if (requireWorkerSBT && workerSBT.balanceOf(user) == 0) {
        return false;
    }
    
    // Verificar minimum token balance
    if (membershipToken.balanceOf(user) < MIN_TOKEN_BALANCE) {
        return false;
    }
    
    // Verificar que no esté en lista negra
    if (isBlacklisted[user]) {
        return false;
    }
    
    return true;
}

// Sistema de stake recuperable para prevenir spam
function reclaimPostingStake(uint256 requestId) external {
    RequestMeta storage request = requests[requestId];
    require(request.author == msg.sender, "No eres el autor");
    require(
        request.status != RequestStatus.FROZEN || // No congelada
        block.timestamp > request.createdAt + STAKE_LOCK_PERIOD, // O periodo expirado
        "Stake aún bloqueado"
    );
    
    uint256 stakeAmount = postingStakes[msg.sender];
    require(stakeAmount > 0, "Sin stake para reclamar");
    
    postingStakes[msg.sender] = 0;
    payable(msg.sender).transfer(stakeAmount);
    
    emit StakeReclaimed(msg.sender, stakeAmount);
}
```

## 🔗 Puntos de Integración

### Con DraftsManager

```solidity
function createDraftFromRequest(uint256 requestId, string calldata draftTitle) 
    external returns (uint256 draftId) {
    RequestMeta storage request = requests[requestId];
    require(request.id != 0, "Request no existe");
    require(_canCreateDraft(msg.sender, requestId), "No autorizado");
    
    // Crear draft vinculado en DraftsManager
    draftId = draftsManager.createDraftFromRequest(requestId, draftTitle, msg.sender);
    
    // Actualizar vínculos
    request.linkedDraftIds.push(draftId);
    requestDrafts[requestId].push(draftId);
    
    emit DraftCreatedFromRequest(requestId, draftId, msg.sender);
    
    return draftId;
}

// Callback desde DraftsManager cuando draft es aprobado
function notifyRequestResolved(uint256 requestId, uint256 approvedDraftId) 
    external onlyDraftsManager {
    RequestMeta storage request = requests[requestId];
    request.status = RequestStatus.RESOLVED;
    
    emit RequestResolved(requestId, approvedDraftId);
}
```

### Con Claims (Sistema de Bounties)

```solidity
function _setupBounty(uint256 requestId, uint256 bountyAmount, uint256 actionTypeId) internal {
    require(actionTypeRegistry.isValidActionType(actionTypeId), "ActionType inválido");
    
    // Reservar fondos para bounty
    bytes32 bountyId = keccak256(abi.encodePacked("bounty", requestId));
    communityToken.reserveFunds(bountyId, bountyAmount, address(this));
    
    requestBounties[requestId] = BountyInfo({
        amount: bountyAmount,
        actionTypeId: actionTypeId,
        active: true,
        claimIds: new uint256[](0)
    });
    
    emit BountyCreated(requestId, actionTypeId, bountyAmount);
}

function submitBountyClaim(uint256 requestId, string calldata evidenceCID) 
    external returns (uint256 claimId) {
    BountyInfo storage bounty = requestBounties[requestId];
    require(bounty.active, "Bounty no activo");
    
    // Crear claim en Claims contract
    claimId = claims.submitClaim(bounty.actionTypeId, evidenceCID, abi.encode(requestId));
    
    // Vincular claim a bounty
    bounty.claimIds.push(claimId);
    claimToBounty[claimId] = requestId;
    
    emit BountyClaimSubmitted(requestId, claimId, msg.sender);
}
```

## 📊 Modelo Económico

### Sistema de Bounties

```solidity
struct BountyInfo {
    uint256 amount;              // Cantidad de recompensa
    uint256 actionTypeId;        // Tipo de trabajo requerido
    bool active;                 // Estado del bounty
    uint256[] claimIds;          // Claims enviados
    uint256 winnerClaimId;       // Claim ganador (0 si no hay)
}

function awardBounty(uint256 requestId, uint256 winningClaimId) 
    external onlyClaimsContract {
    BountyInfo storage bounty = requestBounties[requestId];
    require(bounty.active, "Bounty no activo");
    require(_isValidClaim(winningClaimId, requestId), "Claim inválido");
    
    bounty.active = false;
    bounty.winnerClaimId = winningClaimId;
    
    // Transferir bounty al ganador
    address winner = claims.getClaimWorker(winningClaimId);
    bytes32 bountyPaymentId = keccak256(abi.encodePacked("bounty_award", requestId));
    communityToken.executePayment(bountyPaymentId, winner, bounty.amount);
    
    emit BountyAwarded(requestId, winningClaimId, winner, bounty.amount);
}
```

### Incentivos de Participación

```solidity
// Recompensas por contenido de calidad
function rewardQualityContent(uint256 requestId) external onlyGovernance {
    RequestMeta storage request = requests[requestId];
    
    if (request.upvotes >= QUALITY_THRESHOLD) {
        uint256 reward = QUALITY_CONTENT_REWARD;
        membershipToken.mint(request.author, reward);
        
        emit QualityContentRewarded(requestId, request.author, reward);
    }
}

// Penalizaciones por spam
function penalizeSpamContent(uint256 requestId) external onlyModerator(requestId) {
    RequestMeta storage request = requests[requestId];
    
    // Confiscar posting stake
    uint256 stake = postingStakes[request.author];
    if (stake > 0) {
        postingStakes[request.author] = 0;
        // Enviar stake confiscado a tesorería comunitaria
        communityTreasury.transfer(stake);
    }
    
    // Aplicar cooldown extendido
    lastPostTime[request.author] = block.timestamp + SPAM_PENALTY_COOLDOWN;
    
    emit SpamPenaltyApplied(requestId, request.author, stake);
}
```

## 🎛️ Ejemplos de Configuración

### Configuración para Comunidad de Desarrollo

```solidity
// Parámetros para comunidad técnica activa
RequestHubConfig memory devConfig = RequestHubConfig({
    postCooldown: 1 hours,           // Permitir posts frecuentes
    commentCooldown: 5 minutes,      // Comentarios rápidos
    postingStake: 0.01 ether,        // Stake bajo para participación
    minTokenBalance: 10e18,          // 10 tokens mínimo
    requireWorkerSBT: false,         // No requerir SBT para posts iniciales
    maxTags: 5,                      // Hasta 5 tags por post
    qualityThreshold: 25,            // 25 upvotes para recompensa
    spamPenaltyCooldown: 7 days      // Cooldown semanal por spam
});
```

### Configuración para Comunidad de Contenido

```solidity
// Parámetros para comunidad de creadores
RequestHubConfig memory contentConfig = RequestHubConfig({
    postCooldown: 6 hours,           // Posts más espaciados
    commentCooldown: 2 minutes,      // Comentarios muy frecuentes
    postingStake: 0.005 ether,       // Stake menor para creativos
    minTokenBalance: 5e18,           // Barrera de entrada más baja
    requireWorkerSBT: false,         // Acceso abierto inicial
    maxTags: 10,                     // Más tags para categorización
    qualityThreshold: 50,            // Umbral más alto para contenido
    spamPenaltyCooldown: 3 days      // Recuperación más rápida
});
```

## 🚀 Características Avanzadas

### Descubrimiento y Búsqueda

```solidity
function getRequestsByTag(string calldata tag, uint256 limit) 
    external view returns (uint256[] memory requestIds) {
    // Implementar búsqueda por tag con paginación
}

function getTrendingRequests(uint256 timeWindow, uint256 limit) 
    external view returns (uint256[] memory) {
    // Requests con más actividad reciente
}

function getRequestsNeedingAttention(uint256 communityId) 
    external view returns (uint256[] memory) {
    // Requests con bounties sin resolver, alta actividad, etc.
}
```

### Análisis de Comunidad

```solidity
function getCommunityMetrics(uint256 communityId) external view returns (
    uint256 totalRequests,
    uint256 activeRequests, 
    uint256 totalBounties,
    uint256 averageResolutionTime,
    uint256 participationRate
) {
    // Calcular métricas de salud de la comunidad
}
```

### Notificaciones y Feeds

```solidity
event RequestActivity(
    uint256 indexed requestId,
    address indexed actor,
    ActivityType activityType,
    uint256 timestamp
);

enum ActivityType {
    CREATED,
    COMMENTED,
    UPVOTED,
    DRAFT_CREATED,
    BOUNTY_CLAIMED,
    RESOLVED
}
```

El RequestHub proporciona el espacio de deliberación colaborativa esencial donde las comunidades identifican necesidades, discuten soluciones y coordinan el trabajo que impulsa el ecosistema Shift DeSoc hacia adelante.