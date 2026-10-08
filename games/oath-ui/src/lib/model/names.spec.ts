import { describe, expect, it } from 'vitest'
import { humanizeReason, nameSeats, reasonParts, type Seats } from './names.js'

const ALICE = 'p1'
const BOB = 'Qx7_pL2mWb9-Rk4tYc1nZ'
const seats: Seats = {
    seats: [ALICE, BOB],
    player: (id) => ({ [ALICE]: 'Alice', [BOB]: 'Bob' })[id] ?? id
}

describe('a refusal as its reader sees it', () => {
    it("names another seat, and the reader's own id reads “you”", () => {
        expect(humanizeReason(`${BOB} has 0 favor, not the 2 you would take`, seats, ALICE)).toBe(
            'Bob has 0 favor, not the 2 you would take'
        )
        expect(humanizeReason(`${ALICE} has 0 favor, not the 2 you would take`, seats, BOB)).toBe(
            'Alice has 0 favor, not the 2 you would take'
        )
    })

    it('a possessive reads “your” for the reader and the name for anyone else', () => {
        const reason = `Circlet of Command: ${BOB}'s other relics cannot be targeted or taken`
        expect(humanizeReason(reason, seats, ALICE)).toBe(
            "Circlet of Command: Bob's other relics cannot be targeted or taken"
        )
        expect(humanizeReason(reason, seats, BOB)).toBe(
            'Circlet of Command: your other relics cannot be targeted or taken'
        )
    })

    it('“is” and “has” agree with “you”', () => {
        const reason = `${ALICE} is the Chancellor, not an Exile`
        expect(humanizeReason(reason, seats, ALICE)).toBe('you are the Chancellor, not an Exile')
        expect(humanizeReason(reason, seats, BOB)).toBe('Alice is the Chancellor, not an Exile')
        expect(humanizeReason(`${ALICE} has no favor to burn`, seats, ALICE)).toBe('you have no favor to burn')
        expect(humanizeReason(`${ALICE} has no favor to burn`, seats, BOB)).toBe('Alice has no favor to burn')
    })

    it('a spectator reads every seat by name', () => {
        expect(humanizeReason(`${ALICE} gave ${BOB}'s relic to ${BOB}`, seats, undefined)).toBe(
            "Alice gave Bob's relic to Bob"
        )
    })

    it('an id that begins another id is replaced only where it stands whole', () => {
        const prefixed: Seats = {
            seats: ['ab', 'ab-c', '-x_'],
            player: (id) => ({ ab: 'Ann', 'ab-c': 'Cal', '-x_': 'Xia' })[id] ?? id
        }
        expect(humanizeReason("ab-c has 0 favor; ab's relics; -x_ is here", prefixed, undefined)).toBe(
            "Cal has 0 favor; Ann's relics; Xia is here"
        )
    })

    it('a name with “$” in it is inserted as written', () => {
        const dollar: Seats = { seats: [BOB], player: () => "$&$1 $' Bob" }
        expect(humanizeReason(`${BOB} has 0 favor`, dollar, ALICE)).toBe("$&$1 $' Bob has 0 favor")
        expect(nameSeats(`${BOB}'s board`, dollar, ALICE)).toBe("$&$1 $' Bob's board")
    })

    it('strips the rule citations and names cards as before', () => {
        expect(
            humanizeReason(`${BOB} holds relic.cup-of-plenty (R-5.5.2)`, seats, ALICE)
        ).toBe('Bob holds Cup of Plenty')
    })
})

describe('a refusal with each other seat as its chip', () => {
    const text = (value: string) => ({ kind: 'text', text: value })
    const chip = (playerId: string, possessive = false) => ({ kind: 'seat', playerId, possessive })

    it('reads as `humanizeReason` does, with another seat apart, and the reader still “you”', () => {
        expect(reasonParts(`${BOB} has 0 favor, not the 2 ${ALICE} would take (R-5.5.2)`, seats.seats, ALICE)).toEqual([
            chip(BOB),
            text(' has 0 favor, not the 2 you would take')
        ])
        expect(reasonParts(`${ALICE} is the Chancellor; ${BOB}'s relics stay`, seats.seats, ALICE)).toEqual([
            text('you are the Chancellor; '),
            chip(BOB, true),
            text(' relics stay')
        ])
    })

    it('a spectator reads every seat as its chip; a reason with no seat is one run of text', () => {
        expect(reasonParts(`${ALICE} gave relic.cup-of-plenty to ${BOB}`, seats.seats, undefined)).toEqual([
            chip(ALICE),
            text(' gave Cup of Plenty to '),
            chip(BOB)
        ])
        expect(reasonParts('the world deck is empty', seats.seats, ALICE)).toEqual([text('the world deck is empty')])
    })
})

describe('a summary as its reader sees it', () => {
    it("the actor's own things are “their own” when no other seat is named", () => {
        expect(nameSeats(`killed 2 warbands on ${ALICE}'s board`, seats, BOB, ALICE)).toBe(
            'killed 2 warbands on their own board'
        )
        expect(nameSeats(`killed 2 warbands on ${ALICE}'s board`, seats, ALICE, ALICE)).toBe(
            'killed 2 warbands on your own board'
        )
    })

    it('every other seat is named, and the viewer is “you”', () => {
        expect(nameSeats(`took 2 favor from ${BOB}`, seats, BOB, ALICE)).toBe('took 2 favor from you')
        expect(nameSeats(`took 2 favor from ${BOB}`, seats, undefined, ALICE)).toBe(
            'took 2 favor from Bob'
        )
        expect(nameSeats(`moved ${ALICE}'s and ${BOB}'s pawns`, seats, undefined, ALICE)).toBe(
            "moved Alice's and Bob's pawns"
        )
    })
})
