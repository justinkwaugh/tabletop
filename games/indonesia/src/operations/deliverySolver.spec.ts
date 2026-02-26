import { describe, expect, it } from 'vitest'
import { DeliveryTieBreakPolicy } from '../definition/operationsEconomy.js'
import { Good } from '../definition/goods.js'
import type { DeliveryProblem } from './deliveryPlan.js'
import { solveDeliveryProblem } from './deliverySolver.js'

function createBaseProblem(): DeliveryProblem {
    return {
        operatingCompanyId: 'prod-1',
        good: Good.Rice,
        shippingFeePerShipUse: 5,
        tieBreakPolicy: DeliveryTieBreakPolicy.MinShippingCost,
        zoneSupplies: [
            {
                zoneId: 'prod-1:zone:1',
                areaIds: ['A01'],
                adjacentSeaAreaIds: ['S01'],
                supply: 3
            }
        ],
        cityDemands: [
            {
                cityId: 'city-a',
                cityAreaId: 'A04',
                adjacentSeaAreaIds: ['S01'],
                remainingDemand: 2
            }
        ],
        shippingCompanyNetworks: [
            {
                shippingCompanyId: 'ship-a',
                seaLanes: [],
                seaAreaCapacities: [
                    {
                        seaAreaId: 'S01',
                        capacity: 2
                    }
                ]
            }
        ]
    }
}

describe('solveDeliveryProblem', () => {
    it('maximizes delivered goods subject to supply, demand, and shipping capacity', () => {
        const plan = solveDeliveryProblem(createBaseProblem())

        expect(plan.totalDelivered).toBe(2)
        expect(plan.deliveries).toEqual([
            {
                zoneId: 'prod-1:zone:1',
                cityId: 'city-a',
                shippingCompanyId: 'ship-a',
                quantity: 2,
                seaPathAreaIds: ['S01']
            }
        ])
        expect(plan.shipUses).toEqual([
            {
                shippingCompanyId: 'ship-a',
                seaAreaId: 'S01',
                uses: 2
            }
        ])
        expect(plan.shippingPayments).toEqual([
            {
                shippingCompanyId: 'ship-a',
                amount: 10
            }
        ])
        expect(plan.revenue).toBe(40)
        expect(plan.shippingCost).toBe(10)
        expect(plan.netIncome).toBe(30)
    })

    it('uses min-shipping-cost tie-break when multiple max-delivery solutions exist', () => {
        const problem: DeliveryProblem = {
            operatingCompanyId: 'prod-1',
            good: Good.Rice,
            shippingFeePerShipUse: 5,
            tieBreakPolicy: DeliveryTieBreakPolicy.MinShippingCost,
            zoneSupplies: [
                {
                    zoneId: 'prod-1:zone:1',
                    areaIds: ['A01', 'A02'],
                    adjacentSeaAreaIds: ['S01', 'S02'],
                    supply: 2
                }
            ],
            cityDemands: [
                {
                    cityId: 'city-a',
                    cityAreaId: 'A04',
                    adjacentSeaAreaIds: ['S01', 'S03'],
                    remainingDemand: 2
                }
            ],
            shippingCompanyNetworks: [
                {
                    shippingCompanyId: 'ship-cheap',
                    seaLanes: [],
                    seaAreaCapacities: [
                        {
                            seaAreaId: 'S01',
                            capacity: 1
                        }
                    ]
                },
                {
                    shippingCompanyId: 'ship-expensive',
                    seaLanes: [
                        {
                            fromSeaAreaId: 'S02',
                            toSeaAreaId: 'S03'
                        }
                    ],
                    seaAreaCapacities: [
                        {
                            seaAreaId: 'S02',
                            capacity: 2
                        },
                        {
                            seaAreaId: 'S03',
                            capacity: 2
                        }
                    ]
                }
            ]
        }

        const plan = solveDeliveryProblem(problem)

        expect(plan.totalDelivered).toBe(2)
        expect(plan.shippingCost).toBe(15)
        expect(plan.shipUses).toEqual([
            {
                shippingCompanyId: 'ship-cheap',
                seaAreaId: 'S01',
                uses: 1
            },
            {
                shippingCompanyId: 'ship-expensive',
                seaAreaId: 'S02',
                uses: 1
            },
            {
                shippingCompanyId: 'ship-expensive',
                seaAreaId: 'S03',
                uses: 1
            }
        ])
        expect(plan.shippingPayments).toEqual([
            {
                shippingCompanyId: 'ship-cheap',
                amount: 5
            },
            {
                shippingCompanyId: 'ship-expensive',
                amount: 10
            }
        ])
        expect(plan.deliveries).toEqual([
            {
                zoneId: 'prod-1:zone:1',
                cityId: 'city-a',
                shippingCompanyId: 'ship-cheap',
                quantity: 1,
                seaPathAreaIds: ['S01']
            },
            {
                zoneId: 'prod-1:zone:1',
                cityId: 'city-a',
                shippingCompanyId: 'ship-expensive',
                quantity: 1,
                seaPathAreaIds: ['S02', 'S03']
            }
        ])
    })
})
