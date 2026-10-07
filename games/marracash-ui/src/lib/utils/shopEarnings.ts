import type { ShopEntry } from '@tabletop/marracash'

export type Earning = { playerId: string; amount: number }

// The owner pays the mover's cut out of the income, so each side shows what it nets
export function shopEarnings(entry: ShopEntry, moverId: string): Earning[] {
    if (entry.ownerId === moverId) return [{ playerId: moverId, amount: entry.income }]
    const earnings = [{ playerId: entry.ownerId, amount: entry.income - entry.moverCut }]
    return entry.moverCut > 0
        ? [...earnings, { playerId: moverId, amount: entry.moverCut }]
        : earnings
}
