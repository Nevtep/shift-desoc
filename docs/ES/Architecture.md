# Arquitectura del Sistema Shift DeSoc

Este documento proporciona una visión general de alto nivel de la arquitectura del sistema Shift DeSoc, interacciones de componentes y patrones de flujo de datos tanto para stakeholders técnicos como de negocio.

## 🏗️ Visión General del Sistema

Shift DeSoc implementa una **arquitectura modular, nativa de blockchain** diseñada para escalabilidad, seguridad y capacidad de actualización. La plataforma consiste en contratos inteligentes interconectados que gestionan gobernanza, verificación de trabajo e incentivos económicos.

### Principios de Diseño Central

1. **Modularidad**: Contratos independientes que pueden ser actualizados por separado
2. **Composabilidad**: Interfaces estándar permiten integración de ecosistema
3. **Seguridad**: Seguridad multi-capa con incentivos económicos y protección timelock
4. **Escalabilidad**: Despliegue Layer 2 con patrones eficientes de uso de gas
5. **Transparencia**: Todas las operaciones verificables on-chain con logs de eventos ricos

## 🔗 Arquitectura de Componentes

### Capa de Contratos Inteligentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CAPA DE GOBERNANZA                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────────┐ │
│  │  ShiftGovernor  │◄───┤CountingMultiChoice├────┤  MembershipToken       │ │
│  │  - Propuestas   │    │ - Multi-opción   │    │  - Poder de Voto       │ │
│  │  - Ejecución    │    │ - Dist. Peso     │    │  - Delegación          │ │
│  │  - Timelock     │    │ - Resultados     │    │  - Snapshots           │ │
│  └─────────────────┘    └──────────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          CAPA DE VERIFICACIÓN                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────────┐ │
│  │ActionTypeRegistry│◄───┤     Claims       ├────┤    VerifierPool        │ │
│  │ - Tipos Trabajo │    │ - Envíos         │    │ - Registro             │ │
│  │ - Parámetros    │    │ - Votación M-de-N│    │ - Bonding              │ │
│  │ - Spec Evidencia│    │ - Apelaciones    │    │ - Reputación           │ │
│  └─────────────────┘    └──────────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             CAPA DE TOKENS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────────┐ │
│  │   WorkerSBT     │    │ CommunityToken   │    │   RevenueRouter         │ │
│  │ - Soulbound     │    │ - 1:1 USDC       │    │ - Distribución Tarifas  │ │
│  │ - WorkerPoints  │    │ - Pagos          │    │ - Gestión Tesorería     │ │
│  │ - Logros        │    │ - Recompensas    │    │ - División Ingresos     │ │
│  └─────────────────┘    └──────────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Arquitectura de Flujo de Datos

```
┌───────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│Trabajador │────▶│ Enviar      │────▶│ Selección    │────▶│Actualización│
│           │     │ Reclamo     │     │ Jurado       │     │ Reputación  │
└───────────┘     └─────────────┘     └──────────────┘     └─────────────┘
                         │                     │                    │
                         ▼                     ▼                    ▼
                  ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
                  │ActionType   │     │VerifierPool  │     │ Resolución  │
                  │Registry     │     │              │     │ Claims      │
                  └─────────────┘     └──────────────┘     └─────────────┘
                         │                     │                    │
                         ▼                     ▼                    ▼
                  ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
                  │Parámetros   │     │Asignación    │     │Acuñación SBT│
                  │y Evidencia  │     │Panel M-de-N  │     │y Recompensas│
                  └─────────────┘     └──────────────┘     └─────────────┘
```

## 🔄 Flujos de Trabajo Centrales

### 1. Flujo de Propuesta de Gobernanza

**Proceso de Propuesta Multi-Opción:**
1. **Creación**: Miembro comunitario crea propuesta con múltiples opciones
2. **Período de Debate**: Discusión comunitaria sobre opciones
3. **Período de Votación**: Los miembros distribuyen peso de voto a través de opciones
4. **Conteo de Resultados**: CountingMultiChoice calcula opción ganadora
5. **Cola Timelock**: Propuesta aprobada entra en cola de timelock
6. **Ejecución**: Después del retraso, la propuesta se ejecuta automáticamente

### 2. Flujo de Verificación de Trabajo

**Proceso de Verificación M-de-N:**
1. **Envío**: Trabajador envía reclamo con evidencia IPFS
2. **Validación**: ActionTypeRegistry valida parámetros del reclamo
3. **Selección de Jurados**: VerifierPool selecciona panel M-de-N
4. **Período de Verificación**: Jurados revisan y votan sobre el reclamo
5. **Resolución**: Reclamo aprobado/rechazado basado en consenso mayoría
6. **Recompensas**: WorkerSBT acuñado, WorkerPoints actualizados
7. **Reputación**: Reputación del verificador actualizada basada en precisión

### 3. Flujo de Incentivos Económicos

**Distribución de Valor Comunitario:**
1. **Generación de Ingresos**: Actividad comunitaria genera tarifas/ingresos
2. **Router de Ingresos**: RevenueRouter distribuye fondos según configuración gobernanza
3. **Splits Configurables**: 
   - Contribuidores (típicamente 60-70%)
   - Tesorería Comunitaria (20-30%)
   - Inversores/Stakeholders (10-20%)
