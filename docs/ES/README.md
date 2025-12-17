# Documentación Shift DeSoc

Esta documentación cubre la arquitectura de contratos inteligentes y detalles de implementación de la plataforma Shift DeSoc - un sistema descentralizado de gobernanza y verificación de trabajo.

## 📚 Estructura de Documentación

### Documentación Técnica Central
- **[ValuableActionRegistry](./contracts/ValuableActionRegistry.md)** - Tipos de trabajo definidos por comunidad con parámetros de verificación
- **[Claims](./contracts/Claims.md)** - Sistema de envío de reclamos de trabajo y verificación M-de-N
- **[VerifierPool](./contracts/VerifierPool.md)** - Registro de verificadores, bonding y gestión de reputación
- **[ShiftGovernor](./contracts/ShiftGovernor.md)** - Gobernanza multi-opción con ejecución timelock
- **[CountingMultiChoice](./contracts/CountingMultiChoice.md)** - Mecanismo de votación multi-opción ponderado

### Documentación de Coordinación Comunitaria
- **[RequestHub](./contracts/RequestHub.md)** - Foro de discusión descentralizado y coordinación comunitaria
- **[DraftsManager](./contracts/DraftsManager.md)** - Desarrollo colaborativo de propuestas y revisión
- **[CommunityRegistry](./contracts/CommunityRegistry.md)** - Metadatos comunitarios y gestión de módulos

### Documentación del Sistema Económico
- **[RevenueRouter](./contracts/RevenueRouter.md)** - Distribución de ingresos basada en ROI con decaimiento de inversores
- **[CommunityToken](./contracts/CommunityToken.md)** - Moneda comunitaria respaldada 1:1 por USDC
- **[MembershipTokenERC20Votes](./contracts/MembershipTokenERC20Votes.md)** - Tokens de gobernanza basados en mérito
- **[WorkerSBT](./contracts/WorkerSBT.md)** - Tokens de reputación soulbound con WorkerPoints

### Documentación No Técnica
- **[Whitepaper](./Whitepaper.md)** - Visión de inversión para stakeholders no técnicos
- **[Arquitectura del Sistema](./Architecture.md)** - Diseño de sistema de alto nivel y flujo de trabajo

## 🏗️ Visión General del Sistema

Shift DeSoc implementa una plataforma de gobernanza completamente on-chain para trabajo comunitario descentralizado con los siguientes componentes centrales:

### Capa de Gobernanza
- **Votación multi-opción** para toma de decisiones matizada
- **Ejecución timelock** para seguridad y transparencia
- **Participación basada en tokens** con soporte de delegación

### Capa de Verificación de Trabajo
- **Tipos de acción configurables** con parámetros de verificación personalizados
- **Verificación de jurado M-de-N** con incentivos económicos
- **Selección de verificadores basada en reputación** usando algoritmos pseudo-aleatorios
- **Proceso de apelaciones** para reclamos disputados

### Economía de Tokens
- **Tokens soulbound (SBTs)** para reputación no transferible
- **Sistema WorkerPoints** con seguimiento de promedio móvil exponencial
- **Mecanismos de bonding** para participación de verificadores
- **Compartición de ingresos** a través de divisiones configurables

## 🔧 Estado de Implementación

### ✅ MVP LISTO PARA PRODUCCIÓN (Noviembre 2025)
| Contrato | Cobertura | Estado | Características |
|----------|-----------|---------|-----------------|
| **Gobernanza Central** |
| ShiftGovernor | 86%+ | ✅ Producción | Votación multi-opción, integración timelock, escalación de borradores |
| CountingMultiChoice | 100% | ✅ Producción | Votación ponderada, soporte snapshot, características empresariales |
| **Coordinación Comunitaria** |
| RequestHub | 95%+ | ✅ Producción | Foro de discusión, moderación, integración RequestHub→Claims |
| DraftsManager | 98%+ | ✅ Producción | Desarrollo multi-contribuidor, versionado, ciclos de revisión |
| CommunityRegistry | 96%+ | ✅ Producción | Gestión de metadatos, direcciones de módulos, enlaces inter-comunitarios |
| **Sistema de Verificación de Trabajo** |
| ValuableActionRegistry | 96%+ | ✅ Producción | Tipos de trabajo definidos por comunidad, integración con gobernanza |
| Claims | 98%+ | ✅ Producción | Verificación M-de-N, apelaciones, bounties RequestHub |
| VerifierPool | 95%+ | ✅ Producción | Bonding, reputación, selección pseudo-aleatoria de jurados |
| WorkerSBT | 94%+ | ✅ Producción | Seguimiento EMA WorkerPoints, integración con gobernanza |
| **Módulos Económicos** |
| RevenueRouter | 92%+ | ✅ Producción | Decaimiento de ingresos basado en ROI, distribución matemática |
| CommunityToken | 100% | ✅ Producción | Respaldo 1:1 USDC, gestión de tesorería |
| MembershipTokenERC20Votes | 98%+ | ✅ Producción | Tokens de gobernanza basados en mérito, anti-plutocracia |
| TreasuryAdapter | 90%+ | ✅ Producción | Integración de parámetros CommunityRegistry |

