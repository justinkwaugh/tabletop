// Builds the ordered sequence of decision-card placements for one round. Every player
// lays one decision card; below 4 players the FIRST player lays a second one, and only
// the first:
//   - 4 players: 1 card each, in turn order.
//   - 3 players: "the first player selects two decision cards, placing both face up on
//     the table" - so 2, 1, 1.
//   - 2 players: "The first player always lays 2 decision cards" - so 2, 1. The rule
//     singles out the first player, exactly as the 3-player rule does, rather than
//     handing both players an extra card to fill some fixed number of slots (an earlier
//     reading here gave 2 and 2, which guaranteed a contested action every round by
//     pigeonhole - 4 cards over 3 actions - and gave the second player influence the
//     rulebook doesn't).
// A player's slots are always placed back-to-back (front-loaded), never interleaved
// with another player's turn, matching how the rulebook describes it.
export function buildDecisionPlan(turnOrderFromFirstPlayer: string[]): string[] {
    const playerCount = turnOrderFromFirstPlayer.length

    const plan: string[] = []
    turnOrderFromFirstPlayer.forEach((playerId, index) => {
        const cards = index === 0 && playerCount < 4 ? 2 : 1
        for (let i = 0; i < cards; i++) plan.push(playerId)
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
