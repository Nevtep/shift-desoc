# Contrato CredentialManager (Gestor de Certificaciones)

> **Emisión de certificaciones de cursos con aprobación de verificador designado**

El contrato CredentialManager maneja la definición de cursos y el proceso de aplicación para certificaciones que resultan en SBTs de tipo CREDENTIAL.

---

## Resumen

| Propiedad | Valor |
|-----------|-------|
| **Capa** | Verificación (Capa 3) |
| **Tipo** | Contrato Gestor |
| **Hereda** | AccessControlUpgradeable |
| **Dependencias** | ValuableActionRegistry, CommunityRegistry |
| **SBT Emitido** | CREDENTIAL |

---

## Propósito

CredentialManager implementa el flujo de certificación de cursos:

1. Gobernanza/moderador define cursos disponibles
2. Participante aplica con evidencia de completación
3. Verificador designado aprueba la aplicación
4. Sistema acuña SBT CREDENTIAL

A diferencia de Engagements (verificación M-de-N), las certificaciones usan un **verificador único designado** por curso.

---

## Arquitectura

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CredentialManager                               │
├─────────────────────────────────────────────────────────────────────┤
│  Estado:                                                            │
│  • courses: mapping(courseId → CourseDefinition)                   │
│  • applications: mapping(appId → CredentialApplication)            │
│  • holderCredentials: mapping(holder → mapping(courseId → tokenId))│
├─────────────────────────────────────────────────────────────────────┤
│  Funciones Públicas:                                                │
│  • defineCourse(courseId, communityId, verifier, active)           │
│  • applyForCredential(courseId, evidence) → appId                  │
│  • approveApplication(appId) → tokenId                             │
│  • rejectApplication(appId, reason)                                 │
│  • revokeCredential(tokenId, courseId, reason)                     │
├─────────────────────────────────────────────────────────────────────┤
│  Dependencias:                                                      │
│  • ValuableActionRegistry: emisión de SBT CREDENTIAL               │
│  • CommunityRegistry: validación de comunidad                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Estructuras de Datos

```solidity
struct CourseDefinition {
    bytes32 courseId;           // Identificador único del curso
    uint256 communityId;        // Comunidad que ofrece el curso
    address verifier;           // Verificador designado (único)
    bool active;                // ¿Acepta nuevas aplicaciones?
    string metadataCID;         // Descripción, requisitos, etc.
    uint256 totalIssued;        // Certificaciones emitidas
}

struct CredentialApplication {
    uint256 appId;
    bytes32 courseId;
    address applicant;
    string evidenceCID;         // Prueba de completación
    ApplicationStatus status;
    uint64 appliedAt;
    uint64 processedAt;
    string rejectionReason;     // Si rechazada
    uint256 tokenId;            // Si aprobada
}

enum ApplicationStatus {
    PENDING,
    APPROVED,
    REJECTED
}
```

---

## Flujos de Trabajo

### Flujo 1: Definición de Curso

```solidity
function defineCourse(
    bytes32 courseId,
    uint256 communityId,
    address verifier,
    string calldata metadataCID,
    bool active
) external onlyGovernanceOrModerator(communityId) {
    require(courses[courseId].courseId == bytes32(0), "Course already exists");
    require(verifier != address(0), "Verifier required");
    
    courses[courseId] = CourseDefinition({
        courseId: courseId,
        communityId: communityId,
        verifier: verifier,
        active: active,
        metadataCID: metadataCID,
        totalIssued: 0
    });
    
    emit CourseDefined(courseId, communityId, verifier, metadataCID, active);
}
```

**Permisos**: Solo gobernanza o moderadores de la comunidad pueden definir cursos.

### Flujo 2: Aplicación

```solidity
function applyForCredential(
    bytes32 courseId,
    string calldata evidenceCID
) external returns (uint256 appId) {
    CourseDefinition storage course = courses[courseId];
    
    // 1. Validar curso existe y está activo
    require(course.courseId != bytes32(0), "Course not found");
    require(course.active, "Course not accepting applications");
    
    // 2. Verificar no tiene credencial ya
    require(
        holderCredentials[msg.sender][courseId] == 0,
        "Already holds credential"
    );
    
    // 3. Verificar no tiene aplicación pendiente
    require(
        !_hasPendingApplication(msg.sender, courseId),
        "Pending application exists"
    );
    
    // 4. Crear aplicación
    appId = ++applicationCounter;
    applications[appId] = CredentialApplication({
        appId: appId,
        courseId: courseId,
        applicant: msg.sender,
        evidenceCID: evidenceCID,
        status: ApplicationStatus.PENDING,
        appliedAt: uint64(block.timestamp),
        processedAt: 0,
        rejectionReason: "",
        tokenId: 0
    });
    
    emit ApplicationSubmitted(appId, courseId, msg.sender, evidenceCID);
}
```

