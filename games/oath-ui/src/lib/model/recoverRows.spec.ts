import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, Suit } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { recoverRows } from './recoverRows.js'

function atAncientCity(player: Record<string, unknown> = {}) {
    const s = testState(
        [testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1', supply: 5, favor: 4, secrets: 1, ...player })],
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
            { slotId: 'slot-1', cost: { kind: 'placeFavorInBank', amount: 3, suit: Suit.Order } }
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
})
