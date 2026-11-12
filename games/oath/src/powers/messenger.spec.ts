import { describe, expect, it } from 'vitest'
import { Color, assertExists } from '@tabletop/common'
import { CardKind, PlayerStatus, Suit } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS, type WarbandOwner } from '../model/warbandCounts.js'
import { HydratedOathGameState } from '../model/gameState.js'
import {
    CRADLE,
    HINTERLAND,
    PROVINCES,
    openTurn,
    testPlayer,
    testState
} from '../testing/fixture.js'
import { actionPowerUse, boardWarbands, site, siteWarbands } from '../testing/choices.js'
import { PowerChoiceKind, reasonChoicesInvalid, type PowerChoice } from '../util/powerChoice.js'
import {
    cardPower,
    cardPowers,
    PowerTiming,
    powerIndexOf,
    registerCardPowers
} from '../data/cardPowers.js'
import { registerCards } from '../data/cardRegistry.js'
import { choiceSpecsFor, effectFor, registerEffect } from './registry.js'
import '../powers/index.js'

const MESSENGER = 'denizen.order.messenger'
const SLOTS = [...CRADLE, ...PROVINCES, ...HINTERLAND]
const BOARD = 'board'
type Place = typeof BOARD | string

function messengerPower() {
    const power = cardPowers(MESSENGER)[powerIndexOf(MESSENGER, PowerTiming.Action)]
    assertExists(power, 'Messenger prints an Action power')
    return power
}

/** A player who rules every map slot, Messenger among their advisers. */
function everySlotRuled(
    status: PlayerStatus,
    board: Record<string, number>,
    bySite: Record<string, Record<string, number>>
): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                status,
                siteId: 'c1',
                favor: 3,
                warbandsOnBoard: board,
                advisers: [{ cardId: MESSENGER, faceUp: true }]
            }),
            testPlayer({
                playerId: 'chan',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h3'
            })
        ],
        { warbandsBySite: bySite }
    )
    openTurn(s, 'me')
    return s
}

function placeCount(s: HydratedOathGameState, place: Place, owner: WarbandOwner): number {
    return place === BOARD
        ? (s.getPlayerState('me').warbandsOnBoard[owner] ?? 0)
        : (s.warbandsBySite[place]?.[owner] ?? 0)
}

/**
 * One owner's redistribution as direct moves (a site to a site in one pair): each move empties a
 * surplus or fills a deficit, so a change over k places takes at most k - 1 moves.
 */
function directMoves(
    owner: WarbandOwner,
    from: Record<Place, number>,
    to: Record<Place, number>
): PowerChoice[] {
    const places = [BOARD, ...SLOTS]
    const surplus = places
        .map((p) => ({ p, n: Math.max(0, from[p] - to[p]) }))
        .filter((e) => e.n > 0)
    const deficit = places
        .map((p) => ({ p, n: Math.max(0, to[p] - from[p]) }))
        .filter((e) => e.n > 0)
    const choices: PowerChoice[] = []
    while (surplus.length > 0 && deficit.length > 0) {
        const give = surplus[0]
        const take = deficit[0]
        const n = Math.min(give.n, take.n)
        choices.push(
            give.p === BOARD ? boardWarbands('me', owner, n) : siteWarbands(give.p, owner, n),
            ...(take.p === BOARD ? [] : [site(take.p)])
        )
        give.n -= n
        take.n -= n
        if (give.n === 0) surplus.shift()
        if (take.n === 0) deficit.shift()
    }
    return choices
}

/** A seeded run of numbers, so a failing redistribution can be read again. */
function numbers(seed: number): () => number {
    let x = seed
    return () => {
        x = (x * 1103515245 + 12345) % 2147483648
        return x / 2147483648
    }
}

