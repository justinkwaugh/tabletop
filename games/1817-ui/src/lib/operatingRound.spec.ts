import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenSeventeenScenarios } from '@tabletop/1817/scenarios'
import { operatingRoundInProgress } from '@tabletop/18xx-ui'
import { EighteenSeventeenPresentation } from './presentation.js'

const titleRounds = EighteenSeventeenPresentation.titleRounds

describe('an operating round under way', () => {
    it('is the round a company operates in', () => {
        const state = playExample(EighteenSeventeenScenarios, 'construction', 3).state
        expect(operatingRoundInProgress(state, titleRounds)).toBe(true)
    })

    it('is not a stock round', () => {
        const state = playExample(EighteenSeventeenScenarios, 'trading', 3).state
        expect(operatingRoundInProgress(state, titleRounds)).toBe(false)
    })

    it('is not a round of the title’s own held between operating rounds', () => {
        const state = playExample(EighteenSeventeenScenarios, 'construction', 3).state
        expect(operatingRoundInProgress(state, [{ inProgress: () => true }])).toBe(false)
    })

    it('is not a finished set of operating rounds', () => {
        const state = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            assertExists(state.operatingSet, 'The position is in an operating set')
            state.operatingSet.completed = true
        }).state
        expect(operatingRoundInProgress(state, titleRounds)).toBe(false)
    })
})
