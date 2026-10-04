import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { CardKind, HydratedLetPeek, LetPeek, LetPeekSubjectKind, PlayerStatus } from '@tabletop/oath'
import { buildAction, testPlayer, testState } from '@tabletop/oath/testing'
import { seatAdvisers } from './seatAdvisers.js'
import { describeAction } from './actionDescription.js'
import { slotLabel } from './names.js'

/** R-2.2.2, R-9.4 — a seat names a facedown adviser to its holder alone. */
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'
const TUTOR = 'denizen.arcane.tutor'
const seat = {
    playerId: 'p1',
    advisers: [{ cardId: WOLVES, faceUp: true }, { faceUp: false }],
    adviserIds: [WOLVES, TENTS]
}

describe('seat advisers', () => {
    it('names a faceup adviser to everyone', () => {
        expect(seatAdvisers(seat, 'p2')[0]).toEqual({ key: WOLVES, cardId: WOLVES, faceUp: true, back: CardKind.Denizen, shownToMe: false })
    })

    it('names a facedown adviser to its holder from the holder’s own list', () => {
        expect(seatAdvisers(seat, 'p1')[1]).toEqual({ key: TENTS, cardId: TENTS, faceUp: false, back: CardKind.Denizen, shownToMe: false })
    })

    it('draws a back for anyone else, even on a client that holds the whole state', () => {
        expect(seatAdvisers(seat, 'p2')[1]).toEqual({ key: 'facedown-1', cardId: undefined, faceUp: false, back: CardKind.Denizen, shownToMe: false })
    })

    it('draws a facedown Vision with the Vision back, as its row says (R-9.4)', () => {
        const visionSeat = { playerId: 'p1', advisers: [{ faceUp: false, vision: true as const }], adviserIds: ['vision.conquest'] }
        expect(seatAdvisers(visionSeat, 'p2')[0]).toEqual({ key: 'facedown-0', cardId: undefined, faceUp: false, back: CardKind.Vision, shownToMe: false })
        expect(seatAdvisers(visionSeat, 'p1')[0]).toMatchObject({ cardId: 'vision.conquest', back: CardKind.Vision })
    })

    it('draws a back for a projection that omits the list', () => {
        expect(seatAdvisers({ playerId: 'p1', advisers: seat.advisers }, 'p1')[1].cardId).toBeUndefined()
    })
})

/** R-9.4 — built from full canonical state, as Host View and hotseat hold it. */
describe('a let-peek on a client holding the whole state', () => {
    const nameOf = { player: (playerId: string) => playerId, site: slotLabel, seats: ['p1', 'p2', 'p3'] }

    function shown() {
        const state = testState([
            testPlayer({ playerId: 'p1', color: Color.Red, status: PlayerStatus.Chancellor, siteId: 'c1', advisers: [{ cardId: TUTOR, faceUp: false }] }),
            testPlayer({ playerId: 'p2', color: Color.Blue, siteId: 'c1' }),
            testPlayer({ playerId: 'p3', color: Color.Yellow, siteId: 'c1' })
        ])
        const peek = new HydratedLetPeek(buildAction(LetPeek, { playerId: 'p1', toPlayerId: 'p2', subject: { kind: LetPeekSubjectKind.Adviser, cardId: TUTOR } }))
        peek.apply(state)
        const holder = state.getPlayerState('p1').dehydrate()
        expect(holder.advisers[0]).toMatchObject({ shownTo: ['p2'], shownCardId: TUTOR })
        return { holder, peek }
    }

    it('a third seat, and a viewer with no seat, see a back', () => {
        const { holder } = shown()
        expect(seatAdvisers(holder, 'p3')[0]).toEqual({ key: 'facedown-0', cardId: undefined, faceUp: false, back: CardKind.Denizen, shownToMe: false })
        expect(seatAdvisers(holder, undefined)[0].cardId).toBeUndefined()
    })

    it('the holder and the recipient see the card', () => {
        const { holder } = shown()
        expect(seatAdvisers(holder, 'p1')[0]).toMatchObject({ cardId: TUTOR, shownToMe: false })
        expect(seatAdvisers(holder, 'p2')[0]).toMatchObject({ cardId: TUTOR, shownToMe: true })
    })

    it('the history line names the card to the holder and the recipient alone', () => {
        const { peek } = shown()
        expect(describeAction(peek, nameOf, 'p1')).toBe('let p2 peek at Tutor')
        expect(describeAction(peek, nameOf, 'p2')).toBe('let p2 peek at Tutor')
        expect(describeAction(peek, nameOf, 'p3')).toBe('let p2 peek at a facedown adviser')
        expect(describeAction(peek, nameOf, undefined)).toBe('let p2 peek at a facedown adviser')
    })
})
