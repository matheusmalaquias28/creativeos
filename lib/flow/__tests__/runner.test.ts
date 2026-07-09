import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGraph } from '../runner';
import { gerarFluxoDaDemanda } from '../generator';
import type { FlowGraph } from '../types';
import type { CreativeDemand } from '@/types/demand';
import type { CreativeProfile } from '@/lib/ai/imagegen/prompt-compiler';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const mockProfile: CreativeProfile = {
  base_prompt: 'Estilo minimalista moderno',
  palette: ['#1A1A1A', '#FFFFFF'],
  logo_mode: 'composite',
  style_reference_urls: [],
};

const demanda: Pick<CreativeDemand, 'id' | 'client_id' | 'artes' | 'briefing'> = {
  id: 'demand-1',
  client_id: 'client-1',
  artes: [
    {
      headline: 'Promoção verão',
      subheadline: '30% off em tudo',
      cta: 'Compre agora',
      informacoesExtras: '',
      linkReferencias: '',
    },
    {
      headline: 'Produto destaque',
      subheadline: 'Inspirado na arte anterior',
      cta: 'Saiba mais',
      informacoesExtras: '@img1',
      linkReferencias: '',
    },
  ],
  briefing: {
    titulo: 'Campanha verão',
    instagramCliente: '@cliente',
    tipo: 'post',
    quantidadeArtes: 2,
    materiaisEditados: '',
    driveMateriais: '',
  },
};

function makeContext() {
  return {
    fetchLogoUrl: vi.fn().mockResolvedValue('https://storage/logo.png'),
    fetchReferenceUrls: vi.fn().mockResolvedValue(['https://storage/ref1.png']),
    fetchCreativeProfile: vi.fn().mockResolvedValue(mockProfile),
    imageProvider: {
      generate: vi
        .fn()
        .mockResolvedValueOnce({ url: 'https://storage/art-1.png', base64: 'b1', mimeType: 'image/png' })
        .mockResolvedValueOnce({ url: 'https://storage/art-2.png', base64: 'b2', mimeType: 'image/png' }),
    },
  };
}

// ─── gerarFluxoDaDemanda ──────────────────────────────────────────────────

describe('gerarFluxoDaDemanda', () => {
  it('cria 1 nó clienteLogo e 1 clienteReferencias', () => {
    const g = gerarFluxoDaDemanda(demanda, 2);
    expect(g.nodes.filter((n) => n.type === 'clienteLogo')).toHaveLength(1);
    expect(g.nodes.filter((n) => n.type === 'clienteReferencias')).toHaveLength(1);
  });

  it('cria N nós de cada tipo por arte', () => {
    const g = gerarFluxoDaDemanda(demanda, 3);
    expect(g.nodes.filter((n) => n.type === 'promptArte')).toHaveLength(3);
    expect(g.nodes.filter((n) => n.type === 'gerarImagem')).toHaveLength(3);
    expect(g.nodes.filter((n) => n.type === 'saidaArte')).toHaveLength(3);
  });

  it('pré-preenche dados da arte no promptArte', () => {
    const g = gerarFluxoDaDemanda(demanda, 2);
    const p0 = g.nodes.find((n) => n.type === 'promptArte' && n.data.artIndex === 0);
    expect(p0?.data).toMatchObject({ headline: 'Promoção verão', cta: 'Compre agora' });
  });

  it('não cria edges sequenciais entre artes — cada pipeline é independente', () => {
    const g = gerarFluxoDaDemanda(demanda, 2);
    // Nenhuma edge deve cruzar de gerar_0 para prompt_1 ou qualquer outra cross-conexão
    const crossEdges = g.edges.filter(
      (e) => e.source.startsWith('gerar_') && e.target.startsWith('prompt_')
    );
    expect(crossEdges).toHaveLength(0);
  });

  it('cada gerarImagem recebe logo, refs e promptArte do mesmo pipeline', () => {
    const g = gerarFluxoDaDemanda(demanda, 2);
    const toGerar0 = g.edges.filter((e) => e.target === 'gerar_0').map((e) => e.source);
    expect(toGerar0).toContain('logo');
    expect(toGerar0).toContain('refs');
    expect(toGerar0).toContain('prompt_0');
    // Não deve ter prompt_1 conectado em gerar_0
    expect(toGerar0).not.toContain('prompt_1');
  });
});