4. **Pagos**: CommunityToken facilita pagos con respaldo USDC 1:1

## 🔧 Especificaciones Técnicas de Contratos

### ShiftGovernor
**Propósito**: Gobernanza avanzada con soporte multi-opción y integración timelock

**Características Clave**:
- Extensión de OpenZeppelin Governor con CountingMultiChoice personalizado
- Integración Timelock para ejecución segura de propuestas
- Soporte para propuestas tanto binarias como multi-opción
- Thresholds de quorum configurables por comunidad

**Funciones Principales**:
```solidity
function proposeMultiChoice(
    address[] targets,
    uint256[] values,
    bytes[] calldatas,
    string description,
    uint8 numOptions
) external returns (uint256 proposalId);

function castVoteMulti(
    uint256 proposalId,
    uint256[] weights,
    string reason
) external;
```

### ActionTypeRegistry  
**Propósito**: Gestión de tipos de trabajo configurables con parámetros de verificación

**Características Clave**:
- Tipos de acción definidos por gobernanza con parámetros personalizables
- Especificaciones de evidencia IPFS para requisitos de trabajo
- Sistema de moderadores para gestión de contenido
- Cooldowns y restricciones para prevenir spam

**Parámetros de ActionType**:
```solidity
struct ActionType {
    uint32 weight;              // Recompensa WorkerPoints
    uint32 jurorsMin;           // M (aprobaciones mínimas)
    uint32 panelSize;           // N (jurados totales)
    uint32 verifyWindow;        // Límite tiempo verificación
    uint32 cooldown;            // Cooldown entre reclamos
    uint32 rewardVerify;        // Puntos recompensa verificador
    uint32 slashVerifierBps;    // Tasa slashing verificadores malos
    bool revocable;             // Puede ser revocado por gobernanza
    string evidenceSpecCID;     // Requisitos evidencia IPFS
}
```

### VerifierPool
**Propósito**: Gestión de verificadores con bonding económico y seguimiento de reputación

**Características Clave**:
- Registro de verificadores con requisitos de bonding USDC
- Algoritmo de selección pseudo-aleatorio para paneles justos
- Sistema de reputación EMA que se degrada con el tiempo
- Mecanismos de slashing para verificadores inexactos

**Métricas de Reputación**:
- **Precisión**: Porcentaje de decisiones de verificación correctas
- **Actividad**: Frecuencia de participación en paneles
- **Decaimiento**: Degradación gradual de reputación sin actividad
- **Bonding**: Cantidad apostada como garantía de buen comportamiento

### Claims
**Propósito**: Sistema integral de envío y verificación de reclamos de trabajo

**Características Clave**:
- Estados de reclamo con flujo de trabajo definido (Pending → Verified/Rejected)
- Proceso de apelación para reclamos disputados
- Integración con VerifierPool para selección de jurados
- Prevención de spam a través de cooldowns y validación

**Flujo de Estados de Claims**:
```
PENDING → VERIFYING → VERIFIED/REJECTED
    ↓         ↓            ↓
COOLDOWN   APPEAL     SBT_MINTED
```

### WorkerSBT
**Propósito**: Tokens soulbound para reputación permanente de trabajadores

**Características Clave**:
- Tokens no transferibles vinculados a identidad individual
- Sistema WorkerPoints con seguimiento EMA
- Metadatos de logros almacenados on-chain e IPFS
- Revocación por gobernanza para comportamiento malicioso

**Seguimiento WorkerPoints**:
- **EMA Tracking**: Promedio móvil exponencial de contribuciones
- **Decay Function**: Decaimiento gradual sin actividad reciente
- **Achievement Milestones**: Hitos desbloqueados por WorkerPoints totales
- **Cross-Community**: Reputación portable a través de comunidades

## 🌐 Despliegue Layer 2 y Optimización

### Estrategia de Red Base
**Por qué Base Layer 2:**
- **Costo**: Transacciones <$0.01 vs >$10 en Ethereum mainnet
- **Velocidad**: Confirmaciones de 2 segundos vs 12+ segundos Ethereum
- **Ecosistema**: Creciente adopción DeFi y herramientas de desarrollo
- **Coinbase Integration**: Fácil onboarding para usuarios fiat-to-crypto

### Optimizaciones de Gas
**Patrones de Eficiencia Implementados**:
- **Packed Structs**: Optimización de storage para reducir costos SSTORE
- **Batch Operations**: Múltiples acciones en una sola transacción
- **Event-Driven Architecture**: Datos off-chain indexados via eventos
- **Lazy Evaluation**: Cálculos costosos diferidos hasta ser necesarios

### Métricas de Rendimiento
- **Costo Promedio Transacción**: <$0.01 en Base durante uso normal
- **Throughput**: 1000+ transacciones por segundo capacidad teórica
- **Storage Optimization**: 30-50% reducción costos storage vs patrones naive
- **Batch Efficiency**: 60-80% ahorro gas para operaciones multi-claim

