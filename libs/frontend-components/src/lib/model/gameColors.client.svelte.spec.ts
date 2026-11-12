import { DefaultColorizer } from '$lib/definition/gameColorizer.js'
import { Color, type GameState } from '@tabletop/common'
import { writable } from 'svelte/store'
import { describe, expect, test } from 'vitest'
import { GameColors } from './gameColors.svelte.js'

describe('GameColors when a title gives out colours during the game', () => {
    test('follows the players to their new colours', () => {
        // As the game context holds it: replaced whole, never changed in place.
        let state = $state.raw({
            players: [
                { playerId: 'one', color: Color.Red },
                { playerId: 'two', color: Color.Blue }
            ]
        })
        const colors = new GameColors<GameState>(
            { user: writable(undefined), actAsAdmin: writable(false) },
            {
                runtime: {
                    colorizer: new DefaultColorizer(),
                    playerColors: [Color.Red, Color.Blue]
                },
                game: { hotseat: true, players: [] },
                get state() {
                    return state
                }
            }
        )
        expect(colors.getPlayerColor('one')).toBe(Color.Red)

        state = {
            players: [
                { playerId: 'one', color: Color.Blue },
                { playerId: 'two', color: Color.Red }
            ]
        }

        expect(colors.getPlayerColor('one')).toBe(Color.Blue)
        expect(colors.getPlayerColor('two')).toBe(Color.Red)
    })
})
