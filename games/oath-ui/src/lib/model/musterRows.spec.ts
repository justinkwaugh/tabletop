import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { musterRows } from './musterRows.js'

const BINDERS = 'denizen.hearth.book-binders'
const SEAT = 'denizen.order.council-seat'
const ASSASSIN = 'denizen.discord.assassin'

function site(player: Record<string, unknown> = {}) {
    return testState(
        [testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1', favor: 3, ...player })],
        {
            denizensBySite: { c1: [BINDERS, SEAT, ASSASSIN] },
            cardTokens: { [SEAT]: { favor: 1, secrets: 0 } }
        }
    )
}

const read = (rows: ReturnType<typeof musterRows>) =>
    rows.map((row) => [row.cardId, row.gain, row.bankShort, row.paysSecret])

describe('the Musters at your site (R-5.2)', () => {
    it('lists each card a favor can go on, in the strip order, with the two warbands it brings', () => {
        expect(read(musterRows(site(), 'p1', []))).toEqual([
            [BINDERS, 2, false, false],
            [ASSASSIN, 2, false, false]
        ])
    })

    it('leaves out a card already carrying favor or secrets', () => {
        expect(musterRows(site(), 'p1', []).map((row) => row.cardId)).not.toContain(SEAT)
    })

    it('counts what the bank can give when it runs short (R-9.3)', () => {
        expect(read(musterRows(site({ warbandsInPersonalBank: { p1: 1 } }), 'p1', []))).toEqual([
            [BINDERS, 1, true, false],
            [ASSASSIN, 1, true, false]
        ])
    })

    it('lists nothing without a favor to place', () => {
        expect(musterRows(site({ favor: 0 }), 'p1', [])).toEqual([])
    })
})
