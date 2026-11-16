import { describe, expect, it } from 'vitest'
import { popHighestManualStagedSelection } from '@tabletop/frontend-components'
import { LocomotiveId } from '@tabletop/locomotive-werks'
import {
    CapacityStageOrder,
    ShipStageOrder,
    addCapacityStep,
    mergeCapacitySteps,
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
        expect(once.steps?.value).toEqual([{ locomotiveId: LocomotiveId.Passenger1 }])
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
})
