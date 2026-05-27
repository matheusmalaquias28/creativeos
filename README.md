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

No `.env.local`, adicione a **service role key** (Settings → API → `service_role` — nunca commite).

```bash
npm run seed:admin
```

Credenciais padrão (ou sobrescreva com `DEV_ADMIN_*` no `.env.local`):

| Campo | Valor |
|-------|--------|
| E-mail | `admin@creativeos.dev` |
| Senha | `CreativeOS2025!` |

Login em [http://localhost:3000/login](http://localhost:3000/login).

### 3. Rodar o projeto

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Fluxo MVP (fase atual)

- [x] Login / cadastro (Supabase Auth)
- [x] Dashboard com métricas
- [x] CRUD inicial de clientes (criar + listar + detalhe)
- [x] Schema completo (users, clients, references, onboarding, creative_brains)
- [x] Service layer de IA (`lib/ai/generateCreativeBrain.ts`)
- [ ] Onboarding criativo (formulário)
- [ ] Upload de referências (Storage)
- [ ] Geração e revisão de Creative Brain
- [ ] Reprocessar Brand DNA

## Deploy (Vercel)

1. Conecte o repositório à Vercel
2. Configure as mesmas variáveis de ambiente
3. Atualize redirect URLs no Supabase para o domínio de produção

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
