# **FREELA HUB — Documento Funcional da Plataforma**

**Versão:** v1.0  
**Projeto:** FREELA HUB | V3A  
**Responsável pelo documento:** \[Renato Gioia\]  
**Data da última atualização:** \[22/06/2026\]  
**Status:** Em evolução

---

## **1\. Visão Geral**

O **FREELA HUB** é uma plataforma interna de gestão de freelancers da V3A, criada para centralizar o cadastro, seleção, negociação, contratação, alocação, acompanhamento, pagamento e avaliação de profissionais freelancers.

A plataforma tem como objetivo reduzir informalidade, sobreposição de contratações, falta de visibilidade de agenda, variação excessiva de valores, retrabalho operacional e dependência de controles paralelos.

O sistema atua como uma camada de governança entre os núcleos contratantes, RH, C-Level, freelancers e financeiro, garantindo que as contratações sejam realizadas de forma padronizada, rastreável e alinhada às políticas internas.

---

## **2\. Objetivos da Plataforma**

### **2.1 Objetivo principal**

Centralizar e estruturar o ciclo completo de contratação de freelancers, desde a criação da demanda até a avaliação pós-entrega.

### **2.2 Objetivos específicos**

* Criar um banco único e homologado de freelancers.  
* Evitar duplicidade de cadastro de profissionais.  
* Controlar agenda e disponibilidade dos freelancers.  
* Padronizar valores por função, senioridade e modelo de remuneração.  
* Apoiar os núcleos na formação de shortlists.  
* Registrar negociações e exceções de valores.  
* Exigir aprovação para contratações fora da política.  
* Gerar alocações oficiais após homologação.  
* Apoiar solicitações de pagamento ao financeiro.  
* Consolidar avaliações de desempenho.  
* Melhorar a tomada de decisão em futuras contratações.  
* Reduzir gastos desnecessários e contratações sobrepostas.

---

## **3\. Perfis de Acesso**

A plataforma possui diferentes perfis de acesso, com permissões específicas.

| Perfil | Descrição | Principais Permissões |
| ----- | ----- | ----- |
| **MASTER** | Perfil administrativo máximo | Acesso total à plataforma, gestão de usuários, núcleos, políticas, freelas, jobs, alocações e relatórios |
| **RH** | Perfil de governança operacional | Gestão do banco de freelancers, pré-cadastros, links públicos, políticas, acompanhamento de exceções e suporte ao fluxo |
| **C-LEVEL** | Perfil estratégico multi-núcleo | Acesso semelhante ao perfil de núcleo, porém sem vínculo com um núcleo específico; pode atuar em qualquer núcleo e criar novos núcleos |
| **OPERAÇÃO** | Perfil operacional multi-núcleo | Acesso semelhante ao perfil de C-LEVEL, porém sem vínculo com um núcleo específico; pode atuar em qualquer núcleo mas não pode criar novos núcleos |
| **NÚCLEO** | Perfil operacional do núcleo contratante | Criação de oportunidades, shortlist, negociação, acompanhamento de bookings, avaliação de freelancers e emissão de solicitação de pagamento |
| **HEAD DO NÚCLEO** | Usuário do perfil Núcleo com autoridade de aprovação | Aprova ou reprova exceções de política vinculadas ao seu núcleo |
| **FREELANCER** | Usuário externo via link público | Preenche cadastro, atualiza dados e responde avaliações externas |
| **FINANCEIRO** | Área externa à plataforma | Recebe documento/exportação de solicitação de pagamento emitido pelo sistema |

---

## **4\. Módulos da Plataforma**

### **4.1 Dashboard Geral**

O Dashboard apresenta indicadores consolidados da operação e PRECISA TER VISUALIZAÇÕES DIFERENTES PARA CADA UM DOS PERFIS EXISTENTE.

#### **Indicadores recomendados: ATUALMENTE ESTÁ IGUAL PARA TODOS** (Trabalhar em visualizações diferentes na v2)

