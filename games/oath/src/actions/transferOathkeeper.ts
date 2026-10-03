import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { moveTitle, type TitleMove } from '../util/title.js'

export type TransferOathkeeper = Type.Static<typeof TransferOathkeeper>
export const TransferOathkeeper = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TransferOathkeeper),
            source: Type.Literal(ActionSource.System),
            fromPlayerId: Type.Optional(Type.String()),
            toPlayerId: Type.Optional(Type.String())
        })
    ])
)

export const TransferOathkeeperValidator = Compile(TransferOathkeeper)

export function isTransferOathkeeper(action?: GameAction): action is TransferOathkeeper {
    return action?.type === ActionType.TransferOathkeeper
}

/** R-2.11-H1 — the move `withContinuousTitle` found, applied as it was recorded. */
export class HydratedTransferOathkeeper
    extends HydratableAction<typeof TransferOathkeeper>
    implements TransferOathkeeper
{
    declare type: ActionType.TransferOathkeeper
    declare source: ActionSource.System
    declare fromPlayerId?: string
    declare toPlayerId?: string

    constructor(data: TransferOathkeeper) {
        super(data, TransferOathkeeperValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedTransferOathkeeper.reasonCannotTransfer(state, this)
        if (reason) {
            throw Error(`Cannot move the Oathkeeper title: ${reason}`)
        }
        moveTitle(state, this)
    }

    static reasonCannotTransfer(state: HydratedOathGameState, move: TitleMove): string | undefined {
        if (state.oathkeeperPlayerId !== move.fromPlayerId) {
            return `the title is held by ${state.oathkeeperPlayerId ?? 'nobody'}, not ${move.fromPlayerId ?? 'nobody'}`
        }
        if (move.toPlayerId === move.fromPlayerId) return 'the title would not move'
        return undefined
    }
}
