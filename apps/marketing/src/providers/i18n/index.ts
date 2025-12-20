// Sistema de internacionalización para Shift DeSoc (Next.js compatible)

export type Language = 'en' | 'es'

export const translations = {
    en: {
        // Navigation
        navHome: "Home",
        navAbout: "About",
        navPrinciples: "Principles",
        navSolutions: "Solutions",
        navWhitepaper: "Whitepaper",
        navContact: "Contact",
        navGetStarted: "Get Started",

        // Hero Section
        heroTitle: "Unlocking human cooperation",
        heroTitleLine1: "Unlocking human",
        heroTitleLine2: "cooperation",
        heroSubtitle: "Governance tech that empowers communities to thrive together",
        heroDescription: "Coordinate resources, reward verified contributions, and decide together with tools designed for democratic scale.",
        heroStatement: "Shift turns communities into high-trust networks where effort is visible, value circulates locally, and every voice stays heard.",
        
        // Vision Section
        visionTitle: "The Vision",
        visionSubtitle: "From Competition to Cooperation",
        problemTitle: "Today's Problem:",
        problem1: "Your effort doesn't stay with you: what you build on a platform is lost when you switch, get banned, or the app disappears.",
        problem2: "Important decisions become superficial: yes/no voting ignores nuance, priorities, and real alternatives.",
        problem3: "Rewards go to capital owners, not value creators: creators sustain the system but benefits concentrate at the top.",
        problem4: "Coordinating many people is chaos: without clear rules, the community stalls, fragments, or depends on a few leaders.",
        solutionTitle: "Shift's Solution:",
        solution1: "Your contributions are recorded forever: a verifiable history that follows you across projects and communities.",
        solution2: "Voting with real options: choose among multiple proposals and express priorities, not just for/against.",
        solution3: "Fair distribution of created value: rewards are shared based on verifiable contributions, with transparent rules.",
        solution4: "Coordination that scales without losing democracy: tools to grow from a small group to a large network without bureaucracy or central control.",
        
        // Principles Section
        principlesTitle: "Built on 3 simple but powerful principles",
        principle1Title: "Prove Your Work",
        principle1Subtitle: "Build Reputation",
        principle1Description: "When you complete valuable work, community members verify it and you earn permanent digital credentials (Soulbound Tokens) that prove your contributions. This creates a \"blockchain resume\" that no company can delete.",
        principle2Title: "Contribute",
        principle2Subtitle: "Earn Governance Power",
        principle2Description: "Unlike systems where money equals power, Shift gives voting rights based on verified contributions. The people doing the work get to make the decisions.",
        principle3Title: "Create Value",
        principle3Subtitle: "Share Rewards",
        principle3Description: "Communities set up automatic systems to distribute income fairly based on each person's contributions, not just who invested money first.",
        
        // Features Section
        featuresTitle: "Everything a cooperative society needs – one platform",
        feature1Title: "Community Value System",
        feature1Bullet1: "The community decides what counts as value—not an algorithm or a company.",
        feature1Bullet2: "Every contribution counts: coding, teaching, organizing, facilitating, caregiving.",
        feature1Bullet3: "Clear rules to recognize and reward: defined together and applied transparently.",
        feature2Title: "Multi-Choice Governance",
        feature2Bullet1: "More than yes/no: choose among real proposals.",
        feature2Bullet2: "Decisions with nuance: the community expresses preferences, priorities, and alternatives.",
        feature2Bullet3: "Less polarization, better agreements: outcomes are more representative and actionable.",
        feature3Title: "Community Marketplace",
        feature3Bullet1: "Exchange within the network: services, resources, and products among members and communities.",
        feature3Bullet2: "Trust built on history: reputation helps ensure quality and follow-through.",
        feature3Bullet3: "Value stays in the community instead of going to intermediaries or external shareholders.",
        feature4Title: "Treasury Management",
        feature4Bullet1: "Full transparency: anyone can see income, expenses, and movements.",
        feature4Bullet2: "Spending and crowdfunding decided collectively: priorities, budgets, investments, and campaigns are community-voted.",
        feature4Bullet3: "Accountability by design: every decision is recorded and traceable.",
        feature5Title: "Portable Reputation",
        feature5Bullet1: "Your track record travels with you: what you contribute today serves you tomorrow elsewhere.",
        feature5Bullet2: "Easier entry into new spaces: communities trust your verified trajectory.",
        feature5Bullet3: "Global cooperation: good work opens doors, not “connections.”",
        feature6Title: "Peer-Verified Work",
        feature6Bullet1: "Recognition through community review: contributions are validated by members.",
        feature6Bullet2: "Quality by consensus: multiple reviewers must agree, not just one opinion.",
        feature6Bullet3: "Accountability and trust: the process reduces fraud and rewards well-done work.",
        
        // Applications Section
        applicationsTitle: "Already transforming how people live and work",
        application1Title: "Developer Communities",
        application1Description: "Contributors build verified reputations across projects, with fair compensation for code reviews, documentation, and maintenance work.",
        application2Title: "Local Cooperatives",
        application2Description: "Neighbors coordinate shared resources (tools, vehicles, childcare) while making democratic decisions about community investments.",
        application3Title: "Creative Collectives",
        application3Description: "Artists and creators verify their work quality, build portable reputations, and share revenue from collective projects fairly.",
        application4Title: "Nomad Networks",
        application4Description: "Specialists move between communities worldwide, carrying verified credentials and contributing to local projects while maintaining their reputation.",
        
        // Why Blockchain Section
        whyTitle: "Why Blockchain?",
        whyStatement: "Because centralization failed us.",
        whyPlatformsTitle: "Centralized Platforms",
        whyPlatformsDescription: "Fundamentally unfair. They control your data, reputation, and economic opportunities. They can delete your account, change the rules, or extract value arbitrarily.",
        futureTitle: "The Future We're Building",
        futureStatement1: "Abundance over scarcity",
        futureStatement2: "Cooperation over competition",
        futureWhyDescription: "Permanent, tamper-proof records that no single entity controls. Your reputation and achievements are yours forever, stored on a network maintained by the community itself.",
        
        // Impact Section
        impactTitle: "The Impact: What This Enables",
        impactIndividualsTitle: "For Individuals:",
        impactIndividuals1: "Build lasting reputation that no platform can take away",
        impactIndividuals2: "Get fairly compensated for the value you actually create",
        impactIndividuals3: "Have real voice in decisions that affect your work and community",
        impactIndividuals4: "Access opportunities across a global network of cooperative communities",
        impactCommunitiesTitle: "For Communities:",
        impactCommunities1: "Coordinate resources efficiently without central authority",
        impactCommunities2: "Make better decisions through nuanced, democratic processes",
        impactCommunities3: "Attract quality contributors through reputation-based networking",
        impactCommunities4: "Build sustainable economics where value stays in the community",
        impactSocietyTitle: "For Society:",
        impactSociety1: "Reduce inequality by connecting contribution to rewards",
        impactSociety2: "Increase innovation by empowering people to work on what matters",
        impactSociety3: "Strengthen democracy through practical experience in self-governance",
        impactSociety4: "Create abundance through efficient cooperation instead of wasteful competition",
        
        // Future Section
        futureSectionTitle: "The Future We're Building",
        futureIntro: "Imagine networks of communities that:",
        future1: "Meet all basic human needs through cooperation",
        future2: "Reward creativity and care work as much as traditional \"productive\" labor",
        future3: "Make decisions democratically with sophisticated tools that actually work",
        future4: "Create abundance through intelligent coordination rather than artificial scarcity",
        future5: "Allow people to contribute based on passion and skill rather than survival necessity",
        futureStatement: "This isn't utopian thinking - it's practical engineering applied to human coordination.",
        futureDescription: "When communities can efficiently verify contributions, coordinate resources, and make collective decisions, the artificial constraints that force competition become obsolete.",
        
        // Getting Started Section
        gettingStartedTitle: "Getting Started",
        gettingStarted1Title: "For Communities Ready to Experiment:",
        gettingStarted1Description: "Start with simple coordination: use Shift's tools to track contributions, make group decisions, and distribute any shared resources or income transparently.",
        gettingStarted2Title: "For Individuals Who Want to Contribute:",
        gettingStarted2Description: "Join existing communities using Shift, build verified reputation through quality contributions, and help improve the tools that enable democratic cooperation.",
        gettingStarted3Title: "For Organizations Seeking Change:",
        gettingStarted3Description: "Explore how Shift's governance and verification tools can make your existing organization more democratic, transparent, and fair.",
        
        // CTA Section
        ctaTitle: "Join the Cooperation Revolution",
        ctaStatement: "Shift DeSoc proves that a better world isn't just possible - it's inevitable once we have the right tools to build it.",
        ctaDescription: "The technology exists. The communities are forming. The only question is: Will you be part of building the cooperative future, or stay trapped in systems that extract your value?",
        ctaQuestion: "Ready to shift from competition to cooperation? The tools are here. The communities are waiting. Your contribution matters.",
        btnLearnMore: "Learn More",
        btnJoinCommunity: "Join Community",
        btnStartBuilding: "Start Building",
        ctaTagline: "Shift DeSoc: Where human potential meets cooperative technology",
        
        // Footer
        footerText: "© 2025 Shift DeSoc. Building tools that unlock our collective potential.",
        
        // Language selector
        langSelector: "Language"
    },
    es: {
        // Navigation
        navHome: "Inicio",
        navAbout: "Nosotros",
        navPrinciples: "Principios",
        navSolutions: "Soluciones",
        navWhitepaper: "Whitepaper",
        navContact: "Contacto",
        navGetStarted: "Comenzar",

        // Hero Section
        heroTitle: "Desbloqueamos la cooperación humana",
        heroTitleLine1: "Desbloqueamos la",
        heroTitleLine2: "cooperación humana",
        heroSubtitle: "Tecnología de gobernanza que empodera a las comunidades",
        heroDescription: "Coordina recursos, recompensa contribuciones verificadas y decide en conjunto con herramientas diseñadas para la escala democrática.",
        heroStatement: "Shift convierte a las comunidades en redes de alta confianza donde el esfuerzo se ve, el valor se queda y todas las voces cuentan.",
        
        // Vision Section
        visionTitle: "La Visión",
        visionSubtitle: "De la Competencia a la Cooperación",
        problemTitle: "El Problema de Hoy:",
        problem1: "Tu esfuerzo no se queda contigo: lo que construyes en una plataforma se pierde cuando cambias, te banean o la app desaparece.",
        problem2: "Decisiones importantes se vuelven superficiales: votar “sí/no” no refleja matices, prioridades ni alternativas reales.",
        problem3: "La recompensa va a quien tiene capital, no a quien aporta valor: los creadores sostienen el sistema, pero el beneficio se concentra arriba.",
        problem4: "Coordinar a muchas personas es un caos: sin reglas claras, la comunidad se frena, se fragmenta o depende de pocos líderes.",
        solutionTitle: "La Solución de Shift:",
        solution1: "Tus contribuciones quedan registradas para siempre: un historial verificable que te acompaña entre proyectos y comunidades.",
        solution2: "Votación con opciones reales: elige entre varias propuestas y expresa prioridades, no solo “a favor/en contra”.",
        solution3: "Reparto justo del valor creado: las recompensas se distribuyen según aportes verificables, con reglas transparentes.",
        solution4: "Coordinación que escala sin perder democracia: herramientas para pasar de un grupo pequeño a una red grande sin burocracia ni control central.",
        
        // Principles Section
        principlesTitle: "Construido sobre 3 principios simples pero poderosos",
        principle1Title: "Demuestra Tu Trabajo",
        principle1Subtitle: "Construye Reputación",
        principle1Description: "Cuando completas trabajo valioso, los miembros de la comunidad lo verifican y obtienes credenciales digitales permanentes (Soulbound Tokens) que prueban tus contribuciones. Esto crea un \"currículum blockchain\" que ninguna empresa puede borrar.",
        principle2Title: "Contribuye",
        principle2Subtitle: "Gana Poder de Gobernanza",
        principle2Description: "A diferencia de los sistemas donde el dinero es poder, Shift otorga derechos de voto basados en contribuciones verificadas. Quienes hacen el trabajo son quienes toman las decisiones.",
        principle3Title: "Crea Valor",
        principle3Subtitle: "Comparte Recompensas",
        principle3Description: "Las comunidades configuran sistemas automáticos para repartir ingresos de forma justa según las contribuciones de cada persona, no solo según quién puso dinero primero.",
        
        // Features Section
        featuresTitle: "Todo lo que una sociedad cooperativa necesita – una plataforma",
        feature1Title: "Sistema de Valor",
        feature1Bullet1: "La comunidad decide qué aporta valor: no lo define un algoritmo ni una empresa.",
        feature1Bullet2: "Cada tipo de contribución cuenta: desde programar y enseñar hasta organizar, facilitar o cuidar.",
        feature1Bullet3: "Reglas claras para reconocer y recompensar: lo valioso se define en común y se aplica con transparencia.",
        feature2Title: "Gobernanza Multi-Opción",
        feature2Bullet1: "Más que “sí o no”: puedes elegir entre varias propuestas reales.",
        feature2Bullet2: "Decisiones con matices: la comunidad expresa preferencias, prioridades y alternativas.",
        feature2Bullet3: "Menos polarización, mejores acuerdos: se llega a resultados más representativos y accionables.",
        feature3Title: "Mercado Comunitario",
        feature3Bullet1: "Intercambia dentro de la red: servicios, recursos y productos entre miembros y comunidades.",
        feature3Bullet2: "La confianza se construye con historial: la reputación ayuda a asegurar calidad y cumplimiento.",
        feature3Bullet3: "El valor se queda en la comunidad: en vez de irse a intermediarios o accionistas externos.",
        feature4Title: "Gestión del Tesoro",
        feature4Bullet1: "Transparencia total: cualquier persona puede ver ingresos, gastos y movimientos.",
        feature4Bullet2: "Gasto y crowdfund decididos en colectivo: prioridades, presupuestos, inversiones y campañas se votan en comunidad.",
        feature4Bullet3: "Rendición de cuentas por diseño: cada decisión queda registrada y es rastreable.",
        feature5Title: "Reputación Portátil",
        feature5Bullet1: "Tu historial te acompaña: lo que aportas hoy te sirve mañana, en otra comunidad.",
        feature5Bullet2: "Entrada más fácil a nuevos espacios: las comunidades confían en tu trayectoria verificada.",
        feature5Bullet3: "Cooperación global: una red donde el buen trabajo abre puertas, no “contactos”.",
        feature6Title: "Trabajo Verificado por Pares",
        feature6Bullet1: "Reconocimiento con revisión comunitaria: las contribuciones se validan entre miembros.",
        feature6Bullet2: "Calidad con consenso: se requiere acuerdo de varios revisores, no la opinión de una sola persona.",
        feature6Bullet3: "Responsabilidad y confianza: el proceso reduce fraude y premia el trabajo bien hecho.",
        
        // Applications Section
        applicationsTitle: "Ya está transformando cómo las personas viven y trabajan",
        application1Title: "Comunidades de Desarrolladores",
        application1Description: "Los contribuyentes construyen reputaciones verificadas en proyectos, con pago justo por revisiones de código, documentación y trabajo de mantenimiento.",
        application2Title: "Cooperativas Locales",
        application2Description: "Los vecinos coordinan recursos compartidos (herramientas, vehículos, cuidado de niños) mientras toman decisiones democráticas sobre inversiones comunitarias.",
        application3Title: "Colectivos Creativos",
        application3Description: "Artistas y creadores verifican la calidad de su trabajo, construyen reputaciones portátiles y comparten ingresos de proyectos colectivos de forma justa.",
        application4Title: "Redes Nómadas",
        application4Description: "Especialistas se mueven entre comunidades en todo el mundo, llevando credenciales verificadas y aportando a proyectos locales mientras mantienen su reputación.",
        
        // Why Blockchain Section
        whyTitle: "¿Por qué Blockchain?",
        whyStatement: "Porque la centralización nos falló.",
        whyPlatformsTitle: "Plataformas Centralizadas",
        whyPlatformsDescription: "Fundamentalmente injustas. Controlan tus datos, reputación y oportunidades económicas. Pueden borrar tu cuenta, cambiar las reglas o sacar valor cuando quieran.",
        futureTitle: "El Futuro que Estamos Construyendo",
        futureStatement1: "Abundancia sobre escasez",
        futureStatement2: "Cooperación sobre competencia",
        futureWhyDescription: "Registros permanentes e inalterables que ninguna entidad única controla. Tu reputación y logros son tuyos para siempre, guardados en una red mantenida por la propia comunidad.",
        
        // Impact Section
        impactTitle: "El Impacto: Lo que Esto Habilita",
        impactIndividualsTitle: "Para Individuos:",
        impactIndividuals1: "Construye reputación duradera que ninguna plataforma puede quitarte",
        impactIndividuals2: "Obtén pago justo por el valor que realmente creas",
        impactIndividuals3: "Ten voz real en decisiones que afectan tu trabajo y comunidad",
        impactIndividuals4: "Accede a oportunidades a través de una red global de comunidades cooperativas",
        impactCommunitiesTitle: "Para Comunidades:",
        impactCommunities1: "Coordina recursos de forma eficiente sin autoridad central",
        impactCommunities2: "Toma mejores decisiones a través de procesos democráticos más completos",
        impactCommunities3: "Atrae contribuyentes de calidad a través de redes basadas en reputación",
        impactCommunities4: "Construye economía sostenible donde el valor se queda en la comunidad",
        impactSocietyTitle: "Para la Sociedad:",
        impactSociety1: "Reduce la desigualdad conectando contribución con recompensas",
        impactSociety2: "Aumenta la innovación dando poder a las personas para trabajar en lo que importa",
        impactSociety3: "Fortalece la democracia a través de experiencia práctica en autogobierno",
        impactSociety4: "Crea abundancia a través de cooperación eficiente en lugar de competencia que desperdicia recursos",
        
        // Future Section
        futureSectionTitle: "El Futuro que Estamos Construyendo",
        futureIntro: "Imagina redes de comunidades que:",
        future1: "Cubren todas las necesidades humanas básicas a través de la cooperación",
        future2: "Recompensan la creatividad y el trabajo de cuidado tanto como el trabajo \"productivo\" tradicional",
        future3: "Toman decisiones democráticamente con herramientas sofisticadas que realmente funcionan",
        future4: "Crean abundancia a través de coordinación inteligente en lugar de escasez artificial",
        future5: "Permiten a las personas contribuir basándose en pasión y habilidad en lugar de necesidad de supervivencia",
        futureStatement: "Esto no es pensamiento utópico - es ingeniería práctica aplicada a la coordinación humana.",
        futureDescription: "Cuando las comunidades pueden verificar contribuciones de forma eficiente, coordinar recursos y tomar decisiones colectivas, las restricciones artificiales que fuerzan la competencia se vuelven obsoletas.",
        
        // Getting Started Section
        gettingStartedTitle: "Comenzar",
        gettingStarted1Title: "Para Comunidades Listas para Experimentar:",
        gettingStarted1Description: "Comienza con coordinación simple: usa las herramientas de Shift para rastrear contribuciones, tomar decisiones grupales y repartir cualquier recurso compartido o ingreso de forma transparente.",
        gettingStarted2Title: "Para Individuos que Quieren Contribuir:",
        gettingStarted2Description: "Únete a comunidades existentes que usan Shift, construye reputación verificada a través de contribuciones de calidad y ayuda a mejorar las herramientas que permiten la cooperación democrática.",
        gettingStarted3Title: "Para Organizaciones que Buscan Cambio:",
        gettingStarted3Description: "Explora cómo las herramientas de gobernanza y verificación de Shift pueden hacer que tu organización sea más democrática, transparente y justa.",
        
        // CTA Section
        ctaTitle: "Únete a la Revolución de la Cooperación",
        ctaStatement: "Shift DeSoc demuestra que un mundo mejor no solo es posible - es inevitable una vez que tenemos las herramientas correctas para construirlo.",
        ctaDescription: "La tecnología existe. Las comunidades se están formando. La única pregunta es: ¿Serás parte de construir el futuro cooperativo, o te quedarás atrapado en sistemas que se quedan con tu valor?",
        ctaQuestion: "¿Listo para cambiar de competencia a cooperación? Las herramientas están aquí. Las comunidades están esperando. Tu contribución importa.",
        btnLearnMore: "Saber Más",
        btnJoinCommunity: "Unirse a la Comunidad",
        btnStartBuilding: "Comenzar a Construir",
        ctaTagline: "Shift DeSoc: Donde el potencial humano se encuentra con la tecnología cooperativa",
        
        // Footer
        footerText: "© 2025 Shift DeSoc. Construyendo herramientas que liberan nuestro potencial colectivo.",
        
        // Language selector
        langSelector: "Idioma"
    }
}

export type TranslationKey = keyof typeof translations.en

export function getTranslations(lang: Language = 'es') {
    return translations[lang]
}
