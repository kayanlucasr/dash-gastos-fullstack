# Financeiro

Aplicativo financeiro local com React, Express, Electron 45 e SQLite. Abre diretamente no dashboard, sem login. React, Chart.js, identidade visual e contratos HTTP foram preservados.

## Executar

Use Node 24.13 ou superior para desenvolvimento. O Electron instalado incorpora Node 24.22.0 e SQLite 3.53.4, verificados nesta fase.

1. Na raiz, `npm ci`. Em frontend, `npm ci`.
2. `.env` do backend é opcional para chaves de mercado e opções locais; veja `.env.example`. Nunca use segredos em variáveis VITE_.
3. `npm run desktop:dev` inicia Vite, Express e a janela Electron automaticamente.
4. `npm run desktop:build` gera frontend/dist; `npm run desktop:start` abre esse build estático.

Não é necessário iniciar PostgreSQL, Vite ou Express separadamente. A Fase 3 substituiu a persistência ativa por SQLite. A Fase 7 gera o instalador Windows x64 Financeiro-Setup-1.0.0.exe; o usuário final não precisa instalar Node.js, PostgreSQL ou executar comandos. Consulte a seção da Fase 7 para build e resultados da validação.

O modo web de desenvolvimento continua disponível: `npm start` na raiz e `npm run dev` em frontend. O backend web usa o SQLite de desenvolvimento e não permite acesso pela rede. Configure VITE_API_URL apenas para esse modo, quando necessário.

## Armazenamento persistente

O processo principal obtém app.getPath('userData'), com identidade estável DashGastosDesktop, e envia o caminho ao processo de backend antes de abrir a conexão.

- Modo estático / produção planejada: `%APPDATA%/DashGastosDesktop/data/dash-gastos.sqlite`.
- Electron com Vite: `%APPDATA%/DashGastosDesktop/development/dash-gastos.sqlite`.
- Express avulso: caminho de desenvolvimento acima por padrão; SQLITE_PATH permite um arquivo absoluto alternativo.
- Testes automatizados: pastas temporárias próprias, removidas ao final, sem usar os arquivos reais.

O Electron define seu caminho diretamente e não aceita que SQLITE_PATH do ambiente o redirecione para outro banco. O renderer não recebe caminho do banco, SQL, credenciais ou acesso a arquivos. O arquivo não fica em ASAR, frontend/dist ou na instalação do aplicativo. Não mude a identidade/pasta do aplicativo em futuras versões sem migração explícita do caminho.

A primeira execução cria um SQLite limpo com categorias, indicadores e conta disponível zerada. Os registros PostgreSQL não são importados. Reabrir reutiliza o arquivo e aplica somente migrations pendentes; não recria tabelas ou zera saldos. Um arquivo corrompido, desconhecido ou com versão incompatível interrompe a inicialização, preservando o original.

## Persistência e migrations

Driver: `node:sqlite`, incorporado ao Node/Electron verificados. Nenhum driver SQLite externo ou módulo nativo adicional foi instalado, evitando rebuild de ABI para Electron. No Node 24.13 usado pelo CLI, a API ainda emite ExperimentalWarning; as versões devem permanecer fixadas e ser revalidadas ao atualizar Electron/Node. Esse aviso não foi ocultado.

- db.js: conexão única por processo, queries preparadas, transações e fechamento.
- database/sqlite/connection.cjs: abertura, migrations, integridade, WAL e backup.
- database/sqlite/migrations/001_initial.sql: esquema inicial e catálogo estático.
- repositories/: SQL financeiro e de mercado.
- services/: regras financeiras, datas, conversão de centavos e integração com provedores.

PRAGMA foreign_keys=ON em cada conexão, busy_timeout de 5 segundos e synchronous=FULL com WAL. Cada operação financeira usa BEGIN IMMEDIATE/COMMIT/ROLLBACK com callback síncrono, sem aguardar rede no meio da transação. Isso preserva transferências, revisões de fechamento e ajustes patrimoniais atomicamente. Conexões concorrentes são serializadas pelo SQLite; banco ocupado gera resposta apropriada para tentar novamente.

schema_migrations guarda versão, checksum e data. Migrations já aplicadas não devem ser editadas: crie uma nova. Alteração de checksum ou banco de versão desconhecida são recusados. Antes de migrar um banco existente, é criada uma cópia consistente na subpasta backups do diretório de dados. São verificados quick_check, foreign_key_check e estrutura esperada. `npm run db:init` e `npm run db:migrate` verificam/inicializam o SQLite configurado sem exclusões.

## Esquema SQLite

| Tabela | Conteúdo |
|---|---|
| categories | Códigos e nomes únicos |
| accounts | Contas disponíveis, reservas e investimentos |
| transactions | Eventos financeiros, contas, categoria e cancelamento lógico |
| investment_valuations | Avaliações de investimento e ajustes vinculados |
| monthly_closings | Resumo JSON, mês único e revisão |
| monthly_category_totals | Despesas por categoria em centavos |
| market_indicators | Moeda, unidade e provedor |
| market_quotes | Cotações decimais textuais e datas |
| market_sync_state | Cache, tentativas, erros e reserva temporária de coleta |
| schema_migrations | Histórico com checksums |

Tabelas STRICT, chaves estrangeiras, constraints e índices por data/conta/indicador. Não há users ou user_id.

## Precisão e regras financeiras preservadas

