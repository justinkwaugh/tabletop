import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { OathExileColors, PlayerStatus } from '@tabletop/oath'
import { avatarImage, boardGround, boardImageKeys, titleImage } from './boardImages.js'

describe('player board cut coverage', () => {
    const seats: [PlayerStatus, Color | undefined][] = [
        [PlayerStatus.Chancellor, undefined],
        ...OathExileColors.flatMap((color): [PlayerStatus, Color][] => [
            [PlayerStatus.Exile, color],
            [PlayerStatus.Citizen, color]
        ])
    ]

    it('R-1.7 — all eleven boards resolve a title, an avatar and a ground', () => {
        expect(seats).toHaveLength(11)
        for (const [status, color] of seats) {
            expect(titleImage(status, color), `${status} ${color}`).toBeDefined()
            expect(avatarImage(status, color), `${status} ${color}`).toBeDefined()
            expect(boardGround(status, color), `${status} ${color}`).toMatch(/^#[0-9a-f]{6}$/)
        }
    })

    it('no cut is orphaned — every file names one of the eleven seats', () => {
        const seatKey = (s: PlayerStatus, c: string | undefined) => (s === PlayerStatus.Chancellor ? 'chancellor' : `${s}.${c}`)
        const titleKey = (s: PlayerStatus, c: string | undefined) => (s === PlayerStatus.Citizen ? s : seatKey(s, c))
        const keys = new Set(seats.flatMap(([s, c]) => [`title.${titleKey(s, c)}`, `avatar.${seatKey(s, c)}`]))
        expect(boardImageKeys().filter((k) => !keys.has(k))).toEqual([])
    })

    it('an unknown seat is a broken invariant, not a missing picture', () => {
        expect(() => titleImage(PlayerStatus.Exile, Color.Green)).toThrow()
        expect(() => boardGround(PlayerStatus.Exile, undefined)).toThrow()
    })
})
