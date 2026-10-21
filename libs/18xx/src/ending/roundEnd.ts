import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { GameAction } from '@tabletop/common'
import { portfolioWealth, type ValuationRules } from './finalWealth.js'
import type { StockState } from '../stock/stockState.js'

/** Every player's wealth by player id, valued as at the game's end. */
export const PlayerNetWorth = Type.Record(Type.String(), Type.Number())
export type PlayerNetWorth = Type.Static<typeof PlayerNetWorth>

export function playerNetWorth(state: StockState, rules: ValuationRules): PlayerNetWorth {
    return Object.fromEntries(
        state.players.map(({ playerId }) => [
            playerId,
            portfolioWealth(state, { kind: 'player', playerId }, rules).reduce(
                (sum, item) => sum + item.value,
                0
            )
        ])
    )
}

/**
 * Recorded in the `metadata` of the Action that ends a round. A `FinishOperatingTurn` ending an
 * operating round records its own snapshot instead.
 */
export const RoundEnd = Type.Object(
    {
        round: Type.Union([
            Type.Literal('opening'),
            Type.Literal('stock'),
            Type.Literal('operating'),
            Type.Literal('title')
        ]),
        playerNetWorth: PlayerNetWorth
    },
    { additionalProperties: false }
)
export type RoundEnd = Type.Static<typeof RoundEnd>

export function roundEnd(
    state: StockState,
    rules: ValuationRules,
    round: RoundEnd['round']
): RoundEnd {
    return { round, playerNetWorth: playerNetWorth(state, rules) }
}

const RecordedRoundEnd = Compile(Type.Object({ metadata: Type.Object({ roundEnd: RoundEnd }) }))

/** The round an Action ended, from any Action that records one. */
export function recordedRoundEnd(action: GameAction): RoundEnd | undefined {
    return RecordedRoundEnd.Check(action) ? action.metadata.roundEnd : undefined
}
