# Relatório final — Financeiro 1.0.0

Data: **26/10/2026**, America/Sao_Paulo. Classificação: **APROVADA COM RESSALVAS**.

Os critérios essenciais passaram no ambiente exercitado. Não há falha crítica ou alta conhecida pendente após as correções e auditorias descritas. A aprovação não certifica ambientes não testados ou disponibilidade futura de provedores externos.

## Artefato final

- Instalador: `D:\Programação\Projetos\dash_gastos\dist-installer\Financeiro-Setup-1.0.0.exe`.
- Executável sem instalar: `D:\Programação\Projetos\dash_gastos\dist-installer\win-unpacked\Financeiro.exe`, acompanhado de todos os recursos da pasta.
- Tamanho do instalador: **122.973.006 bytes**.
- SHA-256: `62ed89cfca12b76b52b39b4ca64c451b639c26798fb5c929b03b08d4686d865a`.
- Checksum: `dist-installer/Financeiro-Setup-1.0.0.exe.sha256`.
- Verificação: `dist-installer/package-verification.json`, 573 entradas no ASAR, nenhum arquivo privado encontrado; executável x64, subsistema GUI e ícones de seis resoluções conferidos no executável e instalador.
- Versão 1.0.0 e metadados Financeiro/Kayan Lucas conferidos. Electron 45.0.0 inclui Node 24.22.0 e SQLite 3.53.4. NSIS é gerado pelo electron-builder 26.18.0.
- Instalador sem assinatura digital. Pode haver aviso do SmartScreen; nenhuma proteção do Windows foi desabilitada.

## Resumo técnico e funcionalidades

Fluxo mantido: React → HTTP local Express → serviços → repositórios → SQLite. Electron cria o backend em utilityProcess, define o caminho persistente antes da conexão e gerencia janela/encerramento. Chart.js desenha dados locais; APIs externas ficam restritas ao módulo de Mercado.

Foram verificados Dashboard mensal e comparação anterior; receitas/despesas e seus cálculos; edição/cancelamento lógico; extrato mensal/histórico; fechamento e revisões idempotentes; contas, reservas, investimentos, aportes/resgates e avaliações; evolução patrimonial; Planejamento com CRUD/soma/persistência e independência das tabelas financeiras; cache/histórico de mercado; backup/restauração; segurança local e execução instalada.

Valores são inteiros em centavos com agregações BigInt; transferências não duplicam receita/despesa. Foreign keys, constraints, transações, WAL e migrations com checksum foram preservados. Não foram criadas/alteradas migrations ou módulos financeiros. A identidade visual foi mantida.

## Diagnóstico e correções

| Gravidade inicial | Evidência | Resultado |
|---|---|---|
| Alta, dependências | npm audit do frontend: 13 pacotes, 11 alertas altos e 2 moderados. Parte dos avisos refere-se a adaptadores Node/SSR ou ferramentas, não usados no renderer estático; outros atingem bibliotecas de produção. Não foi demonstrada exploração no aplicativo. | Atualizações compatíveis, sem troca de versões principais. Axios 1.20.0, react-router-dom 7.18.4, Vite 8.3.5 e transitivos corrigidos; mínimos e lockfile atualizados. Auditorias finais da raiz e frontend: zero alertas reportados. |
| Média, calendário | Teste reproduziu HTTP/serviço 400 no mês selecionável 1900-01 ao tentar validar 1899-12 como entrada financeira. | A comparação interna usa limites anteriores calculados; entradas financeiras mantêm seu intervalo. Testes Node e renderer passaram. |
| Média, validação | monthBounds(9999-12) gerava limite com ano expandido e string truncada. | Limite não representável é rejeitado com erro 400; viradas comuns de ano e fevereiro continuam corretas. |
| Alta potencial, recuperação em caminho acentuado | O teste no Node CLI reproduziu temporários não removidos; o código de recuperação usava a mesma remoção recursiva, podendo manter marcador pendente. | Limpeza restrita aos temporários próprios usa unlink/rmdir, sem seguir links, e verifica conclusão. Backup, restauração e reabertura passaram no CLI e no Electron em perfil com acentos. A falha não foi extrapolada como comprovada no runtime distribuído anterior. |
| Média, cobertura de release | Só havia reinstalação da mesma versão. | Upgrade controlado de metadados 0.9.9 → 1.0.0, instalado em identidade exclusiva, com hash do banco preservado antes de abrir a nova versão. |
| Baixa, documentação | README acumulava registros de fases, sem changelog final. | Guia consolidado, changelog e histórico preservado em docs/HISTORICO_FASES.md. |