* Total de freelancers cadastrados.  
* Freelancers elegíveis.  
* Freelancers bloqueados.  
* Alocações ativas.  
* Jobs criados.  `
* Avaliações pendentes.  
* Exceções de valor pendentes.  
* Códigos/links gerados.  
* Jobs fora da política.  
* Negociações aguardando aprovação do Head.  
* Demandas por núcleo.  
* Alocações ativas por função.  
* Últimos jobs registrados.  
* Alertas de governança.

---

### **4.2 Cadastro de Núcleos**

Módulo usado para cadastrar e gerenciar núcleos operacionais da agência.

#### **Campos principais**

* Nome do núcleo.  
* Código do núcleo.  
* Head responsável.  
* E-mail corporativo do Head.  
* Usuário vinculado ao Head.  
* Status do núcleo.  
* Histórico de demandas.  
* Histórico de alocações.

#### **Regras**

* Cada núcleo PRECISA ter um Head responsável.  
* Usuários do tipo Núcleo ficam vinculados a um núcleo específico.  
* Usuários C-Level não ficam vinculados a um único núcleo.
* Usuários OPERAÇÃO não ficam vinculados a um único núcleo.
* MASTER, OPERAÇÃO, C-LEVEL e RH podem administrar núcleos.  
* MASTER, RH eC-Level pode criar novos núcleos, conforme regra de permissão.

---

### **4.3 Gestão de Usuários**

Módulo para administrar usuários internos da plataforma.

#### **Perfis disponíveis**

* MASTER  
* RH  
* C-LEVEL  
* NÚCLEO
* OPERAÇÃO

#### **Campos principais**

* Nome completo.  
* E-mail corporativo.  
* Perfil de acesso.  
* Cargo/função.  
* Núcleo vinculado, quando aplicável.  
* Status operacional.  
* Primeiro acesso pendente.  
* Último login.  
* Senha inicial ou redefinição de senha.

#### **Regras**

* Usuário do perfil Núcleo deve ser vinculado a um núcleo.  
* Usuário C-Level deve aparecer como multi-núcleo.  
* Usuário MASTER deve ter acesso a todos os núcleos.  
* Usuário RH atua em governança e administração do fluxo.  
* O sistema deve impedir perfis inconsistentes, como Núcleo sem núcleo vinculado.

---

### **4.4 Banco de Freelancers**

Módulo central da base de talentos.

#### **Objetivo**

Manter uma base única, limpa, atualizada e homologada de freelancers, trazendo TODOS os freelancers que já foram contratados pela agência e atualizando score de performance de cada um deles para melhor posicionamento de profissionais na V3A.

#### **Fontes de entrada**

1. Cadastro manual pelo RH.  
2. Pré-cadastro via link público ou QR Code.  
3. Atualização cadastral via link público dedicado.

#### **Campos principais**

* Nome completo.
* CNPJ **PRECISAMOS INCLUIR ESTE CAMPO NOS FORUMULÁRIOS E PERFIS DO SISTEMA, ATUALMENTE ELE NÃO É MOSTADO NOS CADASTROS** 
* E-mail.  
* Telefone/WhatsApp.  
* Cidade/UF/país.  
* Função principal.  
* Senioridade.  
* Funções adicionais homologadas.  
* Disponibilidade.  
* Tipo de contratação.  
* Experiência anterior com V3A.  
* Segmentos/indústrias atendidos.  
* Marcas atendidas.  
* Portfólio.  
* LinkedIn.  
* Observações do RH.  
* Status operacional.  
* Score consolidado.  
* Histórico de alocações.  
* Histórico de avaliações.

#### **Regras de qualidade da base**

* O sistema deve impedir duplicidades por CNPJ, e-mail, telefone e nome normalizado.  
* Atualização cadastral não deve criar novo freelancer.  
* Link de atualização deve alterar o registro existente.  
* Duplicidades identificadas devem ser mescladas.  
* O histórico deve ser preservado no registro consolidado.  
* O score deve ser atualizado após avaliações concluídas.

---

### **4.5 Links Públicos / QR Codes**

Módulo para geração de links públicos seguros.

#### **Finalidades**

* Novo cadastro de freelancer.  
* Atualização cadastral de freelancer existente.  
* Avaliação externa pelo freelancer.  
* Avaliação do núcleo contratante pelo freelancer.  
* Avaliação do job pelo freelancer.

#### **Regras**

* Cada link deve ser único.  
* Cada link deve possuir data de expiração.  
* Cada link deve ter status.  
* Cada link deve estar vinculado a uma finalidade.  
* Link de atualização deve obrigatoriamente apontar para um freelancer existente.  
* Link de avaliação deve apontar para uma alocação específica.  
* O sistema deve registrar quem criou o link.  
* O sistema deve registrar quando o link foi preenchido.  
* Links usados, expirados ou revogados não devem permitir novo preenchimento.

#### **Status possíveis**

* Ativo.  
* Utilizado.  
* Expirado.  
* Revogado.  
* Convertido em freela.  
* Atualização aplicada.  
* Aguardando preenchimento.  
* Aguardando aprovação RH.

---

### **4.6 Análise de Pré-Cadastros**

Módulo onde o RH valida novos cadastros e atualizações enviadas via link público.

#### **Abas recomendadas**

* Novos freelas.  
* Atualizações cadastrais.  
* Aprovados.  
* Rejeitados.

#### **Regras**

* Novo pré-cadastro aprovado deve criar freelancer no banco.  
* Atualização aprovada deve alterar o freelancer existente.  
* Rejeição deve registrar justificativa.  
* Conversão deve ser rastreável.  
* A aprovação não deve criar duplicidade.

---

### **4.7 Criar Oportunidade**

Módulo usado para registrar uma nova demanda de freelancer.

#### **Quem pode criar**

* MASTER.  
* RH.  
* C-Level.  
* OPERAÇÃO.
* Núcleo vinculado à demanda.

#### **Campos principais**

* Núcleo responsável.  
* Título do projeto/job.  
* Cliente solicitante.  
* Função requerida.  
* Senioridade requerida.  
* Regime de urgência.  
* Data de início estimada.  
* Data de fim estimada.  
* Total de dias.
* Budget previsto máximo.  
* Descrição técnica/escopo.  
* Entregáveis ou milestones.  
* Modelo de pagamento.  
* Modelo de remuneração.  
* Valor previsto.  
* Política de referência.  
* Status da política.

---

## **5\. Modelos de Pagamento**

A plataforma deve suportar diferentes modelos de pagamento para freelancers.

### **5.1 Pagamento único**

Usado quando o freelancer recebe um único pagamento pela entrega ou pelo período contratado.

#### **Modelos de remuneração possíveis**

* Diária.  
* Hora.  
* Job fechado/pacote.

#### **Cálculos esperados**

**Diária:**

```
Total previsto = valor diário x quantidade de dias considerados
```

**Hora:**

```
Total previsto = valor hora x quantidade de horas estimadas
```

**Job fechado:**

```
Total previsto = valor total fechado
```

---

### **5.2 Pagamento recorrente durante o período de alocação**

Usado quando o freelancer recebe pagamentos distribuídos durante o período contratado.

#### **Modelo obrigatório**

* Mensal / salário por período.

#### **Campos necessários**

* Dia preferencial de pagamento.  
* Quantidade de parcelas.  
* Datas previstas de pagamento.  
* Valor previsto mensal.  
* Valor total previsto.  
* Datas selecionadas ou desmarcadas.

#### **Regras**

* O sistema deve calcular automaticamente as datas de pagamento com base no período de alocação.  
* O usuário pode desmarcar datas, quando necessário.  
* Datas desmarcadas não entram no cálculo.  
* A quantidade de parcelas deve acompanhar as datas selecionadas.  
* O valor mensal sugerido deve ser calculado com base no budget dividido pela quantidade de parcelas.  
* O usuário pode alterar o valor mensal sugerido.

#### **Exemplo**

Período: 20/07/2026 a 30/10/2026  
Dia preferencial: 05  
Datas sugeridas:

* 05/08/2026  
* 05/09/2026  
* 05/10/2026

Quantidade de parcelas: 3

```
Valor mensal sugerido = Budget previsto / 3
```

---

## **6\. Política de Valores**

A Política de Valores funciona como balizador para contratação.

### **6.1 Estrutura da política**

Cada combinação de função e senioridade deve possuir valores de referência e teto para:

* Diária.  
* Mensal/salário.  
* Hora, quando aplicável.  
* Job fechado, quando aplicável ou estimado por regra.

### **6.2 Campos recomendados**

| Campo | Descrição |
| ----- | ----- |
| Função/cargo | Papel profissional contratado |
| Senioridade | Nível do profissional |
| Diária referência | Valor médio recomendado |
| Diária teto | Valor máximo autorizado |
| Mensal referência | Valor mensal recomendado |
| Mensal teto | Valor mensal máximo autorizado |
| Aprovação exigida | Regra de aprovação acima do teto |
| Status | Ativa, inativa ou incompleta |
| Última atualização | Data de atualização da política |

### **6.3 Status da política**

* Dentro da política.  
* Acima do teto.  
* Política não cadastrada.  
* Política incompleta.  
* Aguardando aprovação Head.  
* Aprovado por exceção.  
* Reprovado por exceção.

### **6.4 Job fechado**

Quando o modelo for “job fechado” e houver apenas política diária ou mensal, o sistema deve estimar o teto do job com base na política disponível.

Exemplo de regra:

```
Teto estimado do job fechado = teto diário x dias considerados x fator de desconto
```

A plataforma deve exibir a memória de cálculo utilizada, incluindo:

* Política usada como base.  
* Quantidade de dias ou meses considerados.  
* Valor de referência.  
* Teto autorizado.  
* Percentual de desconto aplicado.  
* Valor final estimado.  
* Diferença entre negociado e teto.

---

## **7\. Workflow de Shortlist, Negociação e Alocação**

O fluxo principal da plataforma é composto por quatro etapas:

1. Seleção do Job.  
2. Shortlist Oficial.  
3. Negociação.  
4. Homologação.

---

### **7.1 Etapa 1 — Seleção do Job**

O usuário seleciona uma oportunidade ativa.

#### **Ações**

* Visualizar lista de jobs.  
* Filtrar por status.  
* Ordenar por colunas.  
* Selecionar job.  
* Avançar para formação de shortlist.

#### **Status possíveis do job**

* Oportunidade criada.  
* Em shortlist.  
* Em negociação.  
* Pendente aprovação.  
* Pronto para homologação.  
* Bookado.  
* Concluído.  
* Cancelado.  
* Reaberto.

---

### **7.2 Etapa 2 — Shortlist Oficial**

O sistema sugere freelancers com base em critérios de compatibilidade.

#### **Categorias automáticas**

* Melhores matches.  
* Boas alternativas.  
* Outras opções.

#### **Critérios de sugestão**

* Função principal.  
* Funções adicionais homologadas.  
* Senioridade.  
* Localização.  
* Disponibilidade.  
* Experiência com V3A.  
* Segmentos/indústrias.  
* Marcas atendidas.  
* Score consolidado.  
* Histórico de avaliações.  
* Agenda livre no período.  
* Aderência ao perfil solicitado.
* Bônus por preenchimento das avaliações NPS de jobs anteriores com a V3A.

#### **Regra importante**

O sistema não deve restringir sugestões apenas a correspondências exatas. Profissionais com senioridade ou função próxima podem aparecer como alternativa, desde que sinalizados corretamente.

Exemplo:

```
Job solicita: Diretor de Arte Especialista
Freela cadastrado: Diretor de Arte Pleno
Resultado esperado: pode aparecer em “Boas Alternativas” ou “Outras Opções”, com indicação de diferença de senioridade.
```

#### **Ação do usuário**

O usuário monta o shortlist oficial selecionando os freelancers que deseja negociar.

---

### **7.3 Etapa 3 — Negociação**

A negociação ocorre individualmente por freelancer.

#### **Informações herdadas da criação da oportunidade**

* Modelo de pagamento.  
* Modelo de remuneração.  
* Budget.  
* Período.  
* Datas de pagamento, quando recorrente.  
* Quantidade de parcelas.  
* Valor previsto.  
* Política aplicável.  
* Status da política.

#### **Campos editáveis na negociação**

* Valor negociado.  
* Modelo de remuneração, quando permitido.  
* Quantidade de parcelas, quando permitido.  
* Datas de pagamento, quando permitido.  
* Status da negociação.  
* Observações internas.  
* Justificativa de exceção.

#### **Status de negociação**

* Selecionado.  
* Em negociação.  
* Aguardando retorno.  
* Pendente aprovação Head.  
* Aprovado pelo Head.  
* Reprovado pelo Head.  
* Aceitou proposta.  
* Recusou proposta.  
* Pronto para homologação.

#### **Regras**

* Apenas freelas do shortlist oficial entram na negociação.  
* Cada freela tem status individual.  
* Apenas freelas que aceitaram ou foram aprovados por exceção podem seguir para homologação.  
* Se o valor negociado exceder a política, exige aprovação do Head do Núcleo.  
* Se o freela tiver conflito de agenda, exige aprovação do RH ou regra equivalente de governança.

---

### **7.4 Aprovação do Head do Núcleo**

Quando o valor negociado excede o teto da política, o sistema deve gerar uma solicitação de aprovação.

#### **Quem aprova**

* Head do núcleo contratante.  
* MASTER, se houver regra de override.  
* C-Level.

#### **O que deve aparecer para o Head**

* Job.  
* Cliente.  
* Núcleo.  
* Freelancer.  
* Função.  
* Senioridade.  
* Período.  
* Valor negociado.  
* Teto da política.  
* Excedente em reais.  
* Excedente percentual.  
* Justificativa.  
* Botão de aprovar.  
* Botão de reprovar.

#### **Resultado da aprovação**

Se aprovado:

* Negociação fica homologável.  
* Status muda para aprovado pelo Head.  
* Histórico registra usuário e data da aprovação.

Se reprovado:

* Negociação fica bloqueada.  
* Justificativa da reprovação é registrada.  
* Freela não pode seguir para homologação.

---

### **7.5 Etapa 4 — Homologação**

A homologação é a confirmação final da negociação aceita.

#### **A homologação deve mostrar**

* Dados do job.  
* Dados do freelancer.  
* Função contratada.  
* Senioridade.  
* Período.  
* Modelo de pagamento.  
* Modelo de remuneração.  
* Valor acordado.  
* Total contratado.  
* Datas de pagamento.  
* Status da política.  
* Aprovação vinculada, quando houver.  
* Saving gerado.  
* Observações finais.

#### **Ação principal**

```
Confirmar Homologação e Criar Alocação
Após confirmada a Homologação, o sistema deve disponibilizar a opção de ir para o módulo **10. Solicitação de Pagamento**.
```

#### **Resultado**

Ao confirmar:

* Criar alocação oficial.  
* Alterar job para bookado.  
* Bloquear retorno indevido ao shortlist.  
* Atualizar timeline.  
* Atualizar histórico do freelancer.  
* Atualizar dashboard.  
* Liberar acompanhamento do booking.
* Disponibilizar a opção de ver a alocação no Módulo **10. Solicitação de Pagamento**

---

## **8\. Booking / Alocação**

A alocação representa o vínculo oficial entre job e freelancer.

### **8.1 Campos principais**

* Código da alocação.  
* Job vinculado.  
* Freelancer vinculado.  
* Núcleo contratante.  
* Cliente.  
* Função.  
* Senioridade.  
* Período.  
* Modelo de pagamento.  
* Modelo de remuneração.  
* Valor homologado.  
* Total contratado.  
* Datas de pagamento.  
* Status do pagamento.  
* Status da entrega.  
* Status da avaliação.  
* Status da alocação.

### **8.2 Status da alocação**

* Bookada.  
* Ativa.  
* Em execução.  
* Aguardando entrega.  
* Entregue.  
* Aguardando solicitação de pagamento.  
* Pagamento solicitado.  
* Aguardando avaliação.  
* Concluída.  
* Cancelada.  
* Reaberta.

---

## **9\. Timeline de Alocações**

A Timeline apresenta a visão operacional de agenda dos freelancers.

### **9.1 Objetivo**

Permitir visibilidade sobre alocações, conflitos, durações e disponibilidade.

### **9.2 Funcionalidades**

* Visualizar alocações por mês, semana e por dia.  
* Visualizar freelancers alocados.  
* Identificar conflitos de agenda.  
* Filtrar apenas alocações ativas.  
* Passar o mouse sobre um job para ver detalhes.  
* Clicar no job para acessar sua página.  
* Exibir status da agenda.

### **9.3 Informações no hover do job**

* Nome do job.  
* Cliente.  
* Núcleo.  
* Freelancer.  
* Período.  
* Status.  
* Valor contratado.  
* Modelo de pagamento.  
* Status do pagamento.

---

## **10\. Solicitação de Pagamento**

A plataforma deve gerar um documento de solicitação de pagamento para envio ao financeiro.

### **10.1 Quem pode emitir**

* Núcleo contratante.  
* MASTER.  
* C-Level.
* Operação.

### **10.2 Quando pode emitir**

Após a alocação ser homologada e conforme o fluxo de pagamento definido.

Para pagamento único:

* Pode ser emitido após conclusão do job ou marco definido.

Para pagamento recorrente:

* Gera um documento único com o detalhamento de todas as parcelas, assim como as datas de pagamento de cada parcela.

### **10.3 Informações do documento**

#### **Dados administrativos**

* Código da solicitação.  
* Data de emissão.  
* Emitido por.  
* Núcleo contratante.  
* Head responsável.  
* Status da solicitação.

#### **Dados do job**

* Código do job.  
* Nome do job.  
* Cliente.  
* Escopo resumido.  
* Entregáveis.  
* Período da alocação.

#### **Dados do freelancer**

* Nome completo.  
* E-mail.  
* Telefone.  
* CPF/CNPJ, se aplicável.  
* Dados bancários, se aplicável.  
* Modelo de contratação.

#### **Dados financeiros**

* Modelo de pagamento.  
* Modelo de remuneração.  
* Valor contratado.  
* Valor da parcela, se recorrente.  
* Quantidade de parcelas.  
* Datas de pagamento das parcelas.  
* Total contratado.  
* Centro de custo, se aplicável.  
* Código financeiro, se aplicável.  
* Observações para o financeiro.

#### **Evidências**

* Status da entrega.  
* Aprovação do núcleo.  
* Aprovação de exceção, se houver.  
* Histórico de negociação.  
* Link da alocação no sistema.

### **10.4 Exportação**

Formatos possíveis:

* PDF.  
* Markdown.  
* CSV.  
* XLSX.

---

## **11\. Avaliações**

A avaliação é dividida em três camadas:

1. Avaliação do freelancer pelo núcleo.  
2. Avaliação da entrega do freelancer.  
3. Avaliação reversa feita pelo freelancer, sobre o Núcleo e sobre a entrega.

---

### **11.1 Avaliação do freelancer pelo núcleo**

Preenchida pelo Head, executivo do núcleo ou líder direto.

#### **Dados automáticos**

* Freelancer avaliado.  
* Quem avaliou.  
* Perfil do avaliador.  
* Núcleo.  
* Projeto/job.  
* Cliente.  
* Função contratada.  
* Senioridade.  
* Período.  
* Valor acordado.  
* Status da política.

#### **Critérios recomendados**

| Critério | Peso |
| ----- | ----- |
| Qualidade técnica | 25% |
| Aderência ao briefing | 15% |
| Prazo e confiabilidade | 15% |
| Autonomia | 10% |
| Comunicação | 10% |
| Comportamento | 10% |
| Capacidade de resolver problemas | 10% |
| Recomendação futura | 5% |

#### **Escala**

| Nota | Significado |
| ----- | ----- |
| 1 | Muito abaixo do esperado |
| 2 | Abaixo do esperado |
| 3 | Atendeu parcialmente |
| 4 | Bom / atendeu bem |
| 5 | Excelente / superou expectativa |

---

### **11.2 Avaliação da entrega**

Avalia o resultado específico daquele job.

#### **Perguntas recomendadas**

* A entrega cumpriu o escopo combinado?  
* A qualidade final atendeu ao padrão esperado?  
* O freelancer cumpriu prazos?  
* Houve necessidade de retrabalho relevante?  
* A entrega foi bem documentada?  
* O freelancer demonstrou entendimento do briefing?  
* O resultado final pode ser reutilizado como referência futura?

---

### **11.3 Avaliação reversa pelo freelancer**

Após a avaliação interna, o sistema deve gerar um link público para o freelancer avaliar:

* Núcleo contratante.  
* Líder direto.  
* Clareza do briefing.  
* Organização do projeto.  
* Prazos.  
* Comunicação.  
* Processo de pagamento.  
* Experiência geral no job.

---

### **11.4 Atualização do score**

Após a conclusão das avaliações:

* O sistema compila as notas.  
* Atualiza o score do freelancer.  
* Atualiza o histórico de performance.  
* Alimenta futuras sugestões de shortlist.  
* Registra possíveis alertas de comportamento ou performance.

---

## **12\. Score do Freelancer**

O score consolidado deve considerar histórico e contexto, além de trazer uma nota bônus que é atribuída ao freelancer quando ele responde à avaliação reversa.

### **12.1 Componentes do score**

* Média ponderada das avaliações.  
* Quantidade de jobs realizados.  
* Recência das avaliações.  
* Consistência entre núcleos.  
* Penalidades por reprovação ou conflito.  
* Bônus por avaliações excelentes.  
* Experiência anterior com V3A.  
* Aderência a segmentos/marcas relevantes.
* Avaliações reversas preenchidas.

### **12.2 Regra recomendada**

Avaliações recentes devem ter maior peso do que avaliações antigas.

Exemplo:

```
Score consolidado = 
(Nota média ponderada x 60%) +
(Recência x 15%) +
(Experiência V3A x 10%) +
(Aderência ao segmento x 10%) +
(Confiabilidade operacional x 5%)
```

---

## **13\. Governança e Compliance**

### **13.1 Regras de governança**

* Todo freelancer precisa estar cadastrado para ser elegível.  
* Toda contratação deve gerar uma alocação oficial.  
* Contratações acima da política precisam de aprovação.  
* Conflitos de agenda precisam ser tratados antes da homologação.  
* Jobs bookados não devem permanecer como oportunidades abertas.  
* Pagamentos devem estar vinculados a alocações.  
* Avaliações devem ser obrigatórias para encerramento do ciclo.

### **13.2 Indicadores de governança**

* Exceções de valor pendentes.  
* Jobs criados fora da política.  
* Alocações sem avaliação.  
* Alocações sem solicitação de pagamento.  
* Freelancers com conflito de agenda.  
* Links públicos expirados.  
* Duplicidades na base.  
* Jobs sem homologação formal.

---

## **14\. Regras de Permissão**

### **14.1 MASTER**

Pode:

* Criar, editar e excluir usuários.  
* Criar e editar núcleos.  
* Gerir todo o banco de freelancers.  
* Criar oportunidades para qualquer núcleo.  
* Aprovar exceções, se permitido.  
* Homologar alocações.  
* Exportar solicitações de pagamento.  
* Visualizar todos os relatórios.

### **14.2 RH**

Pode:

* Gerir banco de freelancers.  
* Aprovar pré-cadastros.  
* Gerar links públicos.  
* Apoiar shortlist.  
* Gerir política de valores.  
* Visualizar exceções.  
* Acompanhar governança.

### **14.3 C-LEVEL**

Pode:

* Atuar em qualquer núcleo.  
* Criar oportunidades.  
* Participar de shortlist e negociação.  
* Gerar links públicos para inclusão de novo freelancer.
* Criar núcleos, se autorizado.  
* Exportar solicitação de pagamento.  
* Visualizar indicadores estratégicos.

### **14.4 OPERAÇÃO**

Pode:

* Atuar em qualquer núcleo.  
* Criar oportunidades.  
* Participar de shortlist e negociação.  
* Gerar links públicos para inclusão de novo freelancer.
* Exportar solicitação de pagamento.  
* Visualizar indicadores estratégicos.

### **14.5 NÚCLEO**

Pode:

* Criar oportunidades para seu núcleo.  
* Montar shortlist.  
* Negociar com freelancers.  
* Gerar links públicos para inclusão de novo freelancer.
* Acompanhar bookings.  
* Emitir solicitação de pagamento.  
* Avaliar freelancer.  
* Avaliar entrega.

### **14.6 HEAD DO NÚCLEO**

Pode adicionalmente:

* Aprovar exceções de valor do próprio núcleo.  
* Reprovar exceções de valor do próprio núcleo.  
* Validar contratações fora da política.  
* Gerar links públicos para inclusão de novo freelancer.  

---

## **15\. Estados e Status Recomendados**

### **15.1 Status do Job**

```
created
in_shortlist
in_negotiation
pending_approval
ready_for_homologation
booked
completed
cancelled
reopened
```

### **15.2 Status da Negociação**

```
selected
in_negotiation
waiting_response
pending_head_approval
approved_by_head
rejected_by_head
accepted
refused
ready_for_homologation
homologated
```

### **15.3 Status da Alocação**

```
booked
active
pending_delivery
delivered
pending_payment_request
payment_requested
pending_evaluation
completed
cancelled
reopened
```

### **15.4 Status do Link Público**

```
active
used
expired
revoked
converted
update_applied
pending_rh_approval
```

---

## **16\. Estrutura de Dados Recomendada**

### **16.1 Tabelas principais**

* users  
* nuclei  
* freelancers  
* freelancer\_roles  
* jobs  
* shortlist\_candidates  
* negotiations  
* approval\_requests  
* allocations  
* payment\_schedules  
* payment\_requests  
* evaluations  
* public\_links  
* value\_policies  
* audit\_logs

### **16.2 Relacionamentos principais**

```
nuclei 1:N users
nuclei 1:N jobs
jobs 1:N shortlist_candidates
jobs 1:N negotiations
jobs 1:N allocations
freelancers 1:N shortlist_candidates
freelancers 1:N negotiations
freelancers 1:N allocations
allocations 1:N payment_schedules
allocations 1:N payment_requests
allocations 1:N evaluations
jobs 1:N approval_requests
```

---

## **17\. Requisitos de UX/UI**

### **17.1 Darkmode e Lightmode**

A plataforma deve ter alternância entre darkmode e lightmode.

#### **Regras**

* Todos os textos devem manter contraste adequado.  
* Tags, badges e botões devem ser legíveis nos dois temas.  
* Estados de sucesso, erro, alerta e informação devem usar cores consistentes.  
* Cards de política não devem usar fundos claros agressivos no darkmode.  
* Lightmode deve manter leitura confortável, sem excesso de contraste.

---

### **17.2 Responsividade Mobile**

A plataforma deve funcionar em telas mobile.

#### **Regras**

* Sidebar deve se adaptar a menu colapsável.  
* Tabelas devem virar cards ou permitir scroll horizontal controlado.  
* Botões críticos devem permanecer visíveis.  
* Modais devem respeitar viewport.  
* Campos não devem truncar informações essenciais.  
* Fluxos longos devem ser divididos em etapas.

---

### **17.3 Tabelas**

As tabelas devem permitir:

* Ordenação por cabeçalho.  
* Filtros.  
* Paginação.  
* Busca.  
* Ações por linha.  
* Visualização responsiva.  
* Indicação clara de status.

---

## **18\. Relatórios e Exportações**

### **18.1 Relatórios recomendados**

* Banco de freelancers.  
* Freelancers por função.  
* Freelancers por segmento.  
* Jobs por núcleo.  
* Alocações por período.  
* Gastos por núcleo.  
* Gastos por função.  
* Exceções de política.  
* Avaliações pendentes.  
* Score consolidado.  
* Histórico de pagamentos.  
* Solicitações de pagamento emitidas.

### **18.2 Exportações**

* CSV.  
* XLSX.  
* PDF.  
* Markdown.  
* Documento de solicitação de pagamento.

---

## **19\. Fluxo Resumido da Plataforma**

```
flowchart TD
    A[Novo Job] --> B[Shortlist Oficial]
    B --> C[Negociação]
    C --> D{Valor dentro da política?}
    D -- Sim --> E{Freela aceitou?}
    D -- Não --> F[Aprovação do Head do Núcleo]
    F --> G{Aprovado?}
    G -- Sim --> E
    G -- Não --> B
    E -- Sim --> H[Homologação]
    E -- Não --> B
    H --> I[Booking / Alocação]
    I --> J[Execução do Job]
    J --> K{Pagamento único ou recorrente?}
    K -- Único --> L[Solicitação de Pagamento]
    K -- Recorrente --> M[Solicitações por Parcela/Período]
    L --> N[Avaliação do Freelancer]
    M --> N
    N --> O[Avaliação da Entrega]
    O --> P[Link para Avaliação Reversa]
    P --> Q[Freelancer Avalia Núcleo e Job]
    Q --> R[Atualização do Score]
    R --> S[Job Done]
