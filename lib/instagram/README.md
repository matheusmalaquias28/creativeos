# Instagram — spike de publicação de carrossel

Publica um carrossel pronto do Carrossel Studio numa conta profissional **de teste**
via Instagram Graph API (Content Publishing). É um spike: uma conta fixa no env,
sem OAuth, sem agendamento.

| Arquivo | O que faz |
| --- | --- |
| `publish.ts` | `publishCarousel({ igUserId, accessToken, imageUrls, caption })`: cria os containers, espera `FINISHED`, publica e devolve `{ mediaId, permalink }`. `getPublishingQuota()` lê a cota de 24h. |
| `errors.ts` | Traduz os erros da Graph API (token, permissão, limites, subcódigos 2207xxx) para português. |
| `jpeg.ts` | PNG → JPEG sRGB (sharp, qualidade 90, fundo branco no lugar do alpha), valida proporção e 8MB. |
| `studio-images.ts` | Pega as páginas do Studio já enviadas para a demanda, converte e sobe no bucket público `generated-images/instagram/<carouselId>/<data>/`. |
| `app/api/instagram/test-publish/route.ts` | `POST { carouselId, dryRun? }`, só admin. |

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
  O código detecta o host pelo prefixo do token. **O spike usa o Facebook Login**, porque
  o token do app começa com `EAA`. Para o multiusuário, veja as decisões no fim deste arquivo.
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

## Passo a passo: conta de teste com Facebook Login (token `EAA…`, o caminho em uso)

O token do app que estamos usando começa com `EAA`, ou seja, vem do **Facebook Login**.
O código manda esse token para `graph.facebook.com` sozinho, sem nenhuma configuração extra.

> **O token não passa por chat e não vai para arquivo versionado.** Coloque
> `INSTAGRAM_TEST_ACCESS_TOKEN` e `INSTAGRAM_TEST_IG_USER_ID` direto no `.env.local`,
> que está no `.gitignore`. Nos comandos abaixo, `$TOKEN`, `$APP_ID` e `$APP_SECRET` são
> variáveis do seu terminal e não devem ser colados em nenhum outro lugar.

1. **Contas:** use uma conta **profissional** do Instagram (Empresa ou Criador) só para
   testes, **vinculada a uma Página do Facebook**. A pessoa que gera o token precisa ter
   uma tarefa na Página (gerenciar ou criar conteúdo).
