"use client";

import { useEffect, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Bold,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  FlipHorizontal,
  ImageUp,
  Italic,
  Lock,
  Maximize,
  Scissors,
  Sparkles,
  Trash2,
  Type,
  Unlock,
  Wand2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CaseUpper,
  Loader2,
} from "lucide-react";
import { CTA_ICONS } from "@/lib/carousel/cta-icons";
import { STUDIO_FONTS, heavyWeightFor } from "@/lib/carousel-studio/fonts";
import { mapPage, reorderLayers, updateLayers, type OrderMove } from "@/lib/carousel-studio/doc-ops";
import type {
  StudioButtonLayer,
  StudioDocument,
  StudioGradient,
  StudioImageLayer,
  StudioLayer,
  StudioPage,
  StudioShapeLayer,
  StudioTextLayer,
} from "@/types/carousel-studio";
import type { StudioHistory } from "./use-studio-history";
import { layerBox } from "./studio-canvas";
import {
  ColorField,
  IconToggle,
  NumberField,
  PanelButton,
  PanelSection,
  Row,
  SelectField,
  SliderField,
  TextField,
} from "./panel-fields";

export type ImageActions = {
  replace: (layerId: string) => void;
  generate: (layerId: string, prompt: string, kind: "background" | "element") => void;
  edit: (layerId: string, instruction: string) => void;
  cutout: (layerId: string) => void;
};

type Props = {
  history: StudioHistory;
  page: StudioPage | null;
  layers: StudioLayer[];
  palette: string[];
  measured: Record<string, number>;
  busy: ReadonlySet<string>;
  readOnly: boolean;
  caption: string;
  onCaptionChange: (v: string) => void;
  imageActions: ImageActions;
  onDuplicate: () => void;
  onDelete: () => void;
  onDuplicatePage: () => void;
  onDeletePage: () => void;
};

const WEIGHTS = [300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) }));
const fontOptions = STUDIO_FONTS.map((f) => ({ value: f.family, label: f.label, style: { fontFamily: f.family } }));

export function PropertiesPanel(props: Props) {
  const { history, page, layers, readOnly } = props;
  const doc = history.doc;

  if (readOnly) {
    return (
      <div className="p-4 text-xs leading-relaxed text-white/50">
        A IA está montando o carrossel. A edição libera assim que a geração terminar.
      </div>
    );
  }
  if (!page) {
    return <div className="p-4 text-xs text-white/50">Selecione uma página ou camada.</div>;
  }
  if (layers.length === 0) return <PagePanel {...props} page={page} doc={doc} />;
  if (layers.length > 1) return <MultiPanel {...props} page={page} doc={doc} />;
  return <LayerPanel {...props} page={page} doc={doc} layer={layers[0]} />;
}

// ─── Página ──────────────────────────────────────────────────────────────────

function GradientEditor({
  gradient,
  palette,
  onChange,
}: {
  gradient: StudioGradient;
  palette: string[];
  onChange: (g: StudioGradient) => void;
}) {
  return (
    <div className="space-y-2 rounded-md bg-white/[0.03] p-2">
      <NumberField label="∠" value={gradient.angle} min={0} max={360} suffix="°" onChange={(angle) => onChange({ ...gradient, angle })} />
      {gradient.stops.map((stop, i) => (
        <div key={i} className="space-y-1.5 border-t border-white/[0.06] pt-2">
          <ColorField
            label={`Cor ${i + 1}`}
            value={stop.color}
            palette={palette}
            onChange={(color) =>
              onChange({ ...gradient, stops: gradient.stops.map((s, j) => (j === i ? { ...s, color: color ?? s.color } : s)) })
            }
          />
          <Row>
            <NumberField
              label="%"
              value={stop.at}
              min={0}
              max={100}
              onChange={(at) => onChange({ ...gradient, stops: gradient.stops.map((s, j) => (j === i ? { ...s, at } : s)) })}
            />
            <NumberField
              label="α"
              value={Math.round(stop.opacity * 100)}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) =>
                onChange({ ...gradient, stops: gradient.stops.map((s, j) => (j === i ? { ...s, opacity: v / 100 } : s)) })
              }
            />
          </Row>
        </div>
      ))}
    </div>
  );
}

