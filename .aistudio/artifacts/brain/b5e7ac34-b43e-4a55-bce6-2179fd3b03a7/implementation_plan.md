# Simulador de Negociações e Risco de Opções B3 (Neon Terminal)

Um simulador profissional e elegante para o mercado de opções da B3 (Bolsa de Valores do Brasil), com tema escuro profundo e acentos neon em azul elétrico, violeta e verde esmeralda. O sistema disponibiliza cotações e cadeia de opções para BOVA11, SMAL11 e as ações mais líquidas da B3, calcula o preço justo via modelo Black-Scholes e volatilidade implícita da série, simula estruturas perna a perna com gráficos interativos de Payoff e Gregas, e atualiza automaticamente os dados a cada 30 segundos.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Decisões confirmadas com base nas respostas do usuário:
> - **Atualização de Dados**: Atualização automática periódica a cada 30 segundos com indicador visual sutil de pulso e cronômetro regressivo, além de botão de recarga instantânea.
> - **Modo de Construção de Estruturas**: Montagem livre perna a perna (adicionando e customizando Calls/Puts compradas e vendidas com quantidades, strikes e vencimentos flexíveis).
> - **Métricas de Risco Priorizadas**: Gráfico de Payoff interativo (com curva no vencimento e curva T+0 atual), análise completa das Gregas (Delta, Gamma, Theta, Vega) e Probabilidade de Lucro (PoP).
> - **Referência de Preço**: Alternância transparente entre "Último Negócio" e "Preço Justo" (Black-Scholes), assumindo o Preço Justo como padrão automático quando a opção não tiver negociação registrada nos últimos 7 dias.

---

### 1. Overview & Core Concept

- **O que faz**: Oferece uma estação de trabalho para traders e investidores de derivativos no Brasil. Permite inspecionar a grade de opções (calls e puts) de ativos líquidos (BOVA11, SMAL11, PETR4, VALE3, ITUB4, BBDC4, B3SA3, BBAS3, MGLU3, ABEV3), simular pernas compradas e vendidas, calcular o preço justo teórico via Black-Scholes a partir da volatilidade implícita e visualizar os gráficos de Payoff e sensibilidade das Gregas frente a oscilações no preço do ativo-objeto e passagem do tempo.
- **Público-alvo**: Operadores de derivativos, investidores de renda variável e analistas de risco que necessitam de simulação precisa e visualização gráfica de estruturas na B3.
- **Valor Principal**: Cálculo transparente do preço justo para opções ilíquidas da B3 (evitando distorções de spread), visualização visual da curva de ganho/perda e exposição das gregas antes de executar no home broker.

---

### 2. User Experience & Visual Design

#### Visual Identity & Theme
- **Estética**: Neon Terminal Dark — visual de alta tecnologia financeira, inspirado em terminais modernos de trading institucional (Bloomberg/Eikon modernos com refinamento dark).
- **Paleta de Cores**:
  - *Fundo Principal*: `#080b12` (Obsidian profundo)
  - *Superfícies & Painéis*: `#0d131f` e `#131b2e` com bordas sutis em `#1e293b`
  - *Acentos Neon*:
    - **Azul Elétrico** (`#38bdf8` / `#0ea5e9`): Ações de compra, seleção de ativos, métricas de Delta e cotações.
    - **Violeta Neon** (`#a855f7` / `#c084fc`): Volatilidade implícita, Vega, opções de venda (Puts) e indicadores de modelo teórico.
    - **Verde Esmeralda Neon** (`#10b981` / `#34d399`): Regiões de lucro, retorno positivo, status de mercado ativo e botões de confirmação.
    - **Carmesim Suave** (`#f43f5e`): Regiões de perda/risco e operações de venda a seco.
- **Tipografia**:
  - Títulos e interface: `Plus Jakarta Sans` ou `Outfit` para clareza e autoridade.
  - Cotações, strikes, gregas e valores financeiros: `font-mono tabular-nums` (`JetBrains Mono` / `IBM Plex Mono`) para alinhamento vertical rigoroso de casas decimais.

#### Principais Fluxos do Usuário
1. **Seleção de Ativo**: O usuário escolhe o ativo-objeto no topo (BOVA11, SMAL11, PETR4, VALE3, etc.) e visualiza a cotação spot em tempo real com variação percentual diária.
2. **Exploração da Grade de Opções (Option Chain)**:
   - Tabela filtrável por Vencimento (séries B3, e.g. Nov/26, Dez/26, Jan/27) e Tipo (Calls à esquerda, Puts à direita, Strikes no centro — formato tradicional Straddle Chain).
   - Indicação visual se a opção teve liquidez nos últimos 7 dias ou se está utilizando o Preço Justo automático.
   - Exibição de Strike, Último Negócio, Preço Justo Calculado, Volatilidade Implícita (IV), Delta e Volume.
