import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, type BarrelTieBreak, type ScoreGame } from '@tabletop/feudum'
import { describeAction } from '$lib/model/actionDescription.js'
import { gameEndOf } from '$lib/model/gameEnd.js'

const Names: Record<string, string> = { p1: 'Dana', p2: 'Rhys', p3: 'Ann' }
const nameOf = (id: string) => Names[id] ?? id

function row(playerId: string, score: number) {
    return {
        playerId,
        voyage: { vp: 0 },
        largeEmpire: { outposts: 0, farms: 0, towns: 0, feudums: 0, sets: 0, vp: 0 },
        shillings: { held: 0, vp: 0 },
        charters: [],
        total: 0,
        score
    }
}

/** R-6.3 A ScoreGame over three seats with these scores, winners and barrel tie-break. */
function scored(
    scores: readonly number[],
    winners: string[],
    barrelTieBreak: BarrelTieBreak
): GameAction {
    const action: ScoreGame = {
        id: 'a',
        gameId: 'g',
        source: ActionSource.System,
        type: ActionType.ScoreGame,
        revealsInfo: true,
        metadata: {
            sheet: scores.map((score, index) => row(`p${index + 1}`, score)),
            winners,
            barrelTieBreak
        }
    }
    return action
}

describe('R-6.3 the barrel tie-break, as the end screen and the History word it', () => {
    it('R-6.3 tied on vp and on barrel sulfur, the win is shared: nothing says the tie was broken', () => {
        const action = scored(
            [20, 20, 5],
            ['p1', 'p2'],
            [
                { playerId: 'p1', barrel: 1 },
                { playerId: 'p2', barrel: 1 }
            ]
        )
        const summary = gameEndOf([action])
        expect(summary?.winners).toEqual(['p1', 'p2'])
        expect(summary?.tieBreak).toEqual({
            broken: false,
            seats: [
                { playerId: 'p1', barrel: 1 },
                { playerId: 'p2', barrel: 1 }
            ],
            shared: true
        })
        const line = describeAction(action, { viewerId: undefined, nameOf, dummyName: String })
        expect(line).toContain('tie on vp and on barrel sulfur: Dana 1, Rhys 1 · won by Dana, Rhys')
        expect(line).not.toMatch(/broken/)
    })

    it('R-6.3 a tie the barrel breaks is still called broken', () => {
        const action = scored(
            [20, 20, 5],
            ['p1'],
            [
                { playerId: 'p1', barrel: 3 },
                { playerId: 'p2', barrel: 1 }
            ]
        )
        expect(gameEndOf([action])?.tieBreak).toEqual({
            broken: true,
            seats: [
                { playerId: 'p1', barrel: 3 },
                { playerId: 'p2', barrel: 1 }
            ],
            shared: false
        })
        expect(
            describeAction(action, { viewerId: undefined, nameOf, dummyName: String })
        ).toContain('tie broken by barrel sulfur: Dana 3, Rhys 1 · won by Dana')
    })

    it('R-6.3 three tied on vp, two level on the barrel: the third is out and the two still share', () => {
        const action = scored(
            [20, 20, 20],
            ['p1', 'p2'],
            [
                { playerId: 'p1', barrel: 2 },
                { playerId: 'p2', barrel: 2 },
                { playerId: 'p3', barrel: 0 }
            ]
        )
        expect(gameEndOf([action])?.tieBreak).toMatchObject({ broken: true, shared: true })
        expect(
            describeAction(action, { viewerId: undefined, nameOf, dummyName: String })
        ).toContain(
            'tie broken by barrel sulfur: Dana 2, Rhys 2, Ann 0, still tied · won by Dana, Rhys'
        )
    })
})
