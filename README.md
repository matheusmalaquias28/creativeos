# Creative OS

Plataforma SaaS interna de geração criativa automatizada para agências de marketing.

## Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **Supabase** (Auth, Database, Storage)
- **Anthropic Claude API** (Creative Brain / Brand DNA)
- **Zod** + **React Hook Form** + **Server Actions**

## Estrutura

```
app/                 # Rotas (App Router)
components/          # UI (layout, auth, clients, ui)
lib/                 # Utilitários, Supabase, IA, schemas
types/               # Tipagens TypeScript
hooks/               # React hooks (futuro)
actions/             # Server Actions
services/            # Camada de dados (queries)
supabase/migrations/ # Schema SQL + RLS
```

## Setup local

### 1. Variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Preencha:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY` (para geração de Creative Brain com Claude)
- `ANTHROPIC_MODEL` (opcional — padrão: `claude-haiku-4-5-20251001`)

### 2. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. **Aplique o schema** (obrigatório — sem isso aparece erro `public.clients`):

   **Opção A — SQL Editor (mais rápido):** abra [SQL Editor](https://supabase.com/dashboard/project/_/sql), cole todo o conteúdo de `supabase/setup.sql` e clique **Run**.

   **Opção B — CLI local:** adicione `SUPABASE_DB_PASSWORD` no `.env.local` (Dashboard → Settings → Database → Database password) e rode:

   ```bash
   npm run db:setup
   ```
3. Em **Authentication → URL Configuration**, adicione:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
4. (Opcional) Desative confirmação de e-mail em dev: **Authentication → Providers → Email**
5. Execute também `supabase/migrations/20250527100000_user_roles.sql` (roles admin/member)

### Admin de teste

No `.env.local`, configure as variáveis `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD` e `DEV_ADMIN_NAME` e a `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → `service_role` — nunca commite).

```bash
npm run seed:admin
```

Login em [http://localhost:3000/login](http://localhost:3000/login).

### 3. Rodar o projeto

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Fluxo MVP

- [x] Login / cadastro (Supabase Auth)
- [x] Dashboard com métricas
- [x] CRUD de clientes
- [x] Onboarding criativo (`/clients/[id]/onboarding`) — auto-save
- [x] Upload de referências (`/clients/[id]/references`)
- [x] Geração Creative Brain com Claude (`/clients/[id]/brain`)
- [x] Revisão, aprovação e reprocessar Brand DNA
- [ ] Geração de criativos (fase 3)

## Deploy (Vercel)

1. Conecte o repositório à Vercel
2. Configure as mesmas variáveis de ambiente
3. Atualize redirect URLs no Supabase para o domínio de produção

### Prazos automáticos de demandas de arte

A migração `20261115100000_automatic_creative_demand_due_dates.sql` agenda uma
checagem do Storm a cada cinco minutos. Ela só processa demandas sem data que
ficaram dez minutos sem atualização. Edits recebidos do War reiniciam a espera;
eventos de remoção/cancelamento arquivam a demanda. Para cada dia útil, são
consideradas no máximo cinco demandas ativas com data, inclusive ajustes que já
tenham prazo. A janela de 16h usa o horário em que a demanda foi solicitada no
fuso `America/Sao_Paulo`.

Para ativar em produção:

1. Defina `CREATIVE_DEMAND_DUE_CRON_SECRET` nas variáveis de ambiente da Vercel.
2. Aplique a migração no Supabase.
3. No SQL Editor do Supabase, guarde a URL e o mesmo segredo do passo 1 no
   Vault (o Supabase não permite `alter database ... set` para parâmetros
   próprios):

   ```sql
   select vault.create_secret('https://SEU-APP/api/cron/creative-demand-due-dates', 'creative_demand_due_url');
   select vault.create_secret('MESMO_SEGREDO_DA_VERCEL', 'creative_demand_due_secret');
   ```

O agendamento já fica registrado pela migração, mas não chama a rota até os dois
segredos existirem no Vault. Demandas de clientes em onboarding sem logo
recebem o status `Falta material do cliente` e continuam sem prazo; quando a logo
for cadastrada, uma checagem posterior pode colocá-las na fila.

## Arquitetura

| Camada | Responsabilidade |
|--------|------------------|
| `app/` | Rotas, layouts, composição de páginas |
| `components/` | UI pura e formulários client |
| `actions/` | Server Actions (mutations, auth) |
| `services/` | Queries e regras de leitura |
| `lib/ai/` | Prompts, Claude (Anthropic), validação Zod |
| `lib/supabase/` | Clients SSR/browser |
| `lib/schemas/` | Validação Zod compartilhada |
| `types/` | Contratos TypeScript |
"# creativeos" 

<!-- redeploy -->

