# README.md

# Login API 🔐

API de autenticação desenvolvida com Node.js, Express, PostgreSQL, JWT e Bcrypt.

## Tecnologias utilizadas

* Node.js
* Express
* PostgreSQL
* JWT (JSON Web Token)
* Bcrypt
* Dotenv

---

# Funcionalidades

* Cadastro de usuários
* Login de usuários
* Criptografia de senha
* Geração de token JWT
* Middleware de autenticação
* Rota protegida

---

# Estrutura do projeto

```bash
login-funcional/
│
├── controllers/
│   └── auth.controller.js
│
├── middlewares/
│   └── auth.middleware.js
│
├── routes/
│   └── auth.routes.js
│
├── .env
├── db.js
├── server.js
├── package.json
```

---

# Instalação

## Clonar repositório

```bash
git clone https://github.com/kayanlucasr
```

## Entrar na pasta

```bash
cd login-funcional
```

## Instalar dependências

```bash
npm install
```

---

# Configuração do banco de dados

Criar um banco PostgreSQL chamado:

```sql
login
```

Criar a tabela:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

# Configurar variáveis de ambiente

Criar um arquivo `.env` baseado no `.env.example`

---

# Rodar projeto

```bash
node server.js
```

Servidor:

```bash
http://localhost:3000
```

---

# Rotas

## Cadastro

### POST

```bash
/auth/register
```

Body:

```json
{
  "nome": "Kayan",
  "email": "teste@email.com",
  "senha": "123456"
}
```

---

## Login

### POST

```bash
/auth/login
```

Body:

```json
{
  "email": "teste@email.com",
  "senha": "123456"
}
```

---

## Rota protegida

### GET

```bash
/profile
```

Header:

```bash
Authorization: Bearer SEU_TOKEN
```

---

# Exemplo de resposta JWT

```json
{
  "message": "Login realizado com sucesso",
  "token": "eyJhbGciOi..."
}
```

---

# .env.example

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua_senha
DB_NAME=login
JWT_SECRET=sua_chave_super_secreta
```

---

# Autor

Desenvolvido por Kayan Lucas.
