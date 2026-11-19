# Playbook do agente: como pedir carrossel ao CreativeOS

Cole isto nas instruções do agente. É o mesmo jeito de pedir que gerou o
carrossel de teste da Previtas que ficou bom (contrato completo da API no
[README](README.md)).

## Regras

1. **Escreva você o texto de cada card.** Mande `cards: [{ "text", "visual" }]`
   em vez de só `content` com o tema. O texto vai exatamente como você escreveu.
   - 1ª linha = título (até ~8 palavras); 2ª linha = apoio (até ~20 palavras).
   - Último card: fechamento + CTA curto na última linha ("Fale com a Previtas").
   - Carrossel: 5 a 7 cards. Sem travessão (— ou –). Português do Brasil.
   - `content` vira só contexto da legenda: público, tom e objetivo.
2. **Sempre mande `visualDirection`** com o bloco fixo da marca (abaixo). Não
   invente outro estilo a cada carrossel: o bloco é sempre o mesmo, só muda o tema.
3. **Descreva o `visual` de TODO card de forma concreta:** fundo (cor), se tem foto
   (e o que ela mostra exatamente) ou "Sem imagem", onde fica cada texto e o
   alinhamento ("à esquerda", "TUDO CENTRALIZADO").
   - Foto só quando ela mostra literalmente o assunto do card. Na dúvida: "Sem imagem".
   - Número de lista: escreva "1." no início do título E diga no visual que ele
     aparece **UMA vez só**, no tamanho padrão. Senão sai duplicado.
   - Repita em cada card a regra que tem que ser igual entre eles (tamanho e
     posição do número, cor do fundo). A IA gera cada card separado; o que não
     está escrito no card, ela varia.
4. **Nunca descreva** logo, rodapé, barra de progresso, @, ícones de redes,
   setas de "arraste" ou numeração de página. Tudo isso é colocado em código depois,
   igual em todos os cards (logo na capa e no último, à esquerda).
5. **Não mande** `logo`, `brandFrame`, `logoPosition` nem `logoCards`: o padrão já
   está certo. Só use se o pedido for diferente do normal.
6. Depois do `202`, consulte `GET /api/carousel-agent/runs/{id}` (ou use
   `callbackUrl`). Em `429`, espere; não reenvie em loop.

## Bloco fixo da marca (Previtas)

```
Siga o modelo visual da marca (imagens de referência do perfil): fotos realistas de brasileiros reais com luz natural, caixa de texto verde-petróleo (#053035) com cantos bem arredondados, títulos em branco com a palavra-chave em laranja (#D34100), fundo off-white nos cards sem foto. Tipografia sans-serif geométrica, títulos grandes e em negrito. Foto só na capa; os outros cards são tipográficos. Nada de ícones, setas soltas, enfeites, molduras ou elementos 3D. Topo e rodapé livres: a logo e o rodapé entram depois. NÚMEROS PADRONIZADOS: em carrossel de lista, o número do item ("1.", "2.", ...) tem SEMPRE o mesmo tamanho (altura do algarismo = 22% da altura da arte), a mesma fonte, o mesmo peso e a mesma cor laranja (#D34100), e fica SEMPRE na mesma posição: alinhado à margem esquerda, logo abaixo do topo livre. O título começa logo abaixo do número, alinhado à esquerda.
```

## Pedido de exemplo (o que deu certo)

```json
{
  "instagram": "@previtasbrasil_",
  "format": "carousel",
  "externalRef": "id-do-lado-do-agente",
  "visualDirection": "<bloco fixo da marca acima>",
  "content": "Público: segurados do INSS que tiveram a aposentadoria negada. Tom: claro, acolhedor, sem juridiquês. Objetivo: mostrar que a negativa tem motivos comuns e que dá para reverter com orientação.",
  "cards": [
    {
      "text": "Aposentadoria negada pelo INSS?\nVeja os 4 motivos mais comuns",
      "visual": "Capa no padrão do modelo: metade de cima com foto realista de uma mulher brasileira de uns 60 anos, sentada à mesa da cozinha, lendo uma carta com expressão preocupada, luz natural de janela. Metade de baixo com fundo off-white e a caixa verde-petróleo arredondada à esquerda com o título (\"negada pelo INSS?\" em laranja); o subtítulo em verde-petróleo à direita da caixa."
    },
    {
      "text": "1. Falta de tempo de contribuição\nPeríodos sem registro podem não aparecer no seu extrato do INSS.",
      "visual": "Sem imagem. Fundo off-white. O \"1.\" do título aparece UMA vez só, no tamanho padrão dos números (altura = 22% da arte), em laranja, alinhado à margem esquerda logo abaixo do topo livre; o resto do título começa logo abaixo dele, alinhado à esquerda. Título em verde-petróleo, texto de apoio menor embaixo."
    },
    {
      "text": "2. Vínculos que não aparecem no CNIS\nEmpregos antigos, rurais ou informais muitas vezes precisam ser comprovados com documentos.",
      "visual": "Sem imagem. Fundo verde-petróleo (#053035) inteiro. O \"2.\" do título aparece UMA vez só, no tamanho padrão dos números (altura = 22% da arte), em laranja, alinhado à margem esquerda logo abaixo do topo livre; o resto do título começa logo abaixo dele, alinhado à esquerda. Título em branco, texto de apoio em branco com opacidade menor."
    },
    {
      "text": "3. Atividade especial não reconhecida\nQuem trabalhou exposto a ruído, calor ou produtos químicos pode ter regras diferentes.",
      "visual": "Sem imagem. Fundo off-white. O \"3.\" do título aparece UMA vez só, no tamanho padrão dos números (altura = 22% da arte), em laranja, alinhado à margem esquerda logo abaixo do topo livre. Embaixo do número, a caixa verde-petróleo arredondada com o resto do título em branco, e o texto de apoio em verde-petróleo abaixo da caixa."
    },
    {
      "text": "4. Documentos incompletos\nFalta de PPP, carnês ou comprovantes trava o pedido.",
      "visual": "Sem imagem. Fundo off-white. O \"4.\" do título aparece UMA vez só, no tamanho padrão dos números (altura = 22% da arte), em laranja, alinhado à margem esquerda logo abaixo do topo livre. Título dentro de uma caixa verde-petróleo arredondada com texto branco, texto de apoio embaixo."
    },
    {
      "text": "A negativa não é o fim\nDá para recorrer ou fazer um novo pedido com os documentos certos.\nFale com a Previtas",
      "visual": "Sem imagem. Fundo verde-petróleo (#053035). TUDO CENTRALIZADO na horizontal: título grande em branco com \"não é o fim\" em laranja, centralizado; texto de apoio em branco, centralizado; \"Fale com a Previtas\" como botão laranja arredondado centralizado embaixo. Nenhum texto alinhado à esquerda neste card."
    }
  ]
}
```
