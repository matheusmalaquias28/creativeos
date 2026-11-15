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

A rotina do Supabase chama o endpoint do CreativeOS a cada cinco minutos. O endpoint espera dez minutos sem alterações, agenda no máximo cinco demandas ativas por dia útil e usa o horário de São Paulo. Pedidos depois das 16h passam para o próximo dia útil. Ajustes com prazo também contam no limite.

Clientes em onboarding passam primeiro por uma checagem do Drive Materiais pelo agente. Sem logo, a demanda fica como Falta material do cliente e sem prazo. Com logo, o material precisa estar cadastrado no cliente do Storm; só então o cron define a data.

As migrações 20261115100000_automatic_creative_demand_due_dates.sql, 20261115110000_creative_demand_agent_queue.sql, 20261115120000_rearm_creative_agent_after_materials.sql e 20261115130000_onboarding_drive_material_triage.sql aplicam a regra e a fila no banco CreativeOS. O cron usa os segredos creative_demand_due_url e creative_demand_due_secret do Vault.

### Criação de artes para revisão

Após o prazo ser definido, o endpoint encaminha até seis demandas por dia para a rotina OpenBot CreativeOS: processar demanda de arte. O agente verifica a copy, logo e referências, ajusta o prompt e gera Feed 4:5. Cada arte recebe no máximo uma geração inicial; Stories, exportação ao Drive e publicação esperam aprovação expressa do usuário. O status operacional da demanda permanece sem alteração durante a revisão.

Na Vercel do projeto CreativeOS, configure OPENBOT_CREATIVE_DEMAND_WEBHOOK_URL, OPENBOT_CREATIVE_DEMAND_WEBHOOK_SECRET e CREATIVEOS_APP_URL. O segredo precisa ser o mesmo que está em Routines settings; ele não deve ser colocado no repositório ou no chat. O endpoint não retira tarefas da fila enquanto URL e segredo não estiverem configurados.

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

