import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { OperationResult, canOperate, research, operableWorldSlots } from '../model/operations.js'
import { OperationKind } from '../model/pieces.js'

export type Research = Type.Static<typeof Research>
export const Research = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Research),
            playerId: Type.String(),
            shipId: Type.String(),
            slot: Type.Number(),
            metadata: Type.Optional(OperationResult)
        })
    ])
)

export const ResearchValidator = Compile(Research)

export function isResearch(action?: GameAction): action is Research {
    return action?.type === ActionType.Research
}

export class HydratedResearch extends HydratableAction<typeof Research> implements Research {
    declare type: ActionType.Research
    declare playerId: string
    declare shipId: string
    declare slot: number
    declare metadata?: OperationResult

    constructor(data: Research) {
        super(data, ResearchValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const ship = state.playerShip(this.playerId, this.shipId)
        if (
            !ship ||
            !canOperate(state, ship, OperationKind.Research) ||
            !operableWorldSlots(state, ship.systemId).includes(this.slot)
        ) {
            throw Error('Invalid Research action')
        }
        this.metadata = research(state, ship, this.slot)
        this.revealsInfo = true
    }
}
