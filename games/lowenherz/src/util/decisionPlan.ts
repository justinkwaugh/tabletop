// Builds the ordered sequence of decision-card placements for one round, following the
// rulebook's per-player-count rules for compensating for missing "seats" (there are
// always 3 actions on a card, and rounds are built around 4 conceptual player seats):
//   - 4 players: each of the 4 players places exactly 1 decision card, in turn order.
//   - 3 players: the first player places 2 decision cards (compensating for the
//     missing 4th seat), then each other player places 1 - "the first player selects
//     two decision cards, placing both face up on the table."
//   - 2 players: the first player places 2, then the second player also places 2 -
//     "The first player always lays 2 decision cards" (and, symmetrically, so does the
//     second, since together they must cover all 4 seats).
// A player's slots are always placed back-to-back (front-loaded), never interleaved
// with another player's turn, matching how the rulebook describes it.
export function buildDecisionPlan(turnOrderFromFirstPlayer: string[]): string[] {
    const totalSlots = 4
    const playerCount = turnOrderFromFirstPlayer.length

    const counts = new Array(playerCount).fill(Math.floor(totalSlots / playerCount))
    let deficit = totalSlots - counts.reduce((sum: number, count: number) => sum + count, 0)
    for (let i = 0; deficit > 0; i++, deficit--) {
        counts[i % playerCount] += 1
    }

    const plan: string[] = []
    turnOrderFromFirstPlayer.forEach((playerId, index) => {
        for (let i = 0; i < counts[index]; i++) plan.push(playerId)
    })
    return plan
}

// Rotates turnOrder (the fixed seating order) so it starts at firstPlayerId.
export function rotateToStart(turnOrder: string[], firstPlayerId: string): string[] {
    const startIndex = turnOrder.indexOf(firstPlayerId)
    if (startIndex < 0) return turnOrder
    return [...turnOrder.slice(startIndex), ...turnOrder.slice(0, startIndex)]
}

// Decision-card placement progress is derived from how many have been committed so far
// this round, the same pattern used for castle-setup placement.
export function currentDecisionPlayer(plan: string[], totalDecisionsMade: number): string | undefined {
    return plan[totalDecisionsMade]
}

export function isRoundDecided(plan: string[], totalDecisionsMade: number): boolean {
    return totalDecisionsMade >= plan.length
}

// Whose turn it currently is to lay a decision card - the gating condition shared by
// every politics card that's "played with a decision card" (Renegade, Alliance, and
// cancelling an Alliance).
export function currentChoosingPlayerId(
    turnOrder: string[],
    firstPlayerId: string,
    totalDecisionsMade: number
): string | undefined {
    return currentDecisionPlayer(buildDecisionPlan(rotateToStart(turnOrder, firstPlayerId)), totalDecisionsMade)
}
