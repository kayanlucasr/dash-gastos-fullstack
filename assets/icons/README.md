# Ícone Financeiro

Arte vetorial: cifrão branco centralizado sobre quadrado verde-esmeralda `#047857`, com cantos arredondados e transparência externa. O cifrão foi convertido em contornos; o SVG e os arquivos distribuídos não dependem de fontes instaladas.

- `financeiro.svg`: fonte vetorial.
- `financeiro.ico`: contêiner ICO Windows verdadeiro, com seis imagens PNG RGBA de 16, 32, 48, 64, 128 e 256 pixels.
- `financeiro-<tamanho>.png`: exportações e prévia de 512 pixels.

Para regenerar em Windows, execute `npm run icons:generate` na raiz. O script usa System.Drawing e o glifo Segoe UI Bold do Windows para construir os contornos e as exportações. O build normal usa os arquivos prontos, sem regenerá-los. Não renomeie PNG para ICO.

Electron, executável, instalador e desinstalador usam o ICO. Os atalhos utilizam o ícone do executável. O verificador de pacote compara os bytes das seis imagens com os recursos embutidos no executável e no instalador.
