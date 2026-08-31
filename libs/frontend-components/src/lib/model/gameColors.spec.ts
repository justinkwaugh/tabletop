import { DefaultColorizer } from '$lib/definition/gameColorizer.js'
import { Color, PlayerStatus, Role, UserStatus, type GameState, type User } from '@tabletop/common'
import { writable } from 'svelte/store'
import { describe, expect, test } from 'vitest'
import { GameColors } from './gameColors.svelte.js'

const user: User = {
    id: 'harness-user',
    username: 'Developer',
    roles: [Role.User, Role.Admin],
    status: UserStatus.Active,
    externalIds: [],
    preferences: {
        preventWebNotificationPrompt: false,
        preferredColorsEnabled: true,
        preferredColors: [Color.Blue, Color.Red],
        colorBlindPalette: false
    }
}

function createColors(hotseat: boolean) {
    const actAsAdmin = writable(false)
    const colors = new GameColors<GameState>(
        {
            user: writable(user),
            actAsAdmin
        },
        {
            runtime: {
                colorizer: new DefaultColorizer(),
                playerColors: [Color.Red, Color.Blue]
            },
            game: {
                hotseat,
                players: [
                    {
                        id: 'one',
                        isHuman: true,
                        userId: user.id,
                        name: 'One',
                        status: PlayerStatus.Joined
                    },
                    {
                        id: 'two',
                        isHuman: true,
                        name: 'Two',
                        status: PlayerStatus.Joined
                    }
                ]
            },
            state: {
                players: [
                    { playerId: 'one', color: Color.Red },
                    { playerId: 'two', color: Color.Blue }
                ]
            }
        }
    )
    return { colors, actAsAdmin }
}

describe('GameColors preference preview', () => {
    test('preserves production hotseat preference suppression', () => {
        const { colors } = createColors(true)

        expect(colors.getPlayerColor('one')).toBe(Color.Red)
        expect(colors.getPlayerColor('two')).toBe(Color.Blue)
    })

    test('preserves production hosted-game preferences', () => {
        const { colors } = createColors(false)

        expect(colors.getPlayerColor('one')).toBe(Color.Blue)
        expect(colors.getPlayerColor('two')).toBe(Color.Red)
    })

    test('previews a different preferred color and resolves its conflict', () => {
        const { colors } = createColors(true)

        colors.setPreferencePreview({
            preferredColorsEnabled: true,
            colorBlindPalette: false
        })

        expect(colors.getPlayerColor('one')).toBe(Color.Blue)
        expect(colors.getPlayerColor('two')).toBe(Color.Red)
    })

    test('previews the colorblind palette', () => {
        const { colors } = createColors(true)

        colors.setPreferencePreview({
            preferredColorsEnabled: false,
            colorBlindPalette: true
        })

        expect(colors.colorBlind).toBe(true)
        expect(colors.getBgColorValue(Color.Red)).toBe('#D55E00')
    })

    test('retains Admin color suppression during a preference preview', () => {
        const { colors, actAsAdmin } = createColors(true)

        actAsAdmin.set(true)
        colors.setPreferencePreview({
            preferredColorsEnabled: true,
            colorBlindPalette: true
        })

        expect(colors.getPlayerColor('one')).toBe(Color.Red)
        expect(colors.getBgColorValue(Color.Red)).toBe('#b91c1c')
    })
})
