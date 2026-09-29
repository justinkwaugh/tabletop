import { describe, expect, it } from 'vitest'
import { seatAdvisers } from './seatAdvisers.js'

/** R-2.2.2, R-9.4 — a seat names a facedown adviser to its holder alone. */
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'
const seat = {
    advisers: [{ cardId: WOLVES, faceUp: true }, { faceUp: false }],
    adviserIds: [WOLVES, TENTS]
}

describe('seat advisers', () => {
    it('names a faceup adviser to everyone', () => {
        expect(seatAdvisers(seat, false)[0]).toEqual({ key: WOLVES, cardId: WOLVES, faceUp: true, shownToMe: false })
    })

    it('names a facedown adviser to its holder from the holder’s own list', () => {
        expect(seatAdvisers(seat, true)[1]).toEqual({ key: TENTS, cardId: TENTS, faceUp: false, shownToMe: false })
    })

    it('draws a back for anyone else, even on a client that holds the whole state', () => {
        expect(seatAdvisers(seat, false)[1]).toEqual({ key: 'facedown-1', cardId: undefined, faceUp: false, shownToMe: false })
    })

    it('draws a back for a projection that omits the list', () => {
        expect(seatAdvisers({ advisers: seat.advisers }, true)[1].cardId).toBeUndefined()
    })

    it('names a facedown adviser to a player its holder let peek, and to nobody else', () => {
        const shown = { faceUp: false, shownTo: ['p2'], shownCardId: 'denizen.arcane.tutor' }
        const viewer = seatAdvisers({ advisers: [shown] }, false)
        expect(viewer[0]).toMatchObject({ cardId: 'denizen.arcane.tutor', faceUp: false, shownToMe: true })
        const third = seatAdvisers({ advisers: [{ faceUp: false, shownTo: ['p2'] }] }, false)
        expect(third[0].cardId).toBeUndefined()
        expect(third[0].shownToMe).toBe(false)
    })
})
