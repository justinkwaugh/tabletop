import { describe, expect, it } from 'vitest'
import {
    ActionType,
    CommandKind,
    ResultTermKind,
    Side,
    attackerWins,
    type ResultTerm
} from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    cavalry,
    infantry
} from '@tabletop/napoleons-triumph/testing'
import {
    AccountSide,
    attackSucceeds,
    finalLines,
    initialLines,
    recordedAccounts,
    verdictOf
} from './resultAccount.js'

const valuesOf = (terms: readonly ResultTerm[] | undefined) =>
    terms?.map((term) => [term.kind, term.value])

describe('the accounts the game keeps of an attack’s results', () => {
    function fought() {
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        arrangeBattlefield(game, [
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: 53 },
            { id: 'A-inf', side: Side.Allied, face: infantry(1), locale: 63, facing: 53 },
            { id: 'A-cav', side: Side.Allied, face: cavalry(3), locale: 63, facing: 53 }
        ])
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        const actions = [
            ...game.act(ActionType.ThreatenAttack, french, {
                approach: game.hydrated.map.approachBetween(53, 63).id
            }),
            ...game.act(ActionType.PressAttack, french),
            ...game.act(ActionType.LeadDefense, allied, { leaderIds: ['A-inf'] })
        ]
        const declared = game.act(ActionType.DeclareAttack, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            wide: false,
            leaderIds: ['F-inf']
        })
        return { game, allied, actions, declared }
    }

    it('are none before an attack is declared', () => {
        expect(recordedAccounts(fought().actions)).toEqual({})
    })

    it('are the declaration’s terms, with no counter-attack yet made', () => {
        const { actions, declared } = fought()
        const accounts = recordedAccounts([...actions, ...declared])
        expect(valuesOf(accounts.initial)).toEqual([
            [ResultTermKind.AttackLeaders, 3],
            [ResultTermKind.InfantryAgainstBlockers, -1],
            [ResultTermKind.DefenseLeaders, -1]
        ])
        expect(accounts.counter).toEqual([])
    })

    it('add what the counter-attack took, with the unit as it was before it lost its step', () => {
        const { game, allied, actions, declared } = fought()
        const countered = game.act(ActionType.CounterAttack, allied, { unitIds: ['A-cav'] })
        const accounts = recordedAccounts([...actions, ...declared, ...countered])
        expect(accounts.counter).toEqual([
            { kind: ResultTermKind.CounterAttack, value: -2, faces: [cavalry(3)] }
        ])
    })

    it('are not taken from a declaration made before accounts were kept', () => {
        const { actions, declared } = fought()
        const before = declared.map((action) => ({ ...action, metadata: undefined }))
        expect(recordedAccounts([...actions, ...before])).toEqual({})
    })
})

describe('the lines of an account', () => {
    it('name what each term counted and whose units they were', () => {
        const lines = initialLines([
            { kind: ResultTermKind.AttackLeaders, value: 3, faces: [cavalry(3)] },
            { kind: ResultTermKind.ApproachPenalty, value: -1 },
            { kind: ResultTermKind.DefenseLeaders, value: 0, faces: [] }
        ])
        expect(lines.map((line) => [line.text, line.value, line.side])).toEqual([
            ['Leading the attack', 3, AccountSide.Attack],
            ['The approach penalises cavalry', -1, undefined],
            ['No unit leads the defence', 0, AccountSide.Defence]
        ])
    })

    it('start the final result from the initial one and say so when no counter-attack was made', () => {
        expect(finalLines(2, []).map((line) => [line.text, line.value])).toEqual([
            ['Initial result', 2],
            ['No counter-attack', 0]
        ])
        const countered = finalLines(2, [
            { kind: ResultTermKind.CounterAttack, value: -2, faces: [cavalry(3)] }
        ])
        expect(countered.map((line) => line.value)).toEqual([2, -2])
        expect(countered[1].side).toBe(AccountSide.Defence)
    })
})

describe('the verdict on a final result', () => {
    it('agrees with the game on who wins, whatever decides it', () => {
        for (const finalResult of [-1, 0, 1]) {
            for (const defendersBlocking of [true, false]) {
                for (const [attackingUnits, defendingUnits] of [
                    [1, 2],
                    [2, 2],
                    [3, 2]
                ]) {
                    for (const attackerSide of [Side.French, Side.Allied]) {
                        const fight = {
                            defendersBlocking,
                            attackingUnits,
                            defendingUnits,
                            attackerIsFrench: attackerSide === Side.French
                        }
                        const wins = attackerWins(finalResult, {
                            defendersBlocking,
                            attackingUnits,
                            defendingUnits,
                            attackerSide
                        })
                        expect(attackSucceeds(finalResult, fight)).toBe(wins)
                        expect(verdictOf(finalResult, fight)).toContain(
                            wins ? 'the attack succeeds' : 'the attack is defeated'
                        )
                    }
                }
            }
        }
    })

    it('says what decided a result of nothing either way', () => {
        const level = {
            defendersBlocking: false,
            attackingUnits: 2,
            defendingUnits: 2,
            attackerIsFrench: true
        }
        expect(verdictOf(0, { ...level, defendersBlocking: true })).toContain(
            'because the defence blocks the approach'
        )
        expect(verdictOf(0, { ...level, attackingUnits: 3 })).toContain(
            '3 attacking against 2 defending'
        )
        expect(verdictOf(0, level)).toContain('the French win')
    })
})
