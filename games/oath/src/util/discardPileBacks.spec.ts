import { beforeAll, describe, expect, it } from 'vitest'
import { Color, getPrng, type Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { CardKind, PlayerStatus, Region } from '../model/oathEnums.js'
import { kindOf } from '../data/cardRegistry.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { testPlayer, testState, testVaultWithDiscards } from '../testing/fixture.js'
import { served, spectator } from '../testing/projection.js'
import { expectPilePlacesMatchTheVault } from '../testing/census.js'
import {
    chancellorSearches,
    continueGameOne,
    keepPlainly,
    nextTurn,
    playGameOne,
    setUp
} from '../testing/rehearsal.js'
import { playStep, playUntil, type LocalGameStore, type LocalPlay } from '../testing/localGames.js'
import { buildAction } from '../testing/actions.js'
import { MachineState } from '../definition/states.js'
import { Search, SearchSource } from '../actions/search.js'
import { CURRENT_OATH_REVISION, OathRevision } from './revision.js'
import {
    EVERYONE,
    drawDiscardPile,
    mergeDiscardPileOnto,
    putOnDiscardPile,
    swapDiscardPileWithDispossessed,
    type Deposit
} from './knowledge.js'
import { applySetupDeal, buildSetupVault, resolveSetupDeal } from './setup.js'

// R-9.4 makes the fronts in a discard pile private, and "all other information" public: every back
// in a pile, and so how far down each Vision lies, never which Vision it is.

const HERALD = 'denizen.hearth.herald'
const INN = 'denizen.hearth.wayside-inn'
const TENTS = 'denizen.nomad.tents'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const ELDERS = 'denizen.nomad.elders'
const STEED = 'denizen.nomad.a-fast-steed'
const ASSASSIN = 'denizen.discord.assassin'
const BINDERS = 'denizen.hearth.book-binders'
const FAITH = 'vision.faith'
const CONQUEST = 'vision.conquest'
const REBELLION = 'vision.rebellion'

/** Seen by the whole table: a card leaving play faceup. */
const SEEN: Deposit = { witnessOf: () => [EVERYONE] }
/** Seen by its player alone: a hand card, whose back the table sees. */
const UNSEEN: Deposit = { witnessOf: () => ['dana'] }

/** The table's record of a pile it saw built: every back, bottom first. */
function everyBack(topFirst: readonly string[]) {
    return topFirst.toReversed().map((cardId) => ({ back: kindOf(cardId) ?? CardKind.Denizen }))
}

/**
 * Dana (an Exile) and Rhys (the Chancellor). The Cradle's pile holds Faith second from the top, the
 * Provinces' Conquest third, the Hinterland's nothing; the table saw every back go down.
 */
function table(): HydratedOathGameState {
    const piles = {
        [Region.Cradle]: [HERALD, FAITH, INN],
        [Region.Provinces]: [TENTS, WOLVES, CONQUEST, RANGERS, ELDERS],
        [Region.Hinterland]: []
    }
    const vault = testVaultWithDiscards(piles)
    vault.dispossessed = [STEED, ASSASSIN]
    return testState(
        [
            testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c1' }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 14 }
            })
        ],
        {
            discardPileCounts: {
                [Region.Cradle]: 3,
                [Region.Provinces]: 5,
                [Region.Hinterland]: 0
            },
            seenDiscardPiles: {
                [Region.Cradle]: everyBack(piles[Region.Cradle]),
                [Region.Provinces]: everyBack(piles[Region.Provinces]),
                [Region.Hinterland]: []
            },
            dispossessedCount: 2,
            protectedPrng: { seed: 1, invocations: 0 },
            vault
        }
    )
}

type PileCase = {
    name: string
    move: (state: HydratedOathGameState) => void
    places: Record<Region, number[]>
}

/**
 * The host's hidden step moves the vault and the table's record; the action's public step writes
 * the counts, which here follow the vault as that step leaves them.
 */
function moved(move: (state: HydratedOathGameState) => void): HydratedOathGameState {
    const state = table()
    move(state)
    for (const region of Object.values(Region))
        state.discardPileCounts[region] = state.requireVault().discardPiles[region].length
    return state
}

