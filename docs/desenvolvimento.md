# Desenvolvimento do Maré de Linha

Aplicativo Android de pesca em português. A versão 2.0 inclui um guia de pesca com avaliação por modalidade, janelas de planejamento, comparação de sete dias, sinais de risco e dois modos de leitura. Inclui também previsões por hora, marés, janelas solunares, favoritos e diário local. O APK requer Android 7.0 ou superior com WebView atualizado. As consultas online usam a API gratuita do Open-Meteo, para uso não comercial.

## Instalação

Abra o APK fornecido no Android. Se o sistema solicitar, permita que o navegador ou gerenciador de arquivos instale esse APK. O Android não precisa de uma conta no app. GPS é opcional. Previsões baixadas ficam salvas temporariamente. Tábuas incluídas, cálculos astronômicos, pontos e capturas funcionam offline.

## Compilar no Windows

Instale Node.js e JDK 17, além do SDK Android com `platforms;android-35` e `build-tools;35.0.0`. No PowerShell 7, na pasta descompactada, execute:

```powershell
npm ci
./build-android.ps1 -SdkPath 'C:/caminho/android-sdk' -JavaPath 'C:/caminho/jdk-17' -OutputApk './Mare-de-Linha.apk'
```

O script gera uma chave de assinatura particular em `.sign` na primeira compilação. Para compilar atualizações da mesma instalação, preserve a chave e a senha. O APK entregue é assinado com a chave original local de desenvolvimento. Uma compilação com chave nova será assinada com outra identidade.

## Guia de condições

O modo simples é o padrão. Em **Guia**, selecione Praia, Alto-mar, Costão e pedras, Rio, Manguezal, Estuário ou Embarcada. A nota compara as condições previstas da modalidade. Veja **Como avaliamos** para abrir os pesos. A leitura exige dados essenciais recentes e cobertura mínima. Os sinais de risco suspendem a nota do horário. Em **Comparar os próximos 7 dias** é possível abrir cada dia e tocar em uma hora para examinar os fatores.

`node test-guide.mjs` verifica as regras de avaliação, risco, cobertura, janelas, modalidades e virada do dia. `src/guide.js` tem os pesos e critérios. `src/insights.js` produz as leituras por variável. `src/guide-view.js` apresenta as avaliações e a comparação de dias.

## Fontes e métodos

- **CHM / DHN / Marinha do Brasil.** Tábua de 2026 com horários e alturas de preamares e baixa-mares em Salvador, Aratu, Madre de Deus, Ilhéus e Recife. O gráfico interpola entre os extremos da tábua. Os valores se referem ao nível de redução da estação. Os arquivos JSON contêm os dados numéricos extraídos e o script `parse-tides.py` faz a conversão a partir dos PDFs do CHM, usando PyMuPDF. [Tábuas oficiais de 2026](https://www.marinha.mil.br/chm/tabuas-de-mare-6) · [Tábuas oficiais de 2027](https://www.marinha.mil.br/chm/tabuas-de-mare-2027)
- **Open-Meteo.** Tempo, vento, ondas, temperatura da superfície da água, correntes e nível do mar modelado. A altura do modelo se refere ao nível médio global e os extremos são aproximados a partir das amostras horárias. O modelo tem cobertura e precisão limitadas perto da costa. [Meteorologia](https://open-meteo.com/en/docs) · [Meteorologia marítima](https://open-meteo.com/en/docs/marine-weather-api) · [Condições de uso](https://open-meteo.com/en/terms)
- **Astronomy Engine.** Horários e fase da Lua calculados localmente. Janelas maiores são de uma hora antes a uma hora depois de cada trânsito lunar e menores de meia hora antes a meia hora depois do nascer ou pôr da Lua. [Astronomy Engine](https://github.com/cosinekitty/astronomy)
- **GloFAS via Open-Meteo.** Vazão média regional diária em UTC, exibida para a modalidade Rio. O modelo representa o maior rio na área da coordenada. [Dados hidrológicos](https://open-meteo.com/en/docs/flood-api)
- **Imagem de abertura.** `web/static/costa.webp`, criada com a ferramenta integrada ImageGen a partir do prompt abaixo.

> Photorealistic editorial photograph for a fishing forecast mobile dashboard hero banner. Wide landscape 3:2, composed for a central panoramic 3:1 crop. Dramatic but peaceful tropical Brazilian Atlantic coast at dawn, blue-green sea from a low coastal overlook, white teal waves rolling into the rocky shore at far right, lush headland to the far right, distant headland on the horizon, subtle golden pink early sunlight near upper right. The left half mostly mostly deep teal dark water and open space with low contrast for white UI text overlay. Authentic Bahia coastline mood, refined outdoor magazine color grading, fine realistic natural textures. No people, typography, graphics, logo or watermarks.

O Nautide foi uma referência de funcionalidades. A inspeção estática do XAPK com o REA identificou a distribuição com APK base e complementos. O código, os dados e os recursos de interface deste app são independentes.
