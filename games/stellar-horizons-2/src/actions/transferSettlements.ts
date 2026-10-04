import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { freeCargo } from '../model/fleet.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { transferPartners } from '../model/settling.js'
import { TurnStep } from '../model/turn.js'

export type TransferSettlements = Type.Static<typeof TransferSettlements>
export const TransferSettlements = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TransferSettlements),
            playerId: Type.String(),
            fromShipId: Type.String(),
            toShipId: Type.String(),
            count: Type.Number()
        })
    ])
)

export const TransferSettlementsValidator = Compile(TransferSettlements)

export function isTransferSettlements(action?: GameAction): action is TransferSettlements {
    return action?.type === ActionType.TransferSettlements
}

export class HydratedTransferSettlements
    extends HydratableAction<typeof TransferSettlements>
    implements TransferSettlements
{
    declare type: ActionType.TransferSettlements
    declare playerId: string
    declare fromShipId: string
    declare toShipId: string
    declare count: number

    constructor(data: TransferSettlements) {
        super(data, TransferSettlementsValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const from = state.playerShip(this.playerId, this.fromShipId)
        const to = state.playerShip(this.playerId, this.toShipId)
        if (
            !from ||
            !to ||
            state.getPlayerState(this.playerId).step === TurnStep.Done ||
            !transferPartners(state, from).includes(to) ||
            !Number.isInteger(this.count) ||
            this.count < 1 ||
            this.count > Math.min(from.settlements, freeCargo(state, to))
        ) {
            throw Error('Invalid TransferSettlements action')
        }
        from.settlements -= this.count
        to.settlements += this.count
    }

    static canTransferSettlements(state: HydratedStellarHorizonsGameState, playerId: string) {
        return (
            state.getPlayerState(playerId).step !== TurnStep.Done &&
            state
                .shipsOf(playerId)
                .some((ship) => ship.settlements > 0 && transferPartners(state, ship).length > 0)
        )
    }
}
