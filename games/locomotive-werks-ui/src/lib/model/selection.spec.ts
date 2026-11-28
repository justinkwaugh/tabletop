import { describe, expect, it } from 'vitest'
import { popHighestManualStagedSelection } from '@tabletop/frontend-components'
import { LocomotiveId } from '@tabletop/locomotive-werks'
import {
    CapacityStageOrder,
    ShipStageOrder,
    addCapacityStep,
    DevelopStageOrder,
    capacityPlan,
    chooseLocomotive,
    keepsWerksOpen,
    mergeCapacitySteps,
    plannedUnits,
    saleChoice,
    setAutoShip,
    setSaleAutoShip,
    toggleHeld
} from './selection.js'

describe('holding back shipments', () => {
    it('toggles a locomotive in and out of the held list', () => {
        const held = toggleHeld({}, LocomotiveId.Fast1)
        expect(saleChoice(held).held).toEqual([LocomotiveId.Fast1])
        expect(saleChoice(toggleHeld(held, LocomotiveId.Fast1)).held).toEqual([])
    })

    it('takes back one press at a time, holds and the automatic tick alike', () => {
        const pressed = setSaleAutoShip(
            toggleHeld(toggleHeld({}, LocomotiveId.Fast1), LocomotiveId.Passenger1),
            true
        )
        const untick = popHighestManualStagedSelection(pressed, ShipStageOrder).nextState
        expect(saleChoice(untick)).toEqual({
            held: [LocomotiveId.Fast1, LocomotiveId.Passenger1],
            autoShip: false
        })
        const once = popHighestManualStagedSelection(untick, ShipStageOrder).nextState
        expect(saleChoice(once).held).toEqual([LocomotiveId.Fast1])
        const none = popHighestManualStagedSelection(once, ShipStageOrder).nextState
        expect(none.plan).toBeUndefined()
    })
})

describe('choosing a locomotive to develop', () => {
    it('takes back the choice, and a second choice replaces the first', () => {
        const first = chooseLocomotive({}, LocomotiveId.Fast1)
        const second = chooseLocomotive(first, LocomotiveId.Passenger2)
        expect(second.locomotive?.value).toBe(LocomotiveId.Passenger2)
        const undone = popHighestManualStagedSelection(second, DevelopStageOrder)
        expect(undone.poppedStage).toBe('locomotive')
        expect(undone.nextState.locomotive).toBeUndefined()
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