Valores em reais ficam em INTEGER, em centavos. Conversão por strings + BigInt, sem parseFloat ou arredondamento. Um lançamento aceita até 9999999999.99; valores com mais de duas casas decimais são rejeitados. Agregações SQLite usam inteiros de 64 bits e retornam BigInt antes da formatação. Os contratos HTTP continuam usando strings decimais com duas casas. Gráficos convertem valores para Number apenas para desenho; a formatação monetária da interface usa inteiros para preservar centavos.

Receita exige destino, despesa exige origem/categoria, transferência exige contas distintas. Aporte e resgate são transferências; não duplicam receita/despesa/patrimônio. Saldo inicial é ajuste explícito. Cada dia de cada conta deve ter saldo não negativo, inclusive após correções retroativas.

Cancelar movimentação usa cancelled_at. Editar preserva a regra atual de substituir campos, sem histórico completo de versões de edição. Avaliações de investimentos representam o valor ao final do dia; geram ajustes de valorização/perda separados dos aportes. Alterações anteriores recalculam ajustes posteriores e podem ser rejeitadas se causarem saldo negativo. Transações garantem rollback integral nesses casos.

Datas financeiras são YYYY-MM-DD, interpretadas em America/Sao_Paulo. Auditoria e cotações usam ISO UTC. Não são aceitas datas futuras. Fechamentos usam [início do mês, início do próximo mês), revisão idempotente e recuperação de meses pendentes na abertura, consultas e operações. Nenhum dado é apagado na virada de mês. Saldo disponível é transportado; patrimônio acumulado não zera.

## Mercado e offline

USD/EUR/BTC usam AwesomeAPI; BTC usa CoinGecko quando COINGECKO_API_KEY estiver configurada. Ibovespa exige BRAPI_TOKEN; ouro exige GOLDAPI_KEY (USD por onça troy). Chaves ficam no backend. Não houve contratação de plano ou criação de chaves.

O backend consulta APIs antes da transação de persistência. Uma reserva temporária de coleta no SQLite evita duplicação entre processos e expira após falha abrupta. Sucesso tem cache de 24h; falha permite nova tentativa após 1h. Timeout de 10s e cancelamento no encerramento. Erros não removem a última cotação válida. O histórico usa a fonte da última cotação, sem misturar provedores.

AwesomeAPI importa até 360 registros; CoinGecko solicita 365 dias e brapi até 1 ano, conforme plano. Ouro acumula histórico a partir da ativação. Períodos incompletos são identificados, sem valores fictícios. A versão SQLite começa também com cotações vazias, preenchidas somente com dados reais de provedores. Sem internet, as finanças funcionam normalmente e o monitor exibe o último cache com data/estado de atualização.

## Backup e recuperação

`npm run db:backup -- C:/caminho/novo-backup.sqlite` cria uma cópia consistente pela API de backup SQLite. O destino deve ser absoluto, novo e ter pasta existente; arquivos existentes não são sobrescritos. No modo CLI, o comando usa SQLITE_PATH ou o banco de desenvolvimento padrão. Para copiar o banco do modo estático, configure explicitamente SQLITE_PATH com o caminho correspondente antes do comando.

Não copie apenas o arquivo .sqlite enquanto o aplicativo estiver aberto: WAL pode conter gravações recentes. Os backups automáticos de migrations usam VACUUM INTO antes da atualização.

Na Fase 6, a interface Configurações → Dados e backups passou a oferecer backup e restauração com diálogos nativos e confirmação. O procedimento e os limites estão na seção da Fase 6 abaixo. Não remova nem sobrescreva um banco corrompido para simplesmente fazer o aplicativo abrir.

## Electron e execução local

- desktop/main.cjs: janela, caminho SQLite, instância única e ciclo de vida.
- desktop/preload.cjs: base relativa /api e, a partir da Fase 6, três operações específicas de gerenciamento de dados, sem caminhos fornecidos pelo renderer.
- desktop/backend.cjs: Express, SQLite e Vite quando em desenvolvimento.
- desktop/config.cjs: configuração da janela e seleção de modo.

contextIsolation/sandbox/webSecurity habilitados; nodeIntegration desabilitado. O processo principal injeta uma capacidade temporária somente nas requisições da janela ao backend; ela não é uma sessão de usuário nem é exposta ao React. O backend fica em loopback, sem publicação em rede. Host, Origin, Sec-Fetch-Site e tipos de conteúdo são verificados. Produção planejada serve assets e /api na mesma origem HTTP local; não depende de file://. Novas janelas e navegações remotas são bloqueadas; a atribuição CoinGecko é validada e aberta no navegador padrão.

Fechar o aplicativo cancela consultas externas, interrompe o agendador, fecha Vite/HTTP e a conexão SQLite. O ícone do aplicativo fica em assets/icons/financeiro.ico; a fonte vetorial e as prévias PNG estão no mesmo diretório.

## Fase 4 — Integração dos serviços

Electron e Express avulso compartilham services/runtime.cjs, que controla os estados new/ready/stopping/stopped/failed. A inicialização abre e valida SQLite antes de aceitar operações. O agendador inicia somente uma vez. O encerramento pausa novos trabalhos, cancela/aguarda consultas de mercado e tarefas pendentes e fecha a conexão SQLite. Chamadas repetidas de encerramento compartilham a mesma operação.