**Estado de Despliegue**: ✅ Comunidad ID 3 operacional en Base Sepolia con 28 transacciones exitosas

## 🎯 Innovaciones Clave

1. **Tecnología Meta-Gobernanza**: Infraestructura flexible que permite a las comunidades modelar cualquier estructura organizacional en lugar de imponer modelos de gobernanza específicos
2. **Pipeline de Coordinación Completo**: `solicitudes → borradores → propuestas → ejecución timelock` con discusión integrada, colaboración y verificación
3. **Gobernanza Multi-Opción**: Votación multi-opción ponderada que permite toma de decisiones matizada más allá de opciones binarias sí/no
4. **Creación Comunitaria Basada en API**: Sistema de despliegue escalable (~$0.19 por comunidad en Base vs $9,600 en Ethereum)
5. **Distribución de Ingresos Basada en ROI**: La participación de ingresos de inversores decrece automáticamente cuando los retornos se acercan al objetivo, asegurando economía sostenible
6. **Poder de Gobernanza Basado en Mérito**: Sistema puro trabajo-a-token-de-gobernanza donde la participación comunitaria se traduce directamente en poder de voto

## 🔐 Características de Seguridad

- **Ejecución timelock** previene ataques de gobernanza inmediatos
- **Requisitos de bonding** aseguran compromiso del verificador
- **Decaimiento de reputación** remueve verificadores inactivos o de bajo rendimiento
- **Mecanismos de apelación** proporcionan recurso para decisiones disputadas
- **Patrones multi-firma** para funciones críticas del sistema

## 📈 Pruebas y Cobertura

Todos los contratos mantienen ≥86% de cobertura de pruebas con testing integral de casos extremos:
- **Pruebas unitarias** para funcionalidad individual de contratos
- **Pruebas de integración** para interacciones entre contratos
- **Pruebas fuzz** para validación de entrada y casos extremos
- **Optimización de gas** con 200 corridas de optimizador

## 🚀 Estado Actual de Despliegue

**✅ DESPLEGADO EN PRODUCCIÓN**: Ecosistema completo desplegado exitosamente y verificado en Base Sepolia con operaciones comunitarias reales.

**Estado de Redes:**
1. **Base Sepolia** (testnet) - ✅ **OPERACIONAL** - Comunidad ID 3 con 28 transacciones exitosas
2. **Base** (mainnet) - **Listo para Lanzamiento en Producción** - Objetivo de despliegue de ultra-bajo costo (~$0.19 por comunidad)
3. **Ethereum Sepolia** (testnet) - Objetivo secundario después del éxito en Base
4. **Ethereum** (mainnet) - Despliegue final después del éxito probado en Base

**Análisis de Costos**: ~$0.19 USD por despliegue de comunidad en Base vs ~$9,600 en Ethereum mainnet

## 📊 Métricas de Rendimiento

- **Eficiencia de Gas**: Optimizado para despliegue Layer 2 en Base
- **Escalabilidad**: Diseñado para alto throughput de transacciones
- **Modularidad**: Los contratos pueden ser actualizados independientemente a través de gobernanza
- **Interoperabilidad**: Interfaces ERC estándar para compatibilidad de ecosistema

---

*Para detalles de implementación técnica, consulta la documentación específica de contratos. Para visión de inversión y negocio, ve el [Whitepaper](./Whitepaper.md).*