const CASES: PileCase[] = [
    {
        name: 'R-5.1.2 — a Search draws two from the top: Conquest is now on top',
        move: (state) => drawDiscardPile(state, Region.Provinces, 2, false, 'dana'),
        places: { cradle: [2], provinces: [1], hinterland: [] }
    },
    {
        name: 'Mushrooms — one drawn from the bottom leaves Faith second',
        move: (state) => drawDiscardPile(state, Region.Cradle, 1, true, 'dana'),
        places: { cradle: [2], provinces: [3], hinterland: [] }
    },
    {
        name: 'R-10.5 — a card leaving play faceup goes on top',
        move: (state) => putOnDiscardPile(state, Region.Cradle, [BINDERS], false, SEEN),
        places: { cradle: [3], provinces: [3], hinterland: [] }
    },
    {
        name: 'R-10.5 — hand cards discarded on top, their backs seen, the last on top',
        move: (state) =>
            putOnDiscardPile(state, Region.Cradle, [REBELLION, BINDERS], false, UNSEEN),
        places: { cradle: [2, 4], provinces: [3], hinterland: [] }
    },
    {
        name: 'Bracken — a Vision sent to the bottom of a pile',
        move: (state) => putOnDiscardPile(state, Region.Provinces, [REBELLION], true, UNSEEN),
        places: { cradle: [2], provinces: [3, 6], hinterland: [] }
    },
    {
        name: 'Land Warden — the kept card’s discard goes under the one card the second card put there',
        move: (state) => putOnDiscardPile(state, Region.Cradle, [REBELLION], false, UNSEEN, 1),
        places: { cradle: [2, 3], provinces: [3], hinterland: [] }
    },
    {
        name: 'Convoys — the Cradle’s pile set down on the Provinces’',
        move: (state) => mergeDiscardPileOnto(state, Region.Cradle, Region.Provinces),
        places: { cradle: [], provinces: [2, 6], hinterland: [] }
    },
    {
        name: 'Fallen Spire — the top denizens trade places with the Dispossessed; the backs stay',
        move: (state) => swapDiscardPileWithDispossessed(state, Region.Provinces, 2),
        places: { cradle: [2], provinces: [3], hinterland: [] }
    },
    {
        name: 'a pile drawn empty, then a Vision discarded onto it',
        move: (state) => {
            drawDiscardPile(state, Region.Cradle, 3, false, 'dana')
            putOnDiscardPile(state, Region.Cradle, [REBELLION], false, UNSEEN)
        },
        places: { cradle: [1], provinces: [3], hinterland: [] }
    },
    {
        name: 'a Vision discarded onto an empty pile',
        move: (state) => putOnDiscardPile(state, Region.Hinterland, [REBELLION], false, UNSEEN),
        places: { cradle: [2], provinces: [3], hinterland: [1] }
    }
]

const PERSPECTIVES = (state: HydratedOathGameState): Visibility.Perspective[] => [
    ...state.players.map((player) => ({ kind: 'player' as const, playerId: player.playerId })),
    spectator
]

/** What `perspective` is served, hydrated as its client holds it. */
function view(state: HydratedOathGameState, perspective: Visibility.Perspective) {
    return new HydratedOathGameState(served(state, perspective))
}