server.js expõe startLocalServer para o modo avulso; SIGINT/SIGTERM acionam o fechamento coordenado. O backend Electron usa o mesmo runtime, mantendo seu gerenciamento de Vite e do servidor HTTP. Durante a parada, novas requisições recebem HTTP 503 com Retry-After, antes de chegar aos serviços financeiros. O runtime encerrado não é reiniciado no mesmo processo: uma nova execução abre os dados existentes normalmente.

Não houve troca do transporte por IPC, mudança de schema, novas dependências ou alteração das regras financeiras/visuais nesta fase. O fluxo continua React → Express → serviços → repositórios → SQLite. A comunicação IPC existente no Electron permanece restrita ao controle do processo de backend.

Validação da Fase 4: 32 testes passaram, incluindo abertura/fechamento idempotente, ordem das dependências, rejeição de chamadas durante encerramento, liberação da porta e preservação dos dados no modo avulso. Smoke tests Electron confirmaram os modos Vite/estático, reabertura SQLite e Chart.js renderizado. Lint e build passaram. Todos os testes financeiros usaram arquivos temporários próprios.

## API preservada

- GET/POST /transactions; PUT/DELETE /transactions/:id.
- GET /dashboard e /dashboard/categories, com month=YYYY-MM.
- GET /finance/categories; GET/POST /finance/accounts.
- GET /finance/wealth; POST /finance/valuations.
- GET /market?code=USD|EUR|BTC|IBOV|GOLD&days=7|30|180|365.

No Electron, esses caminhos recebem prefixo /api. No modo web, continuam nos caminhos anteriores. Não há autenticação de usuário.

## Testes

Resultado atualizado na Fase 7: 54 testes automatizados passaram; lint e build do React passaram; smoke tests Electron/SQLite estático, Vite e do executável empacotado passaram, incluindo backup/restauração, reabertura do arquivo e Chart.js renderizado. O instalador foi testado em Windows 10; detalhes e limites na seção da Fase 7.

- `npm test`: testes SQLite/HTTP em arquivos temporários próprios. Não requer PostgreSQL.
- `npm run desktop:smoke`: build React e testes Electron nos modos estático/Vite, com perfis SQLite temporários. Valida criação, reabertura, saldo, Chart.js efetivamente desenhado, configuração segura, instância única, portas liberadas e arquivo corrompido preservado. Usa configuração PostgreSQL deliberadamente inacessível.
- Em frontend: `npm run lint` e `npm run build`.

Fixtures financeiras são criadas SOMENTE em arquivos temporários. Nenhum teste automatizado deve abrir o banco de desenvolvimento/produção real. Os relatórios desktop ficam em backups/, ignorados pelo Git.

## PostgreSQL preservado

O banco original dash_gastos e os backups anteriores não foram excluídos, migrados ou modificados por esta fase. A conferência somente leitura registrou 1 conta, 0 movimentações e 1082 cotações em backups/postgres-sqlite-reference.json. A nova versão começa separada e vazia.

O driver pg foi removido da execução normal após validar SQLite. database/schema.sql e database/migrations/ continuam como histórico PostgreSQL. Os scripts antigos scripts/init-development.js, scripts/migrate.js e scripts/remove-login-development.js foram preservados e apontam para database/postgres/connection.cjs; não fazem parte dos comandos npm atuais. Dependem de ferramentas/driver PostgreSQL separados e não devem ser usados para inicializar SQLite. Credenciais antigas no .env são ignoradas pela persistência nova e foram mantidas como referência; o .env.example atual contém somente as opções em uso.

## Limitações e próxima fase

O instalador Windows x64 foi gerado na Fase 7; validação em Windows limpo e assinatura permanecem pendentes. Nenhuma migração automática dos registros PostgreSQL foi feita. Restauração por interface foi implementada na Fase 6. Listagens e reconciliações ainda não têm paginação/otimização para grandes históricos. Somas que ultrapassem o inteiro SQLite de 64 bits serão rejeitadas; não são convertidas silenciosamente para ponto flutuante.


## Fase 4 — integração definitiva desktop

Arquitetura mantida: Electron inicia Express em utilityProcess, React acessa /api e serviços usam repositórios SQLite. A capacidade HTTP temporária permanece no processo principal. IPC é reservado ao ciclo de vida; não há acesso genérico ao banco ou filesystem pelo renderer.

O diretório de trabalho do backend é físico, separado dos recursos dentro de app.asar. Banco, journals e backups persistentes ficam em userData. Navegação e redirecionamentos externos são bloqueados; o cliente de produção usa /api mesmo se o preload falhar, sem fallback para servidor de desenvolvimento.

`npm run desktop:start` abre a versão estática após `npm run desktop:build`. `npm run desktop:dev` inicia também o Vite. Não é necessário iniciar backend em outro terminal.

`npm run desktop:asar-smoke` cria um ASAR temporário com código, build React, migrations e dependências do backend; exclui .env, bancos e ferramentas de desenvolvimento. Usa @electron/asar somente como dependência de desenvolvimento. Executa criação/reabertura SQLite, HTTP, Chart.js, proteção da API, instância única, encerramento normal e saída inesperada do backend. O arquivo temporário é removido ao terminar; não gera instalador. O teste usa o executável Electron de desenvolvimento abrindo ASAR: distribuição instalada e Windows limpo permanecem para a fase de empacotamento, após a Fase 5.

Relatórios de execução são escritos no perfil temporário (fora do ASAR); o script preserva os resultados em backups/. Todos os testes usam bancos temporários. O banco real e o histórico PostgreSQL permanecem preservados.