function PagePanel({ history, page, palette, caption, onCaptionChange, onDuplicatePage, onDeletePage, doc }: Props & { page: StudioPage; doc: StudioDocument }) {
  const setPage = (patch: Partial<StudioPage>, key?: string) =>
    history.commit((d) => mapPage(d, page.id, (p) => ({ ...p, ...patch })), key);
  return (
    <div>
      <PanelSection title="Página">
        <TextField value={page.name} onChange={(name) => setPage({ name }, `page-name-${page.id}`)} />
        <ColorField label="Fundo" value={page.background} palette={palette} onChange={(c) => setPage({ background: c ?? page.background }, `page-bg-${page.id}`)} />
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={Boolean(page.gradient)}
            onChange={(e) =>
              setPage({
                gradient: e.target.checked
                  ? {
                      angle: 160,
                      stops: [
                        { color: page.background, opacity: 1, at: 0 },
                        { color: palette[1] ?? "#6366f1", opacity: 1, at: 100 },
                      ],
                    }
                  : null,
              })
            }
            className="accent-indigo-400"
          />
          Degradê no fundo
        </label>
        {page.gradient ? (
          <GradientEditor gradient={page.gradient} palette={palette} onChange={(gradient) => setPage({ gradient }, `page-grad-${page.id}`)} />
        ) : null}
        <div className="flex gap-2 pt-1">
          <PanelButton onClick={onDuplicatePage}>
            <Copy className="size-3.5" /> Duplicar
          </PanelButton>
          <PanelButton tone="danger" onClick={onDeletePage} disabled={doc.pages.length <= 1}>
            <Trash2 className="size-3.5" /> Excluir
          </PanelButton>
        </div>
      </PanelSection>
      <PanelSection title="Legenda do post">
        <TextField multiline rows={8} value={caption} onChange={onCaptionChange} placeholder="Legenda para o Instagram…" />
        <p className="text-[11px] text-white/35">Gerada pela IA junto do carrossel. Edite à vontade.</p>
      </PanelSection>
      <PanelSection title="Atalhos">
        <ul className="space-y-1 text-[11px] leading-relaxed text-white/45">
          <li>Duplo clique: editar texto / enquadrar imagem</li>
          <li>Shift + arrastar: travar eixo · Alt: sem encaixe</li>
          <li>Ctrl+Z / Ctrl+Shift+Z: desfazer / refazer</li>
          <li>Ctrl+D duplicar · Ctrl+C/V copiar/colar · Del apagar</li>
          <li>Ctrl+] / Ctrl+[ trazer para frente / enviar para trás</li>
          <li>Espaço + arrastar ou roda: mover · Ctrl + roda: zoom</li>
          <li>Shift+1 ajustar à tela · setas: mover 1px (Shift 10px)</li>
        </ul>
      </PanelSection>
    </div>
  );
}

// ─── Seleção múltipla ────────────────────────────────────────────────────────

function alignSelection(
  layers: StudioLayer[],
  measured: Record<string, number>,
  mode: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom",
  bounds: { x: number; y: number; width: number; height: number }
) {
  const patches = new Map<string, Partial<StudioLayer>>();
  for (const l of layers) {
    const b = layerBox(l, measured);
    if (mode === "left") patches.set(l.id, { x: Math.round(bounds.x) });
    if (mode === "hcenter") patches.set(l.id, { x: Math.round(bounds.x + (bounds.width - b.width) / 2) });
    if (mode === "right") patches.set(l.id, { x: Math.round(bounds.x + bounds.width - b.width) });
    if (mode === "top") patches.set(l.id, { y: Math.round(bounds.y) });
    if (mode === "vcenter") patches.set(l.id, { y: Math.round(bounds.y + (bounds.height - b.height) / 2) });
    if (mode === "bottom") patches.set(l.id, { y: Math.round(bounds.y + bounds.height - b.height) });
  }
  return patches;
}

