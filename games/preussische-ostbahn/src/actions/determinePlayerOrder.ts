import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, GameResult, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { connectionGoalImpossible, everyRailroadConnected } from '../model/endCheck.js'
import type { HydratedOstbahnGameState } from '../model/gameState.js'
import { CupEntry, drawTurnOrder } from '../model/turnOrder.js'

export enum GameEndReason {
    Connected = 'Connected',
    Impossible = 'Impossible'
}

export type DeterminePlayerOrderMetadata = Type.Static<typeof DeterminePlayerOrderMetadata>
export const DeterminePlayerOrderMetadata = Type.Object({
    endReason: Type.Optional(Type.Enum(GameEndReason)),
    cup: Type.Array(CupEntry),
    drawn: Type.Array(Type.String())
})

export type DeterminePlayerOrder = Type.Static<typeof DeterminePlayerOrder>
export const DeterminePlayerOrder = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.DeterminePlayerOrder),
            metadata: Type.Optional(DeterminePlayerOrderMetadata)
        })
    ])
)

export const DeterminePlayerOrderValidator = Compile(DeterminePlayerOrder)

export function isDeterminePlayerOrder(action?: GameAction): action is DeterminePlayerOrder {
    return action?.type === ActionType.DeterminePlayerOrder
}

export class HydratedDeterminePlayerOrder
    extends HydratableAction<typeof DeterminePlayerOrder>
    implements DeterminePlayerOrder
{
    declare type: ActionType.DeterminePlayerOrder
    declare metadata?: DeterminePlayerOrderMetadata

    constructor(data: DeterminePlayerOrder) {
        super(data, DeterminePlayerOrderValidator)
    }

    apply(state: HydratedOstbahnGameState, _context?: MachineContext) {
        if (state.rounds.currentRound) {
            state.rounds.endRound(state.actionCount)
        }
        const endReason = this.endReason(state)
        if (endReason) {
            const winners = state.richestPlayerIds()
            state.winningPlayerIds = winners
            state.result = winners.length > 1 ? GameResult.Draw : GameResult.Win
            this.metadata = { endReason, cup: [], drawn: [] }
            return
        }
        const cup = state.incomeCup()
        const drawn = drawTurnOrder(cup, state.players.length, state.getPublicPrng().random)
        state.turnManager.turnOrder = drawn
        state.rounds.startRound(state.actionCount + 1)
        this.metadata = { cup, drawn }
    }

    private endReason(state: HydratedOstbahnGameState): GameEndReason | undefined {
        if (everyRailroadConnected(state.railroads)) {
            return GameEndReason.Connected
        }
        if (connectionGoalImpossible(state.railroads)) {
            return GameEndReason.Impossible
        }
        return undefined
    }
}