A validação concorrente identificou SQLITE_BUSY ao ativar WAL em duas primeiras aberturas simultâneas. A configuração agora repete somente essa operação por até cinco segundos; falhas continuam preservando o arquivo, sem repetir transações financeiras.

Validação final desta etapa: 33 testes Node, lint/build React, smoke Electron estático/Vite/ASAR e 100 pares de inicializações SQLite concorrentes passaram. A auditoria online registrou três avisos em dependências transitivas já existentes de Express (body-parser, proxy-addr e qs); atualizar essas dependências permanece pendente, sem atualização ampla automática nesta integração.


## Aba Planejamento

Planejamento permite adicionar, editar e excluir contas com confirmação, informando nome, data e valor. A lista é ordenada por data crescente e exibe total em BRL e quantidade. Datas passadas permanecem cadastradas até exclusão manual; o mês selecionado no dashboard não filtra esta aba.

Migration: database/sqlite/migrations/002_planning_items.sql. A tabela STRICT planning_items armazena centavos inteiros e não possui relacionamentos financeiros. O mecanismo existente aplica a migration com backup antes de atualizar bancos existentes. Tabelas financeiras são preservadas.

API Express: GET/POST /planning e PUT/DELETE /planning/:id, com prefixo /api no desktop. Escritas retornam lista, total e quantidade na mesma transação. Validações no backend: nome de 1 a 255 caracteres após trim, data válida de 0001-01-01 a 9999-12-31, valor positivo com até duas casas decimais e máximo de R$ 9.999.999.999,99 (padrão monetário existente). Soma em BigInt, sem cálculos monetários em ponto flutuante. Consultas parametrizadas e proteções HTTP existentes são reutilizadas.

Operações acessam exclusivamente planning_items: não geram despesas, movimentações, alterações patrimoniais, gráficos ou fechamentos. Não foram adicionadas bibliotecas.

Validação: 37 testes Node passaram, além de lint/build e smoke Electron estático/Vite/ASAR. Cobertura inclui CRUD, ordenação, soma exata, dados inválidos, erro de persistência com preservação do estado, reabertura, migração da versão anterior com backup e comparação de todas as tabelas financeiras antes/depois. O smoke testa a interface real do renderer: cadastro, edição, cancelamento de exclusão e exclusão confirmada, preservando uma conta de teste entre execuções. Todos usam bancos temporários; nenhum teste abre o banco real.

## Fase 5 — acesso direto e validação financeira (26/10/2026)

A auditoria encontrou o acesso sem login já implementado nas alterações locais anteriores: Login.jsx, ProtectedRoute.jsx, Login.css, controllers/auth.controller.js, routes/auth.routes.js e middlewares/auth.middleware.js já estavam removidos. App.jsx abre Dashboard em / e /dashboard; não há contexto de sessão, formulário de cadastro/recuperação ou botão de sair. JWT e bcrypt já estavam ausentes dos manifests. As dependências transitivas cookie/cookie-signature de Express e cookie/set-cookie-parser de React Router não são um sistema de sessão do aplicativo e foram preservadas.

Nenhuma rota de produção ou middleware precisou ser alterado nesta execução. A capacidade temporária X-Desktop-Capability permanece: protege o backend da instância Electron e não identifica um usuário. Context isolation, sandbox, webSecurity, preload restrito, bind em loopback e verificações de Host/Origin/Sec-Fetch-Site continuam ativos. O modo Express avulso é uma ferramenta local de desenvolvimento; a capacidade adicional é exigida no desktop. CORS não é a única proteção.

O esquema SQLite já é individual, sem tabelas de autenticação ou user_id. Não foi criada migration, removida coluna ou aberta a base financeira real. Arquivos históricos PostgreSQL e scripts legados permanecem preservados e fora da execução normal. Não execute scripts de remoção de login PostgreSQL para este aplicativo SQLite.

Alterações desta execução:

- tests/api.test.js: verificação de tabelas de autenticação e campos de usuário/credenciais em todas as tabelas do banco de testes, e resposta 404 para endpoints de login, cadastro, logout e recuperação/redefinição de senha.
- desktop/planning-smoke.cjs: verifica a abertura direta no Dashboard, ausência de campos de senha/controles de login e navegação pelas cinco abas, além do CRUD de Planejamento existente.
- README.md e frontend/README.md: registro da Fase 5 e atualização das instruções de acesso/validação.

Resultados executados nesta fase:

| Comando | Resultado |
|---|---|
| npm test | 37 testes aprovados, nenhum ignorado |
| npm --prefix frontend run lint | Aprovado |
| npm run desktop:smoke | Build e Electron estático/Vite aprovados |
| npm run desktop:asar-smoke | Build e Electron com ASAR temporário aprovados |

Os testes financeiros cobrem receitas/despesas, edição/cancelamento, saldo em centavos, consulta mensal, revisão de fechamentos, transferências/aportes/resgates, avaliações, concorrência e rollback. Mercado foi validado com provedores simulados, cache e falha de conexão, incluindo operações financeiras disponíveis offline; não é uma certificação da disponibilidade atual dos provedores reais. Planejamento mantém itens vencidos, soma valores exatamente e preserva todas as tabelas financeiras. Electron foi reaberto com o mesmo perfil temporário, preservou receitas/despesas/planejamento e renderizou Chart.js; acesso direto sem capacidade recebeu 403. Também foram validados instância única, liberação de portas, falha do backend e preservação de arquivo corrompido.

