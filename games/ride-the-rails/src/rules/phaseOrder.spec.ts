import { describe, expect, it } from 'vitest'
import { PhaseName } from '../definition/phases.js'
import { PHASE_ORDER, firstInPhase, nextInPhase, phaseTurnOrder } from './phaseOrder.js'

const TURN_ORDER = ['p2', 'p4', 'p1', 'p3']

describe('phase order (R-2.1, R-2.2)', () => {
    it('runs the three phases in order', () => {
        expect(PHASE_ORDER).toEqual([PhaseName.TakeShare, PhaseName.Build, PhaseName.Ride])
    })

    it('walks Take a Share from the last in turn order to the first', () => {
        expect(phaseTurnOrder(TURN_ORDER, PhaseName.TakeShare)).toEqual(['p3', 'p1', 'p4', 'p2'])
        expect(firstInPhase(TURN_ORDER, PhaseName.TakeShare)).toBe('p3')
        expect(nextInPhase(TURN_ORDER, PhaseName.TakeShare, 'p1')).toBe('p4')
        expect(nextInPhase(TURN_ORDER, PhaseName.TakeShare, 'p2')).toBeUndefined()
    })

    it.each([PhaseName.Build, PhaseName.Ride])('walks %s from the first to the last', (phase) => {
        expect(phaseTurnOrder(TURN_ORDER, phase)).toEqual(TURN_ORDER)
        expect(firstInPhase(TURN_ORDER, phase)).toBe('p2')
        expect(nextInPhase(TURN_ORDER, phase, 'p1')).toBe('p3')
        expect(nextInPhase(TURN_ORDER, phase, 'p3')).toBeUndefined()
    })

    it('leaves the turn order itself unchanged', () => {
        const turnOrder = [...TURN_ORDER]
        phaseTurnOrder(turnOrder, PhaseName.TakeShare)
        expect(turnOrder).toEqual(TURN_ORDER)
    })

    it('refuses a player outside the turn order', () => {
        expect(() => nextInPhase(TURN_ORDER, PhaseName.Build, 'p5')).toThrow(
            /not in the turn order/
        )
    })
})
