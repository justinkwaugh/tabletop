// A space chosen again before anyone empties it costs one coin more each time with three players,
// and double the previous cost with four or five.
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

// What a share would pay once sold: the revenue shared among the sold shares and this one.
export function minimumShareBid(revenue: number, sharesSold: number): number {
    return Math.ceil(revenue / (sharesSold + 1))
}

// Before the final round the Round Timer loses $1 for every company with one share left on its
// charter and $2 for every company with none.
export function finalRoundReduction(unsoldShares: readonly number[]): number {
    return unsoldShares.reduce((sum, unsold) => sum + (unsold === 0 ? 2 : unsold === 1 ? 1 : 0), 0)
}

export function halfPrice(cost: number): number {
    return Math.ceil(cost / 2)
}
