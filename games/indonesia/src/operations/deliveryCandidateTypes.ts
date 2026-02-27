import type { IndonesiaNodeId } from '../utils/indonesiaNodes.js'
import type {
    CityDemand,
    DeliveryProblem,
    ShippingCompanyNetwork,
    ZoneSupply
} from './deliveryPlan.js'

export type AtomicDeliveryChoice = {
    cultivatedAreaId: string
    shippingCompanyId: string
    seaAreaIds: string[]
    cityId: string
}

export type AtomicDeliveryCandidate = AtomicDeliveryChoice & {
    zoneId: string
    revenue: number
    shippingCost: number
    netProfit: number
}

export type DeliveryOperationContext = {
    problem: DeliveryProblem
    originalTarget: number
    shippedSoFar: number
    deliveredCultivatedAreaIdSet: Set<IndonesiaNodeId>
    zoneById: Map<string, ZoneSupply>
    zoneIdByCultivatedAreaId: Map<IndonesiaNodeId, string>
    cityDemandById: Map<string, CityDemand>
    shippingNetworkById: Map<string, ShippingCompanyNetwork>
}
