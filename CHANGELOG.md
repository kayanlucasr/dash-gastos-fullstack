# Changelog

## 1.0.0 — 26/10/2026

Release pessoal Windows x64, classificada como **APROVADA COM RESSALVAS** no ambiente validado.

- Electron inicia backend e SQLite automaticamente e abre o Dashboard sem login.
- Receitas/despesas, extrato mensal, transferências, fechamentos, reservas/investimentos e avaliações com centavos inteiros e transações.
- Planejamento independente, com CRUD, soma e persistência; Mercado com histórico, datas, cache e falha offline controlada.
- Backup consistente, confirmação nativa para restauração, cópia preventiva e recuperação de interrupções.
- Instalador NSIS Financeiro, ícone original de cifrão, atalhos e desinstalação que preserva dados.

Estabilização final:

- Corrigida a comparação anterior ao selecionar janeiro de 1900.
- Rejeitado limite mensal que extrapolaria o calendário de quatro dígitos.
- Corrigida a limpeza de temporários/marcadores de backup e restauração em caminhos Windows com acentos.
- Atualizados pacotes compatíveis do frontend; Axios 1.20.0, React Router DOM 7.18.4 e Vite 8.3.5, com lockfile e auditorias sem alertas reportados.
- Acrescentados testes de fronteira, caminhos acentuados e atualização controlada 0.9.9 → 1.0.0 em identidade separada da instalação pessoal.
- Consolidados README, histórico técnico e relatório final.

Validação: 57 testes Node, lint/build, Electron estático/Vite/ASAR, cinco reaberturas do executável final, backup/restauração, offline e instalação/upgrade/desinstalação isolados em Windows 10. Consultas públicas reais de USD/EUR/BTC passaram. Consulte [o relatório](docs/RELEASE_1.0.0.md) para evidências e ressalvas.

Sem assinatura, atualização automática ou publicação remota. Windows limpo/Windows 11 e provedores com credenciais permanecem não testados; o upgrade controlado não certifica migrations futuras. Dados pessoais não foram usados nos testes.
