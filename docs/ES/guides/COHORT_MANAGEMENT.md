# Shift DeSoc Cohort Management System

Esta guía completa cubre el sistema de gestión de cohortes de inversión implementado en Shift DeSoc, incluyendo el despliegue, configuración y operación del sistema económico basado en cohortes.

## 📋 Tabla de Contenidos

1. [Configuración del Entorno](#configuración-del-entorno)
2. [Despliegue del Sistema](#despliegue-del-sistema)
3. [Gestión de Cohortes](#gestión-de-cohortes)
4. [Distribución de Ingresos](#distribución-de-ingresos)
5. [Monitoreo y Análisis](#monitoreo-y-análisis)
6. [Casos de Uso Comunes](#casos-de-uso-comunes)
7. [Solución de Problemas](#solución-de-problemas)

## ⚙️ Configuración del Entorno

### 1. Preparación de Variables de Entorno

```bash
# Copiar el archivo de configuración ejemplo
cp .env.example .env

# Editar con tus valores específicos
nano .env
```

### Variables Críticas para Cohortes

```bash
# Red de despliegue
NETWORK=base_sepolia

# Clave privada del deployer (asegurar que tiene ETH)
PRIVATE_KEY=0x...

# Direcciones de contratos (se completan después del despliegue)
COHORT_REGISTRY_ADDRESS=0x...
REVENUE_ROUTER_ADDRESS=0x...
PARAM_CONTROLLER_ADDRESS=0x...
COMMUNITY_TOKEN_ADDRESS=0x...

# Configuración de USDC
USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### 2. Instalación de Dependencias

```bash
# Instalar todas las dependencias
pnpm install

# Compilar contratos
pnpm build

# Ejecutar tests
pnpm test
```

## 🚀 Despliegue del Sistema

### Despliegue Completo en Base Sepolia

```bash
# Despliegue completo del sistema incluyendo cohortes
pnpm deploy:base-sepolia
```

El script de despliegue:

- ✅ Despliega todos los contratos core
- ✅ Configura CohortRegistry con parámetros iniciales
- ✅ Integra RevenueRouter con distribución en cascada
- ✅ Verifica todos los contratos en BaseScan
- ✅ Guarda direcciones en `.env`

### Verificación del Despliegue

```bash
# Verificar estado del sistema
pnpm deploy:verify-community --network base_sepolia

# Ejecutar tests E2E
pnpm test:e2e --network base_sepolia

# Analizar costos de gas
pnpm gas-costs --network base_sepolia
```

## 🏦 Gestión de Cohortes

### Comandos Básicos

```bash
# Ver ayuda completa
pnpm manage:cohorts help

# Listar cohortes activas
pnpm manage:cohorts list 1

# Ver información detallada de cohorte
pnpm manage:cohorts info 1
```

### Crear Nueva Cohorte

```bash
# Crear cohorte con parámetros personalizados
pnpm manage:cohorts create [communityId] [targetROI%] [weight] [maxInvestors] [minInvest] [maxRaise] [termsURI]

# Ejemplo: Cohorte conservadora
pnpm manage:cohorts create 1 115 1500 30 2500 150000 ipfs://QmConservativeTerms

# Ejemplo: Cohorte de crecimiento
pnpm manage:cohorts create 1 130 3000 15 15000 500000 ipfs://QmGrowthTerms
```

### Parámetros de Cohorte

- **communityId**: ID de la comunidad (típicamente 1)
- **targetROI%**: ROI objetivo (115 = 115%, 130 = 130%)
- **weight**: Peso de prioridad en distribución (1000-5000)
- **maxInvestors**: Número máximo de inversores
- **minInvest**: Inversión mínima en USDC
- **maxRaise**: Recaudación máxima total
- **termsURI**: Referencia IPFS a términos de inversión

### Agregar Inversores

```bash
# Agregar inversor específico
pnpm manage:cohorts add-investor <cohortId> <investorAddress> <amount>

# Ejemplo
pnpm manage:cohorts add-investor 1 0x742d35Cc6631C0532925a3b8D2270E49B3a7DC13 25000
```

## 💰 Distribución de Ingresos

### Simular Distribución

```bash
# Simular distribución de $10,000
pnpm manage:cohorts simulate 1 10000

# Salida ejemplo:
# 💰 Distribution Breakdown:
#    Workers: $4,000.00 USDC (40%)
#    Treasury: $2,500.00 USDC (25%)
#    Investors: $3,500.00 USDC (35%)
#
# 📊 Cohort Distribution:
#    Cohort 1: $2,100.00 (Weight: 3000)
#    Cohort 2: $1,400.00 (Weight: 2000)
```

### Ejecutar Distribución Real

```bash
# Distribuir ingresos reales
pnpm manage:cohorts distribute 1 10000

# ⚠️  CUIDADO: Esta operación transfiere tokens reales
```

### Modelo de Distribución en Cascada

1. **Workers Min (40%)**: Cantidad fija para trabajadores
2. **Treasury Base (25%)**: Reservas operativas de la comunidad
3. **Investor Pool (35%)**: Distribuido por pesos de cohorte
4. **Spillover**: Exceso va a treasury si cohortes completadas

## 📊 Monitoreo y Análisis

### Información de Cohorte Detallada

```bash
pnpm manage:cohorts info 1
```

**Salida ejemplo:**

```
📊 Cohort 1 Information
📋 Basic Information:
   Community ID: 1
   Target ROI: 120%
   Priority Weight: 2500
   Max Investors: 25
   Current Investors: 12

💰 Financial Status:
   Total Invested: $180,000.00 USDC
   Total Returned: $95,000.00 USDC
   Target Total: $216,000.00 USDC
   Current ROI: 52%
   Progress: 43%

⚖️  Distribution:
   Current Weight: 2500
   Active: ✅
   Completed: ❌
```

### Listar Todas las Cohortes

```bash
pnpm manage:cohorts list 1
```

## 📋 Casos de Uso Comunes

### 1. Configuración Inicial de Comunidad

```bash
# Paso 1: Desplegar sistema completo
pnpm deploy:base-sepolia

# Paso 2: Crear primera cohorte conservadora
pnpm manage:cohorts create 1 115 2000 30 5000 200000 ipfs://QmConservativeTerms

# Paso 3: Agregar inversores fundadores
pnpm manage:cohorts add-investor 1 0xFounder1... 50000
pnpm manage:cohorts add-investor 1 0xFounder2... 35000
```

### 2. Gestión Mensual de Ingresos

```bash
# Paso 1: Simular distribución de ingresos mensuales
pnpm manage:cohorts simulate 1 25000

# Paso 2: Revisar cohortes antes de distribución
pnpm manage:cohorts list 1

# Paso 3: Ejecutar distribución real
pnpm manage:cohorts distribute 1 25000

# Paso 4: Verificar nuevos estados de cohorte
pnpm manage:cohorts info 1
pnpm manage:cohorts info 2
```

### 3. Creación de Cohortes Diversificadas

```bash
# Cohorte conservadora (ROI bajo, alta capacidad)
pnpm manage:cohorts create 1 112 1500 50 2000 300000

# Cohorte equilibrada (ROI medio, capacidad media)
pnpm manage:cohorts create 1 125 2500 25 10000 400000

# Cohorte de crecimiento (ROI alto, baja capacidad)
pnpm manage:cohorts create 1 140 4000 10 25000 500000
```

## 🔧 Solución de Problemas

### Errores Comunes

#### "Insufficient balance for gas"

```bash
# Verificar balance del deployer
pnpm check:balance --network base_sepolia

# Obtener ETH del faucet de Base Sepolia
# https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
```

#### "CohortRegistry not deployed"

```bash
# Verificar despliegue completo
pnpm deploy:verify-community --network base_sepolia

# Re-desplegar si es necesario
pnpm deploy:base-sepolia
```

#### "Investor already in cohort"

```bash
# Verificar estado de cohorte primero
pnpm manage:cohorts info <cohortId>

# Los inversores solo pueden estar en una cohorte por comunidad
```

### Validaciones de Seguridad

```bash
# Verificar permisos de contratos
pnpm check:permissions --network base_sepolia

# Analizar estado de governance
pnpm check:governance --network base_sepolia

# Verificar estado de compromisos y rewards
pnpm check:engagements --network base_sepolia
pnpm check:rewards --network base_sepolia
```

### Logs y Debugging

```bash
# Habilitar logging detallado
export DEBUG=true

# Ejecutar comandos con verbose output
pnpm manage:cohorts create 1 120 2000 25 5000 250000 --verbose

# Revisar transacciones en BaseScan
# https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>
```

## 🎯 Configuraciones Recomendadas

### Para Comunidades Nuevas (Primeros 6 meses)

```bash
# Cohorte de lanzamiento - conservadora para atraer inversores iniciales
pnpm manage:cohorts create 1 115 3000 20 10000 300000 ipfs://QmLaunchTerms
```

### Para Comunidades Establecidas (6+ meses)

```bash
# Portfolio diversificado de 3 cohortes
pnpm manage:cohorts create 1 112 1800 40 5000 400000    # Conservadora
pnpm manage:cohorts create 1 125 2500 25 15000 600000   # Equilibrada
pnpm manage:cohorts create 1 140 3500 15 30000 800000   # Crecimiento
```

### Para Comunidades Maduras (2+ años)

```bash
# Cohortes especializadas por tipo de proyecto
pnpm manage:cohorts create 1 118 2200 30 8000 500000    # Infraestructura
pnpm manage:cohorts create 1 135 3200 20 20000 700000   # Productos
pnpm manage:cohorts create 1 150 4500 10 50000 1000000  # Investigación
```

## 📞 Soporte

Para soporte técnico:

1. Revisar documentación en `/docs/ES/`
2. Ejecutar `pnpm deploy:verify-community`
3. Verificar logs en BaseScan
4. Consultar con el equipo de desarrollo

---

Este sistema de cohortes permite a las comunidades gestionar inversiones de forma transparente, con ROI garantizado y distribución automática basada en el rendimiento real de la comunidad. 🚀
