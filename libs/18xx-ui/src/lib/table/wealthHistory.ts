import type { EighteenXXState, PlayerNetWorth } from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'
import { RoundProgress, type RoundProgressTitle } from './roundProgress.js'
import { roundLabel, roundTitle, type RoundHeading } from './roundHeading.js'

export type WealthPoint = {
    id: string
    label: string
    title: string
    wealth: Readonly<PlayerNetWorth>
}

export type WealthHistoryTitle = RoundProgressTitle & { startingCash: number }

/**
 * Every player's wealth at the start of the game and at the end of each round, oldest first,
 * from what the round-ending Actions record. The final wealth ends the round the game ended in.
 *
 * Games stored before rounds recorded their ends lack their opening and title-round points.
 */
export function wealthHistory(
    actions: readonly GameAction[],
    state: Pick<EighteenXXState, 'players' | 'finalWealth'>,
    title: WealthHistoryTitle
): WealthPoint[] {
    const points: WealthPoint[] = [
        {
            id: 'start',
            label: 'Start',
            title: 'Start',
            wealth: Object.fromEntries(
                state.players.map(({ playerId }) => [playerId, title.startingCash])
            )
        }
    ]
    // A round that ends again, such as one a merger gives another company to operate, keeps its
    // place with its later end.
    function record(heading: RoundHeading, wealth: PlayerNetWorth) {
        const label = roundLabel(heading)
        const point = { id: label, label, title: roundTitle(heading), wealth }
        const index = points.findIndex((existing) => existing.id === label)
        if (index >= 0) points[index] = point
        else points.push(point)
    }
    const rounds = new RoundProgress(title)
    // Operating rounds held before the first stock round, as in 1846's two-player opening,
    // belong to the opening.
    let firstStockRoundEnded = false
    for (const action of actions) {
        for (const { round, heading, playerNetWorth } of rounds.advance(action)) {
            if (round === 'stock') firstStockRoundEnded = true
            if (!playerNetWorth || (round === 'operating' && !firstStockRoundEnded)) continue
            record(heading, playerNetWorth)
        }
    }
    if (state.finalWealth)
        record(
            rounds.current,
            Object.fromEntries(state.finalWealth.map(({ playerId, total }) => [playerId, total]))
        )
    return points
}
