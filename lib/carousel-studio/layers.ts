import type {
  StudioButtonLayer,
  StudioImageLayer,
  StudioLayer,
  StudioPage,
  StudioShapeLayer,
  StudioTextLayer,
} from "@/types/carousel-studio";
import { STUDIO_FONTS } from "./fonts";

export function newId(): string {
  return crypto.randomUUID();
}

const DEFAULT_FAMILY = STUDIO_FONTS[0].family;

export function makeTextLayer(overrides: Partial<StudioTextLayer> = {}): StudioTextLayer {
  return {
    id: newId(),
    type: "text",
    name: "Texto",
    x: 100,
    y: 100,
    width: 700,
    height: 120,
    rotation: 0,
    opacity: 1,
    text: "Seu texto aqui",
    fontFamily: DEFAULT_FAMILY,
    fontSize: 64,
    fontWeight: 700,
    color: "#ffffff",
    accentColor: "#f5c542",
    align: "left",
    lineHeight: 1.1,
    letterSpacing: 0,
    uppercase: false,
    italic: false,
    autoHeight: true,
    shadow: false,
    highlight: null,
    ...overrides,
  };
}

export function makeImageLayer(overrides: Partial<StudioImageLayer> = {}): StudioImageLayer {
  return {
    id: newId(),
    type: "image",
    name: "Imagem",
    x: 0,
    y: 0,
    width: 600,
    height: 600,
    rotation: 0,
    opacity: 1,
    src: null,
    role: "photo",
    fit: "cover",
    focusX: 50,
    focusY: 50,
    zoom: 1,
    radius: 0,
    flipX: false,
    brightness: 100,
    contrast: 100,
    saturate: 100,
    blur: 0,
    shadow: false,
    prompt: null,
    status: null,
    error: null,
    ...overrides,
  };
}

export function makeShapeLayer(overrides: Partial<StudioShapeLayer> = {}): StudioShapeLayer {
  return {
    id: newId(),
    type: "shape",
    name: "Forma",
    x: 120,
    y: 120,
    width: 400,
    height: 400,
    rotation: 0,
    opacity: 1,
    shape: "rect",
    fill: "#ffffff",
    gradient: null,
    stroke: null,
    strokeWidth: 0,
    radius: 0,
    ...overrides,
  };
}

export function makeButtonLayer(overrides: Partial<StudioButtonLayer> = {}): StudioButtonLayer {
  return {
    id: newId(),
    type: "button",
    name: "Botão",
    x: 100,
    y: 100,
    width: 440,
    height: 104,
    rotation: 0,
    opacity: 1,
    text: "Saiba mais",
    fontFamily: DEFAULT_FAMILY,
    fontSize: 34,
    fontWeight: 700,
    color: "#0b0b0f",
    fill: "#ffffff",
    stroke: null,
    strokeWidth: 0,
    radius: 999,
    icon: "ArrowRight",
    uppercase: false,
    ...overrides,
  };
}

export function makePage(overrides: Partial<StudioPage> = {}): StudioPage {
  return {
    id: newId(),
    name: "Página",
    background: "#0b0b0f",
    gradient: null,
    layers: [],
    ...overrides,
  };
}

/** Cópia profunda com ids novos (duplicar camada/página). */
export function cloneLayer<T extends StudioLayer>(layer: T, offset = 0): T {
  return { ...structuredClone(layer), id: newId(), x: layer.x + offset, y: layer.y + offset };
}

export function clonePage(page: StudioPage): StudioPage {
  return {
    ...structuredClone(page),
    id: newId(),
    name: `${page.name} (cópia)`,
    layers: page.layers.map((l) => cloneLayer(l)),
  };
}
