import * as Type from 'typebox'
import { describe, expect, it } from 'vitest'
import { Visibility } from '@tabletop/common'
import { stateWith } from './stateWith.js'

type Sample = { cash: number; phaseId?: string; companies: string[] }

describe('stateWith', () => {
    it('reads changed members from the copy and the rest from the state', () => {
        const state: Sample = { cash: 10, phaseId: 'I', companies: ['IC'] }
        const copy = stateWith(state, { cash: 20 })
        expect(copy.cash).toBe(20)
        expect(copy.companies).toBe(state.companies)
        expect(state).toEqual({ cash: 10, phaseId: 'I', companies: ['IC'] })
    })

    it('keeps assignments and deletions on the copy', () => {
        const state: Sample = { cash: 10, phaseId: 'I', companies: ['IC'] }
        const copy = stateWith(state, { cash: 20 })
        copy.companies = ['NYC']
        delete copy.phaseId
        expect(copy.companies).toEqual(['NYC'])
        expect(copy.phaseId).toBeUndefined()
        expect('phaseId' in copy).toBe(false)
        expect(Object.hasOwn(copy, 'phaseId')).toBe(false)
        copy.phaseId = 'II'
        expect(copy.phaseId).toBe('II')
        expect(state).toEqual({ cash: 10, phaseId: 'I', companies: ['IC'] })
    })

    it('lists the members the copy holds when the state can be listed', () => {
        const state: Sample = { cash: 10, companies: ['IC'] }
        const copy = stateWith(state, { phaseId: 'II' })
        expect('phaseId' in copy).toBe(true)
        expect(Object.hasOwn(copy, 'cash')).toBe(true)
        expect({ ...copy }).toEqual({ cash: 10, companies: ['IC'], phaseId: 'II' })
    })

    it('copies a copy without changing either', () => {
        const state: Sample = { cash: 10, phaseId: 'I', companies: ['IC'] }
        const first = stateWith(state, { cash: 20 })
        const second = stateWith(first, { phaseId: 'II' })
        second.cash = 30
        expect([state.cash, first.cash, second.cash]).toEqual([10, 20, 30])
        expect([state.phaseId, first.phaseId, second.phaseId]).toEqual(['I', 'I', 'II'])
    })

    it('runs the state’s getters and methods against the copy', () => {
        class Ledger {
            constructor(public cash: number) {}
            get doubled() {
                return this.cash * 2
            }
        }
        const copy = stateWith(new Ledger(10), { cash: 15 })
        expect(copy.doubled).toBe(30)
        expect(copy).toBeInstanceOf(Ledger)
    })

    it('reads public members of a player’s guarded state and still refuses hidden ones', () => {
        const projector = Visibility.createProjector(
            Type.Object({
                cash: Type.Number(),
                seed: Visibility.protect(Type.Number(), { policy: Visibility.Policy.HostOnly })
            })
        )
        const perspective = { kind: 'player', playerId: 'alice' } as const
        const guarded = projector.guardForExecution(
            projector.project({ cash: 10, seed: 7 }, perspective),
            perspective
        )
        expect(() => ({ ...guarded })).toThrow(Visibility.UnavailableProjectedValueError)
        const copy = stateWith(guarded, { cash: 20 })
        expect(copy.cash).toBe(20)
        expect(() => copy.seed).toThrow(Visibility.UnavailableProjectedValueError)
        expect(() => ({ ...copy })).toThrow(Visibility.UnavailableProjectedValueError)
    })
})