Não foi encontrada regressão funcional nesta execução. Foram corrigidas a lacuna de cobertura explícita da navegação/ausência de login e a referência desatualizada que atribuía testes de distribuição à Fase 5. O primeiro npm test foi impedido pelo sandbox ao criar subprocessos (EPERM); a execução autorizada fora dele passou. O aviso experimental de node:sqlite permanece visível; a mensagem ERR_SQLITE_ERROR no teste de Planejamento é uma falha de persistência provocada intencionalmente, com preservação de estado verificada.

Pendências para a Fase 6, sujeitas a nova autorização: definir e validar empacotamento/instalação em Windows limpo, assinatura e distribuição. Avisos transitivos de dependências registrados anteriormente continuam uma pendência; não foi executada nova auditoria online nesta fase. Não foi gerado instalador nem iniciada a próxima fase.

## Fase 6 — segurança, backup e offline (26/10/2026)

O escopo aprovado para a Fase 6 é segurança, gerenciamento de dados e offline. A menção a empacotamento nas pendências históricas da Fase 5 foi supersedida pelo pedido desta fase: o instalador Windows pertence à Fase 7, que não foi iniciada.

Diagnóstico: a arquitetura local, capacidade temporária, WAL, transações, migrations, integridade referencial e cache de mercado já existiam. Faltavam interface de backup/restauração, coordenação da troca de banco e logs persistentes. Nenhuma regra financeira, tabela ou migration existente foi modificada, e nenhuma dependência foi adicionada.

### Uso e localização dos dados

- Abra o Electron e entre em **Configurações → Dados e backups**. O modo web não oferece essas operações privilegiadas.
- Banco estático: `%APPDATA%/DashGastosDesktop/data/dash-gastos.sqlite`.
- Banco Electron de desenvolvimento: `%APPDATA%/DashGastosDesktop/development/dash-gastos.sqlite`.
- Logs: `%APPDATA%/DashGastosDesktop/logs/application.log` e `application.log.1`.
- Backups de segurança de restauração: subpasta `backups` ao lado do banco em uso, com nome `before-restore-<id>.sqlite`.
- Data do último backup manual pela interface: `last-backup.json` ao lado do banco. É um registro local da criação, não uma garantia de que o arquivo externo ainda existe. Backups do CLI/migrations não atualizam essa data.

O banco continua fora do código, instalação e ASAR. Reabrir reutiliza o arquivo. A pasta de dados e sua identidade devem ser preservadas nas futuras atualizações.

### Criar backup

1. Clique em **Criar backup** e escolha um arquivo novo no diálogo do Windows. Cancelar mantém os dados.
2. O backend usa a API de backup SQLite, incluindo escritas já confirmadas em WAL; não copia diretamente o banco ativo. A cópia temporária é convertida em um SQLite independente, sem depender de `-wal` ou `-shm`.
3. Antes de informar sucesso, verifica integridade completa, referências, migrations/checksums e estrutura esperada. O destino é criado sem sobrescrever arquivo existente e os dados são sincronizados com o armazenamento.

As finanças não são pausadas para produzir o snapshot. Validação/cópia de bancos grandes pode atrasar respostas do backend durante a operação; a interface permanece em processo separado. O CLI `npm run db:backup -- C:/caminho/novo.sqlite` reutiliza a mesma criação/validação. Guarde outra cópia em mídia separada: backups locais não protegem contra perda do disco. Arquivos SQLite e backups não são criptografados e dependem das permissões da conta Windows.

### Restaurar backup

1. Feche qualquer execução web/CLI que utilize o mesmo banco. Em **Restaurar backup**, selecione uma cópia diferente do arquivo em uso.
2. O arquivo é aberto somente para leitura, validado e copiado pela API SQLite para um estágio privado no diretório de dados. O original selecionado não é migrado nem alterado pelo aplicativo.
3. O diálogo nativo pede confirmação explícita; **Cancelar** é a opção padrão. Sem confirmação não há substituição. A restauração inclui finanças, planejamento e mercado, substituindo integralmente os dados atuais.
4. Após confirmar, o runtime bloqueia a API com HTTP 503, pausa o agendador, aguarda trabalhos/consultas de mercado e fecha a conexão. Só então cria e valida o backup de segurança do banco atual. Arquivos auxiliares ainda presentes fazem a operação recusar a troca, para evitar substituir banco em uso.
5. O banco anterior fica preservado durante a troca. Um registro `.restore-pending` permite recuperar uma interrupção entre renomeações. A cópia substituta é validada e aberta antes de confirmar a conclusão. Em falha, o banco anterior é recuperado; o candidato rejeitado também é preservado em `backups` quando necessário.
6. A conexão e o agendador voltam a funcionar e a interface é recarregada para descartar valores anteriores. Fechar durante uma operação aguarda sua conclusão antes do encerramento normal.

Compatibilidade conservadora: a restauração aceita somente a mesma coleção de migrations/checksums e o mesmo esquema deste aplicativo. Bancos antigos, mais novos, desconhecidos, vazios, com triggers/objetos adicionais ou estrutura alterada são recusados; não há conversão automática de backups entre versões nesta fase. A restauração não mescla registros. Mantenha espaço livre para o estágio, banco anterior e cópia de segurança; os backups não têm limpeza automática.

### Recuperação e erros

