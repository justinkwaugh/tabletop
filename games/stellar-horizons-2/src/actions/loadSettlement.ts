import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { canLoadFromBase, removeBaseSettlement } from '../model/settling.js'
import { TurnStep } from '../model/turn.js'

export type LoadSettlement = Type.Static<typeof LoadSettlement>
export const LoadSettlement = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.LoadSettlement),
            playerId: Type.String(),
            shipId: Type.String()
        })
    ])
)

export const LoadSettlementValidator = Compile(LoadSettlement)

export function isLoadSettlement(action?: GameAction): action is LoadSettlement {
    return action?.type === ActionType.LoadSettlement
}

export class HydratedLoadSettlement
    extends HydratableAction<typeof LoadSettlement>
    implements LoadSettlement
{
    declare type: ActionType.LoadSettlement
    declare playerId: string
    declare shipId: string

    constructor(data: LoadSettlement) {
        super(data, LoadSettlementValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const ship = state.playerShip(this.playerId, this.shipId)
        if (
            !ship ||
            state.getPlayerState(this.playerId).step !== TurnStep.Cargo ||
            !canLoadFromBase(state, ship)
        ) {
            throw Error('Invalid LoadSettlement action')
        }
        removeBaseSettlement(state, this.playerId, ship.systemId)
        ship.settlements += 1
        ship.loadedFromBase = true
    }

    static canLoadSettlement(state: HydratedStellarHorizonsGameState, playerId: string) {
        return (
            state.getPlayerState(playerId).step === TurnStep.Cargo &&
            state.shipsOf(playerId).some((ship) => canLoadFromBase(state, ship))
        )
    }
}