/** Where an owner's warbands could end: as many as before, the last one kept wherever there was one. */
function redistribution(from: Record<Place, number>, next: () => number): Record<Place, number> {
    const places = [BOARD, ...SLOTS]
    const to: Record<Place, number> = Object.fromEntries(
        places.map((p) => [p, p !== BOARD && from[p] > 0 ? 1 : 0])
    )
    const total = places.reduce((sum, p) => sum + from[p], 0)
    let left = total - places.reduce((sum, p) => sum + to[p], 0)
    while (left > 0) {
        to[places[Math.floor(next() * places.length)]] += 1
        left -= 1
    }
    return to
}

describe('Messenger — "any warbands": up to 16 moves (2 owners x the 8 map slots)', () => {
    it('Messenger makes a fifth move', () => {
        const s = everySlotRuled(
            PlayerStatus.Exile,
            { me: 5 },
            {
                c1: { me: 1 },
                c2: { me: 1 },
                p1: { me: 1 },
                p2: { me: 1 },
                p3: { me: 1 }
            }
        )
        const choices = ['c1', 'c2', 'p1', 'p2', 'p3'].flatMap((siteId) => [
            boardWarbands('me', 'me', 1),
            site(siteId)
        ])
        const action = actionPowerUse('me', MESSENGER, choices)
        action.apply(s)
        expect(action.metadata?.summary).toBe(
            'moved 1 board → c1; 1 board → c2; 1 board → p1; 1 board → p2; 1 board → p3'
        )
        expect(s.getPlayerState('me').warbandsOnBoard['me'] ?? 0).toBe(0)
        for (const siteId of ['c1', 'c2', 'p1', 'p2', 'p3'])
            expect(s.warbandsBySite[siteId]['me']).toBe(2)
    })

    it('Messenger offers 16 moves and no more', () => {
        const specs = choiceSpecsFor(messengerPower())
        expect(specs).toHaveLength(32)
        expect(specs.filter((spec) => spec.kind === PowerChoiceKind.Warbands)).toHaveLength(16)
        expect(specs.every((spec) => spec.sequential)).toBe(true)
    })

    it("Messenger's moves reach any redistribution of two owners across the board and every map slot", () => {
        // A Citizen rules with their own warbands and the Empire's (R-6.6.3). Two owners at one
        // place happen only in games from before revision 5; the cap still covers them.
        const start: Record<WarbandOwner, Record<Place, number>> = {
            me: { board: 3, c1: 2, c2: 3, p1: 0, p2: 2, p3: 3, h1: 0, h2: 2, h3: 3 },
            [IMPERIAL_WARBANDS]: {
                board: 2,
                c1: 2,
                c2: 0,
                p1: 3,
                p2: 2,
                p3: 0,
                h1: 4,
                h2: 2,
                h3: 1
            }
        }
        const owners = ['me', IMPERIAL_WARBANDS]
        const fresh = () =>
            everySlotRuled(
                PlayerStatus.Citizen,
                Object.fromEntries(owners.map((o) => [o, start[o].board])),
                Object.fromEntries(
                    SLOTS.map((p) => [
                        p,
                        Object.fromEntries(
                            owners.flatMap((o) => (start[o][p] > 0 ? [[o, start[o][p]]] : []))
                        )
                    ])
                )
            )

        // Every place changes for both owners: 8 + 8 moves.
        const everyPlace: Record<WarbandOwner, Record<Place, number>> = {
            me: { board: 0, c1: 1, c2: 1, p1: 8, p2: 1, p3: 1, h1: 4, h2: 1, h3: 1 },
            [IMPERIAL_WARBANDS]: {
                board: 0,
                c1: 1,
                c2: 4,
                p1: 1,
                p2: 1,
                p3: 4,
                h1: 1,
                h2: 1,
                h3: 3
            }
        }
        const next = numbers(40)
        const targets = [
            everyPlace,
            ...Array.from({ length: 200 }, () =>
                Object.fromEntries(owners.map((o) => [o, redistribution(start[o], next)]))
            )
        ]
        let longest = 0
        for (const target of targets) {
            const s = fresh()
            const choices = owners.flatMap((o) => directMoves(o, start[o], target[o]))
            const moves = choices.filter((c) => c.kind === PowerChoiceKind.Warbands).length
            longest = Math.max(longest, moves)
            expect(moves).toBeLessThanOrEqual(16)
            actionPowerUse('me', MESSENGER, choices).apply(s)
            for (const o of owners) {
                for (const p of [BOARD, ...SLOTS]) {
                    expect(placeCount(s, p, o), `${o} at ${p}`).toBe(target[o][p])
                }
            }
        }
        expect(longest).toBe(16)
    })
})

