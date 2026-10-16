import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { ActionType, Side } from '@tabletop/napoleons-triumph'
import {
    BATTLE_REFUGE,
    advanceAfterARepulse,
    bombardment,
    bombardmentLossChosen,
    brokenInCombat,
    feintAgainstBlockers,
    feintAgainstOneReserve,
    gunsStayAfterARetreat,
    infantry,
    moveIn,
    regroupedAfterARepulse,
    repulsedByBlockers,
    retreatBeforeCombat,
    retreatToTheRefuge,
    wonBeforeTheRetreat,
    type BattleGame
} from '@tabletop/napoleons-triumph/testing'
import { concludedBattleOf, endingOf, type ConcludedBattle } from './concludedBattle.js'

function concluded(game: BattleGame): ConcludedBattle | undefined {
    return concludedBattleOf({ state: game.state, actions: game.played })
}

function battle(game: BattleGame): ConcludedBattle {
    const ended = concluded(game)
    assertExists(ended, 'Expected an attack that has just ended')
    return ended
}

describe('the attack that has just ended', () => {
    it('is not there while the attack is still being fought', () => {
        const game = wonBeforeTheRetreat()
        expect(game.state.attack).toBeDefined()
        expect(concluded(game)).toBeUndefined()
    })

    it('is the attack its last action recorded, opened by the threat', () => {
        const game = repulsedByBlockers()
        const ended = battle(game)
        expect(ended.openedBy).toBe(game.played[0].id)
        expect(ended.attack).toMatchObject({
            initialResult: -2,
            finalResult: -2,
            attackerWon: false,
            attackingUnitIds: ['F01', 'F02']
        })
        expect(ended.retreatedTo).toEqual([])
        expect(ended.taken).toBe(false)
    })

    it('keeps the units the attack destroyed, as they were last seen', () => {
        const game = repulsedByBlockers()
        expect(game.hydrated.findUnit('F01')).toBeUndefined()
        expect(battle(game).unitsLastSeen.get('F01')?.face).toEqual(infantry(2))
    })

    it('names where the defenders retreated to and whether the attackers moved in', () => {
        const ended = battle(retreatToTheRefuge(wonBeforeTheRetreat()))
        expect(ended.retreatedTo).toEqual([BATTLE_REFUGE])
        expect(ended.taken).toBe(true)
        expect(ended.unitsLastSeen.has('A03')).toBe(true)
    })

    it('names the army the attack demoralized', () => {
        const game = brokenInCombat()
        expect(battle(game).demoralizedId).toBe(game.playerOf(Side.Allied))
        expect(battle(retreatBeforeCombat(1)).demoralizedId).toBe(game.playerOf(Side.Allied))
    })

    it('is gone once anything else is done', () => {
        const game = retreatToTheRefuge(wonBeforeTheRetreat())
        game.by(Side.French, ActionType.EndTurn)
        expect(concluded(game)).toBeUndefined()
    })
})

describe('the sentence that ends an attack', () => {
    it.each([
        ['an attack thrown back', repulsedByBlockers, 'The Allies hold locale 94.'],
        [
            'a won fight the defenders retreat from',
            () => retreatToTheRefuge(wonBeforeTheRetreat()),
            'The Allies retreat to locale 83, and the French take locale 94.'
        ],
        [
            'a retreat that breaks the defending army',
            () => retreatToTheRefuge(wonBeforeTheRetreat(4)),
            'The Allies retreat to locale 83; the Allied army is demoralized.'
        ],
        [
            'a fight whose losses break the defending army',
            brokenInCombat,
            'The Allied army is demoralized.'
        ],
        [
            'a bombardment settled by its declaration',
            bombardment,
            'The guns fire, and the Allies keep locale 94.'
        ],
        [
            'a bombardment whose loss the defender chose',
            bombardmentLossChosen,
            'The guns fire, and the Allies keep locale 94.'
        ],
        [
            'a feint against blockers',
            feintAgainstBlockers,
            'The French call the attack off as a feint.'
        ],
        [
            'a feint the game answers with an advance',
            feintAgainstOneReserve,
            'The French call the attack off as a feint.'
        ],
        ['a defence that holds and advances', advanceAfterARepulse, 'The Allies hold locale 94.'],
        ['a corps thrown back that regroups', regroupedAfterARepulse, 'The Allies hold locale 94.'],
        [
            'a retreat before combat the attackers follow',
            () => moveIn(retreatBeforeCombat()),
            'The Allies fall back to locale 83 before the attack, and the French move into locale 94.'
        ],
        [
            'a retreat before combat the guns stay behind from',
            gunsStayAfterARetreat,
            'The Allies fall back to locale 83 before the attack.'
        ],
        [
            'a retreat before combat that breaks the defending army',
            () => retreatBeforeCombat(1),
            'The Allies fall back to locale 83 before the attack; the Allied army is demoralized.'
        ]
    ])('after %s', (_name, fight, sentence) => {
        const ending = endingOf(battle(fight()), Side.French, (locale) => `locale ${locale}`)
        expect(ending).toBe(sentence)
    })
})
