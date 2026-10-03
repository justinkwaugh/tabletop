import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { rollEndDie } from '../data/dice.js'
import { endDieIsRolled, stableRegimeWinner, warExhaustionWinner } from '../util/victory.js'
import { reasonNotYourTurn } from '../util/turn.js'
import { OathRevision, isAtLeastOathRevision } from '../util/revision.js'

// R-3.4
export const FINAL_ROUND = 8

export type CompleteRestMetadata = Type.Static<typeof CompleteRestMetadata>
export const CompleteRestMetadata = Type.Object({
    endedRound: Type.Optional(Type.Boolean()),
    /** R-3.3 — from the turn-flow revision, the Chancellor's roll comes next (`RollEndDie`). */
    awaitsEndDie: Type.Optional(Type.Boolean()),
    endDieRoll: Type.Optional(Type.Number()),
    round: Type.Optional(Type.Number()),
    wonBy: Type.Optional(Type.String())
})

export type CompleteRest = Type.Static<typeof CompleteRest>
export const CompleteRest = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CompleteRest),
            playerId: Type.String(),
            metadata: Type.Optional(CompleteRestMetadata)
        })
    ])
)

export const CompleteRestValidator = Compile(CompleteRest)

export function isCompleteRest(action?: GameAction): action is CompleteRest {
    return action?.type === ActionType.CompleteRest
}

export class HydratedCompleteRest
    extends HydratableAction<typeof CompleteRest>
    implements CompleteRest
{
    declare type: ActionType.CompleteRest
    declare playerId: string
    declare metadata?: CompleteRestMetadata

    constructor(data: CompleteRest) {
        super(data, CompleteRestValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedCompleteRest.reasonCannotCompleteRest(state, this.playerId)
        if (reason) {
            throw Error(`Cannot complete the Rest Phase: ${reason}`)
        }

        const metadata: CompleteRestMetadata = {}

        const closesRound = HydratedCompleteRest.isLastTurnOfRound(state, this.playerId)
        state.turnManager.endTurn(state.actionCount)

        const resting = state.getPlayerState(this.playerId)
        resting.homelandUsedThisTurn = []
        resting.restPowersUsedThisTurn = []

        if (!closesRound) {
            this.metadata = metadata
            return
        }

        metadata.endedRound = true

        if (isAtLeastOathRevision(state, OathRevision.TurnFlow) && endDieIsRolled(state)) {
            metadata.awaitsEndDie = true
            this.metadata = metadata
            return
        }

        // R-4: check the Stable Regime Win before advancing the marker; R-3.3 thresholds differ per round.
        if (endDieIsRolled(state)) {
            const roll = rollEndDie(state.getProtectedPrng())
            metadata.endDieRoll = roll
            // R-X.3: the PRNG advanced, so this action is not undoable.
            this.revealsInfo = true

            const outcome = stableRegimeWinner(state, roll)
            if (outcome) {
                state.winningPlayerIds = [outcome.winnerPlayerId]
                metadata.wonBy = outcome.rule
                this.metadata = metadata
                return
            }
        }

        // R-3.4: the eighth round ends the game automatically, with no roll.
        if (state.round >= FINAL_ROUND) {
            const outcome = warExhaustionWinner(state)
            state.winningPlayerIds = [outcome.winnerPlayerId]
            metadata.wonBy = outcome.rule
            this.metadata = metadata
            return
        }

        state.round += 1
        metadata.round = state.round
        this.metadata = metadata
    }

    static isLastTurnOfRound(state: HydratedOathGameState, playerId: string): boolean {
        const order = state.turnManager.turnOrder
        return order.length > 0 && order[order.length - 1] === playerId
    }

    static reasonCannotCompleteRest(
        state: HydratedOathGameState,
        playerId: string
    ): string | undefined {
        return reasonNotYourTurn(state, playerId)
    }

    // R-4.3.5 is optional, so completing Rest is always available.
    static canDoCompleteRest(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedCompleteRest.reasonCannotCompleteRest(state, playerId) === undefined
    }
}