// ─── runGraph ─────────────────────────────────────────────────────────────

describe('runGraph', () => {
  it('executa grafo de 2 artes e retorna 2 resultados', async () => {
    const ctx = makeContext();
    const g = gerarFluxoDaDemanda(demanda, 2);
    const result = await runGraph(g, ctx);
    expect(result.arts).toHaveLength(2);
    expect(result.arts[0]).toMatchObject({ artIndex: 0, url: 'https://storage/art-1.png' });
    expect(result.arts[1]).toMatchObject({ artIndex: 1, url: 'https://storage/art-2.png' });
  });

  it('chama imageProvider.generate uma vez por arte', async () => {
    const ctx = makeContext();
    await runGraph(gerarFluxoDaDemanda(demanda, 2), ctx);
    expect(ctx.imageProvider.generate).toHaveBeenCalledTimes(2);
  });

  it('@imgN com edge manual: resolve quando gerar_0 → prompt_1 está conectado', async () => {
    // Fluxo com edge manual de sequência para testar @imgN
    const g = gerarFluxoDaDemanda(demanda, 2);
    g.edges.push({ id: 'e-seq-manual', source: 'gerar_0', target: 'prompt_1' });

    const ctx = makeContext();
    await runGraph(g, ctx);

    // Arte 2 usou @img1 em informacoesExtras → deve ter sido resolvido para URL da arte 1
    const secondCall = ctx.imageProvider.generate.mock.calls[1][0];
    expect(secondCall.referenceUrls).toContain('https://storage/art-1.png');
    expect(secondCall.prompt).not.toContain('@img1');
  });

  it('@imgN sem edge de sequência: token é preservado (não resolve)', async () => {
    // Sem edge manual, prompt_1 é processado antes de gerar_0 → @img1 não resolve
    const g = gerarFluxoDaDemanda(demanda, 2);
    const ctx = makeContext();
    await runGraph(g, ctx);

    // O prompt da arte 2 deve conter @img1 intacto (não há como resolver sem a edge)
    const secondCall = ctx.imageProvider.generate.mock.calls[1][0];
    expect(secondCall.prompt).toContain('@img1');
  });

  it('token @img com índice inexistente é preservado', async () => {
    const demandaComToken: typeof demanda = {
      ...demanda,
      artes: [{ ...demanda.artes[0], informacoesExtras: '@img99' }, demanda.artes[1]],
    };
    const ctx = makeContext();
    const g = gerarFluxoDaDemanda(demandaComToken, 2);
    await runGraph(g, ctx);
    const firstCall = ctx.imageProvider.generate.mock.calls[0][0];
    expect(firstCall.prompt).toContain('@img99');
  });

  it('referenciaImagem → gerarImagem: contribui como ref visual', async () => {
    const ctx = makeContext();
    const g = gerarFluxoDaDemanda(demanda, 1);

    g.nodes.push({
      id: 'img-drag',
      type: 'referenciaImagem',
      data: { imageUrl: 'https://storage/dragged.png', label: 'produto' },
      position: { x: 100, y: 300 },
    });
    g.edges.push({ id: 'e-drag-gerar', source: 'img-drag', target: 'gerar_0' });

    await runGraph(g, ctx);
    const { referenceUrls } = ctx.imageProvider.generate.mock.calls[0][0];
    expect(referenceUrls).toContain('https://storage/dragged.png');
  });

  it('múltiplos referenciaImagem → gerarImagem: todos incluídos', async () => {
    const ctx = makeContext();
    const g = gerarFluxoDaDemanda(demanda, 1);

    g.nodes.push(
      { id: 'img-1', type: 'referenciaImagem', data: { imageUrl: 'https://s/a.png', label: 'a' }, position: { x: 0, y: 300 } },
      { id: 'img-2', type: 'referenciaImagem', data: { imageUrl: 'https://s/b.png', label: 'b' }, position: { x: 0, y: 400 } }
    );
    g.edges.push(
      { id: 'e-1', source: 'img-1', target: 'gerar_0' },
      { id: 'e-2', source: 'img-2', target: 'gerar_0' }
    );

    await runGraph(g, ctx);
    const { referenceUrls } = ctx.imageProvider.generate.mock.calls[0][0];
    expect(referenceUrls).toContain('https://s/a.png');
    expect(referenceUrls).toContain('https://s/b.png');
  });

  it('@(name) em promptArte: resolve para URL da imagem conectada', async () => {
    const ctx = makeContext();
    const g = gerarFluxoDaDemanda(demanda, 1);

    // Arte usa @(produto) em informacoesExtras
    const promptNode = g.nodes.find((n) => n.type === 'promptArte');
    if (promptNode?.type === 'promptArte') {
      promptNode.data.informacoesExtras = 'use @(produto) como destaque principal';
    }

    g.nodes.push({
      id: 'ref-produto',
      type: 'referenciaImagem',
      data: { imageUrl: 'https://storage/produto.png', label: 'produto' },
      position: { x: 0, y: 300 },
    });
    g.edges.push({ id: 'e-ref-prompt', source: 'ref-produto', target: 'prompt_0' });

    await runGraph(g, ctx);
    const call = ctx.imageProvider.generate.mock.calls[0][0];
    // Token deve ter sido substituído pela URL
    expect(call.prompt).not.toContain('@(produto)');
    expect(call.prompt).toContain('https://storage/produto.png');
    // E a URL deve estar nas refs visuais também
    expect(call.referenceUrls).toContain('https://storage/produto.png');
  });

  it('@(name) case-insensitive e ignora espaços extras', async () => {
    const ctx = makeContext();
    const g = gerarFluxoDaDemanda(demanda, 1);

    const promptNode = g.nodes.find((n) => n.type === 'promptArte');
    if (promptNode?.type === 'promptArte') {
      promptNode.data.informacoesExtras = '@(Foto Produto)';
    }

    g.nodes.push({
      id: 'ref-fp',
      type: 'referenciaImagem',
      data: { imageUrl: 'https://s/fp.png', label: 'foto produto' }, // label com espaço
      position: { x: 0, y: 300 },
    });
    g.edges.push({ id: 'e-fp', source: 'ref-fp', target: 'prompt_0' });

    await runGraph(g, ctx);
    const { prompt } = ctx.imageProvider.generate.mock.calls[0][0];
    expect(prompt).not.toContain('@(Foto Produto)');
    expect(prompt).toContain('https://s/fp.png');
  });

  it('@(name) inexistente é preservado intacto', async () => {
    const ctx = makeContext();
    const g = gerarFluxoDaDemanda(demanda, 1);

    const promptNode = g.nodes.find((n) => n.type === 'promptArte');
    if (promptNode?.type === 'promptArte') {
      promptNode.data.informacoesExtras = '@(naoexiste)';
    }

    await runGraph(g, ctx);
    const { prompt } = ctx.imageProvider.generate.mock.calls[0][0];
    expect(prompt).toContain('@(naoexiste)');
  });

  it('detecta ciclo e rejeita a promise', async () => {
    const cycleGraph: FlowGraph = {
      nodes: [
        { id: 'a', type: 'gerarImagem', data: {}, position: { x: 0, y: 0 } },
        { id: 'b', type: 'gerarImagem', data: {}, position: { x: 280, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
      ],
    };
    await expect(runGraph(cycleGraph, makeContext())).rejects.toThrow('Ciclo detectado');
  });

  it('grafo vazio retorna 0 artes', async () => {
    const result = await runGraph({ nodes: [], edges: [] }, makeContext());
    expect(result.arts).toHaveLength(0);
  });

  it('passa style_reference_urls do perfil como referências', async () => {
    const profileWithRefs: CreativeProfile = {
      ...mockProfile,
      style_reference_urls: ['https://storage/style1.png'],
    };
    const ctx = makeContext();
    ctx.fetchCreativeProfile = vi.fn().mockResolvedValue(profileWithRefs);
    ctx.fetchReferenceUrls = vi.fn().mockResolvedValue(['https://storage/demand-ref.png']);

    await runGraph(gerarFluxoDaDemanda(demanda, 1), ctx);
    const { referenceUrls } = ctx.imageProvider.generate.mock.calls[0][0];
    expect(referenceUrls).toContain('https://storage/style1.png');
    expect(referenceUrls).toContain('https://storage/demand-ref.png');
  });
});
