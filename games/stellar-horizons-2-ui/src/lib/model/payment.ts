export interface TechPayment {
    markers: number[]
    cash: number
}

export function paymentTotal(payment: TechPayment): number {
    return payment.markers.reduce((total, value) => total + value, 0) + payment.cash
}

export function suggestPayment(held: readonly number[], cost: number, cash: number) {
    const best = bestMarkerSubset(held, cost)
    const markerValue = best.reduce((total, value) => total + value, 0)
    const needed = Math.max(0, cost - markerValue)
    return needed <= cash ? { markers: best, cash: needed } : undefined
}

function bestMarkerSubset(held: readonly number[], cost: number): number[] {
    const fewestBySum = new Map<number, number[]>([[0, []]])
    for (const marker of held) {
        const sums = [...fewestBySum.entries()].toSorted(([a], [b]) => b - a)
        for (const [sum, markers] of sums) {
            const next = sum + marker
            const existing = fewestBySum.get(next)
            if (!existing || existing.length > markers.length + 1) {
                fewestBySum.set(next, [...markers, marker])
            }
        }
    }
    const sums = [...fewestBySum.keys()]
    const covering = sums.filter((sum) => sum >= cost)
    const chosen = covering.length > 0 ? Math.min(...covering) : Math.max(...sums)
    return (fewestBySum.get(chosen) ?? []).toSorted((a, b) => b - a)
}

export function cashNeeded(markers: readonly number[], cost: number): number {
    return Math.max(0, cost - markers.reduce((total, value) => total + value, 0))
}
