/**
 * AI Technical Scope & Activity Description Generator
 * V3A FREELA HUB - Intelligent Briefing & Scope Assister
 *
 * Implements historical context matching, strict prioritization rules (1.2.1),
 * security/confidentiality filtering (1.2.2 & 1.2.3), and structured 5-section formatting (1.1).
 */

export interface AIScopeGeneratorParams {
  roleNeeded: string;
  seniorityNeeded: string;
  jobTitle?: string;
  clientName?: string;
  nucleoName?: string;
  deliverables?: string;
  dbJobs?: any[];
  dbAllocations?: any[];
  dbEvaluations?: any[];
}

/** Domain knowledge base by role for V3A Live Marketing & Corporate Event operations */
const ROLE_DOMAIN_KNOWLEDGE: Record<
  string,
  {
    objectiveTemplate: string;
    responsibilitiesBySeniority: Record<string, string[]>;
    workInterfaces: string[];
    executionCriteria: string[];
    defaultDeliverables: string[];
  }
> = {
  'Diretor de Arte': {
    objectiveTemplate:
      'Atuação estratégica na criação, desdobramento e direção de arte para o projeto, garantindo identidade visual de alto impacto, consistência estética e excelência na entrega de peças e ambientes.',
    responsibilitiesBySeniority: {
      Júnior: [
        'Desdobrar peças gráficas e visuais a partir do conceito master aprovado.',
        'Tratar imagens, ajustar tipografias e preparar arquivos abertos e fechados.',
        'Auxiliar a equipe de criação no fechamento de pranchas e layouts.',
        'Revisar a aplicação de guias de marca e manuais de identidade.'
      ],
      Pleno: [
        'Desenvolver conceitos visuais e layouts para campanhas e eventos.',
        'Desdobrar key visuals (KV) em múltiplos formatos físicos e digitais.',
        'Coordenar o fechamento técnico de arquivos para gráfica e produção digital.',
        'Garantir a unidade estética de todas as entregas do projeto.',
        'Colaborar ativamente com redatores e cenógrafos na construção do briefing.'
      ],
      Sênior: [
        'Liderar a direção de arte e a conceituação visual do projeto.',
        'Criar Key Visuals (KV) inovadores alinhados aos objetivos estratégicos do cliente.',
        'Supervisionar o desdobramento visual garantindo rigidez estética e padrão V3A.',
        'Apresentar conceitos visuais para liderança e clientes quando requerido.',
        'Orientar a equipe de design e produção gráfica sobre diretrizes de acabamento.',
        'Garantir aderência total aos manuais de marca e diretrizes do briefing.'
      ],
      Especialista: [
        'Definir a visão artística e a direção de arte de projetos complexos de alta visibilidade.',
        'Desenvolver conceitos visuais disruptivos e identidades completas de experiências de marca.',
        'Supervisionar e auditar todas as etapas de produção visual e cenográfica.',
        'Mentorar a equipe criativa e assegurar padrão executivo de excelência.',
        'Validar provas de cor, protótipos e testes gráficos em escala real.'
      ]
    },
    workInterfaces: [
      'Núcleo de Criação e Planejamento',
      'Redação e Copywriting',
      'Cenografia e Modelagem 3D',
      'Produção Gráfica e Liderança de Projeto'
    ],
    executionCriteria: [
      'Alto rigor estético, alinhamento aos manuais de marca e precisão tipográfica.',
      'Entrega de arquivos organizados em camadas limpas com nomenclatura padrão V3A.',
      'Pontualidade rigorosa nos marcos de revisão e aprovação final.',
      'Aderência integral ao briefing e flexibilidade para ajustes solicitados.'
    ],
    defaultDeliverables: [
      'Key Visual Master em alta resolução e formato vetorizado/aberto.',
      'Guia de aplicação visual e pranchas conceituais.',
      'Arquivos finais fechados para impressão gráfica e exibição digital (PSD, AI, PDF/X-1a).'
    ]
  },
  'Designer 3D': {
    objectiveTemplate:
      'Desenvolvimento de modelagens 3D, maquetes eletrônicas e renderizações fotorrealistas para estruturas cenográficas, estandes e ambientes de eventos.',
    responsibilitiesBySeniority: {
      Júnior: [
        'Modelar elementos cenográficos básicos conforme plantas e rascunhos.',
        'Aplicar texturas e materiais pré-definidos na cena.',
        'Configurar iluminação simples e gerar renderizações preliminares.',
        'Exportar arquivos 3D para suporte à equipe de cenografia.'
      ],
      Pleno: [
        'Modelar estandes, cenários e estruturas de eventos em escala real.',
        'Desenvolver renderizações fotorrealistas com iluminação avançada e humanização.',
        'Garantir viabilidade construtiva preliminar nas cotas e proporções do projeto.',
        'Ajustar materiais, texturas e maquetes virtuais com rapidez para aprovação.'
      ],
      Sênior: [
        'Liderar a concepção e modelagem 3D de grandes cenografias e convenções.',
        'Criar imagens fotorrealistas de alta complexidade com rigor técnico e volumétrico.',
        'Detalhamento volumétrico considerando materiais reais (MDF, acrílico, LED, serralheria).',
        'Elaborar passeios virtuais / animações 3D simples para apresentação executiva.',
        'Supervisionar o envio de arquivos FBX/OBJ e especificações técnicas para produção.'
      ],
      Especialista: [
        'Conceber arquiteturas cenográficas complexas e experiências imersivas 3D.',
        'Renderização fotorrealista de alto padrão cinematográfico e simulações de iluminação cênica.',
        'Validar plantas executivas e viabilidade técnico-construtiva com a engenharia.',
        'Supervisionar a biblioteca de ativos e diretrizes 3D da agência.'
      ]
    },
    workInterfaces: [
      'Direção de Arte e Cenografia',
      'Produção Executiva e Cenotécnica',
      'Atendimento e Liderança de Núcleo'
    ],
    executionCriteria: [
      'Proporções realistas, cotas funcionais e fidelidade aos materiais de produção.',
      'Iluminação cênica coerente com a planta técnica do evento.',
      'Entrega de cenas organizadas (FBX, MAX, C4D ou Blender) e renders em alta definição.'
    ],
    defaultDeliverables: [
      'Renders fotorrealistas em alta resolução de múltiplos ângulos da estrutura.',
      'Arquivo 3D aberto e otimizado (FBX/OBJ/MAX).',
      'Planta humanizada e especificações volumétricas prévias.'
    ]
  },
  'Planejamento': {
    objectiveTemplate:
      'Construção da estratégia criativa, conceito de marca, jornada do visitante e defesa de proposta para concorrências e projetos corporativos.',
    responsibilitiesBySeniority: {
      Júnior: [
        'Realizar pesquisas de mercado, tendências e referências institucionais.',
        'Organizar dados do briefing e perfil do público-alvo.',
        'Estruturar rascunhos de apresentações de planejamento.',
        'Dar suporte na elaboração de mapas mentais e dinâmicas de engajamento.'
      ],
      Pleno: [
        'Estruturar o racional de planejamento e a narrativa da apresentação.',
        'Mapear a jornada do participante antes, durante e depois do evento.',
        'Desenvolver mecânicas de atração, ativações de marca e roteiros conceituais.',
        'Redigir defesas criativas claras e alinhadas aos KPIs do cliente.'
      ],
      Sênior: [
        'Liderar a estratégia completa de planejamento para concorrências de grande porte.',
        'Criar o conceito-chave (big idea) e a narrativa mestra do projeto.',
        'Integrar estratégia, cenografia, conteúdo e jornada em uma proposta coesa.',
        'Defender a proposta criativa e estratégica diretamente perante a diretoria do cliente.',
        'Definir mecânicas inovadoras de engajamento, ROI e métricas de sucesso do evento.'
      ],
      Especialista: [
        'Definir a estratégia corporativa e o posicionamento de grandes eventos de mercado.',
        'Desenvolver metodologias proprietárias de experiência de marca e mensuração.',
        'Orientar a estratégia criativa multidisciplinar da agência em concorrências chave.'
      ]
    },
    workInterfaces: [
      'Direção de Criação e Redação',
      'Atendimento e Business Development',
      'Produção Executiva e Budgeting'
    ],
    executionCriteria: [
      'Racional estratégico consistente, fundamentado e alinhado aos objetivos do cliente.',
      'Apresentações executivas impecáveis (PPTX/Keynote) com storytelling fluido.',
      'Respeito rigoroso aos prazos de entrega das entregas de concorrência.'
    ],
    defaultDeliverables: [
      'Apresentação completa de planejamento (PPTX/PDF).',
      'Racional do conceito mestre e mapa da jornada do participante.',
      'Detalhamento de ativações, mecânicas de engajamento e métricas de ROI.'
    ]
  },
  'Produtor Executivo': {
    objectiveTemplate:
      'Gestão end-to-end do projeto, coordenação operacional, controle de cronograma, contratação de fornecedores e fiscalização da montagem/realização.',
    responsibilitiesBySeniority: {
      Júnior: [
        'Acompanhar cotações com fornecedores cadastrados.',
        'Auxiliar no controle de prazos e checklists operacionais.',
        'Dar suporte na recepção de materiais no local do evento.',
        'Atualizar planilhas de contatos e ordens de serviço.'
      ],
      Pleno: [
        'Coordenar a produção de frentes operacionais (cenografia, A/V, credenciamento, buffet).',
        'Negociar cotações técnicas com fornecedores homologados.',
        'Elaborar e fiscalizar o cronograma detalhado de montagem e desmontagem.',
        'Garantir a execução operacional conforme especificações do projeto.'
      ],
      Sênior: [
        'Liderar a produção executiva geral de grandes eventos e convenções.',
        'Negociar contratos com grandes fornecedores garantindo eficiência financeira.',
        'Gerenciar alvarás, licenças, normas de segurança (AVCB) e logística no venue.',
        'Coordenar equipes técnicas no pavilhão durante montagem, evento e desmontagem.',
        'Garantir o alinhamento total entre o projeto aprovado e a entrega real no local.',
        'Gerir imprevistos operacionais com agilidade e postura resolutiva.'
      ],
      Especialista: [
        'Supervisionar operações de megaprojetos e festivais de alta complexidade logística.',
        'Definir protocolos de segurança, contingência e gestão de riscos em larga escala.',
        'Auditagem operacional e garantia de compliance em contratações.'
      ]
    },
    workInterfaces: [
      'Núcleo de Operações e Supply',
      'Fornecedores Técnicos (AV, Cenografia, Venue)',
      'Cliente Final e Autoridades Regulatórias'
    ],
    executionCriteria: [
      'Cumprimento rigoroso do cronograma de montagem e entrega no prazo impreterível.',
      'Postura ética, liderança clara de equipe e resolução ágil de problemas em campo.',
      'Conformidade com normas de segurança do trabalho e regulamentos da V3A.'
    ],
    defaultDeliverables: [
      'Cronograma geral detalhado de produção (montagem, evento, desmontagem).',
      'Matriz de fornecedores com escopos e contatos operacionais.',
      'Relatório final de produção executiva e encerramento de evento.'
    ]
  },
  'Produtor de Campo': {
    objectiveTemplate:
      'Atuação presencial em campo no acompanhamento direto da montagem, operação e suporte logístico durante a realização do evento.',
    responsibilitiesBySeniority: {
      Júnior: [
        'Prestar suporte presencial na sinalização e checagem de itens no local.',
        'Acompanhar a chegada de insumos e alimentação da equipe técnica.',
        'Auxiliar na organização de bastidores e camarins.'
      ],
      Pleno: [
        'Fiscalizar a montagem de estruturas específicas em campo conforme plantas.',
        'Supervisionar o fluxo de staffs, promotores e recepcionistas.',
        'Resolver intercorrências operacionais diretas no piso do evento.'
      ],
      Sênior: [
        'Liderar a operação de campo e o alinhamento de fornecedores no piso do evento.',
        'Fiscalizar a qualidade e segurança das montagens em tempo real.',
        'Coordenar a logística de bastidores, credenciamento e fluxo de convidados.',
        'Garantir a resolução imediata de desvios operacionais durante a operação ao vivo.'
      ],
      Especialista: [
        'Coordenar operações de campo de múltiplos palcos ou grandes recintos de evento.',
        'Gerenciar planos de evacuação, contingência técnica e operações críticas ao vivo.'
      ]
    },
    workInterfaces: [
      'Produção Executiva',
      'Equipes Técnicas de Campo',
      'Staffs e Credenciamento'
    ],
    executionCriteria: [
      'Presença constante no local de operação com foco total no evento.',
      'Comunicação rápida e assertiva por rádio/WhatsApp de campo.',
      'Atenção aos detalhes de acabamento e limpeza do espaço.'
    ],
    defaultDeliverables: [
      'Checklist de montagem e verificação de campo preenchido.',
      'Relatório de intercorrências de campo e passagem de bastão.'
    ]
  },
  'Redator': {
    objectiveTemplate:
      'Criação de conceitos, roteiros, títulos, chamadas e conteúdo textual para campanhas corporativas, vídeos, apresentações e ativações.',
    responsibilitiesBySeniority: {
      Júnior: [
        'Redigir chamadas curtas, posts e textos operacionais.',
        'Revisar ortografia e gramática de apresentações.',
        'Auxiliar em pesquisas de linguagem e tom de voz.'
      ],
      Pleno: [
        'Desenvolver manifestos, slogans e conceitos criativos de projetos.',
        'Escrever roteiros para vídeos institucionais e locução.',
        'Redigir a narrativa de apresentações de planejamento.'
      ],
      Sênior: [
        'Criar o conceito verbal máster (slogans, manifestos, tom de voz) do projeto.',
        'Redigir roteiros complexos de vídeo, apresentações executivas e cerimoniais.',
        'Definir estratégias de conteúdo transmídia para eventos e convenções.',
        'Garantir alinhamento da linguagem às diretrizes de marca do cliente.'
      ],
      Especialista: [
        'Liderar a estratégia narrativa de grandes campanhas institucionais e convenções globais.',
        'Mentoria de redação criativa e diretrizes de tom de voz da agência.'
      ]
    },
    workInterfaces: [
      'Direção de Arte e Criação',
      'Planejamento Estratégico',
      'Atendimento e Cliente'
    ],
    executionCriteria: [
      'Texto perspicaz, ortografia impecável e adaptação exata ao tom de voz exigido.',
      'Roteiros com tempo de leitura/locução preciso.',
      'Pontualidade rigorosa nas rodadas de revisão.'
    ],
    defaultDeliverables: [
      'Manifesto de projeto e conceitos verbais aprovados.',
      'Roteiros detalhados de vídeo/locução/cerimonial.',
      'Textos definitivos para peças cenográficas e digitais.'
    ]
  },
  'Motion Designer': {
    objectiveTemplate:
      'Criação de vinhetas, animações 2D/3D, conteúdos para painéis de LED e identidade em movimento para eventos e apresentações corporativas.',
    responsibilitiesBySeniority: {
      Júnior: [
        'Animar elementos gráficos 2D simples conforme placas da direção de arte.',
        'Renderizar e exportar vídeos nos formatos exigidos pelos painéis.',
        'Auxiliar na adaptação de vinhetas para diferentes resoluções.'
      ],
      Pleno: [
        'Criar animações 2D/3D dinâmicas para vinhetas de abertura e transições.',
        'Animar conteúdos para painéis de LED em resoluções atípicas (ultra-wide/curvos).',
        'Sincronizar animações com trilha sonora e locução.'
      ],
      Sênior: [
        'Liderar a criação de pacotes visuais em movimento completos para convenções.',
        'Desenvolver animações 3D/2D complexas, vinhetas de premiação e projeção mapeada.',
        'Configurar gabaritos técnicos de renderização para servidores de mídia (Watchout, Resolume).',
        'Garantir ritmo dinâmico e alto impacto estético nas telas do evento.'
      ],
      Especialista: [
        'Direção de arte em movimento para espetáculos, projeção mapeada 3D e telas imersivas.',
        'Supervisão técnica de servidores de vídeo em cenários de alta complexidade.'
      ]
    },
    workInterfaces: [
      'Direção de Arte',
      'Equipe de Áudio e Vídeo (AV)',
      'Produção Executiva'
    ],
    executionCriteria: [
      'Animação com ritmo fluido, boa curva de velocidade e sincronia sonora.',
      'Formatação rigorosa conforme os gabaritos de LED do evento.',
      'Arquivos finais renderizados em codecs profissionais (ProRes, H.264 high-bitrate).'
    ],
    defaultDeliverables: [
      'Pacote de vinhetas de abertura, transições e vinhetas de premiação renderizadas.',
      'Loops de fundo para painéis de LED em resolução nativa.',
      'Arquivos abertos de After Effects / Cinema4D organizados.'
    ]
  },
  'Atendimento': {
    objectiveTemplate:
      'Interface comercial e operacional entre o cliente e a agência, gerenciando solicitações, briefing, alinhamentos e acompanhamento de entregas.',
    responsibilitiesBySeniority: {
      Júnior: [
        'Organizar status report diário do projeto.',
        'Registrar atas de reuniões com cliente e repassar para as áreas.',
        'Acompanhar prazos internos de criação e produção.'
      ],
      Pleno: [
        'Conduzir reuniões de alinhamento de briefing com o cliente.',
        'Controlar cronograma de entregas e aprovações do projeto.',
        'Identificar oportunidades de expansão de escopo durante a execução.'
      ],
      Sênior: [
        'Liderar o relacionamento executivo e estratégico com a conta/cliente.',
        'Garantir satisfação do cliente, gestão de expectativas e controle de briefing.',
        'Gerenciar conflitos e negociar alterações de escopo com assertividade.',
        'Assegurar que todas as entregas estejam alinhadas às premissas contratadas.'
      ],
      Especialista: [
        'Gestão de grandes contas corporativas e relacionamento em nível C-Level.',
        'Planejamento de retenção de cliente e governança de contratos de longo prazo.'
      ]
    },
    workInterfaces: [
      'Cliente Final / Mídia / Marketing',
      'Núcleos de Criação e Planejamento',
      'Produção Executiva e Financeiro'
    ],
    executionCriteria: [
      'Comunicação clara, registros formais por escrito de todas as solicitações.',
      'Gestão proativa de cronogramas e aprovações.',
      'Postura profissional, diplomática e orientada a soluções.'
    ],
    defaultDeliverables: [
      'Status Report atualizado e Atas de Alinhamento.',
      'Briefings consolidados para equipe interna.',
      'Relatório de encerramento do projeto e aprovação final.'
    ]
  }
};

