import * as Type from 'typebox'
import { DeliveryTieBreakPolicy } from '../definition/operationsEconomy.js'
import { Good } from '../definition/goods.js'
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

export const CityDeliverySchema = Type.Object({
    zoneId: Type.String(),
    cityId: Type.String(),
    shippingCompanyId: Type.String(),
    quantity: Type.Number(),
    seaPathAreaIds: Type.Array(Type.String())
})

export const ShipUseSchema = Type.Object({
    shippingCompanyId: Type.String(),
    seaAreaId: Type.String(),
    uses: Type.Number()
})

export const ShippingPaymentSchema = Type.Object({
    shippingCompanyId: Type.String(),
    amount: Type.Number()
})

export const DeliveryTieBreakResultSchema = Type.Object({
    policy: Type.Enum(DeliveryTieBreakPolicy),
    deliveredGoods: Type.Number(),
    shippingCost: Type.Number()
})

export const DeliveryPlanSchema = Type.Object({
    operatingCompanyId: Type.String(),
    good: Type.Enum(Good),
    deliveries: Type.Array(CityDeliverySchema),
    shipUses: Type.Array(ShipUseSchema),
    shippingPayments: Type.Array(ShippingPaymentSchema),
    totalDelivered: Type.Number(),
    revenue: Type.Number(),
    shippingCost: Type.Number(),
    netIncome: Type.Number(),
    tieBreakResult: DeliveryTieBreakResultSchema
})
