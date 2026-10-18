import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    CURRENT_OATH_REVISION,
    HydratedOathGameState,
    HydratedPlayFacedownAdviser,
    HydratedSearchResolve,
    MachineState,
    PlayFacedownAdviser,
    PlayerStatus,
    PowerTiming,
    SearchPlay,
    SearchResolve,
    Suit,
    powerIndexOf
} from '@tabletop/oath'
import { buildAction, openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { describeAction } from './actionDescription.js'
import { slotLabel } from './names.js'

// R-5.1.4.I, R-11.2, R-9.3 — a site play whose favor is missing or short says why in the History; a full gain keeps
// its words.

const WOLVES = 'denizen.beast.wolves'
const INN = 'denizen.hearth.wayside-inn'
const FILLER = 'denizen.order.wrestlers'
const LAND_WARDEN = 'denizen.hearth.land-warden'

const names = { player: (playerId: string) => ({ rhys: 'Rhys', dana: 'Dana' })[playerId] ?? playerId, site: slotLabel, seats: ['rhys', 'dana'] }

/** Rhys, an Exile, searching at c1 (the River unless a site is named); Dana the Chancellor. */
function table(banks: Partial<Record<Suit, number>>, site = 'site.river', rhys: Partial<Parameters<typeof testPlayer>[0]> = {}, over: Record<string, unknown> = {}) {
    const state = testState(
        [
            testPlayer({ playerId: 'rhys', color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', favor: 2, ...rhys }),
            testPlayer({ playerId: 'dana', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c2' })
        ],
        {
            machineState: MachineState.Searching,
            oathRevision: CURRENT_OATH_REVISION,
            chancellorPlayerId: 'dana',
            siteCards: { c1: site, c2: 'site.plains', p1: 'site.mountain', h1: 'site.wastes' },
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            ...over
        }
    )
    for (const suit of Object.values(Suit)) state.favorBank[suit] = banks[suit] ?? 0
    openTurn(state, 'rhys')
    return state
}

/** The History row of the Search's play, as the table reads it. */
function searchRow(state: HydratedOathGameState, cardId: string, extra: Partial<SearchResolve> = {}, hand: string[] = [cardId, FILLER]) {
    state.getPlayerState('rhys').handIds = hand
    const played = new HydratedSearchResolve(
        buildAction(SearchResolve, { playerId: 'rhys', keptCardId: cardId, discardOrder: [FILLER], play: SearchPlay.Site, ...extra })
    )
    played.apply(state)
    return describeAction(played.dehydrate(), names)
}

describe('the History of a site play names a missing or short favor (R-9.3)', () => {
    it('an empty bank: "gaining no favor: the Beast bank was empty"', () => {
        expect(searchRow(table({ [Suit.Hearth]: 3 }), WOLVES)).toBe(
            'kept Wolves and played it to their site, gaining no favor: the Beast bank was empty; 1 card went to the provinces discard pile'
        )
    })

    it('short: at Fertile Valley with 1 Hearth favor, "gaining 1 favor: the Hearth bank ran out"', () => {
        expect(searchRow(table({ [Suit.Hearth]: 1 }, 'site.fertile-valley'), INN)).toBe(
            'kept Wayside Inn and played it to their site, gaining 1 favor: the Hearth bank ran out; gained 0 hearth favor (Fertile Valley, Homeland); 1 card went to the provinces discard pile'
        )
    })

    it("a full gain keeps today's words", () => {
        expect(searchRow(table({ [Suit.Beast]: 2 }), WOLVES)).toBe('kept Wolves and played it to their site, gaining 1 favor; 1 card went to the provinces discard pile')
        expect(searchRow(table({ [Suit.Hearth]: 3 }, 'site.fertile-valley'), INN)).toBe(
            'kept Wayside Inn and played it to their site, gaining 1 favor; gained 1 hearth favor (Fertile Valley, Homeland); 1 card went to the provinces discard pile'
        )
    })

    it("a row recorded without the banks that came up short keeps its words (an earlier game's)", () => {
        const state = table({ [Suit.Hearth]: 3 })
        state.getPlayerState('rhys').handIds = [WOLVES, FILLER]
        const played = new HydratedSearchResolve(
            buildAction(SearchResolve, { playerId: 'rhys', keptCardId: WOLVES, discardOrder: [FILLER], play: SearchPlay.Site })
        )
        played.apply(state)
        expect(played.metadata?.favorShort).toBeDefined()
        const metadata = played.metadata ? { ...played.metadata, favorShort: undefined } : undefined
        const record = buildAction(SearchResolve, { playerId: 'rhys', keptCardId: WOLVES, discardOrder: [FILLER], play: SearchPlay.Site, metadata })
        expect(describeAction(record, names)).toBe('kept Wolves and played it to their site; 1 card went to the provinces discard pile')
    })

    it("Land Warden: the second card's empty bank beside the kept card's favor", () => {
        const pending = { pendingSearchModifiers: [{ cardId: LAND_WARDEN, powerIndex: powerIndexOf(LAND_WARDEN, PowerTiming.Modifier) }] }
        const state = table({ [Suit.Hearth]: 3 }, 'site.river', { advisers: [{ cardId: LAND_WARDEN, faceUp: true }] }, pending)
        expect(searchRow(state, INN, { secondPlay: { cardId: WOLVES, play: SearchPlay.Site } }, [INN, WOLVES, FILLER])).toMatch(
            /^kept Wayside Inn and played it to their site, gaining 1 favor: the Beast bank was empty; /
        )
    })

    it('a facedown adviser played faceup to the site with its bank empty (R-6.1)', () => {
        const state = table({}, 'site.river', { advisers: [{ cardId: WOLVES, faceUp: false }] }, { machineState: MachineState.ActPhase })
        const played = new HydratedPlayFacedownAdviser(buildAction(PlayFacedownAdviser, { playerId: 'rhys', cardId: WOLVES, play: SearchPlay.Site }))
        played.apply(state)
        expect(describeAction(played.dehydrate(), names)).toBe('played Wolves to their site, gaining no favor: the Beast bank was empty')
    })
})