/** Default fallback for unlisted roles */
const DEFAULT_ROLE_KNOWLEDGE = {
  objectiveTemplate:
    'Atuação técnica especializada na função requerida para suporte ao projeto, garantindo conformidade operacional, qualidade de entrega e cumprimento dos prazos estabelecidos.',
  responsibilitiesBySeniority: {
    Júnior: [
      'Executar tarefas operacionais sob supervisão direta.',
      'Prestar suporte nas atividades cotidianas da área.',
      'Manter arquivos e registros organizados.'
    ],
    Pleno: [
      'Desenvolver as atividades principais da função com autonomia.',
      'Garantir a qualidade técnica e o cumprimento de prazos.',
      'Interagir proativamente com as demais áreas envolvidas no projeto.'
    ],
    Sênior: [
      'Liderar tecnicamente a execução da função no projeto.',
      'Resolver imprevistos complexos e orientar integrantes da equipe.',
      'Garantir excelência técnica, prazos e padrões da V3A.'
    ],
    Especialista: [
      'Prover consultoria técnica especializada e supervisão de alto nível.',
      'Garantir inovação, conformidade normativa e padrão executivo de entrega.'
    ]
  },
  workInterfaces: [
    'Liderança do Núcleo Contratante',
    'Equipe de Produção e Operações',
    'Fornecedores e Parceiros de Projeto'
  ],
  executionCriteria: [
    'Aderência total ao briefing e normas de segurança e qualidade.',
    'Entrega dentro dos prazos operacionais combinados.',
    'Comunicação assertiva e proatividade na resolução de desvios.'
  ],
  defaultDeliverables: [
    'Relatório de execução das atividades da função.',
    'Arquivos e materiais produzidos no escopo da alocação.'
  ]
};

