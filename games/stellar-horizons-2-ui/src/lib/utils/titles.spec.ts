import { describe, expect, it } from 'vitest'
import { TitleId, TitleRequestKind } from '@tabletop/stellar-horizons-2'
import { titleChangeText } from './titles.js'

describe('title history', () => {
    const change = {
        playerId: 'p0',
        kind: TitleRequestKind.Buy,
        titleId: TitleId.Warlord,
        influence: 18,
        failed: false,
        renounced: []
    }

    it('names the title, its cost, what it renounced and its replacement', () => {
        expect(titleChangeText(change)).toBe('buys Warlord for 18 IP')
        expect(
            titleChangeText({ ...change, renounced: [TitleId.Chancellor, TitleId.Navigator] })
        ).toBe('buys Warlord for 18 IP, renouncing Chancellor and Navigator')
        expect(
            titleChangeText({
                ...change,
                titleId: TitleId.Guildmaster,
                influence: 9,
                replacement: TitleId.Engineer
            })
        ).toBe('buys Guildmaster for 9 IP; Engineer is laid out in its place')
    })

    it('says when an earlier Player took it, and when one is renounced', () => {
        expect(titleChangeText({ ...change, titleId: TitleId.Chancellor, failed: true })).toBe(
            'cannot have Chancellor, taken by a Player earlier in initiative order, and has the 18 IP back'
        )
        expect(
            titleChangeText({
                playerId: 'p0',
                kind: TitleRequestKind.Renounce,
                titleId: TitleId.Warlord
            })
        ).toBe('renounces Warlord')
    })
})
