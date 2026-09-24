import { describe, expect, it } from 'vitest'
import { TrainDepot } from '../trains/trainDepot.js'
import { PhaseTable, type PhaseDefinition } from './phaseTable.js'

const distance = { measure: 'revenue-centers', maximum: 2 } as const
function depot(trains: readonly { id: string; rustsOn?: string }[]) {
    return new TrainDepot({
        id: 'test',
        trains: trains.map((train) => ({ ...train, name: train.id, price: 100, distance })),
        supply: trains.map((train) => ({ definitionId: train.id, count: 1 }))
    })
}
function phase(id: string, startedBy: string[], tileColors = ['yellow']): PhaseDefinition {
    return { id, startedBy, tileColors, operatingRounds: 2, trainLimit: 4 }
}

describe('a phase table', () => {
    const trains = depot([
        { id: '2', rustsOn: '4' },
        { id: '3', rustsOn: '6' },
        { id: '4' },
        { id: '6' },
        { id: 'P' }
    ])
    const table = new PhaseTable(
        [
            phase('I', []),
            phase('II', ['3'], ['yellow', 'green']),
            phase('III', ['4'], ['yellow', 'green']),
            phase('IV', ['6'], ['yellow', 'green', 'brown'])
        ],
        trains
    )

    it('names phases independently of the trains that start them', () => {
        expect(table.firstPhaseId).toBe('I')
        expect(table.phase('IV').tileColors).toEqual(['yellow', 'green', 'brown'])
        expect(table.has('4')).toBe(false)
        expect(() => table.phase('4')).toThrow('Unknown phase 4')
    })

    it('moves to the phase a purchased train starts and never backwards', () => {
        expect(table.phaseAfterPurchase('I', '3')).toBe('II')
        expect(table.phaseAfterPurchase('I', '6')).toBe('IV')
        expect(table.phaseAfterPurchase('III', '3')).toBe('III')
        expect(table.phaseAfterPurchase('II', '2')).toBe('II')
        expect(table.phaseAfterPurchase('II', 'P')).toBe('II')
    })

    it('passes every phase one purchase starts', () => {
        const passing = new PhaseTable(
            [phase('1', []), phase('2', ['2', '3']), phase('3', ['3']), phase('4', ['4'])],
            depot([{ id: '2' }, { id: '3' }, { id: '4' }])
        )
        expect(passing.phaseAfterPurchase('1', '2')).toBe('2')
        expect(passing.phaseAfterPurchase('1', '3')).toBe('3')
    })

    it('compares phases by their order', () => {
        expect(table.isAtLeast('III', 'II')).toBe(true)
        expect(table.isAtLeast('III', 'III')).toBe(true)
        expect(table.isAtLeast('II', 'III')).toBe(false)
        expect(() => table.isAtLeast('II', '3')).toThrow('Unknown phase 3')
    })

    it('rusts a train once the phase its trigger starts is reached', () => {
        expect(table.rustTiming('II', '2')).toBeUndefined()
        expect(table.rustTiming('III', '2')).toBe('immediate')
        expect(table.rustTiming('IV', '2')).toBe('immediate')
        expect(table.rustTiming('III', '3')).toBeUndefined()
        expect(table.rustTiming('IV', '6')).toBeUndefined()
        expect(table.rustTiming('IV', 'P')).toBeUndefined()
    })

    it('refuses a table that cannot be followed', () => {
        expect(() => new PhaseTable([], trains)).toThrow('Invalid phase table')
        expect(() => new PhaseTable([phase('I', []), phase('I', ['3'])], trains)).toThrow(
            'Duplicate phase'
        )
        expect(() => new PhaseTable([phase('I', ['2'])], trains)).toThrow(
            'The first phase is not started by a train'
        )
        expect(() => new PhaseTable([phase('I', []), phase('II', ['9'])], trains)).toThrow(
            'Unknown train definition'
        )
        expect(() => new PhaseTable([phase('I', []), phase('II', ['3'])], trains)).toThrow(
            '2 rusts on a train that starts no phase'
        )
        expect(() => new PhaseTable([phase('I', [])], depot([{ id: '2', rustsOn: '9' }]))).toThrow(
            'Unknown train definition'
        )
    })
})
