import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { isProductionCompany, isShippingCompany } from '../components/company.js'
import {
    GOOD_REVENUE_BY_GOOD,
    SHIPPING_FEE_PER_SHIP_USE
} from '../definition/operationsEconomy.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    isSafeAtomicDeliveryChoiceForPlayer,
    listSafeAtomicDeliveryCandidatesForPlayer,
    type AtomicDeliveryChoice
} from '../operations/deliveryCandidates.js'
import { isIndonesiaNodeId } from '../utils/indonesiaNodes.js'

export type DeliverGoodMetadata = Type.Static<typeof DeliverGoodMetadata>
export const DeliverGoodMetadata = Type.Object({
    revenue: Type.Number(),
    shippingCost: Type.Number(),
    netProfit: Type.Number(),
    shippingPayments: Type.Array(
        Type.Object({
            shippingCompanyId: Type.String(),
            ownerPlayerId: Type.String(),
            amount: Type.Number()
        })
    )
})

export type DeliverGood = Type.Static<typeof DeliverGood>
export const DeliverGood = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeliverGood),
            playerId: Type.String(),
            metadata: Type.Optional(DeliverGoodMetadata),
            cultivatedAreaId: Type.String(),
            shippingCompanyId: Type.String(),
            seaAreaIds: Type.Array(Type.String()),
            cityId: Type.String()
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
    declare cultivatedAreaId: string
    declare shippingCompanyId: string
    declare seaAreaIds: string[]
    declare cityId: string

    constructor(data: DeliverGood) {
        super(data, DeliverGoodValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidDeliverGood(state)) {
            throw Error('Invalid DeliverGood action')
        }

        const operatingCompanyId = state.operatingCompanyId
        assertExists(
            operatingCompanyId,
            'Operating company id should be set for DeliverGood action'
        )

        const operatingCompany = state.companies.find((company) => company.id === operatingCompanyId)
        assertExists(
            operatingCompany,
            `Operating company ${operatingCompanyId} should exist for DeliverGood action`
        )
        if (!isProductionCompany(operatingCompany)) {
            throw Error(
                `Operating company ${operatingCompanyId} should be a production company for DeliverGood action`
            )
        }

        const shippingCompany = state.companies.find(
            (company) => company.id === this.shippingCompanyId
        )
        assertExists(
            shippingCompany,
            `Shipping company ${this.shippingCompanyId} should exist for DeliverGood action`
        )
        assertExists(
            isShippingCompany(shippingCompany) ? shippingCompany : undefined,
            `Company ${this.shippingCompanyId} should be a shipping company for DeliverGood action`
        )

        state.markOperatingCompanyCultivatedAreaDelivered(this.cultivatedAreaId)
        for (const seaAreaId of this.seaAreaIds) {
            if (!isIndonesiaNodeId(seaAreaId)) {
                throw Error(`Sea area id ${seaAreaId} is not a valid Indonesia node id`)
            }
            state.incrementOperatingCompanyShipUseCount(this.shippingCompanyId, seaAreaId, 1)
        }
        state.recordCityGoodDelivery(this.cityId, operatingCompany.good, 1)
        state.incrementOperatingCompanyShippedGoodsCount()

        const revenue = GOOD_REVENUE_BY_GOOD[operatingCompany.good]
        const shippingCost = this.seaAreaIds.length * SHIPPING_FEE_PER_SHIP_USE
        this.metadata = {
            revenue,
            shippingCost,
            netProfit: revenue - shippingCost,
            shippingPayments: [
                {
                    shippingCompanyId: shippingCompany.id,
                    ownerPlayerId: shippingCompany.owner,
                    amount: shippingCost
                }
            ]
        }
    }

    isValidDeliverGood(state: HydratedIndonesiaGameState): boolean {
        return isSafeAtomicDeliveryChoiceForPlayer(state, this.playerId, {
            cultivatedAreaId: this.cultivatedAreaId,
            shippingCompanyId: this.shippingCompanyId,
            seaAreaIds: this.seaAreaIds,
            cityId: this.cityId
        })
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

        if (operatingCompany.owner !== playerId) {
            return false
        }

        return listSafeAtomicDeliveryCandidatesForPlayer(state, playerId).length > 0
    }

    static isSafeChoice(
        state: HydratedIndonesiaGameState,
        playerId: string,
        choice: AtomicDeliveryChoice
    ): boolean {
        return isSafeAtomicDeliveryChoiceForPlayer(state, playerId, choice)
    }
}
