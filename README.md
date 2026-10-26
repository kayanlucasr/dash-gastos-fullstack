# Financeiro 1.0.0

Aplicativo pessoal de gestão financeira para Windows, sem login. Electron inicia React, Express e SQLite automaticamente. Chart.js apresenta gráficos dos dados locais.

**Release: APROVADA COM RESSALVAS** no ambiente validado. Consulte o [relatório final](docs/RELEASE_1.0.0.md), o [changelog](CHANGELOG.md) e as limitações abaixo. Os registros das fases anteriores foram preservados em [histórico técnico](docs/HISTORICO_FASES.md).

## Instalação e início

1. Execute `dist-installer/Financeiro-Setup-1.0.0.exe` e siga o assistente NSIS.
2. Escolha a pasta de instalação. São criados atalhos **Financeiro** na área de trabalho e no menu Iniciar.
3. Abra pelo atalho. O dashboard aparece diretamente, sem login, terminal, Node.js separado ou PostgreSQL.
4. Feche a janela para encerrar o aplicativo e os serviços locais.

Requisitos: Windows x64, permissão de instalação na conta atual e espaço para o programa, banco e cópias de segurança. O ambiente testado foi **Windows 10 x64, build 19045**. Windows 11 e máquinas limpas não foram testados nesta entrega. O instalador é para o usuário atual e não exige elevação por configuração.

O executável é **sem assinatura digital**; o Windows/SmartScreen pode apresentar aviso de editor desconhecido. Nenhuma proteção do Windows precisa ser desativada. O instalador inclui o runtime Electron. Não execute o Financeiro.exe isolado dos recursos da pasta win-unpacked; prefira o instalador completo.

O arquivo `.sha256` ao lado do instalador permite conferir sua integridade. O SHA-256 desta entrega está no relatório final. Não há atualizações automáticas; o instalador não é publicado automaticamente.

## Repositório e obtenção do instalador

