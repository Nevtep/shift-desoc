# Documentación Shift DeSoc

Esta documentación cubre la arquitectura de contratos inteligentes y detalles de implementación de la plataforma Shift DeSoc - un sistema descentralizado de gobernanza y verificación de trabajo.

## 📚 Estructura de Documentación

### Documentación Técnica
- **[ActionTypeRegistry](./contracts/ActionTypeRegistry.md)** - Tipos de acción de trabajo configurables con parámetros de verificación
- **[Claims](./contracts/Claims.md)** - Sistema de envío de reclamos de trabajo y verificación M-de-N
- **[VerifierPool](./contracts/VerifierPool.md)** - Registro de verificadores, bonding y gestión de reputación
- **[ShiftGovernor](./contracts/ShiftGovernor.md)** - Gobernanza multi-opción con ejecución timelock
- **[CountingMultiChoice](./contracts/CountingMultiChoice.md)** - Mecanismo de votación multi-opción ponderado

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

### ✅ Contratos Completados
| Contrato | Cobertura | Estado | Características |
|----------|-----------|---------|-----------------|
| ActionTypeRegistry | 96%+ | Completo | Gobernanza, validación, sistema de moderadores |
| Claims | 98%+ | Completo | Verificación M-de-N, apelaciones, cooldowns |
| VerifierPool | 95%+ | Completo | Bonding, reputación, selección de jurados |
| ShiftGovernor | 86%+ | Completo | Votación multi-opción, integración timelock |
| CountingMultiChoice | 100% | Completo | Votación ponderada, soporte snapshot |

### 🚧 En Desarrollo
- **WorkerSBT** - Token soulbound con seguimiento WorkerPoints
- **Pruebas de Integración** - Validación de flujo de trabajo end-to-end

## 🎯 Innovaciones Clave

1. **Gobernanza Multi-Opción**: A diferencia de la votación binaria sí/no, permite toma de decisiones matizada con preferencias ponderadas
2. **Verificación Basada en Reputación**: Los verificadores ganan reputación a través de decisiones precisas, mejorando la calidad del sistema con el tiempo
3. **Alineación de Incentivos Económicos**: Bonding y recompensas crean skin-in-the-game para todos los participantes
4. **Tipos de Acción Configurables**: Marco flexible para diferentes tipos de trabajo comunitario y requisitos de verificación

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

## 🚀 Estrategia de Despliegue

**Prioridad de Red:**
1. **Base Sepolia** (testnet) - Desarrollo primario y pruebas
2. **Base** (mainnet) - Objetivo de despliegue de producción
3. **Ethereum Sepolia** (testnet) - Pruebas secundarias después del éxito en Base
4. **Ethereum** (mainnet) - Despliegue final después del éxito probado

## 📊 Métricas de Rendimiento

- **Eficiencia de Gas**: Optimizado para despliegue Layer 2 en Base
- **Escalabilidad**: Diseñado para alto throughput de transacciones
- **Modularidad**: Los contratos pueden ser actualizados independientemente a través de gobernanza
- **Interoperabilidad**: Interfaces ERC estándar para compatibilidad de ecosistema

---

*Para detalles de implementación técnica, consulta la documentación específica de contratos. Para visión de inversión y negocio, ve el [Whitepaper](./Whitepaper.md).*