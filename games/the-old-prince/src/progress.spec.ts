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

it('reports the last set once the game end is scheduled', () => {
    expect(
        progressAt({ phaseId: 'D', gameEnding: { reason: 'First D', finalOperatingSet: 7 } })
    ).toEqual({ fraction: 1, label: 'Final OR set', final: true })
})
