# Instagram — publicar carrosséis do Studio e artes das demandas

Há dois pontos de entrada, com o mesmo diálogo:

- **Página da demanda:** o botão **Publicar no Instagram** fica ao lado de **Entregar demanda**
  e vale para qualquer demanda. Ele usa as artes do **feed** que já estão na entrega. Uma
  arte vira um post simples; duas ou mais viram carrossel. Se a arte já foi entregue ao
  Drive (a cópia do Storage é apagada na entrega), o servidor baixa do Drive. O servidor
  converte cada arte para JPEG (sharp, qualidade 90) e recusa a arte do stories (9:16).
- **Editor do Carrossel Studio:** **Exportar → Publicar no Instagram**, com os cards
  renderizados no navegador (veja o fluxo abaixo).

No editor do Carrossel Studio, o comando **Exportar → Publicar no Instagram** Esse comando abre um
diálogo onde você escolhe e ordena os cards (de 2 a 10), edita a legenda (máx. 2.200
caracteres) e decide entre **Agora** ou **Agendar** (data e hora no horário de Brasília).
O diálogo mostra a conta de destino (@username) e pede uma confirmação final: "Vai publicar
N cards em @conta". **Nada publica sozinho.** Só sai post depois de alguém clicar e
confirmar. O cron só publica o que alguém agendou.

## Fluxo

1. **Navegador** ([publish-dialog.tsx](../../components/instagram/publish-dialog.tsx)):
   renderiza os cards escolhidos com o mesmo `FrameRenderer` e `renderFrameToBlob` da
   exportação PNG e converte para JPEG no canvas (qualidade 0.92, fundo branco).
   Não depende de PNG no Storage nem no Drive.
2. `POST /api/instagram/posts/upload` reserva o id do post e devolve URLs assinadas. O
   navegador sobe os JPEGs direto no bucket público `instagram-posts`
   (`<carouselId>/<postId>/card-NN.jpg`).
3. `POST /api/instagram/posts` confere cada card no servidor (caminho, JPEG, proporção,
   8MB), confirma que a conta não mudou desde a confirmação e grava a linha em
   `instagram_posts`. Se for **agora**, publica na mesma requisição. Se for agendado,
   a linha fica como `scheduled`.
4. **Cron** (`/api/cron/instagram-publish`): publica os `scheduled` vencidos.
5. **Histórico:** fica no próprio diálogo e na página da demanda (Realtime), com status,
   link do post, **Cancelar agendamento** e **Tentar de novo**.

**Nunca publica duas vezes.** O post só é publicado por quem consegue trocar o status para
`publishing` num único `UPDATE … WHERE id = ? AND status IN (…) RETURNING`. Dois cliques,
botão e cron juntos, ou dois crons ao mesmo tempo: só uma chamada recebe a linha. Se um post
ficar em `publishing` por mais de 15 min, a execução morreu no meio. O cron marca esse post
como `failed`, com o aviso para conferir no Instagram, e não tenta de novo sozinho.

| Arquivo | O que faz |
| --- | --- |
| `publish.ts` | `publishCarousel()`: com 1 imagem, faz um post simples; com 2 ou mais, segue containers → `FINISHED` → `CAROUSEL` → `media_publish` → permalink. Também tem `getPublishingQuota()` e `getInstagramAccount()` (`/me`). |
| `posts.ts` | Tabela `instagram_posts`: criar, conferir os cards, preparar as artes da demanda (Storage ou Drive → JPEG), reivindicar atomicamente, publicar, cancelar e rodar o cron. |
| `account.ts` | Conta de destino. Hoje é a do env; depois, a conta conectada de cada cliente. |
| `schedule.ts` | Horário de Brasília ↔ UTC e validação do agendamento (de 5 min a 75 dias). |
| `jpeg.ts` / `format.ts` | Regras de imagem do feed; o 9:16 é recusado. |
| `errors.ts` | Erros da Graph API em português. |
| `http.ts` | Só admin publica; formato das respostas de erro. |

Rotas: `GET /api/instagram/account` (`?carouselId=` ou `?demandId=`), `GET|POST /api/instagram/posts`,
`POST /api/instagram/demand-posts` (artes da entrega da demanda),
`POST /api/instagram/posts/upload`, `POST /api/instagram/posts/[id]/publish` (agora ou tentar
de novo), `POST /api/instagram/posts/[id]/cancel` e `GET|POST /api/cron/instagram-publish`.

