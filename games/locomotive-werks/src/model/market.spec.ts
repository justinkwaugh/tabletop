import { describe, expect, it } from 'vitest'
import { LocomotiveId, LocomotiveKind } from './locomotives.js'
import {
    DemandChange,
    SaleOutcome,
    adjustDemand,
    applySale,
    planSale,
    type DicePool,
    type LocomotiveSpace
} from './market.js'

function space(
    locomotiveId: LocomotiveId,
    existingOrders: number[],
    customerBase: number[] = []
): LocomotiveSpace {
    return { locomotiveId, existingOrders, customerBase, cards: 0 }
}

function pool(rolls: number[], available = 20): DicePool {
    const queue = [...rolls]
    return {
        available: () => available,
        roll: () => queue.shift() ?? 1
    }
}

describe('selling locomotives', () => {
    // Susan has produced 3; the dice are 6, 4 and 3.
    it('ships every unit and moves the matching die to the Customer Base', () => {
        const passenger = space(LocomotiveId.Passenger1, [6, 4, 3])
        const plan = planSale(passenger.existingOrders, 3)
        expect(plan).toEqual({ units: 3, face: 3, outcome: SaleOutcome.Matched })
        applySale(passenger, plan!)
        expect(passenger.existingOrders).toEqual([6, 4])
        expect(passenger.customerBase).toEqual([3])
    })

    // Frank has produced 1; the dice are 4 and 6.
    it('lowers the highest die when fewer units ship and none match', () => {
        const passenger = space(LocomotiveId.Passenger1, [4, 6])
        const plan = planSale(passenger.existingOrders, 1)
        expect(plan).toEqual({ units: 1, face: 6, outcome: SaleOutcome.Reduced })
        applySale(passenger, plan!)
        expect(passenger.existingOrders).toEqual([4, 5])
    })

    // Annika has produced 6; the dice are 4 and 5.
    it('ships only the highest die when there are more units', () => {
        const passenger = space(LocomotiveId.Passenger1, [4, 5])
        const plan = planSale(passenger.existingOrders, 6)
        expect(plan).toEqual({ units: 5, face: 5, outcome: SaleOutcome.Exceeded })
        applySale(passenger, plan!)
        expect(passenger.existingOrders).toEqual([4])
        expect(passenger.customerBase).toEqual([5])
    })

    it('prefers a matching die to lowering a higher one', () => {
        expect(planSale([6, 2], 2)?.outcome).toBe(SaleOutcome.Matched)
    })

    it('cannot sell without Existing Orders', () => {
        expect(planSale([], 3)).toBeUndefined()
    })
})

describe('Market Demands', () => {
    function board(spaces: LocomotiveSpace[]) {
        return (locomotiveId: LocomotiveId) => {
            const found = spaces.find((candidate) => candidate.locomotiveId === locomotiveId)
            return found ?? space(locomotiveId, [])
        }
    }

    it('does nothing for a kind with no generation', () => {
        expect(adjustDemand(LocomotiveKind.Freight, board([]), pool([]))).toEqual([])
    })

    it('adds a die to a lone generation below its maximum and rolls the Customer Base', () => {
        const passenger = space(LocomotiveId.Passenger1, [5], [3])
        const steps = adjustDemand(LocomotiveKind.Passenger, board([passenger]), pool([2, 6]))
        expect(steps).toEqual([
            {
                locomotiveId: LocomotiveId.Passenger1,
                change: DemandChange.Grown,
                added: 1,
                returned: 0,
                rolls: [2, 6]
            }
        ])
        expect(passenger.existingOrders).toEqual([5, 2, 6])
        expect(passenger.customerBase).toEqual([])
    })

    it('adds nothing to a generation at its maximum', () => {
        const passenger = space(LocomotiveId.Passenger1, [5, 1], [3])
        adjustDemand(LocomotiveKind.Passenger, board([passenger]), pool([4]))
        expect(passenger.existingOrders).toEqual([5, 1, 4])
    })

    it('takes a die from the older of two generations and grows the newer', () => {
        const older = space(LocomotiveId.Passenger1, [2], [6, 4])
        const newer = space(LocomotiveId.Passenger2, [3])
        const steps = adjustDemand(LocomotiveKind.Passenger, board([older, newer]), pool([1, 5]))
        expect(steps.map((step) => step.change)).toEqual([DemandChange.Shrunk, DemandChange.Grown])
        expect(older.existingOrders).toEqual([2, 1])
        expect(newer.existingOrders).toEqual([3, 5])
    })

    it('returns the lowest Existing Orders die when the older Customer Base is empty', () => {
        const older = space(LocomotiveId.Passenger1, [3, 6])
        const newer = space(LocomotiveId.Passenger2, [3])
        adjustDemand(LocomotiveKind.Passenger, board([older, newer]), pool([5]))
        expect(older.existingOrders).toEqual([6])
    })

    it('retires the oldest of three generations and fills the middle one', () => {
        const oldest = space(LocomotiveId.Passenger1, [2], [5])
        const middle = space(LocomotiveId.Passenger2, [4])
        const newest = space(LocomotiveId.Passenger3, [1])
        const steps = adjustDemand(
            LocomotiveKind.Passenger,
            board([oldest, middle, newest]),
            pool([6, 6, 6, 3])
        )
        expect(steps.map((step) => step.change)).toEqual([
            DemandChange.Obsolete,
            DemandChange.Filled,
            DemandChange.Grown
        ])
        expect(oldest.existingOrders).toEqual([])
        expect(oldest.customerBase).toEqual([])
        expect(middle.existingOrders).toEqual([4, 6, 6, 6])
        expect(newest.existingOrders).toEqual([1, 3])
    })

    it('retires every generation older than the newest two', () => {
        const first = space(LocomotiveId.Passenger1, [2], [5])
        const second = space(LocomotiveId.Passenger2, [4, 3], [1])
        const third = space(LocomotiveId.Passenger3, [4])
        const fourth = space(LocomotiveId.Passenger4, [1])
        const steps = adjustDemand(
            LocomotiveKind.Passenger,
            board([first, second, third, fourth]),
            pool([6, 6, 6, 3])
        )
        expect(steps.map((step) => [step.locomotiveId, step.change])).toEqual([
            [LocomotiveId.Passenger1, DemandChange.Obsolete],
            [LocomotiveId.Passenger2, DemandChange.Obsolete],
            [LocomotiveId.Passenger3, DemandChange.Filled],
            [LocomotiveId.Passenger4, DemandChange.Grown]
        ])
        for (const retired of [first, second]) {
            expect(retired.existingOrders).toEqual([])
            expect(retired.customerBase).toEqual([])
        }
        expect(third.existingOrders).toEqual([4, 6, 6, 6])
        expect(fourth.existingOrders).toEqual([1, 3])
    })

    it('adds only the dice left in the pool', () => {
        const passenger = space(LocomotiveId.Passenger2, [4])
        adjustDemand(LocomotiveKind.Passenger, board([passenger]), pool([2], 0))
        expect(passenger.existingOrders).toEqual([4])
    })
})