2. **App em modo desenvolvimento:** em [developers.facebook.com/apps](https://developers.facebook.com/apps),
   o app (tipo **Business**, com *Facebook Login for Business* adicionado) deve continuar
   em **modo desenvolvimento**. Nesse modo, as permissões funcionam sem App Review, mas só
   para quem tem uma função no app. Se for outra pessoa, adicione-a em *Funções do app → Funções*
   como administradora, desenvolvedora ou testadora, e ela precisa aceitar o convite.
3. **Permissões do token:** `instagram_basic`, `instagram_content_publish` e
   `pages_show_list`. A página de Content Publishing da Meta também lista
   `pages_read_engagement` para o Facebook Login, e vale incluí-la. Para o teste, o jeito
   mais fácil de gerar o token é o [Graph API Explorer](https://developers.facebook.com/tools/explorer/):
   escolha o app, marque as permissões, clique em *Generate Access Token* e aprove a Página
   e a conta do Instagram. O token que sai dali é **curto (cerca de 1 hora)**.
4. **Trocar o token curto por um de longa duração (cerca de 60 dias).** Faça isso no seu
   terminal, porque o comando usa o app secret:
   ```bash
   curl -G "https://graph.facebook.com/v25.0/oauth/access_token" \
     --data-urlencode "grant_type=fb_exchange_token" \
     --data-urlencode "client_id=$APP_ID" \
     --data-urlencode "client_secret=$APP_SECRET" \
     --data-urlencode "fb_exchange_token=$TOKEN"
   ```
   O `access_token` da resposta (`expires_in` ≈ 5.184.000s, cerca de 60 dias) é o valor de
   `INSTAGRAM_TEST_ACCESS_TOKEN`. Esse token não é renovado por chamada de API: quando
   vencer, gere outro no Explorer e troque de novo. Com esse token de usuário longo,
   `GET /me/accounts` também devolve um `access_token` **de Página**, que não expira.
   Se a publicação com o token de usuário der erro de permissão (código 10 ou 200), use
   o token de Página.
5. **Achar o IG user id:**
   ```bash
   curl -G "https://graph.facebook.com/v25.0/me/accounts" \
     --data-urlencode "fields=name,instagram_business_account" \
     --data-urlencode "access_token=$TOKEN"
   ```
   Na Página certa, o `instagram_business_account.id` (algo como `1784…`) é o
   `INSTAGRAM_TEST_IG_USER_ID`. Se o campo não aparecer, a conta do Instagram não está
   vinculada a essa Página ou não é uma conta profissional.
6. **Configurar o `.env.local`** (veja `.env.example`) e reiniciar o `npm run dev`:
   ```
   INSTAGRAM_TEST_IG_USER_ID=1784...
   INSTAGRAM_TEST_ACCESS_TOKEN=EAA...
   ```

### Alternativa: Instagram Login (token `IGAA…`)

Se um dia o app usar *Instagram → API setup with Instagram business login*:

- Adicione a conta como **Instagram Tester** em *Funções do app* e aceite o convite no Instagram.
- Clique em **Generate token** ao lado da conta. Esse token já sai com 60 dias de validade.
- Descubra o ID com `GET https://graph.instagram.com/v25.0/me?fields=user_id,username`.

O código detecta esse tipo de token e usa `graph.instagram.com`.

## Como rodar o teste

Pré-requisitos: o carrossel do Studio precisa estar **ligado a uma demanda**, ter de 2 a 10
páginas em 4:5 ou 1:1, ter a legenda preenchida no painel da página e ter as páginas
enviadas com **"Enviar para a demanda"** no editor. É desse envio que saem os PNGs.
Se a demanda já foi entregue ao Drive, as cópias saíram do Storage e é preciso enviar de novo.

1. Rode `npm run dev` e entre como **admin**.
2. Pegue o `carouselId` na URL do editor (`/carousel/studio/<carouselId>`).
3. No console do navegador (a sessão vai pelo cookie), rode primeiro o **dry run**. Ele
   converte e sobe os JPEGs e mostra a cota, sem publicar nada:
   ```js
   await fetch("/api/instagram/test-publish", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ carouselId: "<id>", dryRun: true }),
   }).then((r) => r.json())
   ```
   Abra as `imageUrls` devolvidas e confira as páginas e a legenda.
4. Para publicar de verdade, rode o mesmo comando sem o `dryRun`. A resposta traz
   `{ mediaId, permalink, imageUrls, warnings }`. Os erros vêm em português, com `step`,
   `code`, `subcode` e `fbtraceId` para procurar no suporte da Meta.

Os testes (`npm test`) usam a API mockada e não fazem nenhuma chamada real.

## Decisões para a próxima etapa (multiusuário). Ainda não implementado

- **Login:** uma conexão por **cliente**. Ainda falta decidir entre os dois tipos de login.
  O Instagram Login dispensa a Página do Facebook e tem renovação de token por API
  (`ig_refresh_token`). O Facebook Login é o que o spike usa e devolve um token de Página
  que não expira, mas exige que o cliente tenha uma Página vinculada e que demos acesso a ela.
- **Tokens:** tabela `instagram_accounts` (client_id, ig_user_id, username, token
  criptografado, expires_at, scopes, status). Um cron renova o token quando faltarem
  cerca de 10 dias para vencer (`ig_refresh_token`) e marca a conta como "reconectar"
  se a renovação falhar ou se aparecer o erro 190.
- **Fila:** tabela `instagram_posts` (studio_carousel_id, client_id, scheduled_at,
  status `scheduled → preparing → publishing → published | failed`, ids dos containers,
  media_id, permalink, erro). Um worker por cron minuto a minuto pega o que venceu, consulta
  `content_publishing_limit`, cria os containers e publica. O que estiver `IN_PROGRESS`
  volta para a fila em vez de bloquear a função. Containers valem 24h, então eles são
  criados perto do horário agendado.
- **Imagens:** o servidor não renderiza o Studio (o export é feito no navegador), e o
  envio ao Drive apaga as cópias do Storage. Por isso, no momento de **agendar**, o editor
  precisa renderizar e gravar os JPEGs num caminho próprio e permanente
  (`generated-images/instagram/...`), sem depender de `demand-exports`.
- **Meta:** para publicar em contas de clientes é preciso Advanced Access para
  `instagram_business_basic` e `instagram_business_content_publish`. Isso pede App Review
  (screencast do fluxo, política de privacidade, callback de exclusão de dados) e
  verificação da empresa no Business Manager.
