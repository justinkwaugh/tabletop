export type Standing = { playerId: string; money: number; rank: number }

// Equal cash shares a rank and the next rank skips (1, 1, 3); ties list in seating order.
export function finalStandings(
    players: readonly { playerId: string; money: number }[],
    seatingOrder: readonly string[]
): Standing[] {
    const sorted = players.toSorted(
        (a, b) =>
            b.money - a.money || seatingOrder.indexOf(a.playerId) - seatingOrder.indexOf(b.playerId)
    )
    return sorted.map((player) => ({
        ...player,
        rank: sorted.findIndex((other) => other.money === player.money) + 1
    }))
}