### Flujo 3: Aprobación

```solidity
function approveApplication(
    uint256 appId,
    string calldata approvalMetadata
) external returns (uint256 tokenId) {
    CredentialApplication storage app = applications[appId];
    CourseDefinition storage course = courses[app.courseId];
    
    // 1. Validar llamante es verificador del curso
    require(msg.sender == course.verifier, "Only course verifier");
    
    // 2. Validar estado pendiente
    require(app.status == ApplicationStatus.PENDING, "Not pending");
    
    // 3. Actualizar aplicación
    app.status = ApplicationStatus.APPROVED;
    app.processedAt = uint64(block.timestamp);
    
    // 4. Acuñar SBT CREDENTIAL via ValuableActionRegistry
    tokenId = registry.issueCredential(
        course.communityId,
        app.applicant,
        app.courseId,
        approvalMetadata
    );
    
    app.tokenId = tokenId;
    
    // 5. Registrar credencial del holder
    holderCredentials[app.applicant][app.courseId] = tokenId;
    
    // 6. Incrementar contador
    course.totalIssued++;
    
    emit ApplicationApproved(appId, app.applicant, tokenId);
}
```

### Flujo 4: Rechazo

```solidity
function rejectApplication(
    uint256 appId,
    string calldata reason
) external {
    CredentialApplication storage app = applications[appId];
    CourseDefinition storage course = courses[app.courseId];
    
    // Solo verificador del curso
    require(msg.sender == course.verifier, "Only course verifier");
    require(app.status == ApplicationStatus.PENDING, "Not pending");
    
    app.status = ApplicationStatus.REJECTED;
    app.processedAt = uint64(block.timestamp);
    app.rejectionReason = reason;
    
    emit ApplicationRejected(appId, app.applicant, reason);
}
```

### Flujo 5: Revocación

```solidity
function revokeCredential(
    uint256 tokenId,
    bytes32 courseId,
    string calldata reason
) external onlyGovernance {
    CourseDefinition storage course = courses[courseId];
    address holder = registry.ownerOf(tokenId);
    
    // 1. Validar credencial pertenece a este curso
    require(holderCredentials[holder][courseId] == tokenId, "Token mismatch");
    
    // 2. Revocar via ValuableActionRegistry
    registry.revoke(tokenId, reason);
    
    // 3. Limpiar registro
    delete holderCredentials[holder][courseId];
    course.totalIssued--;
    
    emit CredentialRevoked(tokenId, courseId, holder, reason);
}
```

---

## Gestión de Cursos

### Actualizar Verificador

```solidity
function updateCourseVerifier(
    bytes32 courseId,
    address newVerifier
) external onlyGovernance {
    require(courses[courseId].courseId != bytes32(0), "Course not found");
    require(newVerifier != address(0), "Verifier required");
    
    address oldVerifier = courses[courseId].verifier;
    courses[courseId].verifier = newVerifier;
    
    emit CourseVerifierUpdated(courseId, oldVerifier, newVerifier);
}
```

### Activar/Desactivar Curso

```solidity
function setCourseActive(
    bytes32 courseId,
    bool active
) external onlyGovernanceOrModerator(courses[courseId].communityId) {
    require(courses[courseId].courseId != bytes32(0), "Course not found");
    
    courses[courseId].active = active;
    
    emit CourseStatusChanged(courseId, active);
}
```

---

## Consultas

```solidity
// Obtener definición de curso
function getCourse(bytes32 courseId) external view returns (CourseDefinition memory);

// Obtener aplicación
function getApplication(uint256 appId) external view returns (CredentialApplication memory);

// Verificar si holder tiene credencial
function hasCredential(address holder, bytes32 courseId) external view returns (bool) {
    return holderCredentials[holder][courseId] != 0;
}

// Obtener tokenId de credencial
function getCredentialToken(address holder, bytes32 courseId) external view returns (uint256) {
    return holderCredentials[holder][courseId];
}

// Listar aplicaciones pendientes por curso
function getPendingApplications(bytes32 courseId) external view returns (uint256[] memory appIds);

// Listar cursos por comunidad
function getCommunnityCourses(uint256 communityId) external view returns (bytes32[] memory courseIds);
```