Ao encontrar uma restauração interrompida, o Electron tenta concluir a recuperação **antes** de abrir SQLite ou aplicar migrations. Outras aberturas pelo adaptador são recusadas enquanto existir `.restore-pending`, evitando criar um banco vazio no intervalo da troca. Se a recuperação não puder ser concluída por permissões, bloqueio ou corrupção, os serviços permanecem indisponíveis; não há fallback que apague/recrie o banco.

Nesse caso, feche o aplicativo e os processos que possam usar o arquivo, preserve **toda** a pasta de dados (incluindo `.restore-pending`, `backups` e eventuais journals), corrija espaço/permissões e reabra o Electron. Se continuar falhando, use os logs e uma cópia da pasta para diagnóstico; não exclua o registro pendente nem substitua arquivos com processos abertos. Uma falha durante a preparação pode deixar uma pasta `.restore-stage-*`; ela não é o banco ativo e deve ser preservada junto aos demais arquivos até resolver a recuperação.

Os logs registram data UTC, evento e códigos técnicos allowlisted, incluindo causa/erro SQLite quando disponíveis. Não registram SQL, corpos HTTP, descrições/valores financeiros, credenciais, caminhos escolhidos ou stack traces. Há rotação em aproximadamente 512 KiB por arquivo, com uma geração anterior; falha de log não interrompe a operação financeira. Mensagens de inicialização distinguem banco, interface ausente e serviços locais. Falhas de espaço, acesso, arquivo incompatível e recuperação têm mensagens próprias na área de dados.

Os testes de interrupção cobrem saída abrupta de processo e recuperação de estado intermediário; não simulam perda física de energia, defeito de disco ou todas as combinações de antivírus/sistemas de arquivos. A cópia de segurança permanece necessária.

Se o banco ativo estiver corrompido e impedir a inicialização, o aplicativo preserva o arquivo e interrompe a abertura; a tela de restauração depende do backend disponível. Essa situação exige recuperação assistida com os processos fechados e preservação da pasta completa. Não há nesta fase um assistente separado de restauração antes da inicialização.

### Segurança e offline

O renderer mantém contextIsolation/sandbox/webSecurity e não recebe Node, SQL, caminhos arbitrários ou a capacidade HTTP. O preload expõe apenas `data.status()`, `data.backup()` e `data.restore()`, sem parâmetros. O processo principal valida janela, frame principal e origem em cada chamada IPC; diálogos nativos escolhem arquivos e confirmam restauração. Caminhos seguem somente pelo canal privado principal/backend; não existem endpoints HTTP de backup/restauração. O backend continua restrito a 127.0.0.1, com capacidade temporária no desktop e verificações de Host/Origin/Sec-Fetch-Site/conteúdo além de CORS. O modo Express avulso permanece uma ferramenta local de desenvolvimento, sem a capacidade adicional da instância Electron.

Receitas, despesas, extrato, fechamento, reservas, investimentos, planejamento, backup/restauração e gráficos locais não exigem internet. Somente Mercado usa os provedores já existentes. As últimas cotações e suas datas continuam visíveis, com indicação de erro/dados antigos; falha mantém o cache e permite nova tentativa após uma hora, e sucesso mantém intervalo de 24 horas. Consultar cache não força coleta externa. Não há novo serviço externo.

### Validação e arquivos

Validação da fase: **52 testes Node aprovados**, lint/build React e smoke Electron estático/Vite/ASAR. Os testes usam exclusivamente bancos/perfis temporários. Cobrem snapshots com WAL, cópia completa, destino existente, arquivo inválido/estrutura adulterada, cancelamento, restauração válida, backup de segurança, falha injetada, processo encerrado abruptamente, recuperação, API bloqueada durante manutenção, encerramento concorrente e logs sem dados sensíveis. O cenário offline exercita todos os módulos por HTTP local com requisições externas rejeitadas. O smoke aciona a interface de criação de backup e o preload/IPC reais para restaurar, com respostas de diálogos simuladas em perfis temporários; verifica recarga, reabertura e Chart.js. Os smoke tests não fazem consultas reais a provedores financeiros nesta fase.

Arquivos criados: `database/sqlite/data-management.cjs`, `desktop/data-controller.cjs`, `desktop/data-smoke.cjs`, `services/diagnostics.cjs`, `frontend/src/components/DataSettings.jsx`, `tests/data-management.test.js`, `tests/data-controller.test.js`, `tests/diagnostics.test.js` e `tests/offline.test.js`.

Arquivos modificados: `database/sqlite/connection.cjs`, `db.js`, `desktop/main.cjs`, `desktop/backend.cjs`, `desktop/preload.cjs`, `services/runtime.cjs`, `services/market.js`, `services/background.js`, `server.js`, `frontend/src/pages/Dashboard.jsx`, `scripts/desktop-smoke.cjs`, `tests/service-runtime.test.js`, `README.md` e `frontend/README.md`.

Problema encontrado e corrigido: uma conexão somente para leitura no backup de segurança podia deixar auxiliares WAL e provocar uma recusa indevida de banco em uso. O fluxo fecha a conexão responsável e produz snapshots independentes. Também foram corrigidas a codificação de uma mensagem antiga no backend e a possibilidade de reabrir/criar banco após falha que exige recuperação. Nenhum dado financeiro real foi aberto, restaurado ou alterado nos testes.

Pendências para a **Fase 7 — Empacotamento Windows (.exe)**: instalador, execução em Windows limpo, assinatura, distribuição e validação de atualização preservando userData. O aviso experimental de node:sqlite no Node CLI continua visível. Avisos de dependências registrados em fases anteriores não foram reavaliados online ou atualizados amplamente nesta fase. Não foi criado instalador nem iniciada a Fase 7.