Código-fonte: [kayanlucasr/dash-gastos-fullstack](https://github.com/kayanlucasr/dash-gastos-fullstack).

O Git versiona fontes, ícones, documentação e lockfiles. Dependências instaladas, bancos pessoais, `.env`, backups, logs e a pasta `dist-installer` ficam fora do versionamento. O instalador citado acima é um artefato local, não um arquivo incluído no clone.

Para obter o projeto e gerar o instalador em Windows x64 com Node 24.13 ou superior na máquina de desenvolvimento:

```powershell
git clone https://github.com/kayanlucasr/dash-gastos-fullstack.git
cd dash-gastos-fullstack
npm ci
npm --prefix frontend ci
npm run desktop:installer
npm run desktop:verify-package
```

O programa instalado não exige Node.js. Uma nova compilação pode ter SHA-256 diferente; use o checksum gerado junto ao respectivo instalador.

## Como utilizar

| Área | Utilização |
|---|---|
| Dashboard | Selecione o mês para ver receitas, despesas, saldo disponível ao fim do período e comparação anterior. Reservas e investimentos são apresentados como posições atuais. |
| Extrato | Cadastre receitas/despesas, escolha contas e categorias, filtre por mês/natureza, edite ou cancele movimentações. Fechamentos anteriores permitem voltar aos meses do histórico. |
| Patrimônio | Crie contas disponíveis, reservas e investimentos; registre saldo inicial/ajuste ou avaliação de investimento. Faça aportes e resgates como transferências no Extrato. |
| Planejamento | Cadastre nome, data e valor de contas futuras; edite ou exclua. A lista soma os valores e mantém itens vencidos até exclusão manual. |
| Mercado | Consulte cotações e histórico disponíveis, fonte e datas. “Consultar cache” relê os dados locais, sem forçar uma coleta externa. |
| Configurações | Crie backup, consulte a data do último backup registrado pela interface ou restaure um arquivo mediante confirmação. |

Planejamento acessa exclusivamente sua tabela: não altera saldo, receitas/despesas, extrato, patrimônio, gráficos financeiros ou fechamento mensal. O mês selecionado no Dashboard não filtra essa lista.

Cancelar uma movimentação preserva seu registro no banco com cancelamento lógico. A edição não mantém um histórico completo de versões dos campos. Transferências não duplicam receitas/despesas; avaliações patrimoniais são separadas dos aportes. As operações rejeitam saldos negativos ao fim de cada dia de cada conta, inclusive após correções retroativas.

## Dados e persistência

| Uso | Local do SQLite |
|---|---|
| Aplicativo instalado/estático | `%APPDATA%/DashGastosDesktop/data/dash-gastos.sqlite` |
| Electron de desenvolvimento | `%APPDATA%/DashGastosDesktop/development/dash-gastos.sqlite` |
| Express avulso | Banco de desenvolvimento por padrão; `SQLITE_PATH` aceita caminho absoluto alternativo |
| Testes | Arquivos temporários próprios; nunca o banco pessoal |

A identidade da pasta **DashGastosDesktop** foi preservada após o nome visível mudar para Financeiro. O banco fica fora da instalação e do ASAR. A primeira abertura sem arquivo cria categorias, indicadores e conta disponível zerada; as seguintes reutilizam os dados. Não há importação automática do PostgreSQL histórico.

Valores financeiros são inteiros em centavos; as agregações usam BigInt e a API devolve strings decimais. Gráficos convertem para Number apenas para desenho. Um lançamento admite até R$ 9.999.999.999,99 e rejeita mais de duas casas decimais. Totais que excedam o inteiro SQLite de 64 bits são recusados.

Datas financeiras seguem America/Sao_Paulo e não aceitam futuro. As migrations existentes são versionadas por checksum e não devem ser editadas; uma atualização cria backup antes de aplicar migrations pendentes. WAL, synchronous=FULL, foreign_keys e transações preservam operações relacionadas. Banco corrompido ou de versão desconhecida não é apagado para permitir abertura.

Antes de atualizar ou desinstalar, faça backup. A desinstalação preserva os dados por configuração; não apague a pasta DashGastosDesktop. Atualizações futuras precisam manter AppId, caminho e compatibilidade de migrations.

## Backup e restauração

Em **Configurações → Dados e backups**:

1. **Criar backup:** escolha um arquivo novo no diálogo do Windows. O backend usa backup consistente do SQLite, incluindo dados confirmados no WAL, valida integridade/esquema e informa o resultado. Arquivos existentes não são sobrescritos.
2. **Restaurar backup:** escolha uma cópia diferente do banco ativo. O aplicativo valida uma cópia temporária e pede confirmação nativa, com Cancelar como padrão.
3. Ao confirmar, a API é bloqueada temporariamente, trabalhos são drenados e a conexão é fechada. O banco atual ganha uma cópia em `backups/before-restore-<id>.sqlite`, ao lado do banco em uso, antes da troca.
4. O banco restaurado é validado; a conexão/agendador retomam e a interface recarrega. Em falha, o banco anterior é recuperado ou preservado para diagnóstico. Um marcador protege a recuperação após interrupção.

O backup inclui finanças, planejamento e mercado; restauração substitui os dados, sem mesclar registros. Só são aceitos o esquema e os checksums compatíveis com esta versão. A data mostrada refere-se ao último backup criado pela interface, não garante que o arquivo ainda existe e não inclui backups do CLI/migrations.

Guarde uma cópia fora do disco principal. SQLite e backups não são criptografados; as permissões da conta Windows protegem seus arquivos. Mantenha espaço para banco, estágio e cópia preventiva. Não há limpeza automática de backups. Não copie somente o `.sqlite` enquanto houver aplicativo aberto: o WAL pode conter gravações recentes.

Se uma restauração for interrompida, reabra o Electron para recuperar antes da inicialização. Se falhar, feche todas as execuções, preserve toda a pasta de dados, incluindo `.restore-pending`, backups e journals, e corrija espaço/permissões antes de tentar novamente. Não remova marcadores ou substitua arquivos com processos abertos.

Se corrupção impedir o backend de iniciar, a tela de restauração não abre: é necessária recuperação assistida com os processos fechados e preservação da pasta completa. Não há assistente separado de recuperação antes da inicialização nesta versão.

## Offline, Mercado e segurança

Dashboard, movimentações, extrato, fechamentos, reservas/investimentos, Planejamento, gráficos locais e backup/restauração funcionam sem internet. Somente os provedores de Mercado dependem de rede.

Mercado mantém últimas cotações, fonte e horários de cotação/coleta. Dados com mais de 24 horas são identificados; falhas mantêm o último cache válido. Há timeout de consulta, intervalo de 24 horas após sucesso e nova tentativa após uma hora em falha, respeitados pelo agendador. Históricos incompletos não recebem valores fictícios.

USD/EUR/BTC podem usar AwesomeAPI. CoinGecko, brapi/Ibovespa e GoldAPI/ouro dependem de configuração/chaves opcionais; configuração de chaves não tem tela própria nesta versão. Ausência de chave aparece como indisponibilidade e não impede as finanças. Credenciais ficam no backend e não são incluídas no instalador. Nunca use segredos em variáveis VITE_.

Electron mantém contextIsolation, sandbox e webSecurity; nodeIntegration fica desabilitado. O preload expõe somente base /api e operações específicas de dados, sem SQL, filesystem genérico ou tokens para o React. IPC valida janela/frame/origem. Navegação remota, novas janelas e permissões são controladas. O Express fica em 127.0.0.1 e usa capacidade temporária da instância desktop, além de Host/Origin/Sec-Fetch-Site, JSON limitado e validação. CORS não é a única proteção.

Logs ficam em `%APPDATA%/DashGastosDesktop/logs/application.log`, com uma geração anterior e rotação por tamanho. Registram eventos/códigos técnicos, sem valores financeiros, SQL, credenciais ou stacks na interface. Fechar o programa aguarda operações e encerra HTTP, agendador e SQLite. O modo Express avulso é uma ferramenta local de desenvolvimento, sem a capacidade adicional do desktop.

## Desenvolvimento e build

Na máquina de desenvolvimento Windows x64, use Node 24.13 ou superior:

```powershell
npm ci
npm --prefix frontend ci
npm run desktop:dev
```

A versão fixada é Electron 45.0.0, com Node 24.22.0 e SQLite 3.53.4 confirmados no executável. SQLite é incorporado, sem addon nativo externo/rebuild de ABI. O aviso experimental de node:sqlite no Node CLI de desenvolvimento não é ocultado.

| Diretório/arquivo | Responsabilidade |
|---|---|
| `frontend/src` | React, navegação, formulários, gráficos e cliente HTTP |
| `desktop` | Janela, preload, processo de backend e diálogos nativos |
| `server.js`, `routes`, `controllers`, `middlewares` | Express, contratos HTTP, proteção local e erros |
| `services`, `repositories` | Regras financeiras, mercado, Planejamento e SQL parametrizado |
| `database/sqlite` | Conexão, migrations, backup/restauração e recuperação |
| `tests`, `scripts` | Testes isolados, manutenção, build e validação da release |
| `assets/icons` | SVG original, PNGs e ICO Windows de seis resoluções |
| `docs` | Relatório final e histórico das fases |

| Comando | Finalidade |
|---|---|
| `npm test` | Suíte financeira/SQLite/segurança em bancos temporários |
| `npm --prefix frontend run lint` | Lint React |
| `npm run desktop:build` | Limpeza segura e build de produção React |
| `npm run desktop:start` | Abrir o build estático no Electron |
| `npm run desktop:prepare` | Build e conferência dos recursos/runtime |
| `npm run desktop:package` | Executável x64 em win-unpacked |
| `npm run desktop:installer` | Gerar NSIS x64 em dist-installer |
| `npm run desktop:verify-package` | Verificar ASAR, PE, ícones e gerar SHA-256 |
| `npm run desktop:smoke` / `desktop:asar-smoke` | Integração estática/Vite/ASAR com perfis temporários |
| `npm run desktop:packaged-smoke` | Testar o executável empacotado |
| `npm run desktop:validation-build` / `desktop:upgrade-smoke` | Gerar identidades isoladas e testar atualização controlada 0.9.9 → 1.0.0 |
| `npm run market:check-live` | Consultar provedores públicos em SQLite temporário, sem chaves pessoais |
| `npm run db:backup -- C:/caminho/novo.sqlite` | Backup consistente CLI do banco configurado |
| `npm run db:init` / `db:migrate` | Inicializar/verificar o SQLite configurado, sem exclusões |
| `npm run icons:generate` | Regenerar arte/ICO no Windows |

Para gerar a release: `npm run desktop:installer`, depois `npm run desktop:verify-package`. O programa final não depende dessas ferramentas. `dist-installer/Financeiro-Setup-1.0.0.exe` é o instalador completo; a pasta win-unpacked é uma alternativa que precisa de todos os seus recursos.

O teste antigo `desktop:install-smoke` recusa uma instalação Financeiro existente. Nesta fase foi usado o teste de atualização com AppId/atalhos exclusivos. Não aponte fixtures ou restaurações de teste ao banco pessoal. As versões controladas de validação usam o mesmo código/esquema com metadados diferentes; não representam uma release histórica publicada.

O builder é 26.18.0, NSIS x64 por usuário, AppId `br.com.kayanlucas.financeiro`, sem publicação/atualização automática. O build exclui bancos, .env, backups, logs, ferramentas e testes de desenvolvimento. Helpers de smoke desktop operam somente quando explicitamente acionados pelo driver de testes. O ícone é ICO verdadeiro com 16, 32, 48, 64, 128 e 256 pixels, embutido também no instalador e usado nos atalhos/janela.

A assinatura fica desabilitada nesta release pessoal. Para assinatura futura, configure FINANCEIRO_SIGNING=1, WIN_CSC_LINK e WIN_CSC_KEY_PASSWORD na máquina de build; não versione segredos. Os scripts PostgreSQL históricos não fazem parte da execução atual e não devem inicializar SQLite.

## Validação e limitações da 1.0.0

Foram executados 57 testes Node, lint/build, smoke estático/Vite/ASAR, teste do executável final com cinco reaberturas consecutivas em caminho com acentos, backup/restauração e atualização instalada isolada. As auditorias npm da raiz e do frontend reportaram zero vulnerabilidades no momento da validação.

Consultas reais de USD/EUR/BTC retornaram cotações e histórico em 26/10/2026. IBOV, ouro e a rota CoinGecko não foram consultados sem credenciais. Falhas de rede e cache foram validadas separadamente com simulação de ausência de internet.

Permanecem ressalvas: Windows limpo/Windows 11 não testados; upgrade ensaiado com versões controladas de mesmo esquema, sem certificar migrations futuras; assinatura ausente; recuperação inicial de banco corrompido assistida; sem simulação de defeito físico de disco/energia. Listagens e reconciliações não têm otimização para históricos muito grandes. Não há falha crítica ou alta conhecida pendente nos cenários exercitados.

O relatório final contém o SHA-256, caminhos, correções, evidências e testes não executados. Sua instalação pessoal não foi substituída na validação: para aplicar esta release, faça backup e execute o instalador final.
