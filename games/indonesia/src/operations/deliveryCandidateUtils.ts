import type { IndonesiaNodeId } from '../utils/indonesiaNodes.js'

export function sortNodeIds(nodeIds: readonly IndonesiaNodeId[]): IndonesiaNodeId[] {
    return [...nodeIds].sort((a, b) => a.localeCompare(b))
}

export function seaLaneKey(seaAreaA: IndonesiaNodeId, seaAreaB: IndonesiaNodeId): string {
    if (seaAreaA.localeCompare(seaAreaB) <= 0) {
        return `${seaAreaA}|${seaAreaB}`
    }

    return `${seaAreaB}|${seaAreaA}`
}
