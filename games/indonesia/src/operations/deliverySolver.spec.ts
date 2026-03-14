import { describe, expect, it } from 'vitest'
import { DeliveryTieBreakPolicy } from '../definition/operationsEconomy.js'
import { Good } from '../definition/goods.js'
import type { DeliveryProblem } from './deliveryPlan.js'
import { solveDeliveryProblem } from './deliverySolver.js'

function createBaseProblem(): DeliveryProblem {
    return {
        operatingCompanyId: 'prod-1',
        operatingCompanyOwnerId: 'p1',
        ownedShippingCompanyIds: ['ship-a'],
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
        expect(plan.criticalDeliveries).toEqual([
            {
                zoneId: 'prod-1:zone:1',
                cityId: 'city-a',
                shippingCompanyId: 'ship-a',
                seaPathAreaIds: ['S01'],
                plannedQuantity: 2,
                requiredQuantity: 2
            }
        ])
    })

    it('uses min-shipping-cost tie-break when multiple max-delivery solutions exist', () => {
        const problem: DeliveryProblem = {
            operatingCompanyId: 'prod-1',
            operatingCompanyOwnerId: 'p1',
            ownedShippingCompanyIds: ['ship-cheap'],
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

    it('prefers shipping payments to owned shipping companies for equal-cost solutions', () => {
        const problem: DeliveryProblem = {
            operatingCompanyId: 'prod-1',
            operatingCompanyOwnerId: 'p1',
            ownedShippingCompanyIds: ['ship-owned'],
            good: Good.Rice,
            shippingFeePerShipUse: 5,
            tieBreakPolicy: DeliveryTieBreakPolicy.MinShippingCost,
            zoneSupplies: [
                {
                    zoneId: 'prod-1:zone:1',
                    areaIds: ['A01'],
                    adjacentSeaAreaIds: ['S01', 'S02'],
                    supply: 1
                }
            ],
            cityDemands: [
                {
                    cityId: 'city-a',
                    cityAreaId: 'A04',
                    adjacentSeaAreaIds: ['S01', 'S02'],
                    remainingDemand: 1
                }
            ],
            shippingCompanyNetworks: [
                {
                    shippingCompanyId: 'ship-not-owned',
                    seaLanes: [],
                    seaAreaCapacities: [
                        {
                            seaAreaId: 'S01',
                            capacity: 1
                        }
                    ]
                },
                {
                    shippingCompanyId: 'ship-owned',
                    seaLanes: [],
                    seaAreaCapacities: [
                        {
                            seaAreaId: 'S02',
                            capacity: 1
                        }
                    ]
                }
            ]
        }

        const plan = solveDeliveryProblem(problem)

        expect(plan.totalDelivered).toBe(1)
        expect(plan.shippingCost).toBe(5)
        expect(plan.deliveries).toEqual([
            {
                zoneId: 'prod-1:zone:1',
                cityId: 'city-a',
                shippingCompanyId: 'ship-owned',
                quantity: 1,
                seaPathAreaIds: ['S02']
            }
        ])
        expect(plan.shippingPayments).toEqual([
            {
                shippingCompanyId: 'ship-owned',
                amount: 5
            }
        ])
    })

    it('breaks equal-cost city ties by the earlier city id', () => {
        const problem: DeliveryProblem = {
            operatingCompanyId: 'prod-1',
            operatingCompanyOwnerId: 'p1',
            ownedShippingCompanyIds: [],
            good: Good.Rice,
            shippingFeePerShipUse: 5,
            tieBreakPolicy: DeliveryTieBreakPolicy.MinShippingCost,
            zoneSupplies: [
                {
                    zoneId: 'prod-1:zone:1',
                    areaIds: ['C07'],
                    adjacentSeaAreaIds: ['S16'],
                    supply: 1
                }
            ],
            cityDemands: [
                {
                    cityId: 'city-jawa-barat',
                    cityAreaId: 'C01',
                    adjacentSeaAreaIds: ['S16'],
                    remainingDemand: 1
                },
                {
                    cityId: 'city-jawa-tengah',
                    cityAreaId: 'C09',
                    adjacentSeaAreaIds: ['S16'],
                    remainingDemand: 1
                }
            ],
            shippingCompanyNetworks: [
                {
                    shippingCompanyId: 'ship-blue',
                    seaLanes: [],
                    seaAreaCapacities: [
                        {
                            seaAreaId: 'S16',
                            capacity: 1
                        }
                    ]
                }
            ]
        }

        const plan = solveDeliveryProblem(problem)

        expect(plan.totalDelivered).toBe(1)
        expect(plan.deliveries).toEqual([
            {
                zoneId: 'prod-1:zone:1',
                cityId: 'city-jawa-barat',
                shippingCompanyId: 'ship-blue',
                quantity: 1,
                seaPathAreaIds: ['S16']
            }
        ])
    })

    it('prefers owned-shipping payments over lower shipping cost', () => {
        const problem: DeliveryProblem = {
            operatingCompanyId: 'prod-1',
            operatingCompanyOwnerId: 'p1',
            ownedShippingCompanyIds: ['ship-owned'],
            good: Good.Rice,
            shippingFeePerShipUse: 5,
            tieBreakPolicy: DeliveryTieBreakPolicy.MinShippingCost,
            zoneSupplies: [
                {
                    zoneId: 'prod-1:zone:1',
                    areaIds: ['A01'],
                    adjacentSeaAreaIds: ['S01', 'S02'],
                    supply: 1
                }
            ],
            cityDemands: [
                {
                    cityId: 'city-a',
                    cityAreaId: 'A04',
                    adjacentSeaAreaIds: ['S01', 'S03'],
                    remainingDemand: 1
                }
            ],
            shippingCompanyNetworks: [
                {
                    shippingCompanyId: 'ship-not-owned',
                    seaLanes: [],
                    seaAreaCapacities: [
                        {
                            seaAreaId: 'S01',
                            capacity: 1
                        }
                    ]
                },
                {
                    shippingCompanyId: 'ship-owned',
                    seaLanes: [
                        {
                            fromSeaAreaId: 'S02',
                            toSeaAreaId: 'S03'
                        }
                    ],
                    seaAreaCapacities: [
                        {
                            seaAreaId: 'S02',
                            capacity: 1
                        },
                        {
                            seaAreaId: 'S03',
                            capacity: 1
                        }
                    ]
                }
            ]
        }

        const plan = solveDeliveryProblem(problem)

        expect(plan.totalDelivered).toBe(1)
        expect(plan.shippingCost).toBe(10)
        expect(plan.deliveries).toEqual([
            {
                zoneId: 'prod-1:zone:1',
                cityId: 'city-a',
                shippingCompanyId: 'ship-owned',
                quantity: 1,
                seaPathAreaIds: ['S02', 'S03']
            }
        ])
        expect(plan.shippingPayments).toEqual([
            {
                shippingCompanyId: 'ship-owned',
                amount: 10
            }
        ])
    })

    it('prefers lower shipping cost when profit is tied', () => {
        const problem: DeliveryProblem = {
            operatingCompanyId: 'prod-1',
            operatingCompanyOwnerId: 'p1',
            ownedShippingCompanyIds: ['ship-owned-short', 'ship-owned-long'],
            good: Good.Rice,
            shippingFeePerShipUse: 5,
            tieBreakPolicy: DeliveryTieBreakPolicy.MinShippingCost,
            zoneSupplies: [
                {
                    zoneId: 'prod-1:zone:1',
                    areaIds: ['A01'],
                    adjacentSeaAreaIds: ['S01', 'S02'],
                    supply: 1
                }
            ],
            cityDemands: [
                {
                    cityId: 'city-a',
                    cityAreaId: 'A04',
                    adjacentSeaAreaIds: ['S01', 'S03'],
                    remainingDemand: 1
                }
            ],
            shippingCompanyNetworks: [
                {
                    shippingCompanyId: 'ship-owned-short',
                    seaLanes: [],
                    seaAreaCapacities: [
                        {
                            seaAreaId: 'S01',
                            capacity: 1
                        }
                    ]
                },
                {
                    shippingCompanyId: 'ship-owned-long',
                    seaLanes: [
                        {
                            fromSeaAreaId: 'S02',
                            toSeaAreaId: 'S03'
                        }
                    ],
                    seaAreaCapacities: [
                        {
                            seaAreaId: 'S02',
                            capacity: 1
                        },
                        {
                            seaAreaId: 'S03',
                            capacity: 1
                        }
                    ]
                }
            ]
        }

        const plan = solveDeliveryProblem(problem)

        expect(plan.totalDelivered).toBe(1)
        expect(plan.shippingCost).toBe(5)
        expect(plan.deliveries).toEqual([
            {
                zoneId: 'prod-1:zone:1',
                cityId: 'city-a',
                shippingCompanyId: 'ship-owned-short',
                quantity: 1,
                seaPathAreaIds: ['S01']
            }
        ])
    })

    it('decodes the final flow after rerouting earlier augmentations', () => {
        const problem: DeliveryProblem = {
            operatingCompanyId: 'prod-1',
            operatingCompanyOwnerId: 'p1',
            ownedShippingCompanyIds: ['ship-blue'],
            good: Good.SiapSaji,
            shippingFeePerShipUse: 5,
            tieBreakPolicy: DeliveryTieBreakPolicy.MinShippingCost,
            zoneSupplies: [
                {
                    zoneId: 'prod-1:zone:1',
                    areaIds: ['C02', 'C03'],
                    adjacentSeaAreaIds: ['S03'],
                    supply: 2
                }
            ],
            cityDemands: [
                {
                    cityId: 'lampung',
                    cityAreaId: 'A22',
                    adjacentSeaAreaIds: ['S03'],
                    remainingDemand: 1
                },
                {
                    cityId: 'remote',
                    cityAreaId: 'A10',
                    adjacentSeaAreaIds: ['S06'],
                    remainingDemand: 1
                }
            ],
            shippingCompanyNetworks: [
                {
                    shippingCompanyId: 'ship-blue',
                    seaLanes: [
                        {
                            fromSeaAreaId: 'S03',
                            toSeaAreaId: 'S06'
                        }
                    ],
                    seaAreaCapacities: [
                        {
                            seaAreaId: 'S03',
                            capacity: 1
                        },
                        {
                            seaAreaId: 'S06',
                            capacity: 1
                        }
                    ]
                },
                {
                    shippingCompanyId: 'ship-orange',
                    seaLanes: [],
                    seaAreaCapacities: [
                        {
                            seaAreaId: 'S03',
                            capacity: 1
                        }
                    ]
                }
            ]
        }

        const plan = solveDeliveryProblem(problem)

        expect(plan.deliveries).toEqual([
            {
                zoneId: 'prod-1:zone:1',
                cityId: 'lampung',
                shippingCompanyId: 'ship-orange',
                quantity: 1,
                seaPathAreaIds: ['S03']
            },
            {
                zoneId: 'prod-1:zone:1',
                cityId: 'remote',
                shippingCompanyId: 'ship-blue',
                quantity: 1,
                seaPathAreaIds: ['S03', 'S06']
            }
        ])
        expect(plan.shipUses).toEqual([
            {
                shippingCompanyId: 'ship-blue',
                seaAreaId: 'S03',
                uses: 1
            },
            {
                shippingCompanyId: 'ship-blue',
                seaAreaId: 'S06',
                uses: 1
            },
            {
                shippingCompanyId: 'ship-orange',
                seaAreaId: 'S03',
                uses: 1
            }
        ])
    })

    it('does not mark a delivery critical when an alternate path can replace it', () => {
        const problem: DeliveryProblem = {
            operatingCompanyId: 'prod-1',
            operatingCompanyOwnerId: 'p1',
            ownedShippingCompanyIds: ['ship-a'],
            good: Good.Rice,
            shippingFeePerShipUse: 5,
            tieBreakPolicy: DeliveryTieBreakPolicy.MinShippingCost,
            zoneSupplies: [
                {
                    zoneId: 'prod-1:zone:1',
                    areaIds: ['A01'],
                    adjacentSeaAreaIds: ['S01', 'S02'],
                    supply: 1
                }
            ],
            cityDemands: [
                {
                    cityId: 'city-a',
                    cityAreaId: 'A04',
                    adjacentSeaAreaIds: ['S03', 'S04'],
                    remainingDemand: 1
                }
            ],
            shippingCompanyNetworks: [
                {
                    shippingCompanyId: 'ship-a',
                    seaLanes: [
                        {
                            fromSeaAreaId: 'S01',
                            toSeaAreaId: 'S03'
                        },
                        {
                            fromSeaAreaId: 'S02',
                            toSeaAreaId: 'S04'
                        }
                    ],
                    seaAreaCapacities: [
                        {
                            seaAreaId: 'S01',
                            capacity: 1
                        },
                        {
                            seaAreaId: 'S02',
                            capacity: 1
                        },
                        {
                            seaAreaId: 'S03',
                            capacity: 1
                        },
                        {
                            seaAreaId: 'S04',
                            capacity: 1
                        }
                    ]
                }
            ]
        }

        const plan = solveDeliveryProblem(problem)

        expect(plan.totalDelivered).toBe(1)
        expect(plan.criticalDeliveries).toBeUndefined()
    })

    it('marks a delivery critical when no alternate path can replace it', () => {
        const problem: DeliveryProblem = {
            operatingCompanyId: 'prod-1',
            operatingCompanyOwnerId: 'p1',
            ownedShippingCompanyIds: ['ship-a'],
            good: Good.Rice,
            shippingFeePerShipUse: 5,
            tieBreakPolicy: DeliveryTieBreakPolicy.MinShippingCost,
            zoneSupplies: [
                {
                    zoneId: 'prod-1:zone:1',
                    areaIds: ['A01'],
                    adjacentSeaAreaIds: ['S01'],
                    supply: 1
                }
            ],
            cityDemands: [
                {
                    cityId: 'city-a',
                    cityAreaId: 'A04',
                    adjacentSeaAreaIds: ['S03'],
                    remainingDemand: 1
                }
            ],
            shippingCompanyNetworks: [
                {
                    shippingCompanyId: 'ship-a',
                    seaLanes: [
                        {
                            fromSeaAreaId: 'S01',
                            toSeaAreaId: 'S03'
                        }
                    ],
                    seaAreaCapacities: [
                        {
                            seaAreaId: 'S01',
                            capacity: 1
                        },
                        {
                            seaAreaId: 'S03',
                            capacity: 1
                        }
                    ]
                }
            ]
        }

        const plan = solveDeliveryProblem(problem)

        expect(plan.totalDelivered).toBe(1)
        expect(plan.criticalDeliveries).toEqual([
            {
                zoneId: 'prod-1:zone:1',
                cityId: 'city-a',
                shippingCompanyId: 'ship-a',
                seaPathAreaIds: ['S01', 'S03'],
                plannedQuantity: 1,
                requiredQuantity: 1
            }
        ])
    })
})
