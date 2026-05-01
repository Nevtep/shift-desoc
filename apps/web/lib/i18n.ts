export type AppLocale = "es" | "en";

export const LOCALE_COOKIE_KEY = "shift_locale";
export const defaultLocale: AppLocale = process.env.NEXT_PUBLIC_APP_LOCALE === "en" ? "en" : "es";

export function sanitizeLocale(value?: string | null): AppLocale {
  return value === "en" ? "en" : "es";
}

export function resolveLocaleFromCookieString(cookieValue?: string): AppLocale {
  if (!cookieValue) return defaultLocale;
  const parts = cookieValue.split(";").map((part) => part.trim());
  const found = parts.find((part) => part.startsWith(`${LOCALE_COOKIE_KEY}=`));
  if (!found) return defaultLocale;
  const raw = found.slice(`${LOCALE_COOKIE_KEY}=`.length);
  return sanitizeLocale(decodeURIComponent(raw));
}

export function getClientLocale(): AppLocale {
  if (typeof document === "undefined") return defaultLocale;
  return resolveLocaleFromCookieString(document.cookie);
}

const dictionaries = {
  es: {
    layout: {
      htmlLang: "es",
      navCommunities: "Comunidades",
      navGovernance: "Gobernanza",
      navEngagements: "Engagements",
      navMarketplace: "Marketplace",
      navProfile: "Perfil",
      navRequests: "Solicitudes",
      navDrafts: "Borradores",
      navProposals: "Propuestas",
      governanceMenuAria: "Menu de gobernanza",
      languageMenuAria: "Cambiar idioma",
      missingEnv:
        "Falta GRAPHQL_URL o INDEXER_API_URL. Actualiza .env para apuntar al indexer de Base Sepolia.",
      footerTitle: "Shift meta-gobernanza",
      footerDocs: "Documentacion",
      homeAria: "Shift DeSoc - Inicio"
    },
    home: {
      badge: "Meta-gobernanza comunitaria",
      title: "Coordinacion verificable para comunidades que quieren decidir y ejecutar juntas",
      subtitle:
        "Shift transforma acuerdos en flujos operables: solicitudes, borradores, propuestas y ejecucion on-chain con reglas auditables.",
      ctaStart: "Iniciar comunidad",
      ctaExplore: "Explorar comunidades",
      value1Title: "Votacion multi-opcion",
      value1Body: "Las comunidades comparan alternativas reales y priorizan con mas contexto que un si/no.",
      value2Title: "Contribucion verificada",
      value2Body: "El trabajo se valida entre pares con reglas M-de-N antes de distribuir reconocimiento y valor.",
      value3Title: "Trazabilidad operativa",
      value3Body: "Decisiones, estados y ejecucion quedan visibles para mejorar confianza y coordinacion.",
      howTitle: "Como funciona",
      howDetail: "Ver detalle tecnico",
      howDetailBody:
        "La autoridad operativa se apoya en contratos y timelock, mientras el indexer acelera consulta de actividad para navegacion diaria.",
      mainActionLabel: "Accion principal",
      createSectionTitle: "Crear comunidad",
      communitiesLabel: "Comunidades",
      communitiesTitle: "Comunidades indexadas",
      communitiesLink: "Ver pagina de comunidades"
    },
    communitiesPage: {
      metaTitle: "Comunidades | Shift DeSoc",
      metaDescription:
        "Explora comunidades on-chain indexadas con infraestructura de gobernanza y coordinacion Shift.",
      badge: "Directorio comunitario",
      title: "Comunidades en Shift",
      subtitle:
        "Explora comunidades indexadas y abre cada una para ver gobernanza, coordinacion y actividad reciente.",
      ctaCreate: "Crear comunidad",
      ctaHome: "Volver al inicio",
      card1Title: "Datos indexados",
      card1Body: "La lista refleja lo que expone el indexer; puede haber un ligero desfase frente a la cadena.",
      card2Title: "Tu contexto",
      card2Body: "Si conectas tu wallet, veras primero las comunidades vinculadas a tu actividad.",
      card3Title: "Siguiente paso",
      card3Body: "Desde cada comunidad accedes al panel con modulos de gobernanza y coordinacion.",
      infoTitle: "Sobre esta vista",
      infoDetail: "Detalle tecnico",
      infoDetailBody:
        "Los identificadores y la red vienen del indexer GraphQL. La fuente de verdad para reglas y parametros sigue siendo el contrato en cadena."
    },
    wizard: {
      ready: "Tu comunidad esta lista.",
      goHome: "Ir al inicio",
      goCommunity: "Ir a mi comunidad",
      flowIncludes: "Que incluye este flujo",
      flowItem1: "Configurar nombre, descripcion y moneda de tesoreria.",
      flowItem2: "Ejecutar preflight de red y fondos antes de desplegar.",
      flowItem3: "Retomar progreso si cierras o cambias de sesion.",
      checkingTitle: "Revisando tus comunidades...",
      checkingBody: "Estamos consultando tu actividad reciente para mostrarte el mejor punto de entrada.",
      hasCommunities: "Ya tienes comunidades. Puedes crear otra o seguir explorando.",
      noCommunities: "Puedes crear una comunidad nueva o explorar las existentes.",
      connectedHint: "Como ya estas conectado, puedes crear una nueva comunidad cuando quieras.",
      createCommunity: "Crear comunidad",
      paused: "Despliegue pausado",
      verification: "Verificacion",
      deploying: "Desplegando tu comunidad",
      failedBody: "Ocurrio un error. Corrige el problema y usa Reanudar para continuar.",
      verifyingBody: "Ejecutando comprobaciones de verificacion.",
      deployingBody: "Confirma las transacciones en tu wallet cuando se te solicite. No cierres esta pagina.",
      resume: "Reanudar",
      resuming: "Reanudando...",
      startOver: "Empezar de nuevo",
      allChecksPassed: "Todas las comprobaciones pasaron.",
      done: "Listo",
      createTitle: "Crea tu comunidad",
      createBody:
        "Configura tu comunidad y sigue los pasos guiados. Te pediremos confirmar algunas acciones desde tu wallet.",
      txExplorer: "Ver transaccion en explorador",
      onboardingTitle: "Crea tu comunidad en Shift",
      onboardingBody:
        "Shift es una plataforma modular de gobernanza para comunidades descentralizadas. Este asistente te guia para desplegar tu comunidad con herramientas de gobernanza, verificacion y economia colaborativa.",
      onboardingHint: "Conecta tu wallet para empezar. Es el primer paso.",
      onboardingConnectionFailed: "La conexion fallo",
      onboardingConnectionCancelled: "Conexion cancelada.",
      onboardingConnecting: "Conectando...",
      close: "Cerrar"
    },
    communityList: {
      chain: "Red",
      viewCommunity: "Ver comunidad",
      loading: "Cargando comunidades...",
      loadFailed: "No se pudieron cargar las comunidades.",
      retry: "Reintentar",
      empty: "Todavia no hay comunidades indexadas.",
      myCommunities: "Mis comunidades",
      allCommunities: "Todas las comunidades",
      indexedCommunities: "Comunidades indexadas"
    },
    deployConfig: {
      stepNameTitle: "Nombre de la comunidad",
      stepNameDesc: "Asigna un nombre a tu comunidad",
      stepDescriptionTitle: "Descripcion",
      stepDescriptionDesc: "Describe el proposito de tu comunidad",
      stepCurrencyTitle: "Moneda",
      stepCurrencyDesc: "Elige la moneda estable para pagos y tesoreria",
      stepReadyTitle: "Lista para desplegar",
      stepReadyDesc: "Verifica que tu wallet tenga ETH suficiente para gas",
      labelCommunityName: "Nombre de la comunidad",
      placeholderCommunityName: "ej. Shift Builders Collective",
      labelDescription: "Descripcion",
      placeholderDescription: "Proposito y modelo operativo breve de esta comunidad",
      labelCurrency: "Moneda de la comunidad",
      currencyHelp: "La comunidad usara esta moneda para pagos y tesoreria.",
      selected: "Seleccionada",
      checking: "Comprobando wallet y red...",
      preflightCheck: "Comprobacion preflight",
      refreshing: "Actualizando...",
      refresh: "Actualizar",
      testAddress: "Direccion de prueba detectada: {address}. Los datos pueden no pertenecer a una wallet real.",
      wallet: "Wallet",
      connected: "Conectada",
      disconnected: "Desconectada",
      network: "Red",
      supported: "compatible",
      unsupported: "no compatible",
      balance: "Balance",
      required: "Requerido",
      sufficient: "suficiente",
      insufficient: "insuficiente",
      allChecksPassed: "Todas las comprobaciones pasaron. Puedes desplegar.",
      refreshingStatus: "Actualizando estado de preflight...",
      selectCurrency: "Selecciona una moneda.",
      exit: "Salir",
      back: "Atras",
      stepOf: "Paso {current} de {total}",
      next: "Siguiente",
      createCommunity: "Crear comunidad",
      simulateDeploy: "Simular deploy (modo diseno)"
    },
    deploySteps: {
      preflight: "Preflight",
      deployLayers: "Desplegar capas",
      wireRegistry: "Conectar registro",
      handoff: "Transferencia",
      verify: "Verificar",
      layerDeployment: "Despliegue de capa",
      permissionWiring: "Conexion de permisos y registro",
      adminHandoff: "Transferencia de admin",
      bootstrapRegistry: "Inicializar registro comunitario",
      applyWiring: "Aplicar conexion de roles de acceso",
      postWiring: "Ejecutar configuracion posterior",
      grantTimelock: "Conceder rol admin a timelock",
      revokeDeployer: "Revocar rol admin del deployer",
      revokeBootstrap: "Revocar rol admin del coordinador bootstrap",
      transaction: "Transaccion",
      of: "de",
      confirmed: "confirmada",
      confirming: "confirmando...",
      pending: "pendiente"
    },
    verification: {
      checking: "Verificando...",
      pass: "Correcto",
      fail: "Fallo"
    }
  },
  en: {
    layout: {
      htmlLang: "en",
      navCommunities: "Communities",
      navGovernance: "Governance",
      navEngagements: "Engagements",
      navMarketplace: "Marketplace",
      navProfile: "Profile",
      navRequests: "Requests",
      navDrafts: "Drafts",
      navProposals: "Proposals",
      governanceMenuAria: "Governance menu",
      languageMenuAria: "Change language",
      missingEnv: "Missing GRAPHQL_URL or INDEXER_API_URL. Update .env to point at the Base Sepolia indexer.",
      footerTitle: "Shift meta-governance",
      footerDocs: "Docs",
      homeAria: "Shift DeSoc - Home"
    },
    home: {
      badge: "Community meta-governance",
      title: "Verifiable coordination for communities that decide and execute together",
      subtitle:
        "Shift turns agreements into operational flows: requests, drafts, proposals, and on-chain execution with auditable rules.",
      ctaStart: "Start community",
      ctaExplore: "Explore communities",
      value1Title: "Multi-option voting",
      value1Body: "Communities compare real alternatives and prioritize with more context than yes/no voting.",
      value2Title: "Verified contribution",
      value2Body: "Work is peer-validated with M-of-N rules before recognition and value distribution.",
      value3Title: "Operational traceability",
      value3Body: "Decisions, states, and execution stay visible to improve trust and coordination.",
      howTitle: "How it works",
      howDetail: "View technical detail",
      howDetailBody:
        "Operational authority relies on contracts and timelock, while the indexer accelerates activity queries for daily navigation.",
      mainActionLabel: "Main action",
      createSectionTitle: "Create community",
      communitiesLabel: "Communities",
      communitiesTitle: "Indexed communities",
      communitiesLink: "Open communities page"
    },
    communitiesPage: {
      metaTitle: "Communities | Shift DeSoc",
      metaDescription:
        "Explore indexed on-chain communities running Shift governance and coordination infrastructure.",
      badge: "Community directory",
      title: "Communities on Shift",
      subtitle:
        "Browse indexed communities and open each one to see governance, coordination, and recent activity.",
      ctaCreate: "Create community",
      ctaHome: "Back to home",
      card1Title: "Indexed data",
      card1Body: "This list reflects what the indexer exposes; there may be slight lag versus the chain.",
      card2Title: "Your context",
      card2Body: "When you connect your wallet, communities tied to your activity appear first.",
      card3Title: "Next step",
      card3Body: "From each community you reach the hub with governance and coordination modules.",
      infoTitle: "About this view",
      infoDetail: "Technical detail",
      infoDetailBody:
        "Network and IDs come from the GraphQL indexer. On-chain contracts remain the source of truth for rules and parameters."
    },
    wizard: {
      ready: "Your community is ready!",
      goHome: "Go to home",
      goCommunity: "Go to my community",
      flowIncludes: "What this flow includes",
      flowItem1: "Configure name, description, and treasury currency.",
      flowItem2: "Run network and funding preflight before deploying.",
      flowItem3: "Resume progress if you close or change sessions.",
      checkingTitle: "Checking your communities...",
      checkingBody: "We are checking recent activity to show your best next entry point.",
      hasCommunities: "You already have communities. You can create another one or keep exploring.",
      noCommunities: "You can create a new community or explore existing ones.",
      connectedHint: "Since you are already connected, you can create a new community whenever you want.",
      createCommunity: "Create community",
      paused: "Deployment paused",
      verification: "Verification",
      deploying: "Deploying your community",
      failedBody: "An error occurred. Fix the issue and use Resume to continue.",
      verifyingBody: "Running verification checks.",
      deployingBody: "Confirm transactions in your wallet when prompted. Do not close this page.",
      resume: "Resume",
      resuming: "Resuming...",
      startOver: "Start over",
      allChecksPassed: "All checks passed.",
      done: "Done",
      createTitle: "Create your community",
      createBody:
        "Configure your community and follow the guided steps. You will be asked to confirm some actions from your wallet.",
      txExplorer: "View transaction on block explorer",
      onboardingTitle: "Create your community on Shift",
      onboardingBody:
        "Shift is a modular governance platform for decentralized communities. This guided flow helps you deploy your community with governance, verification, and collaborative economy tools.",
      onboardingHint: "Connect your wallet to get started. This is the first step.",
      onboardingConnectionFailed: "Connection failed",
      onboardingConnectionCancelled: "Connection cancelled.",
      onboardingConnecting: "Connecting...",
      close: "Close"
    },
    communityList: {
      chain: "Chain",
      viewCommunity: "View community",
      loading: "Loading communities...",
      loadFailed: "Failed to load communities.",
      retry: "Retry",
      empty: "No communities indexed yet.",
      myCommunities: "My communities",
      allCommunities: "All communities",
      indexedCommunities: "Indexed communities"
    },
    deployConfig: {
      stepNameTitle: "Community name",
      stepNameDesc: "Give your community a name",
      stepDescriptionTitle: "Description",
      stepDescriptionDesc: "Describe your community purpose",
      stepCurrencyTitle: "Currency",
      stepCurrencyDesc: "Choose the stable currency for payments and treasury",
      stepReadyTitle: "Ready to deploy",
      stepReadyDesc: "Verify your wallet has enough ETH for gas fees",
      labelCommunityName: "Community name",
      placeholderCommunityName: "e.g. Shift Builders Collective",
      labelDescription: "Description",
      placeholderDescription: "Short purpose and operating model for this community",
      labelCurrency: "Community currency",
      currencyHelp: "Your community will use this currency for payments and treasury.",
      selected: "Selected",
      checking: "Checking wallet and network...",
      preflightCheck: "Preflight check",
      refreshing: "Refreshing...",
      refresh: "Refresh",
      testAddress: "Test/mock address detected: {address}. Data may not be from a real wallet.",
      wallet: "Wallet",
      connected: "Connected",
      disconnected: "Disconnected",
      network: "Network",
      supported: "supported",
      unsupported: "unsupported",
      balance: "Balance",
      required: "Required",
      sufficient: "sufficient",
      insufficient: "insufficient",
      allChecksPassed: "All checks passed. You can deploy.",
      refreshingStatus: "Refreshing preflight status...",
      selectCurrency: "Please select a currency.",
      exit: "Exit",
      back: "Back",
      stepOf: "Step {current} of {total}",
      next: "Next",
      createCommunity: "Create community",
      simulateDeploy: "Simulate deploy (design mode)"
    },
    deploySteps: {
      preflight: "Preflight",
      deployLayers: "Deploy Layers",
      wireRegistry: "Wire Registry",
      handoff: "Handoff",
      verify: "Verify",
      layerDeployment: "Layer deployment",
      permissionWiring: "Permission and registry wiring",
      adminHandoff: "Admin handoff",
      bootstrapRegistry: "Bootstrap community registry",
      applyWiring: "Apply access-role wiring",
      postWiring: "Run post-wiring setup",
      grantTimelock: "Grant timelock admin role",
      revokeDeployer: "Revoke deployer admin role",
      revokeBootstrap: "Revoke bootstrap coordinator admin role",
      transaction: "Transaction",
      of: "of",
      confirmed: "confirmed",
      confirming: "confirming...",
      pending: "pending"
    },
    verification: {
      checking: "Checking...",
      pass: "Pass",
      fail: "Fail"
    }
  }
} as const;

export function getI18n(locale?: AppLocale) {
  const resolvedLocale = locale ?? getClientLocale();
  return dictionaries[resolvedLocale];
}

export function setLocaleCookie(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function getAvailableLocales(): AppLocale[] {
  return ["es", "en"];
}

export function getLocaleLabel(locale: AppLocale): string {
  return locale === "es" ? "Español" : "English";
}

export function getLocaleBadge(locale: AppLocale): string {
  return locale.toUpperCase();
}