/**
 * Messenger as it was registered before the cap: the same effect with its first four pairs. A
 * test card, so the two checks can be put to the same lists.
 */
const FOUR_PAIRS = 'denizen.test.messenger-four-pairs'
registerCards([{ id: FOUR_PAIRS, name: 'Four Pairs', kind: CardKind.Denizen, suit: Suit.Order }])
registerCardPowers(FOUR_PAIRS, [{ ...messengerPower(), cardId: FOUR_PAIRS, powerIndex: 0 }])
const messengerEffect = effectFor(messengerPower())
assertExists(messengerEffect, 'Messenger has an effect')
registerEffect(FOUR_PAIRS, 0, {
    ...messengerEffect,
    choices: choiceSpecsFor(messengerPower()).slice(0, 8)
})

describe('Messenger — the cap only widens what is accepted', () => {
    function table(): HydratedOathGameState {
        const s = everySlotRuled(
            PlayerStatus.Exile,
            { me: 1 },
            { c1: { me: 2 }, c2: { me: 2, chan: 3 } }
        )
        s.getPlayerState('me').advisers.push({ cardId: FOUR_PAIRS, faceUp: true })
        return s
    }

    function verdict(
        s: HydratedOathGameState,
        cardId: string,
        choices: PowerChoice[]
    ): string | undefined {
        const power = cardPower(cardId, cardId === MESSENGER ? messengerPower().powerIndex : 0)
        assertExists(power, `${cardId} has a power`)
        return (
            reasonChoicesInvalid(s, 'me', power, choices) ??
            messengerEffect?.reasonCannotResolve?.({ state: s, playerId: 'me', power, choices })
        )
    }

    function where(s: HydratedOathGameState) {
        return {
            board: s.getPlayerState('me').warbandsOnBoard,
            sites: s.warbandsBySite,
            favor: s.getPlayerState('me').favor
        }
    }

    it('Messenger replays every list of up to four pairs the old check accepted, to the same state and summary', () => {
        // Two from the board and from c2 are more than either holds free until an earlier move adds them.
        const ws = [
            boardWarbands('me', 'me', 2),
            siteWarbands('c1', 'me', 1),
            siteWarbands('c2', 'me', 2)
        ]
        const ss = [site('c1'), site('c2')]
        const base = table()
        let accepted = 0
        const visit = (choices: PowerChoice[]) => {
            const old = verdict(base, FOUR_PAIRS, choices)
            if (old === undefined) {
                accepted += 1
                expect(verdict(base, MESSENGER, choices), JSON.stringify(choices)).toBeUndefined()
                const before = new HydratedOathGameState(base.dehydrate())
                const after = new HydratedOathGameState(base.dehydrate())
                const four = actionPowerUse('me', FOUR_PAIRS, choices)
                const sixteen = actionPowerUse('me', MESSENGER, choices)
                four.apply(before)
                sixteen.apply(after)
                expect(sixteen.metadata?.summary).toBe(four.metadata?.summary)
                expect(where(after)).toEqual(where(before))
            }
            if (choices.length === 8) return
            const last = choices.at(-1)
            // A refused list ending in a site stays refused; one ending in warbands may want its site.
            if (old !== undefined && choices.length > 0 && last?.kind !== PowerChoiceKind.Warbands)
                return
            for (const next of old === undefined || choices.length === 0 ? [...ws, ...ss] : ss) {
                visit([...choices, next])
            }
        }
        visit([])
        expect(accepted).toBe(316)
    }, 30_000)
})