```

---

## **20\. Critérios de Aceite Gerais**

A plataforma será considerada funcional quando:

* O RH conseguir cadastrar e validar freelancers.  
* O sistema impedir duplicidades na base.  
* O núcleo conseguir criar oportunidades.  
* O sistema aplicar corretamente a política de valores.  
* O shortlist sugerir candidatos compatíveis e alternativas relevantes.  
* A negociação herdar o fluxo de pagamento da criação da oportunidade.  
* Exceções acima da política exigirem aprovação do Head.  
* O Head conseguir aprovar ou reprovar exceções do próprio núcleo.  
* A homologação criar uma alocação real.  
* Jobs bookados aparecerem em Meus Bookings e Timeline.  
* A solicitação de pagamento puder ser exportada.  
* Avaliações internas e externas atualizarem o score.  
* O dashboard refletir indicadores reais.  
* Darkmode, lightmode e mobile estejam legíveis e utilizáveis.

---

## **21\. Pendências e Melhorias Futuras**

* Refinar cálculo de job fechado com política diária/mensal.  
* Criar painel específico de exceções pendentes.  
* Melhorar relatório financeiro por núcleo e função.  
* Integrar com financeiro ou ERP.  
* Automatizar notificações por e-mail ou WhatsApp.  
* Criar trilha de onboarding de freelancers.  
* Criar ranking inteligente de talentos.  
* Criar alertas de risco por agenda, valor ou performance.  
* Implementar análise de savings por período.  
* Implementar trilha completa de auditoria por usuário.

---

## **22\. Glossário**

| Termo | Definição |
| ----- | ----- |
| Freelancer | Profissional externo cadastrado na base |
| Núcleo | Área ou célula contratante da V3A |
| Head do Núcleo | Responsável pelo núcleo |
| Job | Demanda ou oportunidade de contratação |
| Shortlist | Lista oficial de freelancers considerados para uma demanda |
| Negociação | Etapa de definição de valor, modelo de pagamento e aceite |
| Homologação | Confirmação final da contratação |
| Booking | Registro oficial da alocação do freelancer |
| Alocação | Vínculo entre freelancer, job, período e pagamento |
| Política de Valores | Matriz de referência e teto por função/senioridade |
| Exceção | Valor ou condição fora da política padrão |
| Solicitação de Pagamento | Documento exportável enviado ao financeiro |
| Score | Nota consolidada do freelancer |
| Avaliação reversa | Avaliação feita pelo freelancer sobre núcleo, líder e job |

---