## Fase 7 — instalador Windows Financeiro (26/10/2026)

Ferramenta: **electron-builder 26.18.0**, fixada como dependência de desenvolvimento. A versão do aplicativo permanece **1.0.0**. O produto, executável, janela, atalhos e entrada de desinstalação usam o nome **Financeiro**; a interface financeira foi preservada. AppId estável: `br.com.kayanlucas.financeiro`.

### Instalar e executar

Execute `dist-installer/Financeiro-Setup-1.0.0.exe` e siga o assistente NSIS. A instalação é para o usuário atual, permite escolher o diretório e cria atalhos na área de trabalho e no menu Iniciar. Não exige elevação administrativa por configuração. Depois, abra **Financeiro** pelo atalho. Para remover o programa, use a entrada de desinstalação do Windows.

O usuário final não precisa de terminal, Node.js, npm, Vite ou PostgreSQL. O runtime Electron acompanha o programa e inicia o Express/SQLite automaticamente. O executável e instalador usam o subsistema gráfico do Windows. Fechar a janela encerra os serviços locais.

A pasta de dados foi mantida em `%APPDATA%/DashGastosDesktop/data/dash-gastos.sqlite`, independentemente do novo nome visível. A pasta de desenvolvimento continua separada. O instalador não contém banco pessoal nem substitui essa pasta; a desinstalação está configurada para preservar os dados. Atualizações futuras devem manter o mesmo AppId e caminho de dados. Faça backup antes de reinstalar/atualizar. A primeira execução sem banco cria a estrutura e aplica as migrations existentes, sem importar PostgreSQL.

### Build reproduzível

Em Windows x64, com Node 24.13 ou superior instalado apenas na máquina de desenvolvimento:

```powershell
npm ci
npm --prefix frontend ci
npm run desktop:installer
```

O comando final faz a limpeza verificada do frontend gerado, compila React, verifica recursos/versão do Electron e gera NSIS x64. Usa a distribuição Electron 45.0.0 já instalada em node_modules/electron/dist. Não há addon SQLite externo: `node:sqlite` acompanha o runtime e `npmRebuild` fica desabilitado. A execução empacotada confirmou Electron 45.0.0, Node 24.22.0 e SQLite 3.53.4.

| Comando | Finalidade |
|---|---|
| `npm run desktop:dev` | Vite, backend e Electron em desenvolvimento |
| `npm run desktop:build` | Limpar e compilar React para produção |
| `npm run desktop:prepare` | Build React e conferência de main/preload/backend, migrations, ICO e versão do runtime |
| `npm run desktop:package` | Executável Windows x64 com recursos em `dist-installer/win-unpacked` |
| `npm run desktop:installer` | Instalador NSIS x64 completo |
| `npm run icons:generate` | Regenerar SVG, PNGs e ICO em Windows |
| `npm run desktop:verify-package` | Conferir ASAR, arquitetura, subsistema gráfico, ícones embutidos e gerar SHA-256 |
| `npm run desktop:packaged-smoke` | Testar o executável empacotado com bancos temporários |
| `npm run desktop:install-smoke` | Instalar, testar, reinstalar e desinstalar em diretório isolado |

Saídas: `dist-installer/Financeiro-Setup-1.0.0.exe`, `win-unpacked/Financeiro.exe` e recursos. O diretório win-unpacked deve permanecer completo para execução sem instalar; não distribua apenas o Financeiro.exe solto. O instalador já contém tudo. O arquivo `.blockmap` é um artefato auxiliar do builder; não foi instalado mecanismo de atualização automática e não há publicação automática.

O build inclui main/preload/backend, serviços, repositórios, rotas, migrations SQLite, dependências de produção, frontend compilado e ICO. A conferência do ASAR recusaria bancos, `.env`, backups, logs, addons `.node`, PostgreSQL, Vite, electron-builder ou a pasta de testes. Pequenos helpers de autodiagnóstico desktop permanecem disponíveis apenas pelo modo de smoke, que nos testes usa perfis temporários; não carregam fixtures pessoais. Chaves opcionais dos provedores de Mercado não são distribuídas no instalador.

### Ícone e assinatura

Fontes em `assets/icons`: `financeiro.svg` com contornos vetoriais, `financeiro.ico` verdadeiro e PNGs de 16, 32, 48, 64, 128, 256 e 512 pixels. A arte tem cifrão branco, fundo verde-esmeralda e cantos arredondados. O ICO contém seis imagens de 16 a 256 pixels. Não é um PNG renomeado. O script usa System.Drawing do Windows; os arquivos prontos não dependem de fontes.

O mesmo ICO é usado no executável, instalador, desinstalador e janela; atalhos usam o ícone do executável. O AppUserModelId do Electron coincide com o AppId para agrupamento na barra de tarefas. O verificador compara os bytes de todas as imagens embutidas nos recursos PE do executável e do instalador com o ICO fonte.

Esta versão é **sem assinatura digital**, confirmada como `NotSigned`. O Windows/SmartScreen pode apresentar avisos de editor desconhecido. Nenhuma política do Windows, SmartScreen ou Defender foi alterada. A edição dos recursos PE continua habilitada para gravar o ícone. Para assinatura futura, configure `FINANCEIRO_SIGNING=1` e as variáveis seguras `WIN_CSC_LINK` e `WIN_CSC_KEY_PASSWORD` na máquina de build; não grave certificado/senha no repositório. Certificado não é exigido nesta entrega.

