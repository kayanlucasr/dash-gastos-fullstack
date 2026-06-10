# 💰 Dash Gastos

Dashboard Financeiro Full Stack desenvolvido para controle de receitas e despesas.

O projeto permite autenticação de usuários, gerenciamento de transações financeiras e visualização de indicadores através de dashboard e gráficos.

---

## 🚀 Tecnologias Utilizadas

### Frontend

- React
- Vite
- React Router DOM
- Axios
- Chart.js
- React Chartjs 2
- CSS3

### Backend

- Node.js
- Express
- JWT (JSON Web Token)
- PostgreSQL
- Bcrypt
- Dotenv

### Banco de Dados

- PostgreSQL

---

## 📋 Funcionalidades

### Autenticação

✅ Cadastro de usuários

✅ Login

✅ Geração de Token JWT

✅ Rotas protegidas

---

### Dashboard Financeiro

✅ Total de receitas

✅ Total de despesas

✅ Saldo atualizado

✅ Gráfico de despesas por categoria

---

### Transações

✅ Criar transações

✅ Listar transações

✅ Editar transações

✅ Excluir transações

✅ Categorizar receitas e despesas

✅ Filtro por tipo (Receitas e Despesas)

---

## 📸 Demonstração

### Dashboard

- Cards de Receitas
- Cards de Despesas
- Cards de Saldo
- Gráfico de categorias
- Lista de transações

---

## 🗄 Estrutura do Projeto

### Backend

```bash
backend/
│
├── controllers/
├── middlewares/
├── routes/
├── db.js
├── server.js
└── .env
```

### Frontend

```bash
frontend/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── styles/
│   └── App.jsx
```

---

## ⚙️ Instalação

### Clonar projeto

```bash
git clone https://github.com/seuusuario/dash-gastos.git
```

### Backend

```bash
cd backend

npm install

npm run dev
```

### Frontend

```bash
cd frontend

npm install

npm run dev
```

---

## 🔑 Variáveis de Ambiente

Crie um arquivo `.env`

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua_senha
DB_NAME=dash_gastos

JWT_SECRET=sua_chave_secreta
```

---

## 📊 Banco de Dados

Tabelas principais:

### users

```sql
id
nome
email
senha
```

### categories

```sql
id
nome
```

### transactions

```sql
id
descricao
valor
tipo
data
user_id
category_id
```

---

## 🎯 Objetivo do Projeto

Projeto desenvolvido para prática de desenvolvimento Full Stack utilizando React, Node.js e PostgreSQL, aplicando conceitos de:

- Autenticação JWT
- CRUD Completo
- API REST
- Banco de Dados Relacional
- Consumo de API
- Componentização React
- Controle de Estado
- Gráficos e Dashboards

---

## 👨‍💻 Autor

Kayan Lucas

Estudante de Análise e Desenvolvimento de Sistemas com foco em Desenvolvimento Full Stack.

LinkedIn: https://www.linkedin.com

GitHub: https://github.com