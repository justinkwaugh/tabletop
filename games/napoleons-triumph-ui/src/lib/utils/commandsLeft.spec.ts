import { describe, expect, it } from 'vitest'
import { ActionType, CommandKind, Side } from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import { commandsLeft, commandsUsed } from './commandsLeft.js'

function underway(): TestGame {
    const game = new TestGame()
    game.deployBoth()
    return game
}

function commandCorps(game: TestGame, side: Side, commanderId: string) {
    const state = game.hydrated
    const locale = state.commander(commanderId).position?.locale
    if (locale === undefined) {
        throw new Error(`${commanderId} is not on the map`)
    }
    game.act(ActionType.Move, game.playerOf(side), {
        order: {
            kind: CommandKind.Corps,
            commanderId,
            unitIds: state.corpsUnits(commanderId).map((unit) => unit.id)
        },
        to: { locale, approach: state.map.passableApproachesOf(locale)[0].id }
    })
}

describe('what an army may still command', () => {
    it('counts the Allies’ five corps commands down', () => {
        const game = underway()
        const allied = game.playerOf(Side.Allied)
        expect(commandsLeft(game.hydrated, allied)).toBe(
            'Corps commands: 5 left, one per corps · Independent commands: 3 left'
        )
        commandCorps(game, Side.Allied, 'langeron')
        expect(commandsLeft(game.hydrated, allied)).toBe(
            'Corps commands: 4 left, one per corps · Independent commands: 3 left'
        )
        expect(commandsUsed(game.hydrated, allied)).toBe(
            'Commands used this turn: 1 of 5 corps, 0 of 3 independent'
        )
    })

    it('tells the French there is no limit beyond one for each corps', () => {
        const game = underway()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        const french = game.playerOf(Side.French)
        commandCorps(game, Side.French, 'lannes')
        commandCorps(game, Side.French, 'murat')
        expect(commandsLeft(game.hydrated, french)).toBe(
            'Corps commands: no limit, one per corps · Independent commands: 4 left'
        )
        expect(commandsUsed(game.hydrated, french)).toBe(
            'Commands used this turn: 2 corps (no limit), 0 of 4 independent'
        )
    })
})
