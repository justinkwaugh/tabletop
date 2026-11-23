import { describe, expect, it } from 'vitest'
import { popHighestManualStagedSelection } from '@tabletop/frontend-components'
import { LocomotiveId } from '@tabletop/locomotive-werks'
import {
    CapacityStageOrder,
    ShipStageOrder,
    addCapacityStep,
    capacityPlan,
    keepsWerksOpen,
    mergeCapacitySteps,
    plannedUnits,
    setAutoShip,
    toggleHeld
} from './selection.js'

describe('holding back shipments', () => {
    it('toggles a locomotive in and out of the held list', () => {
        const held = toggleHeld({}, LocomotiveId.Fast1)
        expect(held.held?.value).toEqual([LocomotiveId.Fast1])
        expect(toggleHeld(held, LocomotiveId.Fast1).held?.value).toEqual([])
    })

    it('takes back one press at a time', () => {
        const twice = toggleHeld(toggleHeld({}, LocomotiveId.Fast1), LocomotiveId.Passenger1)
        const once = popHighestManualStagedSelection(twice, ShipStageOrder).nextState
        expect(once.held?.value).toEqual([LocomotiveId.Fast1])
        const none = popHighestManualStagedSelection(once, ShipStageOrder).nextState
        expect(none.held).toBeUndefined()
    })
})

describe('planning capacity', () => {
    it('stacks each press so Undo takes back the last', () => {
        const twice = addCapacityStep(
            addCapacityStep({}, { locomotiveId: LocomotiveId.Passenger1 }),
            { locomotiveId: LocomotiveId.Fast1, from: LocomotiveId.Passenger1 }
        )
        const once = popHighestManualStagedSelection(twice, CapacityStageOrder).nextState
        expect(capacityPlan(once).steps).toEqual([{ locomotiveId: LocomotiveId.Passenger1 }])
    })

    it('takes back the automatic shipping tick in turn with the planned steps', () => {
        const step = { locomotiveId: LocomotiveId.Passenger1 }
        const ticked = addCapacityStep(setAutoShip(addCapacityStep({}, step), true), step)
        expect(capacityPlan(ticked)).toEqual({ steps: [step, step], autoShip: true })

        const lastStep = popHighestManualStagedSelection(ticked, CapacityStageOrder).nextState
        expect(capacityPlan(lastStep)).toEqual({ steps: [step], autoShip: true })
        const tick = popHighestManualStagedSelection(lastStep, CapacityStageOrder).nextState
        expect(capacityPlan(tick)).toEqual({ steps: [step], autoShip: false })
    })

    it('merges runs of the same step into one purchase', () => {
        expect(
            mergeCapacitySteps([
                { locomotiveId: LocomotiveId.Passenger1 },
                { locomotiveId: LocomotiveId.Passenger1 },
                { locomotiveId: LocomotiveId.Fast1, from: LocomotiveId.Passenger1 },
                { locomotiveId: LocomotiveId.Passenger1 }
            ])
        ).toEqual([
            { locomotiveId: LocomotiveId.Passenger1, units: 2 },
            { locomotiveId: LocomotiveId.Fast1, from: LocomotiveId.Passenger1, units: 1 },
            { locomotiveId: LocomotiveId.Passenger1, units: 1 }
        ])
    })

    it('keeps a werk that an earlier upgrade closed from taking or giving units', () => {
        const plants = [
            { locomotiveId: LocomotiveId.Passenger1, units: 1 },
            { locomotiveId: LocomotiveId.Fast1, units: 1 },
            { locomotiveId: LocomotiveId.Freight1, units: 1 }
        ]
        const units = plannedUnits(plants, [
            { locomotiveId: LocomotiveId.Freight1, from: LocomotiveId.Fast1 }
        ])
        expect(units.get(LocomotiveId.Fast1)).toBe(0)
        expect(
            keepsWerksOpen(units, {
                locomotiveId: LocomotiveId.Fast1,
                from: LocomotiveId.Passenger1
            })
        ).toBe(false)
        expect(keepsWerksOpen(units, { locomotiveId: LocomotiveId.Fast1 })).toBe(false)
        expect(
            keepsWerksOpen(units, { locomotiveId: LocomotiveId.Freight1, from: LocomotiveId.Fast1 })
        ).toBe(false)
        expect(
            keepsWerksOpen(units, {
                locomotiveId: LocomotiveId.Freight1,
                from: LocomotiveId.Passenger1
            })
        ).toBe(true)
        expect(keepsWerksOpen(units, { locomotiveId: LocomotiveId.Passenger1 })).toBe(true)
    })
})
