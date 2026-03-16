export default function EvolucaoPage() {
  const milestones = [
    {
      dayNumber: 1,
      date: "Sábado, 7 de março",
      title: "Reconhecimento de terreno",
      description:
        "Início da operação. Dedicamos o dia ao mapeamento completo dos 497 sites de prefeituras do Rio Grande do Sul. Catalogamos cada endereço web, identificamos quais estavam no ar e quais apresentavam problemas. Um trabalho de inventário: entender o tamanho do desafio antes de começar a construir.",
      stats: ["497 sites catalogados", "Mapeamento inicial"],
    },
    {
      dayNumber: 2,
      date: "Domingo, 8 de março",
      title: "Anatomia dos sites",
      description:
        "Com o mapa em mãos, partimos para entender como cada prefeitura organiza suas notícias. Descobrimos que não existe um padrão único — são mais de 8 plataformas diferentes (WordPress, CittaWeb, Webde, Plone, Laravel, entre outras). Cada uma coloca as notícias em lugares diferentes, com formatos diferentes de URL e estrutura de página. Começamos a documentar cada variação.",
      stats: ["8+ plataformas identificadas", "Análise de estruturas"],
    },
    {
      dayNumber: 3,
      date: "Segunda, 9 de março",
      title: "Primeiras coletas",
      description:
        "Colocamos o sistema para funcionar pela primeira vez. Com os padrões mais comuns já mapeados, conseguimos acessar 50 sites e coletar 28 notícias. Pouco? Talvez. Mas era a prova de que o conceito funcionava — a máquina conseguia ler o que as prefeituras publicavam.",
      stats: ["50 sites", "28 notícias"],
    },
    {
      dayNumber: 4,
      date: "Terça, 10 de março",
      title: "Dobrando a cobertura",
      description:
        "Ajustamos o sistema para reconhecer automaticamente cada tipo de plataforma. Sites que usam o formato '/noticia/visualizar/id/', '/noticia/view/', e até os antigos com 'noticias.php' passaram a ser lidos corretamente. A cobertura quase dobrou em um dia.",
      stats: ["95 sites", "62 notícias", "+90% cobertura"],
    },
    {
      dayNumber: 5,
      date: "Quarta, 11 de março",
      title: "Quebrando barreiras",
      description:
        "Três frentes de avanço: adicionamos suporte para sites que usam PHP tradicional (como Antônio Prado e André da Rocha), resolvemos problemas de certificado de segurança (SSL) que bloqueavam dezenas de sites, e começamos a detectar sites WordPress automaticamente. Municípios como Arroio do Meio, Araricá e Arambaré entraram no radar.",
      stats: ["150 sites", "98 notícias"],
    },
    {
      dayNumber: 6,
      date: "Quinta, 12 de março",
      title: "Expansão acelerada",
      description:
        "Dia de grandes ganhos. Descobrimos e adicionamos cinco novos padrões de URL usados por dezenas de prefeituras. Também habilitamos o bypass de SSL para todos os sites (não apenas os do atende.net), o que desbloqueou municípios como Tramandaí e Erebango. A cada rodada, mais municípios apareciam no mapa.",
      stats: ["210 sites", "148 notícias"],
    },
    {
      dayNumber: 7,
      date: "Sexta, 13 de março",
      title: "Marco: mais da metade do RS coberto",
      description:
        "Pela primeira vez, ultrapassamos a marca de 280 municípios monitorados — mais da metade do estado. O sistema agora reconhece 16 padrões diferentes de URL e consegue extrair notícias de sites que vão desde portais modernos em WordPress até sistemas legados em PHP dos anos 2000. Também refinamos a extração de datas, permitindo filtrar notícias por dia.",
      stats: ["280 sites", "210 notícias", "56% do RS"],
    },
    {
      dayNumber: 8,
      date: "Sábado, 14 de março",
      title: "Refinamento de qualidade",
      description:
        "Com menor atividade nas prefeituras no fim de semana, focamos em qualidade. Melhoramos a extração de títulos (evitando que o nome do site fosse confundido com o título da notícia), refinamos a detecção de datas e adicionamos suporte para mais 30 sites com estruturas menos comuns.",
      stats: ["310 sites", "145 notícias"],
    },
    {
      dayNumber: 9,
      date: "Domingo, 15 de março",
      title: "Estabilidade e autonomia",
      description:
        "Sistema rodando de forma completamente autônoma. A coleta manteve-se estável mesmo com o volume reduzido típico do fim de semana. Aproveitamos para ajustar os filtros de data e preparar o terreno para o lançamento do painel de acompanhamento.",
      stats: ["320 sites", "98 notícias", "Sistema autônomo"],
    },
    {
      dayNumber: 10,
      date: "Segunda, 16 de março",
      title: "Pulso RS no ar",
      description:
        "Lançamento do painel que você está vendo agora. Com 340 dos 497 municípios cobertos (68,4%), o Pulso RS permite acompanhar em tempo real o que as prefeituras gaúchas estão publicando. Filtro por data, busca por município, indicadores de evolução — tudo acessível de forma simples para quem precisa da informação.",
      stats: ["340 sites", "68,4% do RS", "Painel ativo"],
    },
  ];

  const howItWorks = [
    {
      number: 1,
      title: "Coleta Automática",
      description:
        "Todo dia, às 6h da manhã, o sistema visita os sites das 497 prefeituras do Rio Grande do Sul. Ele identifica a página de notícias de cada site e coleta as publicações mais recentes.",
    },
    {
      number: 2,
      title: "Adaptação Inteligente",
      description:
        "Cada prefeitura usa uma plataforma diferente. O Pulso RS reconhece mais de 16 formatos distintos de site, se adaptando automaticamente para extrair as notícias de cada um.",
    },
    {
      number: 3,
      title: "Organização e Acesso",
      description:
        "As notícias são processadas e organizadas neste painel. Filtre por data, busque por município e acompanhe a evolução da cobertura ao longo do tempo.",
    },
  ];

  const nextSteps = [
    {
      title: "Cobertura total: 497 municípios",
      description:
        "Estamos trabalhando para incluir os municípios restantes, especialmente aqueles cujos sites usam tecnologias que exigem renderização por navegador.",
    },
    {
      title: "Alertas personalizados",
      description:
        "Jornalistas poderão configurar alertas para receber notificações quando municípios específicos publicarem novidades.",
    },
    {
      title: "Categorização automática",
      description:
        "Classificação inteligente das notícias por tema (saúde, educação, obras, segurança) para facilitar o trabalho de pauta.",
    },
    {
      title: "Resumos diários",
      description:
        "Relatório automático com o panorama do dia: principais destaques, municípios mais ativos e tendências identificadas.",
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1
          className="font-editorial text-3xl font-bold mb-1"
          style={{ color: "var(--ink)" }}
        >
          Bastidores
        </h1>
        <p style={{ color: "var(--ink-secondary)" }}>
          O diário de bordo do Pulso RS — como construímos a cobertura de 340 municípios em 10 dias
        </p>
      </div>
      <div
        className="h-px mb-10"
        style={{ background: "var(--fio)" }}
      />

      {/* Timeline as serialized story */}
      <div className="max-w-3xl mx-auto mb-16">
        {milestones.map((milestone, i) => (
          <div key={i} className="mb-0">
            {/* Chapter marker */}
            <p
              className="text-sm font-semibold uppercase tracking-[0.15em] mb-3"
              style={{ color: "var(--editorial-red)" }}
            >
              Dia {milestone.dayNumber} &mdash; {milestone.date}
            </p>

            {/* Title */}
            <h3
              className="font-editorial text-xl font-bold mb-3"
              style={{ color: "var(--ink)" }}
            >
              {milestone.title}
            </h3>

            {/* Body text as paragraph */}
            <p
              className="text-base leading-relaxed mb-4"
              style={{ color: "var(--ink)", lineHeight: "1.75" }}
            >
              {milestone.description}
            </p>

            {/* Stats as inline aside */}
            <div className="inline-flex flex-wrap gap-3 mb-6">
              {milestone.stats.map((stat, j) => (
                <span
                  key={j}
                  className="text-xs font-medium px-3 py-1"
                  style={{
                    border: "1px solid var(--fio)",
                    color: "var(--ink-secondary)",
                    borderRadius: "2px",
                  }}
                >
                  {stat}
                </span>
              ))}
            </div>

            {/* Thick fio separator between days */}
            {i < milestones.length - 1 && (
              <div
                className="mb-8"
                style={{
                  borderBottom: "2px solid var(--fio-strong)",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Nossa Metodologia */}
      <div className="max-w-4xl mx-auto mb-16">
        <h2
          className="font-editorial text-2xl font-bold mb-2 text-center"
          style={{ color: "var(--ink)" }}
        >
          Nossa Metodologia
        </h2>
        <div
          className="h-px mb-8"
          style={{ background: "var(--fio)" }}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {howItWorks.map((item, i) => (
            <div
              key={i}
              className="py-6 px-6 text-center"
              style={{
                borderRight:
                  i < howItWorks.length - 1
                    ? "1px solid var(--fio)"
                    : "none",
              }}
            >
              <p
                className="font-editorial text-4xl font-black mb-3"
                style={{ color: "var(--editorial-red)" }}
              >
                {item.number}
              </p>
              <h4
                className="font-semibold mb-2"
                style={{ color: "var(--ink)" }}
              >
                {item.title}
              </h4>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--ink-secondary)" }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* O Que Vem Por Aí */}
      <div className="max-w-3xl mx-auto">
        <h2
          className="font-editorial text-2xl font-bold mb-2"
          style={{ color: "var(--ink)" }}
        >
          O Que Vem Por Aí
        </h2>
        <div
          className="h-px mb-6"
          style={{ background: "var(--fio)" }}
        />

        <div>
          {nextSteps.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-4 py-4"
              style={{
                borderBottom:
                  i < nextSteps.length - 1
                    ? "1px solid var(--fio)"
                    : "none",
              }}
            >
              <span
                className="font-editorial text-2xl font-black shrink-0"
                style={{ color: "var(--editorial-red)" }}
              >
                {i + 1}
              </span>
              <div>
                <h4
                  className="font-semibold mb-1"
                  style={{ color: "var(--ink)" }}
                >
                  {step.title}
                </h4>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--ink-secondary)" }}
                >
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
