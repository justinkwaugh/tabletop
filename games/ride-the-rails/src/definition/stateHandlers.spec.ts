import { TerminalStateHandler } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { RideTheRailsStateHandlers } from './stateHandlers.js'
import { MachineState } from './states.js'

describe('the machine-state handlers (R-2.1)', () => {
    it('maps every machine state to a handler of its own', () => {
        const states = Object.values(MachineState)
        expect(Object.keys(RideTheRailsStateHandlers).sort()).toEqual([...states].sort())
        for (const state of states) {
            expect(RideTheRailsStateHandlers[state]).not.toBeInstanceOf(TerminalStateHandler)
        }
        const handlers = new Set(states.map((state) => RideTheRailsStateHandlers[state]))
        expect(handlers.size).toBe(states.length)
    })
})
