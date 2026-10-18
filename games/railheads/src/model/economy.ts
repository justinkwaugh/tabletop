export function selectionCost(selections: number, playerCount: number): number {
    if (playerCount === 3) {
        return selections + 1
    }
    return selections === 0 ? 1 : 2 ** (selections - 1)
}

export function pileCoins(selections: number, playerCount: number): number {
    let coins = 0
    for (let selection = 0; selection < selections; selection++) {
        coins += selectionCost(selection, playerCount)
    }
    return coins
}

export function dividendPerShare(revenue: number, sharesSold: number): number {
    return sharesSold === 0 ? 0 : Math.ceil(revenue / sharesSold)
}

export function minimumShareBid(revenue: number, sharesSold: number): number {
    return Math.ceil(revenue / (sharesSold + 1))
}

export function finalRoundReduction(unsoldShares: readonly number[]): number {
    return unsoldShares.reduce((sum, unsold) => sum + (unsold === 0 ? 2 : unsold === 1 ? 1 : 0), 0)
}

export function halfPrice(cost: number): number {
    return Math.ceil(cost / 2)
}
