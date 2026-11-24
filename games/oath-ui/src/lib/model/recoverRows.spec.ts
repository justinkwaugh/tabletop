import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, PowerTiming, Suit, powerIndexOf } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { recoverRows } from './recoverRows.js'

function atAncientCity(player: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({
                playerId: 'p1',
                color: Color.Red,
                siteId: 'c1',
                supply: 5,
                favor: 4,
                secrets: 1,
                ...player
            })
        ],
        {
            siteCards: { c1: 'site.ancient-city' },
            relicsBySite: { c1: [{ slotId: 'slot-1' }] }
        }
    )
    openTurn(s, 'p1')
    return s
}

describe('the relics and banners a Recover can take (R-5.4)', () => {
    it('lists the relic at the site with the price the site prints', () => {
        expect(recoverRows(atAncientCity(), 'p1', []).relics).toEqual([
            {
                slotId: 'slot-1',
                cost: { kind: 'placeFavorInBank', amount: 3, suit: Suit.Order },
                modifiers: []
            }
        ])
    })

    it('leaves out a relic the player cannot pay for', () => {
        expect(recoverRows(atAncientCity({ favor: 2 }), 'p1', []).relics).toEqual([])
    })

    it('offers a banner at every amount above its value up to what the player holds', () => {
        const s = atAncientCity()
        const value = s.banners[Banner.PeoplesFavor].value
        const bid = recoverRows(s, 'p1', []).banners.find((b) => b.banner === Banner.PeoplesFavor)
        expect(bid?.amounts[0]).toBe(value + 1)
        expect(bid?.amounts.at(-1)).toBe(4)
    })

    it("offers the Darkest Secret with Magician's Code in use, though the player holds no secrets", () => {
        const code = 'denizen.arcane.magicians-code'
        const s = atAncientCity({ secrets: 0, advisers: [{ cardId: code, faceUp: true }] })
        s.banners[Banner.DarkestSecret].value = 1
        const inUse = [{ cardId: code, powerIndex: powerIndexOf(code, PowerTiming.Modifier) }]
        const bid = recoverRows(s, 'p1', inUse).banners.find(
            (b) => b.banner === Banner.DarkestSecret
        )
        // R-7.4 — the Code's two secrets beat a value of 1 "even" with none paid.
        expect(bid).toEqual({ banner: Banner.DarkestSecret, amounts: [0], modifiers: inUse })
    })

    it("bids from none up to the secrets held with Magician's Code in use", () => {
        const code = 'denizen.arcane.magicians-code'
        const s = atAncientCity({ secrets: 2, advisers: [{ cardId: code, faceUp: true }] })
        s.banners[Banner.DarkestSecret].value = 1
        const inUse = [{ cardId: code, powerIndex: powerIndexOf(code, PowerTiming.Modifier) }]
        const ofDarkest = (declared: typeof inUse) =>
            recoverRows(s, 'p1', declared).banners.find((b) => b.banner === Banner.DarkestSecret)
        expect(ofDarkest(inUse)?.amounts).toEqual([0, 1, 2])
        // Without the Code the least bid is still one over the value.
        expect(ofDarkest([])?.amounts).toEqual([2])
    })
})
