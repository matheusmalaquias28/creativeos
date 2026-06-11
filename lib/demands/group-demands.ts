import {
  getDemandColorState,
  COLOR_GROUP_MAP,
  type DemandColorState,
} from "@/lib/demands/demand-color";
import type { CreativeDemandListItem } from "@/types/demand";

export function groupDemands(demands: CreativeDemandListItem[]) {
  const groups = new Map<
    DemandColorState,
    { demands: CreativeDemandListItem[] }
  >();

  for (const demand of demands) {
    const colorState = getDemandColorState(demand);
    if (!groups.has(colorState)) {
      groups.set(colorState, { demands: [] });
    }
    groups.get(colorState)!.demands.push(demand);
  }

  return Array.from(groups.entries())
    .map(([key, value]) => ({
      key,
      ...COLOR_GROUP_MAP[key],
      demands: value.demands,
    }))
    .sort((a, b) => a.priority - b.priority);
}
