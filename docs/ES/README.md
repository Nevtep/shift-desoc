# Centro de Documentación Shift DeSoc

**Bienvenido a la documentación de Shift DeSoc.** Este centro proporciona documentación técnica y empresarial completa para la plataforma de meta-gobernanza Shift.

## 🎯 Navegación Rápida

| Documento | Propósito |
|-----------|-----------|
| [**Whitepaper**](./Whitepaper.md) | Visión, modelo de negocio y caso de inversión |
| [**Arquitectura**](./Architecture.md) | Diseño del sistema y relaciones entre 24 contratos |
| [**Capas**](./Layers.md) | Referencia unificada de arquitectura de 5 capas |
| [**Tokenomics**](./Tokenomics.md) | Economía de tokens, distribución de ingresos y cohortes |
| [**Contratos**](./contracts/) | Documentación individual de contratos (24 contratos) |
| [**Guías**](./guides/) | Guías operativas para gestión de comunidades |

---

## 📚 Estructura de Documentación

### Documentos Principales

| Documento | Descripción |
|-----------|-------------|
| [Whitepaper.md](./Whitepaper.md) | Visión ejecutiva, modelo de negocio, oportunidad de mercado, caso de inversión |
| [Architecture.md](./Architecture.md) | Diseño del sistema, arquitectura de 5 capas, relaciones entre componentes, modelo de seguridad |
| [Layers.md](./Layers.md) | Referencia unificada de capas: coordinación, gobernanza, verificación, económica, comercio |
| [Tokenomics.md](./Tokenomics.md) | MembershipToken, CommunityToken, ValuableActionSBT (5 tipos), cascada de ingresos, cohortes |

### Documentación de Contratos (24 Contratos)

#### Capa 1: Coordinación Comunitaria (4 contratos)
- [CommunityRegistry.md](./contracts/CommunityRegistry.md) — Metadatos de comunidad y coordinación de módulos
- [RequestHub.md](./contracts/RequestHub.md) — Foro de discusión y coordinación de ideas
- [DraftsManager.md](./contracts/DraftsManager.md) — Desarrollo colaborativo de propuestas
- [ParamController.md](./contracts/ParamController.md) — Gestión dinámica de parámetros

#### Capa 2: Gobernanza Democrática (4 contratos)
- [ShiftGovernor.md](./contracts/ShiftGovernor.md) — Motor de gobernanza multi-opción
- [CountingMultiChoice.md](./contracts/CountingMultiChoice.md) — Mecanismo de votación ponderada
- [MembershipTokenERC20Votes.md](./contracts/MembershipTokenERC20Votes.md) — Tokens de gobernanza basados en mérito
- TimelockController (OpenZeppelin) — Retrasos de ejecución y protección

#### Capa 3: Verificación de Trabajo (9 contratos)
- [ValuableActionRegistry.md](./contracts/ValuableActionRegistry.md) — Tipos de compromisos definidos por la comunidad
- [Engagements.md](./contracts/Engagements.md) — Flujo de verificación de compromisos de trabajo
- [VerifierPowerToken1155.md](./contracts/VerifierPowerToken1155.md) — Selección democrática de verificadores
- [VerifierElection.md](./contracts/VerifierElection.md) — Gobernanza y elecciones de verificadores
- [VerifierManager.md](./contracts/VerifierManager.md) — Selección de jurados M-de-N
- [ValuableActionSBT.md](./contracts/ValuableActionSBT.md) — Tokens Soulbound multi-tipo (5 tipos)
- [CredentialManager.md](./contracts/CredentialManager.md) — Emisión de certificaciones de cursos
- [PositionManager.md](./contracts/PositionManager.md) — Ciclo de vida de posiciones
- [InvestmentCohortManager.md](./contracts/InvestmentCohortManager.md) — Coordinación de cohortes de inversión

#### Capa 4: Motor Económico (4 contratos)
- [CommunityToken.md](./contracts/CommunityToken.md) — Moneda comunitaria respaldada 1:1 con USDC
- [CohortRegistry.md](./contracts/CohortRegistry.md) — Almacenamiento y seguimiento de cohortes de inversión
- [RevenueRouter.md](./contracts/RevenueRouter.md) — Cascada de distribución de ingresos automatizada
- [TreasuryAdapter.md](./contracts/TreasuryAdapter.md) — Controles de gasto de tesorería

#### Capa 5: Módulos Comunitarios (3 contratos)
- [Marketplace.md](./contracts/Marketplace.md) — Mercado de servicios descentralizado
- [CommerceDisputes.md](./contracts/CommerceDisputes.md) — Resolución de disputas comerciales
- [HousingManager.md](./contracts/HousingManager.md) — Coordinación de co-vivienda