O teste PowerShell de upgrade recusou inicialmente um caminho lido com codificação padrão incorreta, antes de instalar. A leitura JSON passou a usar UTF-8 explícito e o teste completo passou. Nenhuma restauração ou teste destrutivo foi feito no banco pessoal.

## Testes executados

| Execução | Resultado e alcance |
|---|---|
| `npm test` | **57 aprovados, 0 falhas, 0 ignorados**. Finanças, negativos/limites, concorrência, SQLite, rollback, migrations/backup, Planejamento, offline, segurança HTTP/IPC, logs e calendário. |
| `npm --prefix frontend run lint` | Aprovado após atualização das dependências. |
| `npm run desktop:smoke` | Estático e Vite aprovados: abertura direta, navegação, Chart.js, operações, backup/restauração, encerramento e arquivo inválido preservado, em perfis temporários. |
| `npm run desktop:asar-smoke` | ASAR aprovado com backend, SQLite, HTTP protegido e renderer reais. |
| `npm run desktop:packaged-smoke`, com DESKTOP_SMOKE_REOPEN_COUNT=5 | Executável final aprovado: primeira criação vazia, execução com fixture, cinco reaberturas consecutivas e saída inesperada do backend. Perfil com acentos; comparação anterior de janeiro de 1900 exercitada na interface. |
| Backup/restauração | Snapshot com WAL, arquivo completo, validação, destino existente, cancelamento, confirmação, cópia preventiva, recuperação de falha/saída abrupta e reabertura. Diálogos têm respostas simuladas; preload/IPC/SQLite reais. |
| Offline | Todos os módulos locais e backup/restauração funcionaram com requisições externas do backend rejeitadas; cache não foi apagado. Processos empacotados rodaram com PATH limitado ao Windows. |
| Segurança/dependências | Raiz e frontend sem vulnerabilidades reportadas pelo npm no momento da auditoria. Isolamento/sandbox mantidos, Node desabilitado no renderer, capacidade temporária e acesso não autorizado 403; consultas parametrizadas e entradas inválidas cobertas. |
| Provedores públicos reais | Em 26/10/2026 às 19:06 BRT, AwesomeAPI retornou USD/EUR/BTC sem erro. Foram persistidos e lidos 310/331/360 pontos disponíveis, respectivamente, dentro da janela consultada de 365 dias. Isso não afirma série diária completa. |
| `npm run desktop:installer` e `desktop:verify-package` | Instalador final gerado, ícones/arquitetura/GUI/privacidade conferidos e SHA-256 calculado. |

Evidências locais: `backups/phase8/node-tests.txt`, `desktop-smoke.txt`, `asar-smoke.txt`, `final-packaged-smoke.txt`, `repeated-starts.json`, `market-live.json`, `root-audit-final.json`, `frontend-audit-initial.json`, `frontend-audit-final.json`, `validation-build.txt`, `windows-upgrade.json` e `final-build.txt`. Relatórios adicionais de runtime ficam em backups/electron-smoke-*.json. Os arquivos usam exclusivamente fixtures e não contêm dados financeiros pessoais.

## Instalação, atualização e desinstalação

Testes em **Windows 10 x64, build 19045**. A instalação pessoal Financeiro 1.0.0 já existente foi identificada e preservada. O script antigo de instalação, que recusa conflitos, não foi forçado a executar sobre ela.

Foram criados dois instaladores de validação, 0.9.9 e 1.0.0, com AppId, nome de atalhos, entrada de desinstalação, diretório e perfil exclusivos. São o mesmo código/esquema com metadados de versão diferentes, não uma release histórica publicada. Isso verifica a mecânica de upgrade NSIS e preservação de dados; não certifica migração de esquemas futuros.

A versão 0.9.9 foi instalada e exercitada. O banco de teste recebeu histórico, transferências, reserva/investimento, avaliação, fechamentos, Planejamento e cache de cotação. O instalador 1.0.0 preservou o hash do arquivo antes de abrir o programa novo; o smoke passou novamente depois. A versão instalada foi conferida no registro e no runtime.

