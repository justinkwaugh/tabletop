import { CanalSegment } from '../model/board.js'

// Returns the highest total amount proposed for any single canal segment.
// Used to compute the rejection penalty the overseer owes if they refuse all bribes.
export function maxSegmentTotal(
    proposals: Array<{ segment: CanalSegment; amount: number }>
): number {
    const totals = new Map<string, number>()
    for (const p of proposals) {
        const key = `${p.segment.orientation},${p.segment.col},${p.segment.row}`
        totals.set(key, (totals.get(key) ?? 0) + p.amount)
    }
    return totals.size > 0 ? Math.max(...totals.values()) : 0
}