function AlignButtons({ onAlign }: { onAlign: (mode: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => void }) {
  return (
    <div className="flex flex-wrap gap-0.5">
      <IconToggle title="Alinhar à esquerda" onClick={() => onAlign("left")}><AlignStartVertical className="size-3.5" /></IconToggle>
      <IconToggle title="Centralizar na horizontal" onClick={() => onAlign("hcenter")}><AlignCenterVertical className="size-3.5" /></IconToggle>
      <IconToggle title="Alinhar à direita" onClick={() => onAlign("right")}><AlignEndVertical className="size-3.5" /></IconToggle>
      <IconToggle title="Alinhar ao topo" onClick={() => onAlign("top")}><AlignStartHorizontal className="size-3.5" /></IconToggle>
      <IconToggle title="Centralizar na vertical" onClick={() => onAlign("vcenter")}><AlignCenterHorizontal className="size-3.5" /></IconToggle>
      <IconToggle title="Alinhar à base" onClick={() => onAlign("bottom")}><AlignEndHorizontal className="size-3.5" /></IconToggle>
    </div>
  );
}

function MultiPanel({ history, page, layers, measured, onDuplicate, onDelete, doc }: Props & { page: StudioPage; doc: StudioDocument }) {
  const boxes = layers.map((l) => layerBox(l, measured));
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const bounds = {
    x: minX,
    y: minY,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - minX,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - minY,
  };
  const ids = layers.map((l) => l.id);
  return (
    <div>
      <PanelSection title={`${layers.length} camadas`}>
        <div className="text-[11px] text-white/45">Alinhar entre si</div>
        <AlignButtons
          onAlign={(mode) => {
            const patches = alignSelection(layers, measured, mode, bounds);
            history.commit((d) => updateLayers(d, page.id, ids, (l) => patches.get(l.id) ?? {}));
          }}
        />
        <div className="text-[11px] text-white/45">Alinhar na página</div>
        <AlignButtons
          onAlign={(mode) => {
            const patches = alignSelection(layers, measured, mode, { x: 0, y: 0, width: doc.width, height: doc.height });
            history.commit((d) => updateLayers(d, page.id, ids, (l) => patches.get(l.id) ?? {}));
          }}
        />
        <SliderField
          label="Opacidade"
          min={0}
          max={100}
          value={Math.round((layers[0].opacity ?? 1) * 100)}
          format={(v) => `${v}%`}
          onChange={(v) => history.commit((d) => updateLayers(d, page.id, ids, () => ({ opacity: v / 100 })), `multi-opacity`)}
        />
        <div className="flex gap-2">
          <PanelButton onClick={onDuplicate}><Copy className="size-3.5" /> Duplicar</PanelButton>
          <PanelButton tone="danger" onClick={onDelete}><Trash2 className="size-3.5" /> Apagar</PanelButton>
        </div>
      </PanelSection>
    </div>
  );
}

// ─── Camada única ───────────────────────────────────────────────────────────

const TYPE_LABEL: Record<StudioLayer["type"], string> = {
  image: "Imagem",
  text: "Texto",
  shape: "Forma",
  button: "Botão",
};

function LayerPanel(props: Props & { page: StudioPage; doc: StudioDocument; layer: StudioLayer }) {
  const { history, page, layer, measured, doc, onDuplicate, onDelete } = props;
  const set = (patch: Partial<StudioLayer>, key?: string) =>
    history.commit((d) => updateLayers(d, page.id, [layer.id], () => patch), key ? `${key}-${layer.id}` : undefined);
  const box = layerBox(layer, measured);
  const order = (move: OrderMove) => history.commit((d) => reorderLayers(d, page.id, [layer.id], move));

  return (
    <div>
      <PanelSection
        title={TYPE_LABEL[layer.type]}
        action={
          <div className="flex gap-0.5">
            <IconToggle title={layer.hidden ? "Mostrar" : "Ocultar"} onClick={() => set({ hidden: !layer.hidden })}>
              {layer.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </IconToggle>
            <IconToggle title={layer.locked ? "Destravar" : "Travar"} active={layer.locked} onClick={() => set({ locked: !layer.locked })}>
              {layer.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
            </IconToggle>
            <IconToggle title="Duplicar (Ctrl+D)" onClick={onDuplicate}><Copy className="size-3.5" /></IconToggle>
            <IconToggle title="Apagar (Del)" onClick={onDelete}><Trash2 className="size-3.5" /></IconToggle>
          </div>
        }
      >
        <TextField value={layer.name} onChange={(name) => set({ name }, "name")} />
      </PanelSection>

      <PanelSection title="Posição e tamanho">
        <Row>
          <NumberField label="X" value={box.x} onChange={(x) => set({ x }, "x")} />
          <NumberField label="Y" value={box.y} onChange={(y) => set({ y }, "y")} />
          <NumberField label="L" value={box.width} min={4} onChange={(width) => set({ width }, "w")} />
          {layer.type === "text" && layer.autoHeight ? (
            <div className="flex h-7 items-center rounded-md bg-white/[0.03] px-2 text-[11px] text-white/40">A {Math.round(box.height)} · auto</div>
          ) : (
            <NumberField label="A" value={box.height} min={4} onChange={(height) => set({ height }, "h")} />
          )}
          <NumberField label="↻" value={layer.rotation} min={-180} max={180} suffix="°" onChange={(rotation) => set({ rotation }, "rot")} />
          <NumberField
            label="α"
            value={Math.round(layer.opacity * 100)}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => set({ opacity: v / 100 }, "opacity")}
          />
        </Row>
        <div className="text-[11px] text-white/45">Alinhar na página</div>
        <AlignButtons
          onAlign={(mode) => {
            const patch = alignSelection([layer], measured, mode, { x: 0, y: 0, width: doc.width, height: doc.height }).get(layer.id);
            if (patch) set(patch);
          }}
        />
        <div className="flex flex-wrap gap-0.5">
          <IconToggle title="Trazer para frente (Ctrl+Shift+])" onClick={() => order("front")}><ArrowUpToLine className="size-3.5" /></IconToggle>
          <IconToggle title="Avançar (Ctrl+])" onClick={() => order("forward")}><ArrowUp className="size-3.5" /></IconToggle>
          <IconToggle title="Recuar (Ctrl+[)" onClick={() => order("backward")}><ArrowDown className="size-3.5" /></IconToggle>
          <IconToggle title="Enviar para trás (Ctrl+Shift+[)" onClick={() => order("back")}><ArrowDownToLine className="size-3.5" /></IconToggle>
        </div>
      </PanelSection>

      {layer.type === "text" ? <TextSection {...props} layer={layer} set={set} /> : null}
      {layer.type === "image" ? <ImageSection {...props} layer={layer} set={set} /> : null}
      {layer.type === "shape" ? <ShapeSection {...props} layer={layer} set={set} /> : null}
      {layer.type === "button" ? <ButtonSection {...props} layer={layer} set={set} /> : null}
    </div>
  );
}

type SectionProps<T extends StudioLayer> = Props & {
  page: StudioPage;
  doc: StudioDocument;
  layer: T;
  set: (patch: Partial<StudioLayer>, key?: string) => void;
};

function TextSection({ layer, set, palette }: SectionProps<StudioTextLayer>) {
  return (
    <PanelSection title="Texto">
      <TextField multiline rows={4} value={layer.text} onChange={(text) => set({ text }, "text")} />
      <p className="text-[10px] text-white/35">Dica: envolva palavras em *asteriscos* para destacá-las.</p>
      <SelectField
        value={layer.fontFamily}
        style={{ fontFamily: layer.fontFamily }}
        options={fontOptions.some((o) => o.value === layer.fontFamily) ? fontOptions : [{ value: layer.fontFamily, label: "Fonte personalizada" }, ...fontOptions]}
        onChange={(fontFamily) => set({ fontFamily, fontWeight: Math.min(layer.fontWeight, heavyWeightFor(fontFamily)) } as Partial<StudioTextLayer>)}
      />
      <Row>
        <NumberField label="T" value={layer.fontSize} min={6} max={600} onChange={(fontSize) => set({ fontSize } as Partial<StudioTextLayer>, "fs")} />
        <SelectField value={String(layer.fontWeight)} options={WEIGHTS} onChange={(w) => set({ fontWeight: Number(w) } as Partial<StudioTextLayer>)} />
        <NumberField label="↕" value={layer.lineHeight} min={0.6} max={3} step={0.05} onChange={(lineHeight) => set({ lineHeight } as Partial<StudioTextLayer>, "lh")} />
        <NumberField label="↔" value={layer.letterSpacing} min={-20} max={60} step={0.5} onChange={(letterSpacing) => set({ letterSpacing } as Partial<StudioTextLayer>, "ls")} />
      </Row>
      <div className="flex flex-wrap gap-0.5">
        <IconToggle title="Alinhar à esquerda" active={layer.align === "left"} onClick={() => set({ align: "left" } as Partial<StudioTextLayer>)}><AlignLeft className="size-3.5" /></IconToggle>
        <IconToggle title="Centralizar" active={layer.align === "center"} onClick={() => set({ align: "center" } as Partial<StudioTextLayer>)}><AlignCenter className="size-3.5" /></IconToggle>
        <IconToggle title="Alinhar à direita" active={layer.align === "right"} onClick={() => set({ align: "right" } as Partial<StudioTextLayer>)}><AlignRight className="size-3.5" /></IconToggle>
        <span className="mx-1 w-px bg-white/10" />
        <IconToggle title="Negrito" active={layer.fontWeight >= 700} onClick={() => set({ fontWeight: layer.fontWeight >= 700 ? 400 : heavyWeightFor(layer.fontFamily) } as Partial<StudioTextLayer>)}><Bold className="size-3.5" /></IconToggle>
        <IconToggle title="Itálico" active={layer.italic} onClick={() => set({ italic: !layer.italic } as Partial<StudioTextLayer>)}><Italic className="size-3.5" /></IconToggle>
        <IconToggle title="Caixa alta" active={layer.uppercase} onClick={() => set({ uppercase: !layer.uppercase } as Partial<StudioTextLayer>)}><CaseUpper className="size-3.5" /></IconToggle>
        <IconToggle title="Sombra" active={layer.shadow} onClick={() => set({ shadow: !layer.shadow } as Partial<StudioTextLayer>)}><Type className="size-3.5" /></IconToggle>
      </div>
      <ColorField label="Cor" value={layer.color} palette={palette} onChange={(c) => set({ color: c ?? layer.color } as Partial<StudioTextLayer>, "color")} />
      <ColorField label="Destaque (*palavras*)" value={layer.accentColor} palette={palette} onChange={(c) => set({ accentColor: c ?? layer.accentColor } as Partial<StudioTextLayer>, "accent")} />
      <ColorField label="Marca-texto do destaque" value={layer.highlight ?? null} allowNone palette={palette} onChange={(c) => set({ highlight: c } as Partial<StudioTextLayer>, "hl")} />
      <label className="flex items-center gap-2 text-xs text-white/70">
        <input type="checkbox" className="accent-indigo-400" checked={layer.autoHeight} onChange={(e) => set({ autoHeight: e.target.checked } as Partial<StudioTextLayer>)} />
        Altura automática
      </label>
    </PanelSection>
  );
}

function ImageSection({ layer, set, page, doc, history, imageActions, busy }: SectionProps<StudioImageLayer>) {
  const [prompt, setPrompt] = useState(layer.prompt ?? "");
  const [instruction, setInstruction] = useState("");
  const [kind, setKind] = useState<"background" | "element">(layer.role === "element" ? "element" : "background");
  useEffect(() => {
    setPrompt(layer.prompt ?? "");
    setInstruction("");
    setKind(layer.role === "element" ? "element" : "background");
  }, [layer.id, layer.prompt, layer.role]);
  const isBusy = busy.has(layer.id);
  const asImage = (patch: Partial<StudioImageLayer>, key?: string) => set(patch as Partial<StudioLayer>, key);

  return (
    <>
      <PanelSection title="Imagem">
        {layer.error ? <p className="rounded-md bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">{layer.error}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <PanelButton onClick={() => imageActions.replace(layer.id)} disabled={isBusy}>
            <ImageUp className="size-3.5" /> Trocar
          </PanelButton>
          <PanelButton onClick={() => imageActions.cutout(layer.id)} disabled={isBusy || !layer.src}>
            <Scissors className="size-3.5" /> Remover fundo
          </PanelButton>
          <PanelButton
            onClick={() =>
              history.commit((d) =>
                reorderLayers(
                  updateLayers(d, page.id, [layer.id], () => ({ x: 0, y: 0, width: doc.width, height: doc.height, rotation: 0, role: "background", fit: "cover", radius: 0 }) as Partial<StudioLayer>),
                  page.id,
                  [layer.id],
                  "back"
                )
              )
            }
          >
            <Maximize className="size-3.5" /> Usar de fundo
          </PanelButton>
          <PanelButton onClick={() => asImage({ flipX: !layer.flipX })}>
            <FlipHorizontal className="size-3.5" /> Espelhar
          </PanelButton>
        </div>
        <div className="flex gap-1">
          <IconToggle title="Preencher a caixa (corta)" active={layer.fit === "cover"} onClick={() => asImage({ fit: "cover" })}>Preencher</IconToggle>
          <IconToggle title="Caber inteira na caixa" active={layer.fit === "contain"} onClick={() => asImage({ fit: "contain" })}>Caber</IconToggle>
        </div>
        {layer.fit === "cover" ? (
          <SliderField label="Zoom" min={1} max={4} step={0.01} value={layer.zoom || 1} format={(v) => `${Math.round(v * 100)}%`} onChange={(zoom) => asImage({ zoom }, "zoom")} />
        ) : null}
        <Row>
          <SliderField label="Foco X" min={0} max={100} value={layer.focusX} onChange={(focusX) => asImage({ focusX }, "fx")} />
          <SliderField label="Foco Y" min={0} max={100} value={layer.focusY} onChange={(focusY) => asImage({ focusY }, "fy")} />
        </Row>
        <NumberField label="◜" value={layer.radius} min={0} max={2000} onChange={(radius) => asImage({ radius }, "radius")} />
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input type="checkbox" className="accent-indigo-400" checked={Boolean(layer.shadow)} onChange={(e) => asImage({ shadow: e.target.checked })} />
          Sombra projetada
        </label>
        <p className="text-[10px] text-white/35">Duplo clique na imagem para enquadrar arrastando.</p>
      </PanelSection>

      <PanelSection title="Ajustes">
        <SliderField label="Brilho" min={30} max={170} value={layer.brightness ?? 100} format={(v) => `${v}%`} onChange={(brightness) => asImage({ brightness }, "br")} />
        <SliderField label="Contraste" min={30} max={170} value={layer.contrast ?? 100} format={(v) => `${v}%`} onChange={(contrast) => asImage({ contrast }, "ct")} />
        <SliderField label="Saturação" min={0} max={200} value={layer.saturate ?? 100} format={(v) => `${v}%`} onChange={(saturate) => asImage({ saturate }, "sat")} />
        <SliderField label="Desfoque" min={0} max={40} value={layer.blur ?? 0} format={(v) => `${v}px`} onChange={(blur) => asImage({ blur }, "blur")} />
        <PanelButton onClick={() => asImage({ brightness: 100, contrast: 100, saturate: 100, blur: 0 })}>
          <Eraser className="size-3.5" /> Zerar ajustes
        </PanelButton>
      </PanelSection>

      <PanelSection title="IA">
        <div className="space-y-1.5">
          <div className="text-[11px] text-white/55">Editar esta imagem</div>
          <TextField multiline rows={2} value={instruction} onChange={setInstruction} placeholder="Ex.: deixe o fundo mais escuro, troque a roupa para azul…" />
          <PanelButton
            tone="primary"
            className="w-full"
            disabled={isBusy || !layer.src || !instruction.trim()}
            onClick={() => imageActions.edit(layer.id, instruction)}
          >
            {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />} Aplicar edição
          </PanelButton>
        </div>
        <div className="space-y-1.5 border-t border-white/[0.06] pt-2">
          <div className="text-[11px] text-white/55">Gerar imagem nova</div>
          <div className="flex gap-1">
            <IconToggle title="Foto/cena de fundo" active={kind === "background"} onClick={() => setKind("background")}>Cena</IconToggle>
            <IconToggle title="Objeto recortado (sem fundo)" active={kind === "element"} onClick={() => setKind("element")}>Elemento</IconToggle>
          </div>
          <TextField multiline rows={4} value={prompt} onChange={setPrompt} placeholder="Descreva a imagem (sem texto)…" />
          <PanelButton
            tone="primary"
            className="w-full"
            disabled={isBusy || !prompt.trim()}
            onClick={() => imageActions.generate(layer.id, prompt, kind)}
          >
            {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Gerar
          </PanelButton>
        </div>
      </PanelSection>
    </>
  );
}

function ShapeSection({ layer, set, palette }: SectionProps<StudioShapeLayer>) {
  const asShape = (patch: Partial<StudioShapeLayer>, key?: string) => set(patch as Partial<StudioLayer>, key);
  return (
    <PanelSection title="Forma">
      <div className="flex gap-1">
        <IconToggle title="Retângulo" active={layer.shape === "rect"} onClick={() => asShape({ shape: "rect" })}>Retângulo</IconToggle>
        <IconToggle title="Elipse" active={layer.shape === "ellipse"} onClick={() => asShape({ shape: "ellipse" })}>Elipse</IconToggle>
      </div>
      <ColorField label="Preenchimento" value={layer.fill} palette={palette} onChange={(c) => asShape({ fill: c ?? layer.fill }, "fill")} />
      <label className="flex items-center gap-2 text-xs text-white/70">
        <input
          type="checkbox"
          className="accent-indigo-400"
          checked={Boolean(layer.gradient)}
          onChange={(e) =>
            asShape({
              gradient: e.target.checked
                ? { angle: 180, stops: [{ color: layer.fill, opacity: 0, at: 0 }, { color: layer.fill, opacity: 1, at: 100 }] }
                : null,
            })
          }
        />
        Degradê
      </label>
      {layer.gradient ? <GradientEditor gradient={layer.gradient} palette={palette} onChange={(gradient) => asShape({ gradient }, "grad")} /> : null}
      {layer.shape === "rect" ? <NumberField label="◜" value={layer.radius} min={0} max={2000} onChange={(radius) => asShape({ radius }, "radius")} /> : null}
      <ColorField label="Borda" value={layer.stroke} allowNone palette={palette} onChange={(stroke) => asShape({ stroke, strokeWidth: stroke && !layer.strokeWidth ? 4 : layer.strokeWidth }, "stroke")} />
      {layer.stroke ? <NumberField label="Esp" value={layer.strokeWidth} min={0} max={80} onChange={(strokeWidth) => asShape({ strokeWidth }, "sw")} /> : null}
    </PanelSection>
  );
}

function ButtonSection({ layer, set, palette }: SectionProps<StudioButtonLayer>) {
  const asButton = (patch: Partial<StudioButtonLayer>, key?: string) => set(patch as Partial<StudioLayer>, key);
  return (
    <PanelSection title="Botão">
      <TextField value={layer.text} onChange={(text) => asButton({ text }, "text")} />
      <SelectField
        value={layer.fontFamily}
        style={{ fontFamily: layer.fontFamily }}
        options={fontOptions.some((o) => o.value === layer.fontFamily) ? fontOptions : [{ value: layer.fontFamily, label: "Fonte personalizada" }, ...fontOptions]}
        onChange={(fontFamily) => asButton({ fontFamily, fontWeight: Math.min(layer.fontWeight, heavyWeightFor(fontFamily)) })}
      />
      <Row>
        <NumberField label="T" value={layer.fontSize} min={8} max={200} onChange={(fontSize) => asButton({ fontSize }, "fs")} />
        <SelectField value={String(layer.fontWeight)} options={WEIGHTS} onChange={(w) => asButton({ fontWeight: Number(w) })} />
        <NumberField label="◜" value={layer.radius} min={0} max={999} onChange={(radius) => asButton({ radius }, "radius")} />
        <SelectField
          value={layer.icon ?? ""}
          options={[{ value: "", label: "Sem ícone" }, ...CTA_ICONS.map((i) => ({ value: i.id, label: i.label }))]}
          onChange={(icon) => asButton({ icon: icon || null })}
        />
      </Row>
      <div className="flex gap-0.5">
        <IconToggle title="Caixa alta" active={layer.uppercase} onClick={() => asButton({ uppercase: !layer.uppercase })}><CaseUpper className="size-3.5" /></IconToggle>
      </div>
      <ColorField label="Fundo" value={layer.fill} palette={palette} onChange={(c) => asButton({ fill: c ?? layer.fill }, "fill")} />
      <ColorField label="Texto" value={layer.color} palette={palette} onChange={(c) => asButton({ color: c ?? layer.color }, "color")} />
      <ColorField label="Borda" value={layer.stroke} allowNone palette={palette} onChange={(stroke) => asButton({ stroke, strokeWidth: stroke && !layer.strokeWidth ? 3 : layer.strokeWidth }, "stroke")} />
    </PanelSection>
  );
}
