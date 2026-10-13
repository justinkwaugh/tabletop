import { describe, expect, it } from 'vitest'
import { ActionType, CommandKind, FeintEnd, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    alliedTurn,
    cavalry,
    frenchTurn,
    guard,
    infantry,
    defendWith
} from '@tabletop/napoleons-triumph/testing'
import { describeAction } from './describeAction.js'

const NEAR = 94

function underway(): TestGame {
    const game = new TestGame()
    game.deployBoth()
    return game
}

function told(game: TestGame, type: ActionType, side: Side, payload: Record<string, unknown>) {
    const [action] = game.act(type, game.playerOf(side), payload)
    return describeAction(action, game.hydrated)
}

function langeron(game: TestGame): string[] {
    return game.hydrated.corpsUnits('langeron').map((unit) => unit.id)
}

describe('how a move is told', () => {
    it('starts with the corps, not the army', () => {
        const game = underway()
        const order = { kind: CommandKind.Corps, commanderId: 'langeron', unitIds: langeron(game) }
        expect(told(game, ActionType.Move, Side.Allied, { order, to: { locale: NEAR } })).toBe(
            'Langeron’s corps moves from Pratze Berg to locale 94.'
        )
    })

    it('starts with the commander who detaches units', () => {
        const game = underway()
        const order = {
            kind: CommandKind.Detach,
            commanderId: 'langeron',
            unitIds: langeron(game).slice(0, 2)
        }
        expect(told(game, ActionType.Move, Side.Allied, { order, to: { locale: NEAR } })).toBe(
            'Langeron detaches 2 units from Pratze Berg to locale 94.'
        )
    })

    it('says whose unit it is when a unit moves by itself', () => {
        const game = underway()
        const order = { kind: CommandKind.Unit, unitIds: langeron(game).slice(0, 1) }
        expect(told(game, ActionType.Move, Side.Allied, { order, to: { locale: NEAR } })).toBe(
            'An Allied unit moves from Pratze Berg to locale 94.'
        )
    })
})

describe('how other actions are told', () => {
    it('keeps the army as the subject of a plain sentence', () => {
        const game = underway()
        expect(told(game, ActionType.EndTurn, Side.Allied, {})).toBe('The Allies end their turn.')
    })

    it('names a feint by the pieces that made it', () => {
        const game = underway()
        const [unitId] = langeron(game)
        const allied = game.playerOf(Side.Allied)
        game.act(ActionType.Move, allied, {
            order: { kind: CommandKind.Unit, unitIds: [unitId] },
            to: { locale: NEAR }
        })
        game.act(ActionType.EndTurn, allied)
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, {
            approach: game.hydrated.map.approachBetween(93, NEAR).id
        })
        defendWith(game, allied, [unitId])
        const corps = game.hydrated.corpsUnits('st-hilaire').map((unit) => unit.id)
        expect(
            told(game, ActionType.DeclareFeint, Side.French, {
                orders: [{ kind: CommandKind.Corps, commanderId: 'st-hilaire', unitIds: corps }],
                end: FeintEnd.Reserve
            })
        ).toBe('The attack by St. Hilaire’s corps is a feint, ending in reserve.')
    })

    it('tells the press and the naming of the leading units as steps of their own', () => {
        const game = underway()
        const [unitId] = langeron(game)
        const allied = game.playerOf(Side.Allied)
        game.act(ActionType.Move, allied, {
            order: { kind: CommandKind.Unit, unitIds: [unitId] },
            to: { locale: NEAR }
        })
        game.act(ActionType.EndTurn, allied)
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach: game.hydrated.map.approachBetween(93, NEAR).id
        })
        expect(told(game, ActionType.DeclareDefense, Side.Allied, { unitIds: [unitId] })).toBe(
            'The Allies stand with a unit.'
        )
        expect(told(game, ActionType.PressAttack, Side.French, {})).toBe(
            'The French press the attack.'
        )
        expect(told(game, ActionType.LeadDefense, Side.Allied, { leaderIds: [] })).toBe(
            'The Allies name no leading unit.'
        )
    })
})

describe('how morale paid beyond the losses is told', () => {
    const BELOW_THE_SLOPE = 103
    const ON_THE_SLOPE = 93
    const FROM = 95
    const INTO = 108
    const REFUGE = 96

    function guardAttackUpTheSlope(frenchMorale: number) {
        const game = frenchTurn([
            { id: 'F-guard', side: Side.French, face: guard(), locale: BELOW_THE_SLOPE },
            {
                id: 'A-inf',
                side: Side.Allied,
                face: infantry(2),
                locale: ON_THE_SLOPE,
                facing: BELOW_THE_SLOPE
            }
        ])
        game.arrange((state) => {
            state.playerOf(Side.French).morale = frenchMorale
        })
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach: game.hydrated.map.approachBetween(BELOW_THE_SLOPE, ON_THE_SLOPE).id,
            guardUnitId: 'F-guard'
        })
        defendWith(game, game.playerOf(Side.Allied), ['A-inf'])
        game.act(ActionType.LeadDefense, game.playerOf(Side.Allied), { leaderIds: ['A-inf'] })
        return told(game, ActionType.DeclareAttack, Side.French, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-guard'] }],
            wide: false,
            leaderIds: ['F-guard']
        })
    }

    it('says what committing the Guard cost, and what the defeat of its Guard Attack cost after the losses', () => {
        expect(guardAttackUpTheSlope(23)).toBe(
            'The French make a narrow attack with a unit, led by a unit. Initial result 0. ' +
                'The French commit the Guard and lose 4 morale. ' +
                'Final result 0: the attack is thrown back. 2 steps lost. ' +
                'The French lose 1 morale. ' +
                'The Guard Attack is defeated. The French lose 3 more morale and may make no more Guard Attacks.'
        )
    })

    it('gives the morale really lost by an army near its last point', () => {
        const telling = guardAttackUpTheSlope(3)
        expect(telling).toContain('The French commit the Guard and lose 2 morale.')
        expect(telling).toContain('The French are demoralized.')
    })

    it('says what committing the heavy cavalry cost in a retreat', () => {
        const game = alliedTurn([
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: FROM },
            { id: 'F-heavy', side: Side.French, face: cavalry(3), locale: INTO }
        ])
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.Allied), {
            approach: game.hydrated.map.approachBetween(FROM, INTO).id
        })
        expect(
            told(game, ActionType.Retreat, Side.French, {
                losses: {},
                destinations: { 'F-heavy': REFUGE },
                kept: {}
            })
        ).toBe(
            'The French retreat from locale 108 without a fight. ' +
                'The French commit their heavy cavalry and lose 2 morale.'
        )
    })
})
