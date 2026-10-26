# Frontend — Financeiro

React, Vite e Chart.js. Configuração e regras completas no README da raiz.

- `npm run dev`: desenvolvimento.
- `npm run lint`: análise estática.
- `npm run build`: produção.
- `npm run preview`: conferir build.

Configure VITE_API_URL em .env conforme .env.example. Nunca coloque segredos em variáveis VITE_.

Dashboard mostra indicadores mensais, saldo disponível ao fim do período e reservas/investimentos atuais. Extrato permite seleção mensal, edição, cancelamento e transferência entre contas. Patrimônio oferece contas, ajustes de saldo inicial e avaliações de investimento. Mercado mostra dados do backend com fonte, unidade, data e estados de indisponibilidade.

Os valores são strings decimais na API; a conversão numérica no frontend é para exibição e Chart.js. A composição dos saldos totais usa centavos inteiros (BigInt). Filtros do extrato não alteram a distribuição das despesas.

Acesso direto em `/` e `/dashboard`, sem tela de login, cadastro, token ou botão Sair. Vite e preview vinculam-se a 127.0.0.1. Não publique a API local por túneis ou proxies.

No desktop, execute `npm run desktop:dev` na raiz ou `npm run desktop:build` seguido de `npm run desktop:start`. Electron inicia o backend automaticamente e abre o dashboard na própria janela. A proteção temporária da comunicação é gerenciada pelo processo principal, sem sessão de usuário ou credenciais no React.

Fase 5: lint/build e smoke tests Electron estático/Vite/ASAR aprovados. O smoke verifica abertura direta, ausência de campos de senha e controles de login, navegação em Dashboard/Extrato/Patrimônio/Mercado/Planejamento, Chart.js e CRUD/persistência de Planejamento. Os testes usam perfis SQLite temporários; consulte o relatório no README da raiz.

Persistência atual: SQLite no backend. Os contratos continuam usando strings decimais; a interface formata dinheiro sem somas de ponto flutuante. O renderer não acessa o arquivo SQLite. Consulte o README da raiz para caminhos separados de desenvolvimento, produção planejada e testes.

Fase 6: **Configurações → Dados e backups** oferece criação de backup consistente, data do último backup e restauração pelo Electron. A seleção de arquivos e a confirmação são diálogos nativos; o React não recebe caminhos nem acesso genérico a arquivos/IPC. A restauração pausa os serviços, cria cópia de segurança, valida a substituição e recarrega a interface. No modo web os botões ficam indisponíveis, com orientação para abrir o desktop.

Todas as finanças e gráficos locais funcionam sem internet. Mercado mostra cache com datas, erro e indicação de cotação antiga. Consulte o README da raiz para compatibilidade de backups, localização de logs e recuperação em caso de falha.

Release final 1.0.0: Axios 1.20.0, React Router DOM 7.18.4 e Vite 8.3.5, com mínimos compatíveis e lockfile atualizado. A auditoria npm do frontend passou sem alertas reportados. O renderer também validou a seleção do mês limite 1900-01 e retorno ao mês atual. Guia consolidado em [README da raiz](../README.md) e resultados/ressalvas em [relatório da release](../docs/RELEASE_1.0.0.md).

Fase 7: o nome do programa Windows é **Financeiro**, com ícone de cifrão personalizado. Para gerar o instalador completo, use `npm run desktop:installer` na raiz. O build desktop limpa e compila a interface antes de empacotar; não exige Vite, Node.js ou terminal no computador do usuário final. A interface financeira e a pasta persistente DashGastosDesktop foram preservadas. Resultados e limitações da instalação estão no README da raiz.