## 🔐 Modelo de Seguridad

### Mecanismos de Seguridad Multi-Capa

**1. Seguridad de Contratos Inteligentes**
- **Timelock Protection**: Retraso 24-48 horas para cambios de gobernanza críticos
- **Access Control**: Roles granulares con permisos específicos
- **Input Validation**: Validación integral de parámetros y estados
- **Reentrancy Guards**: Protección contra ataques de reentrancia

**2. Seguridad Económica**  
- **Bonding Requirements**: Verificadores deben apostar USDC como garantía
- **Slashing Mechanisms**: Penalizaciones económicas por comportamiento malicioso
- **Reputation Decay**: Degradación automática de reputación sin actividad
- **Quorum Requirements**: Múltiples verificadores requeridos para decisiones

**3. Seguridad de Gobernanza**
- **Proposal Delays**: Período de debate antes de votación
- **Execution Delays**: Timelock previene ejecución inmediata
- **Emergency Pause**: Capacidad de pausar contratos en emergencias
- **Upgrade Paths**: Actualizaciones controladas por gobernanza con delays

### Vectores de Ataque y Mitigaciones

**Ataques de Gobernanza:**
- **Mitigación**: Timelock delays, quorum requirements, emergency pause
- **Monitoreo**: Event monitoring para propuestas sospechosas

**Ataques de Verificación:**
- **Mitigación**: Bonding económico, reputation tracking, slashing
- **Detección**: Análisis de patrones de votación para comportamiento coordinated

**Ataques de Spam:**
- **Mitigación**: Cooldowns, tarifas de envío, rate limiting
- **Prevención**: Requisitos mínimos de reputación para participation

## 📊 Estado de Desarrollo y Cobertura de Pruebas

### Cobertura de Pruebas por Contrato
| Contrato | Cobertura Líneas | Cobertura Funciones | Cobertura Ramas | Estado |
|----------|------------------|---------------------|-----------------|---------|
| ShiftGovernor | 86%+ | 95%+ | 80%+ | ✅ Completado |
| CountingMultiChoice | 100% | 100% | 100% | ✅ Completado |
| ActionTypeRegistry | 96%+ | 98%+ | 92%+ | ✅ Completado |
| Claims | 98%+ | 100% | 95%+ | ✅ Completado |
| VerifierPool | 95%+ | 97%+ | 88%+ | ✅ Completado |
| WorkerSBT | 85%+ | 90%+ | 80%+ | 🚧 En Desarrollo |

### Estrategias de Testing

**Pruebas Unitarias**:
- Cobertura de todas las funciones públicas y paths de ejecución
- Testing de edge cases y condiciones de error
- Validación de emisión de eventos y cambios de estado
- Pruebas de optimización de gas y límites

**Pruebas de Integración**:
- Flujos de trabajo end-to-end a través de múltiples contratos
- Interacciones entre sistemas de gobernanza y verificación
- Escenarios de distribución económica y tokenomics
- Testing de upgrade y migración de contratos

**Pruebas Fuzz**:
- Input aleatorio para descubrir edge cases no anticipados
- Fuzzing de parámetros de gobernanza y verificación
- Testing de resistencia bajo condiciones adversas
- Validación de invariantes del sistema bajo stress

### Pipeline de Integración Continua
```bash
# Comandos de testing automatizados
pnpm forge:test      # Ejecutar todas las pruebas unitarias
pnpm forge:cov       # Generar reporte de cobertura
pnpm cov:gate        # Enforcer umbral ≥86% cobertura
pnpm fmt             # Formatear código según estándares
```

## 🚀 Cronograma de Despliegue

### Fase 1: Testnet Deployment (Q4 2024)
- **Base Sepolia**: Despliegue completo para testing público
- **Community Beta**: 10-20 comunidades piloto
- **Features**: Gobernanza básica, verificación trabajo, SBTs
- **Testing**: Security audits, stress testing, UX feedback

### Fase 2: Mainnet Launch (Q1 2025)  
- **Base Mainnet**: Despliegue producción con auditorías completadas
- **Limited Release**: 50-100 comunidades early adopters
- **Features**: Sistema económico completo, marketplace básico
- **Monitoring**: Métricas de adopción, health del sistema, community feedback

### Fase 3: Scale & Expand (Q2-Q3 2025)
- **Open Access**: Plataforma disponible para todas las comunidades
- **Advanced Features**: Analytics avanzadas, mobile apps, integraciones
- **Multi-Chain**: Expandir a Ethereum mainnet y otras L2s
- **Enterprise**: Características y soporte para organizaciones grandes

### Fase 4: Ecosystem Growth (Q4 2025+)  
- **Developer Tools**: SDKs, APIs, herramientas de integración
- **Partnerships**: Integraciones con plataformas existentes
- **Global Expansion**: Localización e expansion internacional
- **Advanced DeSoc**: Características avanzadas de sociedad descentralizada

---

*Esta arquitectura está diseñada para evolucionar con las necesidades de la comunidad mientras mantiene seguridad, escalabilidad y usabilidad como principios centrales.*