### Guías

| Guía | Propósito |
|------|-----------|
| [Gestión de Cohortes](./guides/COHORT_MANAGEMENT.md) | Operaciones de cohortes de inversión |

---

## 🗺️ Documentación por Caso de Uso

### Entendiendo el Sistema
1. **Inicio**: [Architecture.md](./Architecture.md) — Visión general del sistema
2. **Profundización**: [Layers.md](./Layers.md) — Referencia capa por capa
3. **Economía**: [Tokenomics.md](./Tokenomics.md) — Mecánicas de tokens e ingresos
4. **Negocio**: [Whitepaper.md](./Whitepaper.md) — Visión y caso de inversión

### Implementando Gobernanza
1. [ShiftGovernor.md](./contracts/ShiftGovernor.md) — Motor de gobernanza principal
2. [CountingMultiChoice.md](./contracts/CountingMultiChoice.md) — Mecanismo de votación
3. [MembershipTokenERC20Votes.md](./contracts/MembershipTokenERC20Votes.md) — Tokens de gobernanza

### Construyendo Verificación de Trabajo
1. [ValuableActionRegistry.md](./contracts/ValuableActionRegistry.md) — Definiciones de tipos de trabajo
2. [Engagements.md](./contracts/Engagements.md) — Flujo de verificación de compromisos
3. [VerifierManager.md](./contracts/VerifierManager.md) — Selección de jurados
4. [ValuableActionSBT.md](./contracts/ValuableActionSBT.md) — Emisión de SBT (5 tipos)

### Gestionando Certificaciones y Posiciones
1. [CredentialManager.md](./contracts/CredentialManager.md) — Flujo de certificaciones de cursos
2. [PositionManager.md](./contracts/PositionManager.md) — Ciclo de vida de posiciones
3. [InvestmentCohortManager.md](./contracts/InvestmentCohortManager.md) — Coordinación de inversiones

### Configurando Distribución de Ingresos
1. [Tokenomics.md](./Tokenomics.md) — Explicación de cascada de ingresos
2. [RevenueRouter.md](./contracts/RevenueRouter.md) — Implementación de distribución
3. [CohortRegistry.md](./contracts/CohortRegistry.md) — Seguimiento de cohortes

---

## 📊 Estado Actual (Enero 2026)

**✅ MVP Listo para Producción**
- 24 contratos desplegados en Base Sepolia
- Cobertura de documentación completa
- Community ID 1 operacional
- Despliegue en Base mainnet listo (~$10 de costo)

### Suite de Contratos (24 contratos)

| Capa | Contratos |
|------|-----------|
| **Coordinación** | CommunityRegistry, RequestHub, DraftsManager, ParamController |
| **Gobernanza** | ShiftGovernor, CountingMultiChoice, MembershipTokenERC20Votes, TimelockController |
| **Verificación** | ValuableActionRegistry, Engagements, VerifierPowerToken1155, VerifierElection, VerifierManager, ValuableActionSBT, CredentialManager, PositionManager, InvestmentCohortManager |
| **Económica** | CommunityToken, CohortRegistry, RevenueRouter, TreasuryAdapter |
| **Comercio** | Marketplace, CommerceDisputes, HousingManager |

### Tipos de SBT (vía ValuableActionSBT)

| Tipo | Emitido Por | Propósito |
|------|-------------|-----------|
| WORK | Engagements | Compromisos de trabajo completados |
| ROLE | PositionManager | Posiciones completadas exitosamente |
| CREDENTIAL | CredentialManager | Certificaciones de cursos/formación |
| POSITION | PositionManager | Roles activos en curso |
| INVESTMENT | InvestmentCohortManager | Participación en inversiones |

---

## 🔐 Características de Seguridad

- **Ejecución con Timelock** previene ataques de gobernanza inmediatos
- **Elecciones democráticas de verificadores** aseguran responsabilidad comunitaria
- **Verificación M-de-N** para validación de trabajo
- **Mecanismos de apelación** para decisiones disputadas
- **Protecciones de TreasuryAdapter** (1 gasto/semana, límite 10%, lista de stablecoins)

## 📈 Pruebas y Cobertura

Todos los contratos mantienen ≥86% de cobertura de pruebas:
- **Pruebas unitarias** para funcionalidad individual de contratos
- **Pruebas de integración** para interacciones entre contratos
- **Pruebas fuzz** para validación de entrada
- **Umbral de cobertura** aplicado en CI/CD

---

_Para flujo de trabajo de desarrollo, ver [.github/copilot-instructions.md](../../.github/copilot-instructions.md)._
