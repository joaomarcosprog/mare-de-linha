# Análise de UI e UX do Maré de Linha 2.0

A versão 1.0 mostrava a previsão em cartões e gráficos, mas exigia que o pescador juntasse as informações e tomasse a decisão sozinho. No 2.0, as primeiras informações são a avaliação do horário, a melhor janela prevista e os riscos que podem mudar o plano. O usuário escolhe a modalidade uma vez e pode alternar entre a leitura em linguagem simples e os dados técnicos na mesma tela.

## O que o Nautide faz bem

O resumo do Nautide agrupa as condições em torno de um horário selecionado e permite mudar a hora e o dia sem perder o contexto. O gráfico de marés marca altas e baixas diretamente na curva, e a tabela de atividade permite comparar dias em sequência. Esses padrões funcionam porque conectam os dados à pergunta «quando?». A interface pública também demonstra filtros de pesquisa por condições no SeaQuery e informa mais de 25 mil estações. A comparação aqui é uma avaliação de interface baseada nas telas e funções públicas. [Capturas no Google Play](https://play.google.com/store/apps/details?hl=pt_BR&id=com.nautide.app) · [Nautide](https://nautide.com/)

Na versão 1.0 do Maré de Linha, a fotografia e quatro números consumiam o primeiro campo de visão. A direção do vento vinha abreviada, a tendência de pressão exigia abrir a tabela e a maré aparecia sem uma leitura imediata de enchente ou vazante. As janelas da Lua e os dados ambientais também exigiam consultas separadas. A versão 2.0 encurta esse caminho com avaliação por modalidade, causas visíveis e navegação por hora.

## O que mudou nas telas

| Tela | Primeira leitura | Ao aprofundar |
| --- | --- | --- |
| Guia | Avaliação do horário, melhor janela, alternativa disponível, riscos e melhor janela dos próximos sete dias | Nota, cobertura e pesos da modalidade. Fatores a favor e pontos de atenção em cada hora |
| Planejamento | Sete dias comparados pela melhor janela de cada um e quantidade de horários com risco | Toque em um dia para examinar horários, fatores e riscos. O modo detalhado tem tabela de 24 horas |
| Marés | Maré subindo, baixando ou variando pouco. Próxima alta ou baixa e impacto no acesso ao ponto | Curva, alturas, referência vertical, dados oficiais ou de modelo e tabela mensal onde há cobertura oficial |
| Condições do tempo | Intensidade do vento, rajadas, direção em palavras, chance e volume de chuva, sensação térmica e tendência | Gráficos por variável e tabela horária com umidade, nuvens, visibilidade e demais medidas |
| Condições do mar | Altura, período e origem das ondas. Força e destino da corrente. Temperatura superficial e tendência | Gráficos e tabela com ondulação, período, direção, água e corrente. Indicação da origem modelada |
| Pressão | Subindo, caindo, estável ou sem base para comparar. Significado da mudança para o tempo | Diferença em três horas, curva e valores ao nível do mar e na superfície |
| Sol, Lua e atividade | Luz disponível, nascer e pôr do Sol e da Lua, fase, iluminação e linha do tempo solunar | Horário e evento que originaram cada janela. Tabela solunar mensal calculada no aparelho |
| Rio | Tempo na margem e tendência regional da vazão quando disponível | Série de vazão diária em m³/s. O modelo pode representar o maior rio próximo em vez do trecho escolhido |
| Diário | Capturas, notas, horário e modalidade no mesmo registro | Edição das capturas existentes, inclusive da versão anterior |

Os estados combinam texto, ícone e cor. A barra resume a faixa da nota e as explicações estão nos cartões. Nas direções, vento e ondas dizem de onde vêm. A corrente diz para onde vai. Nos casos em que a espécie ou o trecho mudam a interpretação, o cartão explica o papel do dado sem atribuir uma faixa universal de temperatura, pressão ou fase lunar.

## Como o guia decide

O índice é uma média ponderada dos fatores disponíveis. A tela **Como avaliamos** mostra os pesos e a contribuição de cada fator. A maior influência muda de acordo com a modalidade.

| Modalidade | Fatores com mais peso |
| --- | --- |
| Praia | Ondas, vento e chuva |
| Alto-mar | Ondas, vento e visibilidade |
| Costão e pedras | Ondas, maré e chuva |
| Rio | Chuva, vento e luz disponível |
| Manguezal | Maré, chuva e corrente |
| Estuário | Corrente, maré e chuva |
| Embarcada | Ondas, vento e corrente |

O cálculo exige dados essenciais recentes e pelo menos 67% dos pesos disponíveis. A janela combina dois horários consecutivos com nota mínima de 60 e pelo menos 90 minutos restantes. As faixas são 88–100 excelente, 74–87 bom, 60–73 regular, 42–59 pouco favorável e 0–41 desfavorável. Trovoadas, ondas ou rajadas acima dos limites da modalidade e outros sinais de risco bloqueiam a nota daquele horário. Os limites são critérios editoriais conservadores do aplicativo, distintos dos avisos oficiais. [Avisos de mau tempo da Marinha](https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo)

O índice expressa adequação prevista para planejar a saída. Seu resultado não estima chance de captura. O solunar recebe de 5% a 6% do peso e funciona como um sinal auxiliar. Estudos registram resultados diferentes entre espécies e locais. [Estudo sobre trutas de água doce](https://link.springer.com/article/10.1007/s42452-023-05379-8) · [Estudo sobre pesca em recifes](https://repository.library.noaa.gov/view/noaa/59593)

## Cobertura e verificação

- A comparação meteorológica cobre até sete dias. As tábuas oficiais incluídas são de 2026 para Salvador, Aratu, Madre de Deus, Ilhéus e Recife. Marés e correntes de modelo têm resolução limitada perto da costa. [Centro de Hidrografia da Marinha](https://www.marinha.mil.br/chm/tabuas-de-mare-6) · [Modelo marítimo](https://open-meteo.com/en/docs/marine-weather-api)
- A vazão de rio é uma média diária, sujeita à seleção do rio predominante perto da coordenada. A tendência regional deve ser conferida no trecho que será pescado. [Open-Meteo GloFAS](https://open-meteo.com/en/docs/flood-api)
- Foram exercitados os estados das sete modalidades, ausência de dados, previsão antiga, risco, virada do dia, navegação por hora, tabelas, atualização do APK e preservação dos dados locais. O ganho esperado de usabilidade é menos passos para decidir onde e quando pescar. A comparação de desempenho com o Nautide ainda requer observação de pescadores executando as mesmas tarefas nos dois apps.
