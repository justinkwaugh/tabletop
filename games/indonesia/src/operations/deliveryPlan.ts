import type { DeliveryTieBreakPolicy } from '../definition/operationsEconomy.js'
import type { Good } from '../definition/goods.js'
import type { IndonesiaNodeId } from '../utils/indonesiaNodes.js'

export type ProductionZoneId = string
export type CompanyId = string
export type CityId = string

export type ZoneSupply = {
    zoneId: ProductionZoneId
    areaIds: readonly IndonesiaNodeId[]
    adjacentSeaAreaIds: readonly IndonesiaNodeId[]
    supply: number
}

export type CityDemand = {
    cityId: CityId
    cityAreaId: IndonesiaNodeId
    adjacentSeaAreaIds: readonly IndonesiaNodeId[]
    remainingDemand: number
}

export type SeaLane = {
    fromSeaAreaId: IndonesiaNodeId
    toSeaAreaId: IndonesiaNodeId
}

export type SeaAreaCapacity = {
    seaAreaId: IndonesiaNodeId
    capacity: number
}

export type ShippingCompanyNetwork = {
    shippingCompanyId: CompanyId
    seaLanes: readonly SeaLane[]
    seaAreaCapacities: readonly SeaAreaCapacity[]
}

export type DeliveryProblem = {
    operatingCompanyId: CompanyId
    good: Good
    shippingFeePerShipUse: number
    tieBreakPolicy: DeliveryTieBreakPolicy
    zoneSupplies: readonly ZoneSupply[]
    cityDemands: readonly CityDemand[]
    shippingCompanyNetworks: readonly ShippingCompanyNetwork[]
}

export type CityDelivery = {
    zoneId: ProductionZoneId
    cityId: CityId
    shippingCompanyId: CompanyId
    quantity: number
    seaPathAreaIds: readonly IndonesiaNodeId[]
}

export type ShipUse = {
    shippingCompanyId: CompanyId
    seaAreaId: IndonesiaNodeId
    uses: number
}

export type ShippingPayment = {
    shippingCompanyId: CompanyId
    amount: number
}

export type DeliveryTieBreakResult = {
    policy: DeliveryTieBreakPolicy
    deliveredGoods: number
    shippingCost: number
}

export type DeliveryPlan = {
    operatingCompanyId: CompanyId
    good: Good
    deliveries: readonly CityDelivery[]
    shipUses: readonly ShipUse[]
    shippingPayments: readonly ShippingPayment[]
    totalDelivered: number
    revenue: number
    shippingCost: number
    netIncome: number
    tieBreakResult: DeliveryTieBreakResult
}

export type DeliverySolutionMetadata = {
    candidateSolutionCount: number
    selected: DeliveryTieBreakResult
}