## O que a documentação da Meta diz hoje (conferido em 18/10/2026, API v25.0)

O fluxo descrito na tarefa está certo: um container por imagem (`POST /{ig-user-id}/media`
com `image_url` + `is_carousel_item=true`), depois o container do carrossel
(`media_type=CAROUSEL` + `children` com os IDs separados por vírgula + `caption`),
depois `POST /{ig-user-id}/media_publish` com `creation_id`. Detalhes e o que muda:

- **Dois tipos de API.** *Instagram Login* (host `graph.instagram.com`, token `IGAA…`,
  escopos `instagram_business_basic` + `instagram_business_content_publish`, não precisa
  de Página do Facebook) e *Facebook Login* (host `graph.facebook.com`, token `EAA…`,
  permissões `instagram_basic` + `instagram_content_publish` + `pages_read_engagement`,
  mais `pages_show_list` para listar as Páginas e achar a conta, e também
  `ads_management`/`ads_read` se o usuário tiver papel no Business Manager da Página).
  O código detecta o host pelo prefixo do token. **O spike usa o Instagram Login**, porque
  o token de teste começa com `IGAA`. Para o multiusuário, veja as decisões no fim deste arquivo.
- **Itens:** 2 a **10** por carrossel na API. O app do Instagram aceita 20, a API não.
- **Formato:** só **JPEG** (MPO/JPS não). Máx. **8MB**, largura 320–1440px, sRGB.
- **Proporção:** de **4:5 a 1.91:1**. Todos os itens são cortados pela proporção da
  primeira imagem. 9:16 não entra, por isso a rota recusa carrosséis 9:16 do Studio.
- **Legenda:** só no container do carrossel (os itens não aceitam). Máx. 2.200
  caracteres, 30 hashtags e 20 menções.
- **Limite de publicação:** **100 posts via API por 24h** (janela móvel), e um carrossel
  conta como um post. A própria página se contradiz: a seção de carrossel ainda fala
  em 50. Na prática, vale o que `GET /{ig-user-id}/content_publishing_limit` devolver,
  e a rota consulta isso antes de publicar.
- **Status do container:** `IN_PROGRESS`, `FINISHED`, `ERROR`, `EXPIRED`, `PUBLISHED`.
  Um container expira 24h depois de criado. A Meta recomenda consultar 1x por minuto,
  por até 5 minutos. Aqui o polling é a cada 3s, com teto de 2 min por etapa, porque
  imagens costumam ficar prontas em segundos. Num worker em produção, use intervalos maiores.
- **URL da imagem:** precisa ser pública no momento da publicação, porque a Meta baixa o
  arquivo pela URL (bucket público `generated-images`).
- **Novidade:** `alt_text` (até 1.000 caracteres) por imagem desde 24/03/2025. Ainda
  não é usado aqui.
- **Tokens:** o token gerado no painel vale **60 dias**. O do fluxo de login vale 1h e é
  trocado por um de 60 dias (`GET graph.instagram.com/access_token?grant_type=ig_exchange_token`).
  A renovação é feita com `GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token`,
  com o token tendo pelo menos 24h de vida e ainda válido. Se o token não for renovado
  dentro de 60 dias, ele morre.
- **Acesso:** *Standard Access* basta para contas que você tem ou gerencia e que foram
  adicionadas ao app. Atender contas de terceiros (os clientes) exige *Advanced Access*,
  que passa por App Review.

## Passo a passo: conta de teste com Instagram Login (token `IGAA…`, o caminho em uso)

O token de teste começa com `IGAA`, ou seja, vem da **Instagram API com login do Instagram**.
O código detecta isso pelo prefixo e manda todas as chamadas para `graph.instagram.com`:
containers, status, `media_publish`, permalink, cota e `/me`. A versão é a `v25.0`, a atual
da documentação, e pode ser trocada com `INSTAGRAM_API_VERSION` (por exemplo, `v21.0`).

