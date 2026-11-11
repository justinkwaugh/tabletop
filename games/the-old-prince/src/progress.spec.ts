import { expect, it } from 'vitest'
import { startedGameProgress } from '../../../libs/18xx/test/gameProgress.js'
import { Definition } from './definition/gameDefinition.js'

const { startedGame, progressAt } = startedGameProgress(Definition, 4)

it('starts at the first phase with no bank to report', () => {
    expect(startedGame.progress).toEqual({ fraction: 0, label: 'Phase 2H' })
})

it('measures progress through the phase table to the D that ends the game', () => {
    expect(progressAt({ phaseId: '5H' })?.fraction).toBe(0.333)
    expect(progressAt({ phaseId: 'D' })?.fraction).toBe(1)
})

const firstD = { phaseId: 'D', gameEnding: { reason: 'First D', finalOperatingSet: 9 } }
const operatingSet = (number: number, completed: boolean) => ({
    number,
    roundNumber: 1,
    roundCount: 3,
    companyOrder: [],
    completedCompanyIds: [],
    privateIncomePaid: true,
    completed
})

it('names the last set while the sets before it are still to play', () => {
    for (const set of [operatingSet(8, false), operatingSet(8, true)])
        expect(progressAt({ ...firstD, operatingSet: set })).toEqual({
            fraction: 1,
            label: 'Ends after OR 9',
            final: true
        })
})

it('reports the final set once it starts', () => {
    expect(progressAt({ ...firstD, operatingSet: operatingSet(9, false) })).toEqual({
        fraction: 1,
        label: 'Final OR set',
        final: true
    })
})
