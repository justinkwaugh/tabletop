import { expect, it } from 'vitest'
import { roundHeaderPositions } from './historyRounds.js'

it('combines a stock round and its operating rounds in one bottom row', () => {
    expect(
        roundHeaderPositions(
            [
                { group: 'Round 2', top: 1000 },
                { group: 'Round 2', top: 2000 },
                { group: 'Round 2', top: 3000 },
                { group: 'Round 1', top: 4000 }
            ],
            200,
            20
        )
    ).toEqual([160, 160, 160, 180])
})
it('peels a round continuously away from its set and merges it on contact', () => {
    for (const top of [159, 150, 140, 130]) {
        expect(
            roundHeaderPositions(
                [
                    { group: 'Round 2', top },
                    { group: 'Round 2', top: 2000 },
                    { group: 'Round 2', top: 3000 },
                    { group: 'Round 1', top: 4000 }
                ],
                200,
                20
            )
        ).toEqual([top, 160, 160, 180])
    }
})
it('recombines passed operating rounds in the top stack', () => {
    expect(
        roundHeaderPositions(
            [
                { group: 'Round 2', top: -2000 },
                { group: 'Round 2', top: -1000 },
                { group: 'Round 2', top: -500 },
                { group: 'Round 1', top: 1000 }
            ],
            200,
            20
        )
    ).toEqual([0, 0, 0, 180])
})
