import { describe, expect, it } from 'vitest'
import { ActionType, Side, commandersOf } from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/map/boardGeometry.js'
import { commandDiscs } from './commandTrack.js'

function underway(): TestGame {
    const game = new TestGame()
    game.deployBoth()
    return game
}

function discsWhenCommanded(...commanderIds: string[]) {
    const game = underway()
    game.arrange((state) => {
        for (const commanderId of commanderIds) {
            state.commander(commanderId).commandsThisTurn = 1
        }
    })
    return commandDiscs(game.hydrated)
}

describe('discs on the command tracks', () => {
    it('are absent until a command is given', () => {
        expect(commandDiscs(underway().hydrated)).toEqual([])
    })

    it("mark the box of a commander that has commanded, on its own army's track", () => {
        const [langeron] = discsWhenCommanded('langeron')
        const [murat] = discsWhenCommanded('murat')
        expect(langeron.x).toBeLessThan(BOARD_WIDTH / 4)
        expect(murat.x).toBeGreaterThan((BOARD_WIDTH * 3) / 4)
        expect(discsWhenCommanded('langeron', 'murat')).toEqual(
            expect.arrayContaining([langeron, murat])
        )
        expect(discsWhenCommanded('langeron', 'murat')).toHaveLength(2)
    })

    it('give every commander a box of its own', () => {
        const commanderIds = [...commandersOf(Side.French), ...commandersOf(Side.Allied)].map(
            (commander) => commander.id
        )
        const discs = discsWhenCommanded(...commanderIds)
        expect(new Set(discs.map((disc) => `${disc.x}:${disc.y}`)).size).toBe(commanderIds.length)
    })

    it('fill one Independent box for each independent command used', () => {
        const game = underway()
        const allied = game.playerOf(Side.Allied)
        game.arrange((state) => {
            state.getPlayerState(allied).independentCommandsUsed = 2
        })
        const discs = commandDiscs(game.hydrated)
        expect(discs).toHaveLength(2)
        expect(new Set(discs.map((disc) => `${disc.x}:${disc.y}`)).size).toBe(2)
        for (const disc of discs) {
            expect(disc.y).toBeGreaterThan(BOARD_HEIGHT * 0.85)
        }
    })

    it('are cleared when the turn ends', () => {
        const game = underway()
        const allied = game.playerOf(Side.Allied)
        game.arrange((state) => {
            state.commander('langeron').commandsThisTurn = 1
            state.getPlayerState(allied).independentCommandsUsed = 1
        })
        expect(commandDiscs(game.hydrated)).toHaveLength(2)
        game.act(ActionType.EndTurn, allied)
        expect(commandDiscs(game.hydrated)).toEqual([])
    })
})
