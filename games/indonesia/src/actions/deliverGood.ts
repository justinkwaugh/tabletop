import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'

export type DeliverGoodMetadata = Type.Static<typeof DeliverGoodMetadata>
export const DeliverGoodMetadata = Type.Object({})

export type DeliverGood = Type.Static<typeof DeliverGood>
export const DeliverGood = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeliverGood),
            playerId: Type.String(),
            metadata: Type.Optional(DeliverGoodMetadata)
        })
    ])
)

export const DeliverGoodValidator = Compile(DeliverGood)

export function isDeliverGood(action?: GameAction): action is DeliverGood {
    return action?.type === ActionType.DeliverGood
}

export class HydratedDeliverGood extends HydratableAction<typeof DeliverGood> implements DeliverGood {
    declare type: ActionType.DeliverGood
    declare playerId: string
    declare metadata?: DeliverGoodMetadata

    constructor(data: DeliverGood) {
        super(data, DeliverGoodValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidDeliverGood(state)) {
            throw Error('Invalid DeliverGood action')
        }

        this.metadata = {}
    }

    isValidDeliverGood(state: HydratedIndonesiaGameState): boolean {
        return HydratedDeliverGood.canDeliverGood(state, this.playerId)
    }

    static canDeliverGood(state: HydratedIndonesiaGameState, _playerId: string): boolean {
        return state.machineState === MachineState.Operations
    }
}
