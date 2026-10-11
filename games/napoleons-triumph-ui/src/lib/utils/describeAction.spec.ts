import { describe, expect, it } from 'vitest'
import { ActionType, CommandKind, FeintEnd, Side } from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
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
        game.act(ActionType.DeclareDefense, allied, { unitIds: [unitId], leaderIds: [] })
        const corps = game.hydrated.corpsUnits('st-hilaire').map((unit) => unit.id)
        expect(
            told(game, ActionType.DeclareFeint, Side.French, {
                orders: [{ kind: CommandKind.Corps, commanderId: 'st-hilaire', unitIds: corps }],
                end: FeintEnd.Reserve
            })
        ).toBe('The attack by St. Hilaire’s corps is a feint, ending in reserve.')
    })
})
