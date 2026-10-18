import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { OperationResult, canOperate, mine, operableWorldSlots } from '../model/operations.js'
import { OperationKind } from '../model/pieces.js'

export type Mine = Type.Static<typeof Mine>
export const Mine = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Mine),
            playerId: Type.String(),
            shipId: Type.String(),
            slot: Type.Number(),
            metadata: Type.Optional(OperationResult)
        })
    ])
)

export const MineValidator = Compile(Mine)

export function isMine(action?: GameAction): action is Mine {
    return action?.type === ActionType.Mine
}

export class HydratedMine extends HydratableAction<typeof Mine> implements Mine {
    declare type: ActionType.Mine
    declare playerId: string
    declare shipId: string
    declare slot: number
    declare metadata?: OperationResult

    constructor(data: Mine) {
        super(data, MineValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const ship = state.playerShip(this.playerId, this.shipId)
        if (
            !ship ||
            !canOperate(state, ship, OperationKind.Mining) ||
            !operableWorldSlots(state, ship.systemId).includes(this.slot)
        ) {
            throw Error('Invalid Mine action')
        }
        this.metadata = mine(state, ship, this.slot)
        this.revealsInfo = true
    }
}