describe('R-9.4 — where the Visions lie in each discard pile, from its backs', () => {
    it('before any move, Faith is second in the Cradle’s pile and Conquest third in the Provinces’', () => {
        const state = table()
        expect(state.discardVisionPlacesIn(Region.Cradle)).toEqual([2])
        expect(state.discardVisionPlacesIn(Region.Provinces)).toEqual([3])
        expect(state.discardVisionPlacesIn(Region.Hinterland)).toEqual([])
        expectPilePlacesMatchTheVault(state)
    })

    it.each(CASES)('$name', ({ move, places }) => {
        const state = moved(move)
        expectPilePlacesMatchTheVault(state)
        for (const region of Object.values(Region))
            expect(state.discardVisionPlacesIn(region)).toEqual(places[region])
    })

    it.each(CASES)('$name: every seat and a spectator are served the same places', ({ move }) => {
        const state = moved(move)
        for (const perspective of PERSPECTIVES(state)) {
            const client = view(state, perspective)
            for (const region of Object.values(Region))
                expect(client.discardVisionPlacesIn(region)).toEqual(
                    state.discardVisionPlacesIn(region)
                )
        }
    })

    it('no front the table did not see reaches another seat or a spectator', () => {
        const state = moved((s) =>
            putOnDiscardPile(s, Region.Cradle, [REBELLION, BINDERS], false, UNSEEN)
        )
        for (const perspective of [{ kind: 'player' as const, playerId: 'rhys' }, spectator]) {
            const json = JSON.stringify(served(state, perspective))
            for (const cardId of [REBELLION, BINDERS, HERALD, FAITH, CONQUEST, TENTS])
                expect(json).not.toContain(cardId)
            expect(view(state, perspective).discardVisionPlacesIn(Region.Cradle)).toEqual([2, 4])
        }
    })

    it('R-1.19 — the setup deal’s seeded piles show their backs', () => {
        const state = table()
        state.discardPileCounts = {
            [Region.Cradle]: 0,
            [Region.Provinces]: 0,
            [Region.Hinterland]: 0
        }
        state.seenDiscardPiles = {
            [Region.Cradle]: [],
            [Region.Provinces]: [],
            [Region.Hinterland]: []
        }
        const vault = buildSetupVault(state, getPrng(1))
        state.vault = vault
        applySetupDeal(state, resolveSetupDeal(vault, ['dana', 'rhys']))
        for (const region of Object.values(Region))
            expect(state.discardPileCountIn(region)).toBeGreaterThan(0)
        expectPilePlacesMatchTheVault(state)
    })

    it('an empty pile has no Vision in it', () => {
        const state = table()
        state.seenDiscardPiles[Region.Hinterland] = []
        expect(state.discardVisionPlacesIn(Region.Hinterland)).toEqual([])
    })

    it('a pile whose backs the table’s record does not show at every place has no known places', () => {
        // A game recorded before the table kept every back: the pile's count, and no record of it.
        const state = table()
        state.seenDiscardPiles[Region.Provinces] = []
        expect(state.discardVisionPlacesIn(Region.Provinces)).toBeUndefined()
        // Or a record with a place it cannot name the back of.
        state.seenDiscardPiles[Region.Cradle] = [
            { back: CardKind.Denizen },
            null,
            { back: CardKind.Denizen }
        ]
        expect(state.discardVisionPlacesIn(Region.Cradle)).toBeUndefined()
    })
})

/** R-4.1, R-5.1 — the seat on the clock wakes, then searches the discard pile its pawn draws from. */
function searchesTheirPile(play: LocalPlay): LocalPlay {
    const [playerId] = play.state.activePlayerIds
    const woken = playUntil(play, (state) => state.machineState !== MachineState.WakePhase)
    return playStep(
        woken,
        buildAction(Search, { playerId, drawFrom: SearchSource.Discard, revealsInfo: true })
    )
}

describe('revision 35', () => {
    it('is EngineFixes30, and current', () => {
        expect(OathRevision.EngineFixes30).toBe(35)
        expect(CURRENT_OATH_REVISION).toBe(OathRevision.EngineFixes30)
    })
})

describe('R-9.4 — a whole chronicle: each pile’s places follow its cards at every step', () => {
    const steps: LocalPlay[] = []
    beforeAll(async () => {
        const store: LocalGameStore = new Map()
        const one = await playGameOne(store)
        steps.push(one.created, ...one.steps)
        const two = setUp(await continueGameOne(store))
        const searched = chancellorSearches(two)
        const kept = keepPlainly(searched)
        const fromPile = searchesTheirPile(nextTurn(kept))
        steps.push(two, searched, kept, fromPile, keepPlainly(fromPile))
    })

    it('game 1 from setup to its chronicle written, then game 2’s setup, a Search of the world deck and one of a pile: the places are the vault’s', () => {
        expect(steps.length).toBeGreaterThan(20)
        const search = steps[steps.length - 2].actions.findLast(
            (action) => action.type === Search.properties.type.const
        )
        expect((search as Search | undefined)?.drawFrom).toBe(SearchSource.Discard)
        for (const step of steps)
            expectPilePlacesMatchTheVault(new HydratedOathGameState(structuredClone(step.state)))
    })

    it('every seat and a spectator are served the host’s places at every step', () => {
        for (const step of steps) {
            const host = new HydratedOathGameState(structuredClone(step.state))
            for (const perspective of PERSPECTIVES(host)) {
                const client = view(host, perspective)
                for (const region of Object.values(Region))
                    expect(client.discardVisionPlacesIn(region)).toEqual(
                        host.discardVisionPlacesIn(region)
                    )
            }
        }
    })
})