3. **Simulador de Estrutura (Perna a Perna)**:
   - Botão de 1 clique na grade para adicionar a opção como Perna (Comprar/Vender).
   - Gerenciador de pernas onde o usuário ajusta quantidade, preço de entrada (Último Preço vs Preço Justo vs Preço Personalizado).
   - Métricas em tempo real da carteira montada: Custo Líquido (Débito/Crédito), Lucro Máximo, Perda Máxima, Breakevens e Probabilidade de Lucro (PoP).
4. **Gráficos Interativos de Payoff e Gregas**:
   - Gráfico de Payoff: Curva no Vencimento (linha sólida verde/vermelha) vs Curva Hoje T+0 (linha pontilhada ciano/violeta).
   - Sliders interativos de simulação: Variação de Preço do Ativo (-20% a +20%), Variação de Volatilidade (-10% a +10%) e Dias para o Vencimento (Theta decay em tempo real).
   - Gráficos de Gregas: Delta Total da Estrutura, Gamma, Theta diário (em R$) e Vega por ponto de vol.

---

### 3. Key Product Decisions & Trade-Offs

- **Black-Scholes & Modelo de Volatilidade da B3**:
  - *Abordagem*: Motor matemático em TypeScript implementando a distribuição cumulativa normal e Black-Scholes para opções européias/americanas, com estimador de volatilidade histórica e smile/skew de volatilidade implícita ajustado às taxas de juros CDI/Selic vigentes.
  - *Por que*: Permite recalcular instantaneamente o preço justo e todas as gregas em microssegundos no navegador sem travamento, reagindo dinamicamente aos sliders do usuário.
- **Regra de 7 Dias sem Negociação**:
  - *Abordagem*: Cada série de opção carrega o timestamp do último negócio real. Se a data for superior a 7 dias, a opção recebe uma indicação visual e o sistema adota automaticamente o `precoJusto` como preço de referência nas simulações, permitindo ao usuário alternar manualmente caso queira.
- **Atualização Periódica a cada 30 Segundos**:
  - *Abordagem*: Timer com `setInterval` de 30s atualizando cotações spot e prêmios de opções via endpoint mock/proxy da B3 com oscilações reais de mercado, acompanhado por um anel de progresso visual sutil e botão de atualização imediata.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          App Header & Top Bar                          │
│  [Ticker Selector: BOVA11, SMAL11, PETR4...] [Spot Price & Var]        │
│  [Pricing Ref Toggle: Preço Justo / Último]  [30s Timer & Refresh]     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌──────────────────────────────────┐        ┌──────────────────────────────────┐
│       Grade de Opções (B3)       │        │   Simulador & Gestor de Pernas   │
│  - Filtro por Vencimento         │        │  - Lista de Pernas (Calls/Puts)  │
│  - Calls | Strike | Puts         │ ────►  │  - Ajuste de Quantidade & Ação   │
│  - Preço Último vs Preço Justo   │        │  - Custo Líquido & Breakevens    │
│  - Volatilidade Implícita (IV)   │        │  - Probabilidade de Lucro (PoP)  │
└──────────────────────────────────┘        └─────────────────┬────────────────┘
                                                              │
                                                              ▼
                                            ┌──────────────────────────────────┐
                                            │   Gráficos Interativos (Canvas)  │
                                            │  - Payoff (Vencimento + Hoje T+0)│
                                            │  - Curvas de Delta, Gamma, Theta │
                                            │  - Sliders de Sensibilidade      │
                                            └──────────────────────────────────┘
```

#### Modelo de Dados (TypeScript)
- `AssetOption`: Símbolo, tipo (`CALL` | `PUT`), modelo (`EUROPEIA` | `AMERICANA`), strike, vencimento, dias úteis até vencimento, último preço, data do último negócio, volume, volatilidade implícita (`iv`), preço justo (`fairPrice`), gregas (`delta`, `gamma`, `theta`, `vega`, `rho`).
- `SimulationLeg`: ID, ativo base, código da opção, tipo, ação (`BUY` | `SELL`), quantidade, preço de entrada, modo de preço (`FAIR` | `LAST` | `CUSTOM`).
- `StructureMetrics`: Custo montagem (R$), Lucro máximo, Prejuízo máximo, Breakevens, PoP (%), Delta total, Gamma total, Theta diário (R$), Vega total.

---

### 5. Verification & Test Plan

1. **Cálculo Black-Scholes e Gregas**:
   - Verificar precisão da fórmula analítica para chamadas e vendas (Call/Put Parity, valores de Delta entre 0 e 1 para Calls e -1 e 0 para Puts).
2. **Alternância de Preço de Referência**:
   - Confirmar que opções sem negócios há mais de 7 dias selecionam automaticamente o Preço Justo.
   - Testar o toggle global e individual entre Último Negócio e Preço Justo.
3. **Simulador de Estrutura**:
   - Adicionar pernas de trava de alta (Bull Call Spread), verificar cálculo correto do payoff máximo, prejuízo limitado e breakeven.
4. **Ciclo de Atualização de 30s**:
   - Testar o recarregamento automático a cada 30 segundos com feedback visual sem perda do estado de pernas já montadas.
5. **Responsividade & Layout**:
   - Garantir visualização nítida em desktops e telas compactas com tipografia tabular monetária.
