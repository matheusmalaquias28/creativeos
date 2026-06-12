export const TRADITIONAL_DESIGNER_MINUTES = 60;
export const HYBRID_DESIGNER_MINUTES = 5;

export function traditionalMinutesForDemands(count: number): number {
  return count * TRADITIONAL_DESIGNER_MINUTES;
}

export function hybridMinutesForDemands(count: number): number {
  return count * HYBRID_DESIGNER_MINUTES;
}

export function formatDesignerDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}