### Testes executados e limites

- **54 testes Node aprovados**, incluindo finanças, offline, integridade, backup/restauração, NSIS e estrutura completa do ICO. Lint e build React aprovados.
- Smoke estático e Vite aprovados após os ajustes de nome/ícone e dependências.
- O Financeiro.exe empacotado criou o SQLite na primeira execução sem arquivo, executou receitas/despesas, edição, cancelamento, consulta de extrato e conferência de saldo pelo HTTP protegido, renderizou Chart.js e validou CRUD de Planejamento, backup, cancelamento e restauração. Reabertura, instância única, bloqueio de acesso sem capacidade, encerramento/liberação de portas e saída inesperada do backend foram exercitados.
- Os processos empacotados foram executados com PATH limitado a System32 e consultas externas do backend simuladas como indisponíveis. O driver dos testes usa Node na máquina de desenvolvimento; o programa instalado utiliza seu próprio runtime. Isso comprova a independência do PATH, mas não equivale a uma máquina fisicamente sem Node.
- Instalador executado em **Windows 10 build 19045**, em diretório de teste com acentos. Criou atalhos na área de trabalho e menu Iniciar apontando para o executável instalado. O smoke passou usando o programa instalado e voltou a passar após reinstalação da mesma versão com o mesmo perfil temporário. A desinstalação removeu programa, atalhos e entrada de desinstalação; o banco temporário foi preservado sem alteração de hash. A instalação de teste foi removida ao final.
- Toda gravação financeira/restauração usou bancos temporários. O banco real não foi aberto nem migrado nos testes. A localização padrão foi preservada por configuração; não foi feita reinstalação sobre uma instalação pessoal existente.
- Verificação do pacote: executável x64/GUI, ícone de seis resoluções no executável/instalador, frontend sem chunks antigos e nenhum arquivo privado ou addon SQLite. SHA-256 em `dist-installer/Financeiro-Setup-1.0.0.exe.sha256`; resultados em `package-verification.json` e `windows-install-smoke.json`. Os relatórios detalhados de runtime ficam em backups/, sem os bancos temporários.

Limitações: não houve teste em Windows limpo, Windows 11 ou migração entre duas versões diferentes do aplicativo. Reinstalar a mesma versão não certifica migrations futuras. Os diálogos de backup/restauração tiveram respostas simuladas nos smoke tests; o preload, IPC, SQLite e programa instalado foram reais. Não houve simulação de falha física de energia. Validação visual de todos os estados do Explorer/barra de tarefas depende do Windows; foram conferidos a arte, os recursos PE e os atalhos. O aviso experimental de SQLite continua no Node CLI. As limitações de restauração da Fase 6 continuam aplicáveis.

### Problemas corrigidos e arquivos

O Node 24.13 deste Windows deixou diretórios com caminho acentuado intactos ao usar `fs.rmSync` recursivo, sem lançar erro; isso permitia acumular chunks antigos do frontend. A falha foi reproduzida em diretório descartável. O build agora verifica o destino gerado, remove arquivos com unlink/rmdir e confirma a remoção antes de compilar; recusa diretório redirecionado ou que contenha bancos/repositório. O verificador do pacote também rejeita assets que não estejam referenciados pelo HTML atual. A conferência ASAR foi ajustada para separadores nativos de caminho no Windows.

A auditoria npm confirmou os três avisos antigos do Express. Foram atualizados os transitivos compatíveis para body-parser 2.4.0, proxy-addr 2.0.8 e qs 6.16.1, mantendo Express 5.2.1. O npm reportou **zero vulnerabilidades na árvore da raiz** após a atualização. Não foi feita atualização ampla da stack. Avisos de pacotes de desenvolvimento descontinuados vindos do builder não impediram o build.

Uma execução do teste de instalação encontrou indisponibilidade do cmdlet Get-FileHash no processo PowerShell. O script passou a calcular SHA-256 diretamente pela API .NET. A instalação temporária pendente foi desinstalada com conferência de caminho e preservação do banco; o teste completo do instalador final foi repetido e todos os resultados ficaram aprovados, sem deixar a instalação de teste ativa.

Criados: `electron-builder.cjs`, `assets/icons/*`, `scripts/generate-icon.ps1`, `scripts/clean-frontend.cjs`, `scripts/desktop-prepare.cjs`, `scripts/packaged-smoke.cjs`, `scripts/verify-package.cjs`, `scripts/windows-install-smoke.ps1`, `desktop/finance-smoke.cjs` e `tests/packaging.test.js`.

Modificados: `package.json`, `package-lock.json`, `desktop/main.cjs`, `desktop/config.cjs`, `scripts/desktop-smoke.cjs`, `scripts/desktop-asar-smoke.cjs`, `.gitignore`, `README.md` e `frontend/README.md`. Artefatos de build e relatórios em dist-installer são ignorados pelo Git. As alterações locais das fases anteriores foram preservadas; não houve commit/push ou remoção do histórico PostgreSQL.

Pendências para a **Fase 8**, somente após nova autorização: definir o escopo da fase, testar em Windows limpo/Windows 11 e validar atualização entre versões distintas; avaliar assinatura digital caso necessária. Nenhuma atualização automática ou funcionalidade financeira nova foi adicionada. A Fase 8 não foi iniciada.