> **O token não passa por chat e não vai para arquivo versionado.** Coloque
> `INSTAGRAM_ACCESS_TOKEN` direto no `.env.local`, que está no `.gitignore`. Nos comandos
> abaixo, `$TOKEN` e `$APP_SECRET` são variáveis do seu terminal e não devem ser colados
> em nenhum outro lugar.

1. **Conta:** use uma conta **profissional** do Instagram (Empresa ou Criador de conteúdo).
   Não precisa de Página do Facebook.
2. **App em modo desenvolvimento:** em [developers.facebook.com/apps](https://developers.facebook.com/apps),
   use um app do tipo **Business** com o produto *Instagram* e deixe-o em **modo desenvolvimento**.
3. **Conta como testadora:** em *Funções do app → Funções*, adicione a conta como
   **Instagram Tester**. Depois, aceite o convite logado nessa conta, no Instagram web:
   *Configurações → Apps e sites → Convites de testador*. O nome do menu muda com frequência.
4. **Gerar o token:** em *Instagram → API setup with Instagram business login*, clique em
   **Generate token** ao lado da conta e faça login no Instagram. O token do painel já é
   **de longa duração (60 dias)** e precisa dos escopos `instagram_business_basic` e
   `instagram_business_content_publish`.
   - Se o token vier do fluxo de login (curto, 1 hora), troque por um de 60 dias no
     servidor ou terminal, porque o comando usa o app secret:
     ```bash
     curl -G "https://graph.instagram.com/access_token" \
       --data-urlencode "grant_type=ig_exchange_token" \
       --data-urlencode "client_secret=$APP_SECRET" \
       --data-urlencode "access_token=$TOKEN"
     ```
   - Para renovar antes de vencer, com o token tendo pelo menos 24h e ainda válido:
     ```bash
     curl -G "https://graph.instagram.com/refresh_access_token" \
       --data-urlencode "grant_type=ig_refresh_token" \
       --data-urlencode "access_token=$TOKEN"
     ```
5. **Conferir de quem é o token** (é daqui que sai o id da conta):
   ```bash
   curl -G "https://graph.instagram.com/v25.0/me" \
     --data-urlencode "fields=user_id,username" \
     --data-urlencode "access_token=$TOKEN"
   ```
   O `user_id` é o id usado para publicar. Não é preciso copiá-lo: sem
   `INSTAGRAM_TEST_IG_USER_ID`, a rota chama esse mesmo `/me`. Se a variável estiver definida
   e não bater com o `/me`, a rota recusa a publicação e diz qual conta o token representa.
6. **Configurar o `.env.local`** (veja `.env.example`) e reiniciar o `npm run dev`:
   ```
   INSTAGRAM_ACCESS_TOKEN=IGAA...
   # opcional, só para travar a conta:
   INSTAGRAM_TEST_IG_USER_ID=...
   ```
   `INSTAGRAM_TEST_ACCESS_TOKEN` continua aceito como nome alternativo do token.

### Alternativa: Facebook Login (token `EAA…`)

Com esse tipo de token, o código usa `graph.facebook.com`.

- **Permissões:** `instagram_basic`, `instagram_content_publish` e `pages_show_list`, mais
  `pages_read_engagement`, que a doc de Content Publishing também pede.
- **Conta:** precisa estar vinculada a uma Página do Facebook.
- **Token:** gere no [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
  Ele sai curto (cerca de 1 hora); troque por um de cerca de 60 dias com
  `GET graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=$APP_ID&client_secret=$APP_SECRET&fb_exchange_token=$TOKEN`.
  Se der erro de permissão, use o token **de Página** devolvido por `/me/accounts`,
  que não expira.
- **Id da conta:** o `/me` desse tipo de token devolve o usuário do Facebook, não a conta
  do Instagram. Por isso `INSTAGRAM_TEST_IG_USER_ID` é **obrigatório** aqui: é o
  `instagram_business_account.id` de `GET /me/accounts?fields=name,instagram_business_account`.

## Cron dos agendados

O projeto **não tem `vercel.json` nem `vercel.ts`**. No plano Hobby da Vercel, o cron roda
no máximo uma vez por dia, e no Pro pode rodar a cada minuto. A rota aceita os dois jeitos
de disparo e recusa tudo se não houver segredo configurado:

- **Vercel Cron (plano Pro):** `GET` com `Authorization: Bearer $CRON_SECRET`, que a Vercel
  envia sozinha. Basta um `vercel.ts`/`vercel.json` com `crons: [{ path: "/api/cron/instagram-publish", schedule: "*/5 * * * *" }]`.
- **pg_cron + pg_net do Supabase (qualquer plano):** é o que o projeto já usa na limpeza do
  Space (`20261002000000_spaces_ttl.sql`). A chamada é um `POST` com `x-cron-secret: $INSTAGRAM_CRON_SECRET`:
  ```sql
  alter database postgres set app.instagram_cron_url = 'https://SEU-APP/api/cron/instagram-publish';
  alter database postgres set app.instagram_cron_secret = 'o-mesmo-INSTAGRAM_CRON_SECRET';
  select cron.schedule('instagram-publish', '*/5 * * * *', $$
    select net.http_post(
      url := current_setting('app.instagram_cron_url', true),
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-cron-secret', current_setting('app.instagram_cron_secret', true)),
      body := '{}'::jsonb)
    where current_setting('app.instagram_cron_url', true) is not null;
  $$);
  ```
- **Make:** um cenário agendado a cada 5 min que faz o mesmo `POST`.

**Ainda não ativado:** a escolha fica com o time. Sem cron, os agendados ficam esperando.
O botão "Publicar agora" funciona sem cron.

## Como testar

1. No `.env.local`: `INSTAGRAM_ACCESS_TOKEN` (e opcionalmente `INSTAGRAM_TEST_IG_USER_ID`),
   como no passo a passo acima. Para testar o cron, defina também `INSTAGRAM_CRON_SECRET`.
2. Rode `npm run dev`, entre como **admin** e abra um carrossel 4:5 ou 1:1 no Studio.
3. Clique em **Exportar → Publicar no Instagram**. Confira a conta no topo, escolha e ordene
   os cards, ajuste a legenda e clique em **Agendar** para daqui a uns 10 min (agendar pode
   ser cancelado e não posta nada antes da hora).
   **Publicar agora posta de verdade na conta mostrada.**
4. O agendamento aparece no histórico do diálogo e na página da demanda. Para disparar o
   cron à mão depois do horário:
   ```bash
   curl -X POST http://localhost:3000/api/cron/instagram-publish -H "x-cron-secret: $INSTAGRAM_CRON_SECRET"
   ```
5. `npm test` cobre os fluxos com a API e o banco mockados: claim simultâneo, cron, cancelar,
   falhas e fuso horário.

## Decisões para a próxima etapa (multiusuário). Ainda não implementado

- **Login:** uma conexão por **cliente**. Ainda falta decidir entre os dois tipos de login.
  O Instagram Login é o que o spike usa: dispensa a Página do Facebook e tem renovação de
  token por API (`ig_refresh_token`). O Facebook Login devolve um token de Página que não
  expira, mas exige que o cliente tenha uma Página vinculada e que demos acesso a ela.
- **Tokens:** tabela `instagram_accounts` (client_id, ig_user_id, username, token
  criptografado, expires_at, scopes, status). Um cron renova o token quando faltarem
  cerca de 10 dias para vencer (`ig_refresh_token`) e marca a conta como "reconectar"
  se a renovação falhar ou se aparecer o erro 190.
- **Fila:** feita (`instagram_posts` + cron). Para volume maior, falta consultar
  `content_publishing_limit` antes de cada post. Também falta não segurar a função esperando
  `IN_PROGRESS`: hoje ela espera até 2 min por etapa, e o ideal é devolver o post para a fila.
- **Imagens:** feito. Os cards são gerados no navegador na hora de publicar ou agendar e
  ficam no bucket `instagram-posts`. O que se edita no Studio depois de agendar **não entra**
  no post: é uma foto daquele momento.
- **Conta por cliente:** trocar `resolveAccountForClient()` em `account.ts` para ler a conta
  conectada do cliente. A tabela já grava `client_id`, `ig_user_id` e `ig_username` por post.
- **Meta:** para publicar em contas de clientes é preciso Advanced Access para
  `instagram_business_basic` e `instagram_business_content_publish`. Isso pede App Review
  (screencast do fluxo, política de privacidade, callback de exclusão de dados) e
  verificação da empresa no Business Manager.