/**
 * Anonymizes historical text removing confidential/private details (Rule 1.2.3)
 */
function cleanAndAnonymizeHistoryText(text: string): string {
  if (!text) return '';
  return text
    .replace(/R\$\s?[\d.,]+/gi, '[valor negociado]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b\d{2}\s?\d{4,5}[-\s]?\d{4}\b/g, '[telefone]')
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '[cnpj]')
    .trim();
}

/**
 * Generates an AI-assisted technical scope formatted into 5 structured sections.
 *
 * @param params Context parameter set
 * @returns Formatted Markdown string containing the generated technical scope
 */
export function generateTechnicalScopeWithAI(params: AIScopeGeneratorParams): string {
  const {
    roleNeeded,
    seniorityNeeded,
    jobTitle,
    clientName,
    nucleoName,
    deliverables,
    dbJobs = [],
    dbAllocations = [],
    dbEvaluations = []
  } = params;

  // ── Step 1: Historical Record Prioritized Search (Rule 1.2.1 & 1.2.2) ──
  let historicalMatchText = '';
  let matchTier = 7; // Default: Domain knowledge (Tier 7)

  if (dbJobs.length > 0) {
    // Filter valid historical jobs (Rule 1.2.2)
    const validJobs = dbJobs.filter(j => {
      if (!j.description || j.description.trim().length < 20) return false;
      if (j.status === 'canceled' || j.status === 'draft') return false;

      // Check if job had negative evaluations
      if (dbEvaluations.length > 0) {
        const evals = dbEvaluations.filter((ev: any) => ev.jobId === j.id);
        const hasNegative = evals.some((ev: any) => (ev.score || 5) < 3);
        if (hasNegative) return false;
      }
      return true;
    });

    if (validJobs.length > 0) {
      // Tier 1: Same role & same seniority
      const tier1 = validJobs.find(
        j => j.roleNeeded === roleNeeded && j.seniorityNeeded === seniorityNeeded
      );
      if (tier1) {
        historicalMatchText = cleanAndAnonymizeHistoryText(tier1.description);
        matchTier = 1;
      } else {
        // Tier 2: Same role in close seniority
        const tier2 = validJobs.find(j => j.roleNeeded === roleNeeded);
        if (tier2) {
          historicalMatchText = cleanAndAnonymizeHistoryText(tier2.description);
          matchTier = 2;
        } else {
          // Tier 3: Same nucleus & same role
          const tier3 = validJobs.find(
            j => (j.nucleoName === nucleoName || j.nucleoId) && j.roleNeeded === roleNeeded
          );
          if (tier3) {
            historicalMatchText = cleanAndAnonymizeHistoryText(tier3.description);
            matchTier = 3;
          } else {
            // Tier 4: Same client or project category
            const tier4 = validJobs.find(
              j => clientName && j.clientName && j.clientName.toLowerCase() === clientName.toLowerCase()
            );
            if (tier4) {
              historicalMatchText = cleanAndAnonymizeHistoryText(tier4.description);
              matchTier = 4;
            }
          }
        }
      }
    }
  }

  // ── Step 2: Role Knowledge Lookup ──
  const roleKnowledge = ROLE_DOMAIN_KNOWLEDGE[roleNeeded] || DEFAULT_ROLE_KNOWLEDGE;
  const seniorityKey = ['Júnior', 'Pleno', 'Sênior', 'Especialista'].includes(seniorityNeeded)
    ? seniorityNeeded
    : 'Sênior';
  const respList =
    roleKnowledge.responsibilitiesBySeniority[seniorityKey] ||
    roleKnowledge.responsibilitiesBySeniority['Sênior'];

  // ── Step 3: Synthesize 5 Structured Sections (Rule 1.1) ──

  // Section 1: Objetivo da Atuação
  const jobTitleText = jobTitle ? `"${jobTitle}"` : 'do projeto';
  const clientText = clientName ? ` para o cliente ${clientName}` : '';
  const objective = `Atuação de nível ${seniorityNeeded} na função de ${roleNeeded}${clientText}, com foco principal no suporte ao job ${jobTitleText}. ${roleKnowledge.objectiveTemplate}`;

  // Section 2: Principais Responsabilidades (4 to 8 items)
  const responsibilitiesFormatted = respList
    .slice(0, 8)
    .map(r => `- ${r}`)
    .join('\n');

  // Section 3: Interface e Dinâmica de Trabalho
  let interfacesFormatted = roleKnowledge.workInterfaces.map(i => `- ${i}`).join('\n');
  if (nucleoName) {
    interfacesFormatted = `- Núcleo Responsável: ${nucleoName}\n` + interfacesFormatted;
  }

  // Section 4: Critérios Esperados de Execução
  const criteriaFormatted = roleKnowledge.executionCriteria.map(c => `- ${c}`).join('\n');

  // Section 5: Entregas Esperadas
  let deliverablesFormatted = '';
  if (deliverables && deliverables.trim().length > 3) {
    deliverablesFormatted = `- Entregáveis informados no briefing: ${deliverables.trim()}\n` +
      roleKnowledge.defaultDeliverables.map(d => `- ${d}`).join('\n');
  } else {
    deliverablesFormatted = roleKnowledge.defaultDeliverables.map(d => `- ${d}`).join('\n');
  }

  // Combine into clean structured text
  const structuredOutput = `• OBJETIVO DA ATUAÇÃO
${objective}

• PRINCIPAIS RESPONSABILIDADES
${responsibilitiesFormatted}

• INTERFACE E DINÂMICA DE TRABALHO
${interfacesFormatted}

• CRITÉRIOS ESPERADOS DE EXECUÇÃO
${criteriaFormatted}

• ENTREGAS ESPERADAS
${deliverablesFormatted}`;

  return structuredOutput;
}
