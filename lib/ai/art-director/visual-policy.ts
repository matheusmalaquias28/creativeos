export const VISUAL_MODES = ['free', 'guided', 'brand'] as const;
export type VisualMode = (typeof VISUAL_MODES)[number];
export function resolveVisualMode(value: unknown, hasIdentity: boolean): VisualMode {
  return VISUAL_MODES.includes(value as VisualMode) ? value as VisualMode : hasIdentity ? 'brand' : 'free';
}
export function visualPolicy(mode: VisualMode): string {
  if (mode === 'brand') return 'Follow the existing brand palette and typography. References establish identity, not a mandatory layout. Develop a new concept for this copy.';
  if (mode === 'guided') return 'Follow only the explicit client preferences below. Choose all unspecified colours, typography and composition for this copy. Past designs are optional inspiration, not binding identity.';
  return 'Create an original visual direction from this copy. Choose a coherent palette, typography and composition. Do not infer a mandatory identity from previous designs or industry stereotypes.';
}
