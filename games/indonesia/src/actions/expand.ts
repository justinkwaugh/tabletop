import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'

export type ExpandMetadata = Type.Static<typeof ExpandMetadata>
export const ExpandMetadata = Type.Object({})

export type Expand = Type.Static<typeof Expand>
export const Expand = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Expand),
            playerId: Type.String(),
            metadata: Type.Optional(ExpandMetadata)
        })
    ])
)

export const ExpandValidator = Compile(Expand)

export function isExpand(action?: GameAction): action is Expand {
    return action?.type === ActionType.Expand
}

export class HydratedExpand extends HydratableAction<typeof Expand> implements Expand {
    declare type: ActionType.Expand
    declare playerId: string
    declare metadata?: ExpandMetadata

    constructor(data: Expand) {
        super(data, ExpandValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidExpand(state)) {
            throw Error('Invalid Expand action')
        }

        this.metadata = {}
    }

    isValidExpand(state: HydratedIndonesiaGameState): boolean {
        return HydratedExpand.canExpand(state, this.playerId)
    }

    static canExpand(state: HydratedIndonesiaGameState, playerId: string): boolean {
        if (
            state.machineState !== MachineState.ShippingOperations &&
            state.machineState !== MachineState.ProductionOperaions
        ) {
            return false
        }

        const operatingCompanyId = state.operatingCompanyId
        if (!operatingCompanyId) {
            return false
        }

        const operatingCompany = state.companies.find((company) => company.id === operatingCompanyId)
        if (!operatingCompany) {
            return false
        }

        return operatingCompany.owner === playerId
    }
}
