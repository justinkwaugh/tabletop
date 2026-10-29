import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { attackEndedBy } from '@tabletop/napoleons-triumph'
import {
    infantry,
    repulsedByBlockers,
    retreatToTheRefuge,
    wonBeforeTheRetreat,
    type BattleGame
} from '@tabletop/napoleons-triumph/testing'
import { lossesOfAttack } from './attackLosses.js'
import { unitsAsTheyEnteredTheAttack } from './attackForces.js'

function entered(game: BattleGame) {
    const attack = game.state.attack ?? attackEndedBy(game.played.at(-1))
    assertExists(attack, 'Expected an attack being fought or just ended')
    return unitsAsTheyEnteredTheAttack(
        { state: game.state, actions: game.played },
        lossesOfAttack(game.played, attack, game.state.attack?.pending ?? [])
    )
}

describe('the units of an attack as they entered it', () => {
    it('are as strong as they went into an attack that is over', () => {
        const game = retreatToTheRefuge(wonBeforeTheRetreat())
        expect(game.hydrated.findUnit('F01')?.face).toEqual(infantry(2))
        expect(entered(game).get('F01')?.face).toEqual(infantry(3))
        expect(entered(game).get('A04')?.face).toEqual(infantry(3))
    })

    it('are as strong as they went into an attack still being fought', () => {
        expect(entered(wonBeforeTheRetreat()).get('F01')?.face).toEqual(infantry(3))
    })

    it('keep the units the attack destroyed', () => {
        const game = wonBeforeTheRetreat()
        expect(game.hydrated.findUnit('A01')).toBeUndefined()
        expect(entered(game).get('A01')?.face).toEqual(infantry(2))
        expect(entered(repulsedByBlockers()).get('F01')?.face).toEqual(infantry(2))
    })

    it('show the enemy what the attack revealed, at the strength it was revealed', () => {
        const game = retreatToTheRefuge(wonBeforeTheRetreat())
        expect(entered(game).get('F01')?.shown).toEqual(infantry(3))
        expect(entered(game).get('A01')?.shown).toEqual(infantry(2))
    })

    it('show the enemy a unit revealed by the loss that destroyed it', () => {
        const game = wonBeforeTheRetreat()
        expect(entered(game).get('A02')?.shown).toEqual(infantry(1))
    })

    it('stand as they are on the board until the history is loaded', () => {
        const game = wonBeforeTheRetreat()
        const attack = game.state.attack
        assertExists(attack, 'Expected an attack being fought')
        const entered = unitsAsTheyEnteredTheAttack(
            { state: game.state, actions: [] },
            lossesOfAttack([], attack, attack.pending)
        )
        expect(entered.get('F01')).toEqual(game.hydrated.findUnit('F01'))
    })

    it('leave the units that lost nothing as they stand', () => {
        const game = retreatToTheRefuge(wonBeforeTheRetreat())
        expect(entered(game).get('F02')).toEqual(game.hydrated.findUnit('F02'))
    })
})
