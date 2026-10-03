import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    MachineContext,
    assert,
    assertExists
} from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { rollEndDie } from '../data/dice.js'
import { endDieIsRolled, endDieThreshold, stableRegimeWinner } from '../util/victory.js'

export type RollEndDieMetadata = Type.Static<typeof RollEndDieMetadata>
export const RollEndDieMetadata = Type.Object({
    roll: Type.Number(),
    round: Type.Number(),
    threshold: Type.Number(),
    wonBy: Type.Optional(Type.String())
})

export type RollEndDie = Type.Static<typeof RollEndDie>
export const RollEndDie = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RollEndDie),
            playerId: Type.String(),
            metadata: Type.Optional(RollEndDieMetadata)
        })
    ])
)

export const RollEndDieValidator = Compile(RollEndDie)

export function isRollEndDie(action?: GameAction): action is RollEndDie {
    return action?.type === ActionType.RollEndDie
}

/** R-3.3, R-3.3.1 — the Chancellor's roll at the end of rounds five to seven. */
export class HydratedRollEndDie extends HydratableAction<typeof RollEndDie> implements RollEndDie {
    declare type: ActionType.RollEndDie
    declare playerId: string
    declare metadata?: RollEndDieMetadata

    constructor(data: RollEndDie) {
        super(data, RollEndDieValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = HydratedRollEndDie.reasonCannotRoll(state, this.playerId)
        if (reason) {
            throw Error(`Cannot roll the end die: ${reason}`)
        }
        const round = state.round
        const threshold = endDieThreshold(round)
        assertExists(threshold, 'A roll the Chancellor may make has a threshold')
        assert(
            endDieIsRolled(state),
            'R-3.3 — the end die is rolled only while an Imperial player holds the title'
        )

        const roll = rollEndDie(state.getProtectedPrng())
        // R-X.3: the PRNG advanced, so this action is not undoable.
        this.revealsInfo = true

        const outcome = stableRegimeWinner(state, roll)
        if (outcome) {
            state.winningPlayerIds = [outcome.winnerPlayerId]
            this.metadata = { roll, round, threshold, wonBy: outcome.rule }
            return
        }
        state.round += 1
        this.metadata = { roll, round, threshold }
    }

    static reasonCannotRoll(state: HydratedOathGameState, playerId: string): string | undefined {
        if (state.machineState !== MachineState.EndOfRound)
            return 'no round is waiting on the end die'
        if (playerId !== state.chancellorId()) return 'only the Chancellor rolls the end die'
        if (endDieThreshold(state.round) === undefined) {
            return `R-3.3 rolls no end die at the end of round ${state.round}`
        }
        return undefined
    }

    static canDoRollEndDie(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedRollEndDie.reasonCannotRoll(state, playerId) === undefined
    }
}
