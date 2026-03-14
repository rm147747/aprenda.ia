# Aprenda.AI

Plataforma educacional com IA para aprendizado personalizado de criancas, com foco em TDAH.

## Funcionalidades

- **Selecao de crianca**: Raphaela (10), Francisco (8), Antonio (7)
- **Entrada de conteudo**: texto, PDF, DOCX, imagens
- **Microaulas com IA**: GPT-4o gera aulas adaptadas por idade
- **Quiz interativo**: verificacao de aprendizagem com feedback
- **Revisao adaptativa**: reforco de pontos fracos
- **Painel dos pais**: metricas, sessoes, recomendacoes
- **Estrategias TDAH**: blocos curtos, checkpoints, reforco positivo, gamificacao leve

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: FastAPI (Python 3.12) + SQLite + OpenAI GPT-4o
- **Parsing**: PyMuPDF (PDF), python-docx (DOCX), GPT-4o Vision (imagens)

## Credenciais

- **Login familia**: `familiabrandao` / `12345`
- **PIN dos pais**: `1234`

## Setup Local

### Backend

```bash
cd aprendaai-backend
cp .env.example .env
# Edite .env com sua OPENAI_API_KEY
poetry install
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd aprendaai-frontend
npm install
npm run dev
# Acesse http://localhost:5173
```

### Build e Deploy (same-origin via proxy)

```bash
# Build frontend
cd aprendaai-frontend
npm run build

# Copiar build para backend/static
cp -r dist ../aprendaai-backend/static

# Iniciar backend
cd ../aprendaai-backend
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000

# Iniciar proxy (serve frontend + proxies API)
cd ..
python proxy.py
# Acesse http://localhost:3000
```

## Estrutura

```
aprendaai/
├── aprendaai-backend/     # FastAPI backend
│   ├── app/
│   │   ├── main.py        # App principal + rotas estaticas
│   │   ├── config.py      # Configuracoes
│   │   ├── database.py    # SQLite + modelos
│   │   ├── ai_service.py  # Integracao GPT-4o
│   │   ├── extraction.py  # Pipeline PDF/DOCX/imagem
│   │   ├── prompts.py     # Prompts do sistema
│   │   ├── routes_auth.py # Autenticacao familia
│   │   ├── routes_children.py
│   │   ├── routes_sessions.py
│   │   └── routes_parents.py
│   ├── pyproject.toml
│   └── .env.example
├── aprendaai-frontend/    # React frontend
│   ├── src/
│   │   ├── api/client.ts  # Cliente API
│   │   ├── App.tsx        # Roteamento principal
│   │   ├── pages/         # Todas as telas
│   │   └── types/         # TypeScript types
│   ├── index.html
│   └── package.json
├── gateway/               # Pagina de login gateway
│   └── index.html
├── proxy.py               # Reverse proxy (frontend + API)
└── README.md
```
