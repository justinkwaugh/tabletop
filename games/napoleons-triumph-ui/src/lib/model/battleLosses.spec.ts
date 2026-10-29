import { describe, expect, it } from 'vitest'
import {
    BATTLE_FROM,
    BATTLE_INTO,
    artillery,
    infantry,
    retreatToTheRefuge,
    wonBeforeTheRetreat,
    type BattleGame
} from '@tabletop/napoleons-triumph/testing'
import { battleLossesOf } from './battleLosses.js'

function lossesOf(game: BattleGame) {
    return battleLossesOf({ state: game.state, actions: game.played })
}

describe('the losses of the attack opened by the latest threat', () => {
    it('keep where each unit stood when it lost its first steps, and all it lost', () => {
        const game = retreatToTheRefuge(wonBeforeTheRetreat())
        const losses = lossesOf(game)
        expect(losses?.openedBy).toBe(game.played[0].id)
        expect(
            losses?.taken.map(({ unit, loss }) => ({
                unitId: unit.id,
                position: unit.position,
                face: loss.face,
                steps: loss.steps,
                eliminated: loss.eliminated
            }))
        ).toEqual([
            {
                unitId: 'F01',
                position: { locale: BATTLE_FROM },
                face: infantry(3),
                steps: 1,
                eliminated: false
            },
            {
                unitId: 'A01',
                position: { locale: BATTLE_INTO },
                face: infantry(2),
                steps: 2,
                eliminated: true
            },
            {
                unitId: 'A02',
                position: { locale: BATTLE_INTO },
                face: infantry(1),
                steps: 1,
                eliminated: true
            },
            {
                unitId: 'A03',
                position: { locale: BATTLE_INTO },
                face: artillery(),
                steps: 1,
                eliminated: true
            },
            {
                unitId: 'A04',
                position: { locale: BATTLE_INTO },
                face: infantry(3),
                steps: 2,
                eliminated: false
            }
        ])
    })

    it('are kept while the attack is still being fought', () => {
        const losses = lossesOf(wonBeforeTheRetreat())
        expect(losses?.taken.map(({ unit }) => unit.id)).toEqual(['F01', 'A01', 'A02'])
    })
})
