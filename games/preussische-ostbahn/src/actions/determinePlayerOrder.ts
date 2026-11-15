import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    GameResult,
    HydratableAction,
    MachineContext,
    assert
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { GameEndReason } from '../model/endCheck.js'
import { RoundEndKind, type HydratedOstbahnGameState, type RoundEnd } from '../model/gameState.js'
import { CupEntry, drawTurnOrder } from '../model/turnOrder.js'

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
        const roundEnd = state.roundEnd()
        this.assertTakenFor(roundEnd)
        if (state.rounds.currentRound) {
            state.rounds.endRound(state.actionCount)
        }
        if (roundEnd.kind === RoundEndKind.GameOver) {
            const winners = state.richestPlayerIds()
            state.winningPlayerIds = winners
            state.result = winners.length > 1 ? GameResult.Draw : GameResult.Win
            this.metadata = { endReason: roundEnd.endReason, cup: [], drawn: [] }
            return
        }
        const cup = state.incomeCup()
        const drawn = drawTurnOrder(cup, state.players.length, state.getPublicPrng().random)
        state.turnManager.turnOrder = drawn
        state.rounds.startRound(state.actionCount + 1)
        this.metadata = { cup, drawn }
    }

    private assertTakenFor(roundEnd: RoundEnd) {
        if (roundEnd.kind === RoundEndKind.GameOver) {
            assert(this.source === ActionSource.System, 'The game ends by itself')
            return
        }
        assert(
            this.source === ActionSource.User && this.playerId === roundEnd.drawerId,
            'Only the player ending the round draws the turn order'
        )
        assert(this.revealsInfo === true, 'Drawing the turn order reveals the draw')
    }
}
