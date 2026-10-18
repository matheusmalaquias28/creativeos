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
  e também `ads_management`/`ads_read` se o usuário tiver papel no Business Manager da Página).
  O código detecta o host pelo prefixo do token. **Recomendação: Instagram Login.**
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

## Passo a passo: conta de teste

1. **Conta do Instagram:** use uma conta **profissional** (Empresa ou Criador) só para testes.
2. **Criar o app:** em [developers.facebook.com/apps](https://developers.facebook.com/apps),
   clique em *Criar app* e escolha o tipo **Business**. O app nasce em **modo desenvolvimento**
   e deve continuar assim no spike. Nesse modo, ele só funciona com contas que têm papel no app.
3. **Produto Instagram:** no painel do app, adicione o produto *Instagram* e abra
   *Instagram → API setup with Instagram business login*.
4. **Adicionar a conta como testadora:** em *Funções do app → Funções*, adicione a conta
   como **Instagram Tester**. Depois, aceite o convite logado nessa conta: no Instagram
   web, *Configurações → Apps e sites → Convites de testador*. O nome exato do menu muda
   com frequência, então confira no painel.
5. **Gerar o token:** de volta em *API setup with Instagram business login*, clique em
   *Add account* / **Generate token** ao lado da conta, faça login no Instagram e copie o
   token (`IGAA…`, válido por 60 dias).
6. **Descobrir o ID da conta:**
   ```bash
   curl "https://graph.instagram.com/v25.0/me?fields=user_id,username&access_token=SEU_TOKEN"
   ```
   O `user_id` da resposta é o `INSTAGRAM_TEST_IG_USER_ID`.
7. **Configurar o `.env.local`** (veja `.env.example`):
   ```
   INSTAGRAM_TEST_IG_USER_ID=1784...
   INSTAGRAM_TEST_ACCESS_TOKEN=IGAA...
   ```

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

- **Login:** Instagram Login (Business Login for Instagram), uma conexão por **cliente**.
  Assim não dependemos de o cliente ter uma Página do Facebook vinculada.
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