---

## Eventos

```solidity
event CourseDefined(
    bytes32 indexed courseId,
    uint256 indexed communityId,
    address verifier,
    string metadataCID,
    bool active
);

event CourseVerifierUpdated(
    bytes32 indexed courseId,
    address oldVerifier,
    address newVerifier
);

event CourseStatusChanged(
    bytes32 indexed courseId,
    bool active
);

event ApplicationSubmitted(
    uint256 indexed appId,
    bytes32 indexed courseId,
    address indexed applicant,
    string evidenceCID
);

event ApplicationApproved(
    uint256 indexed appId,
    address indexed applicant,
    uint256 tokenId
);

event ApplicationRejected(
    uint256 indexed appId,
    address indexed applicant,
    string reason
);

event CredentialRevoked(
    uint256 indexed tokenId,
    bytes32 indexed courseId,
    address indexed holder,
    string reason
);
```

---

## Control de Acceso

| Rol | Permisos |
|-----|----------|
| `ANYONE` | Aplicar a cursos activos |
| `COURSE_VERIFIER` | Aprobar/rechazar aplicaciones de su curso |
| `MODERATOR` | Definir cursos, activar/desactivar |
| `GOVERNANCE` | Todas las operaciones, revocar credenciales |

---

## Diferencias con Otros Gestores

| Aspecto | CredentialManager | Engagements | PositionManager |
|---------|-------------------|-------------|-----------------|
| Verificación | Un verificador designado | Panel M-de-N | Un verificador designado |
| Resultado | SBT CREDENTIAL | SBT WORK | SBT POSITION → ROLE |
| Duración | Permanente (hasta revocación) | Única | Período definido |
| Pagos | Sin pago automático | CommunityToken | Participación ingresos |
| Gobernanza | Solo revocación | Solo parámetros | Cierre + revocación |

---

## Casos de Uso

### 1. Certificación de Formación

```
Curso: "Onboarding Comunitario"
Verificador: Coordinador de educación
Proceso:
  1. Nuevo miembro completa módulos de formación
  2. Envía evidencia (quiz completado, asistencia)
  3. Coordinador aprueba
  4. SBT CREDENTIAL acuñado
  5. Miembro puede acceder a funciones avanzadas
```

### 2. Licencia Profesional

```
Curso: "Licencia de Verificador"
Verificador: Comité de gobernanza
Proceso:
  1. Candidato demuestra experiencia
  2. Presenta portfolio de verificaciones
  3. Comité evalúa y aprueba
  4. SBT CREDENTIAL emitido
  5. Candidato elegible para VerifierElection
```

### 3. Certificación de Competencia

```
Curso: "Desarrollador Solidity Nivel 2"
Verificador: Lead técnico de la comunidad
Proceso:
  1. Desarrollador completa proyecto de evaluación
  2. Presenta código + documentación
  3. Lead técnico revisa y aprueba
  4. SBT CREDENTIAL acuñado
  5. Desarrollador puede tomar proyectos avanzados
```

---

## Integración

### Con ValuableActionRegistry

```solidity
// CredentialManager llama a registry para acuñar
function issueCredential(
    uint256 communityId,
    address recipient,
    bytes32 courseId,
    string calldata metadata
) external onlyCredentialManager returns (uint256 tokenId) {
    return _mintSBT(
        communityId,
        recipient,
        TokenKind.CREDENTIAL,
        0, // Sin actionTypeId para credenciales
        metadata
    );
}
```

### Con Otros Contratos

```
CredentialManager
    ├── ValuableActionRegistry (emisión SBT)
    │   └── ValuableActionSBT (almacenamiento)
    ├── CommunityRegistry (validación comunidad)
    └── AccessControl (permisos verificador)
```

---

## Seguridad

### Protecciones

| Vector | Mitigación |
|--------|------------|
| Credencial duplicada | Verificación pre-aplicación |
| Aplicación spam | Una aplicación pendiente por curso |
| Verificador malicioso | Revocación por gobernanza |
| Suplantación | Solo verificador designado puede aprobar |

### Invariantes

1. Un holder solo puede tener una credencial por curso
2. Solo el verificador designado puede aprobar/rechazar
3. Solo gobernanza puede revocar credenciales
4. Cursos inactivos no aceptan aplicaciones
5. Aplicaciones rechazadas pueden reaplicar después
