# CHANGELOG — feat/spacing-and-approval-gate

## Patch A — Repetição espaçada (Leitner)

- **A1** Nova tabela `review_items(id, child_id, source_session_id, concept_key, prompt, options_json, correct_option, hint, box, next_review_at, last_result, lapses, created_at, updated_at)` com `UNIQUE(child_id, concept_key)` e índice em `(child_id, next_review_at)`.
- **A2** Helper `app/review_engine.py` (`concept_key`, `upsert_quiz_items`). Quiz de toda aula aprovada (auto ou manual) é semeado na fila Leitner com `box=0` e vencimento imediato. `INSERT OR IGNORE` preserva o agendamento de itens repetidos.
- **A3** `POST /api/sessions/{id}/quiz-response` agora avança/reseta o box do item correspondente. **Só a 1ª tentativa** por questão dentro de uma sessão atualiza o cronograma. Intervalos por box: `[0, 1, 3, 7, 16]` dias. Acerto → `box=min(box+1,4)`; erro → `box=0, lapses+=1, next_review_at=now`.
- **A4** `GET /api/children/{id}/due?limit=10` — itens devidos agora, com interleaving leve (top 2N ordenado por vencimento → embaralha → corta N).
- **A5** `POST /api/review-items/{id}/answer` — responder itens fora de uma sessão (usado pela "Revisão do dia").
- **A6** Frontend: card "Revisão do dia (N)" por criança no Home (`pages/Home.tsx`); nova página `pages/ReviewDue.tsx` em `/lesson/review-due?child=X`.

## Patch B — Gate de aprovação

- **B1** Migration idempotente adiciona a `sessions`: `approval_status TEXT DEFAULT 'draft'`, `approved_by TEXT`, `approved_at TIMESTAMP`, `lesson_edited INTEGER DEFAULT 0`. Em `settings`: `auto_approve INTEGER DEFAULT 0`. Sessões legadas com `status IN ('completed','ready','error')` são backfillados para `'approved'` no momento exato da migração (detectado por `PRAGMA table_info`) — histórico continua acessível.
- **B2** `POST /api/sessions` lê `settings.auto_approve` e marca a sessão como `'draft'` (default seguro) ou `'approved'` + audit trail (`approved_by='parent'`, `approved_at`).
- **B3** `GET /api/sessions/{id}/lesson` retorna `{status:'awaiting_approval', lesson:null}` enquanto não aprovada. `POST /api/sessions/{id}/quiz-response` retorna **403 hard** — fecha o buraco mesmo se a aprovação for revogada após a criança abrir a aula.
- **B4** Novos endpoints sob `/api/parents/*` (todos exigem `X-Parent-Token`):
  - `GET /pending`
  - `GET /sessions/{id}/lesson-draft`
  - `PATCH /sessions/{id}/lesson` — valida estrutura (`title/blocks/quiz`), marca `lesson_edited=1`.
  - `POST /sessions/{id}/approve` — aprova + **semeia o Leitner com o quiz pós-edição** (não com o original).
  - `GET /settings`, `PATCH /settings` — `auto_approve` global.
- **B5** Frontend:
  - `Lesson.tsx`/`Quiz.tsx` mostram "Tua aula está sendo preparada 👨‍🏫" quando `awaiting_approval`. `Lesson` faz polling para destravar quando o pai aprova.
  - `ParentDashboard.tsx`: seção "Aulas pendentes" + toggle global "Aprovar aulas automaticamente" (default OFF).
  - `pages/ParentReviewLesson.tsx` (`/parents/review/:id`): editor por bloco e por questão, botões "Salvar edições" e "Aprovar e liberar".

## Outros (escopo direto pedido)

- **upload**: limite por sessão subiu de 10 para 20 arquivos (`TopicInput.tsx`).
- **.gitignore** mínimo em backend e frontend para `__pycache__/`, `node_modules/`, `*.db`, `.env`, `uploads/`, `dist/`.

## Compatibilidade

- Toda migração é idempotente (`ALTER TABLE` em try/except, `CREATE TABLE IF NOT EXISTS`).
- Aulas pré-existentes nunca foram bloqueadas pelo gate (backfill na migração).
- Endpoints existentes mantêm contratos; novos campos no payload são aditivos.
