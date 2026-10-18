import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { DecisionKind } from '@tabletop/napoleons-triumph'
import {
    BattleGame,
    attacker,
    defender,
    infantry,
    oddLossOnTheAttackers
} from '@tabletop/napoleons-triumph/testing'
import { awaitedStep } from './battleWaiting.js'

function attackOf(game: BattleGame) {
    const attack = game.hydrated.attack
    assertExists(attack, 'An attack is in progress')
    return attack
}

describe('what the other player is waited on for in an attack', () => {
    it('names the army whose leading unit the odd step falls on', () => {
        const game = oddLossOnTheAttackers()
        expect(awaitedStep(attackOf(game), (playerId) => game.hydrated.sideOf(playerId))).toBe(
            'to choose which French leading unit takes the extra step'
        )
    })

    it('says how many steps are still owed when a player places them on other units', () => {
        const game = oddLossOnTheAttackers()
        const attack = attackOf(game)
        attack.pending = [
            {
                kind: DecisionKind.ExcessLosses,
                playerId: attack.defenderId,
                amount: 2,
                unitIds: ['A01', 'A02']
            }
        ]
        expect(awaitedStep(attack, (playerId) => game.hydrated.sideOf(playerId))).toBe(
            'to choose which Allied units lose the 2 steps still owed'
        )
    })

    it('says what the step of the attack is for when nothing is owed', () => {
        const game = new BattleGame([attacker('F01', infantry(3)), defender('A01', infantry(2))])
        game.threaten()
        expect(awaitedStep(attackOf(game), (playerId) => game.hydrated.sideOf(playerId))).toBe(
            'to defend or retreat'
        )
    })
})
