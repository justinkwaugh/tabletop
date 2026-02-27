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

        state.incrementOperatingCompanyShippedGoodsCount()
        this.metadata = {}
    }

    isValidDeliverGood(state: HydratedIndonesiaGameState): boolean {
        return HydratedDeliverGood.canDeliverGood(state, this.playerId)
    }

    static canDeliverGood(state: HydratedIndonesiaGameState, playerId: string): boolean {
        if (state.machineState !== MachineState.ProductionOperations) {
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

        const deliveryPlan = state.operatingCompanyDeliveryPlan
        if (!deliveryPlan || deliveryPlan.operatingCompanyId !== operatingCompanyId) {
            return false
        }

        const shippedGoodsCount = state.operatingCompanyShippedGoodsCount ?? 0
        if (shippedGoodsCount >= deliveryPlan.totalDelivered) {
            return false
        }

        return operatingCompany.owner === playerId
    }
}
