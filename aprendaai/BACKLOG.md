# BACKLOG — itens fora do escopo destes dois patches

## Já fora do escopo (você mencionou)

- **Tokens em `localStorage` expostos a XSS** — migrar `parent_token` para cookie `HttpOnly; Secure; SameSite=Strict` + endpoint de logout que limpa o cookie.
- **Telemetria de tempo de resposta** para dificuldade adaptativa (v2 do Leitner — incluir RT por questão na decisão de promoção/rebaixamento, não só correto/errado).

## Descoberto durante a Fase 0 (não consertei — não está em A/B)

1. **Nenhum vínculo `parent → child`**. JWT do pai tem só `{role, exp}`. OK para a sua família, ruim para multi-família. Se um dia abrir pra outras famílias, precisa `parent_id` no JWT + filtro `WHERE parent_id=?` em todas as queries.
2. **Rotas da criança sem autenticação alguma**. `/api/sessions/*` e `/api/children/*` aceitam qualquer chamada. Qualquer `session_id` adivinhado expõe dados. Mitigado parcialmente por estar atrás de proxy/tunnel, mas é dívida.
3. **`CORS allow_origins=["*"]` + `allow_credentials=True`** (`main.py:33-38`) — combinação inválida pela spec CORS. Funciona hoje porque tudo roda same-origin via `proxy.py`, mas browsers vão recusar se você expor o backend cross-origin.
4. **Sem framework de migration**. `init_db()` faz `ALTER TABLE` idempotente em try/except. Cresce mal. Quando passar de 5 migrations, considerar Alembic ou um `_schema_migrations` table manual.
5. **`pyproject.toml` lista `psycopg`** que não é usado em código (legado de pivot pra Postgres que não aconteceu).
6. **Geração de aula é síncrona** dentro do `POST /api/sessions`. Com 20 arquivos × Vision/Whisper, isso bloqueia uvicorn por minutos e estoura timeout de browser. Considerar fila (Celery/Arq) com `status='processing'` polling.
7. **`parent_username/password` default `123/123`** seedado em `init_db()`. Trocar no setup inicial — está em texto plano no `config.py`.

## Descoberto durante implementação (relacionado mas não consertado)

8. **Re-edição após aprovação não re-sincroniza a Leitner queue.** Se você editar uma aula JÁ APROVADA via outro fluxo, novos itens entram (`INSERT OR IGNORE` não conflita), mas itens com texto alterado viram órfãos no `review_items` (não aparecem mais como pergunta de quiz; o item antigo nunca mais será respondido e ficará "due" indefinidamente). Mitigação atual: edição válida apenas pré-aprovação (`B4 PATCH /lesson` aceita em qualquer estado, mas a tela só expõe pré-approve). Idealmente, ao editar pós-approve, deletar itens órfãos por session_id e re-`upsert`.
9. **`approved_by` é string fixa `'parent'`** (decisão sua). Se virar multi-pai, expandir JWT.
10. **`auto_approve` é global** (decisão sua). Se virar por-criança, a coluna está em `settings`; basta mover para `children.auto_approve` e atualizar B2/B4.
11. **Frontend `Lesson.tsx` faz polling a cada 5s** quando awaiting_approval. Funcional, mas gasta requests. WebSocket ou SSE seria melhor — out of scope.
12. **Validação de `lesson` editada (`_validate_lesson_payload`)** aceita qualquer string em `title`/`content`/`question` — não há limite de tamanho. Risco baixo (só pai autenticado edita), mas vale adicionar `maxlen` em produção.

## SQL de rollback (em caso de emergência)

```sql
-- DOWN: review_items (A1)
DROP INDEX IF EXISTS idx_review_items_due;
DROP TABLE IF EXISTS review_items;

-- DOWN: gate columns (B1) — SQLite < 3.35 não suporta DROP COLUMN; rebuild:
BEGIN;
CREATE TABLE sessions_new AS
  SELECT id, child_id, topic, input_type, original_file, extracted_text,
         lesson_json, started_at, ended_at, duration_sec, status, stars_earned
  FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;
CREATE TABLE settings_new AS
  SELECT id, parent_username, parent_password_hash, created_at, updated_at
  FROM settings;
DROP TABLE settings;
ALTER TABLE settings_new RENAME TO settings;
COMMIT;
```

Reversão NÃO perde dados das colunas originais. Perde, claro, o conteúdo das colunas adicionadas (`approval_status`, `box`, etc.).