Atalhos foram criados com o destino correto. Depois do teste, o desinstalador exclusivo removeu programa/atalhos/registro de validação e preservou o hash do banco. Não ficaram processos da instalação de teste. Os registros e hashes dos atalhos da instalação pessoal ficaram idênticos. O banco pessoal não foi aberto para fazer essa comparação. O diretório instalado e o perfil de teste foram removidos ao final.

O instalador final de identidade Financeiro foi gerado e seu executável testado; **não foi instalado sobre a cópia pessoal**. A validação instalada usou a mesma configuração NSIS com identidade isolada. O registro da Fase 7 também contém uma instalação/desinstalação da identidade Financeiro, feita antes de existir a instalação pessoal.

## Testes não executados e ressalvas

- Windows limpo, Windows 11 e máquina fisicamente sem Node/PostgreSQL: não havia outro ambiente adequado. O executável foi testado com PATH sem essas ferramentas, mas o driver dos testes usa Node no host.
- IBOV/brapi, ouro/GoldAPI e rota CoinGecko: não consultados em rede por exigirem credenciais opcionais; nenhuma chave pessoal foi usada, criada ou contratada.
- Upgrade entre dois esquemas históricos distintos: a simulação usa o mesmo esquema. Testes unitários de migration preservam a base anterior com backup, mas não certificam atualizações futuras.
- SmartScreen/reputação/assinatura: sem certificado; não houve tentativa de alterar proteções.
- Falha física de disco/energia e todos os estados visuais do Explorer/barra de tarefas: não simulados. Recursos PE, arte e atalhos foram conferidos.
- Recuperação antes da inicialização de banco corrompido permanece assistida; o backend precisa estar disponível para usar a tela de restauração.
- O Node CLI ainda emite aviso experimental de SQLite. Não há otimização/paginação para históricos muito grandes, criptografia do banco ou histórico completo de versões de edição.

Essas ressalvas são documentadas e não impediram os critérios essenciais no cenário pessoal testado. Não foram adicionadas funcionalidades para contorná-las.

## Arquivos desta fase

Modificados: `frontend/package.json`, `frontend/package-lock.json`, `services/finance.js`, `database/sqlite/data-management.cjs`, `desktop/main.cjs`, `desktop/planning-smoke.cjs`, `scripts/desktop-smoke.cjs`, `scripts/windows-install-smoke.ps1`, `tests/data-management.test.js`, `package.json`, `README.md` e `frontend/README.md`.

Criados: `tests/release-boundaries.test.js`, `scripts/validation-builder.cjs`, `scripts/build-validation-installers.cjs`, `scripts/windows-upgrade-smoke.ps1`, `scripts/upgrade-fixture.cjs`, `scripts/check-market-live.cjs`, `CHANGELOG.md`, `docs/HISTORICO_FASES.md` e este relatório. Instaladores/relatórios gerados ficam nos diretórios ignorados dist-installer e backups; alterações locais anteriores foram mantidas.

Nenhuma tabela/migration, stack, identidade visual ou módulo financeiro novo. Não houve publicação, tag Git, release remota, commit ou push.

## Instalar, utilizar e manter os dados

1. Faça um backup pela sua instalação atual antes de substituir a versão preliminar.
2. Execute o instalador final no caminho acima e siga o assistente. Abra Financeiro pelo atalho da área de trabalho ou menu Iniciar.
3. O dashboard abre diretamente; use Extrato para receitas/despesas/transferências, Patrimônio para contas/avaliações, Planejamento para contas futuras independentes e Configurações para backups.
4. A base pessoal continua em `%APPDATA%/DashGastosDesktop/data/dash-gastos.sqlite`. Desenvolvimento usa `%APPDATA%/DashGastosDesktop/development/dash-gastos.sqlite`; testes usam pastas temporárias.
5. Mantenha cópia externa do backup e preserve a pasta de dados ao atualizar/desinstalar. Logs técnicos ficam em `%APPDATA%/DashGastosDesktop/logs`.

Parecer: **APROVADA COM RESSALVAS para uso pessoal no ambiente validado**, com os limites acima. Não há pendência crítica/alta conhecida sem correção nos cenários testados. A instalação pessoal não foi atualizada automaticamente; para receber as correções é necessário executar o instalador final. Nenhuma fase adicional foi iniciada.
