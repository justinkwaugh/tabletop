import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import { assertExists } from '@tabletop/common'
import {
    GameSession,
    setStagedSelectionValue,
    undoableStagedSelection,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import {
    MachineState,
    PhaseName,
    isRideJourney,
    journeyPayments,
    journeyRefusal,
    nextCities,
    railroadsIn,
    usaCity,
    type CityId,
    type HexId,
    type HydratedRideTheRailsGameState,
    type RailroadId,
    type Shares,
    type Track
} from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import { heldJourneyStage, journeyOffer, startCities } from './journeyOffer.js'
import {
    JourneyStageOrder,
    draftLinks,
    openRailroadChoice,
    linksKeptAt,
    pickJourneyStart,
    pushDraftLink,
    type JourneyStageValues
} from './journeyStage.js'
import type { RideTheRailsGameSession } from './session.svelte.js'

const RED: RailroadId = 'railroad.red'
const BLUE: RailroadId = 'railroad.blue'

const KANSAS_CITY: CityId = 'city.usa.kansas-city'
const SAINT_LOUIS: CityId = 'city.usa.saint-louis'
const CINCINNATI: CityId = 'city.usa.cincinnati'
const PITTSBURGH: CityId = 'city.usa.pittsburgh'
const LITTLE_ROCK: CityId = 'city.usa.little-rock'
const DES_MOINES: CityId = 'city.usa.des-moines'

const KANSAS_CITY_TO_SAINT_LOUIS: HexId[] = [
    'hex.usa.8-32',
    'hex.usa.8-34',
    'hex.usa.8-36',
    'hex.usa.8-38'
]
const SAINT_LOUIS_TO_CINCINNATI: HexId[] = [
    'hex.usa.8-38',
    'hex.usa.8-40',
    'hex.usa.8-42',
    'hex.usa.8-44',
    'hex.usa.8-46'
]
const CINCINNATI_TO_PITTSBURGH: HexId[] = [
    'hex.usa.8-46',
    'hex.usa.7-47',
    'hex.usa.7-49',
    'hex.usa.7-51'
]
const KANSAS_CITY_TO_SAINT_LOUIS_FAR_NORTH: HexId[] = [
    'hex.usa.8-32',
    'hex.usa.7-33',
    'hex.usa.6-34',
    'hex.usa.6-36',
    'hex.usa.6-38',
    'hex.usa.7-39',
    'hex.usa.8-38'
]
const SAINT_LOUIS_TO_LITTLE_ROCK_CROSSING: HexId[] = [
    'hex.usa.8-38',
    'hex.usa.8-36',
    'hex.usa.9-35',
    'hex.usa.10-36',
    'hex.usa.11-37'
]
const KANSAS_CITY_TO_SAINT_LOUIS_NORTH: HexId[] = [
    'hex.usa.8-32',
    'hex.usa.7-33',
    'hex.usa.7-35',
    'hex.usa.7-37',
    'hex.usa.8-38'
]
const KANSAS_CITY_TO_SAINT_LOUIS_SOUTH: HexId[] = [
    'hex.usa.8-32',
    'hex.usa.9-33',
    'hex.usa.9-35',
    'hex.usa.9-37',
    'hex.usa.8-38'
]
const SAINT_LOUIS_TO_DES_MOINES: HexId[] = [
    'hex.usa.8-38',
    'hex.usa.7-37',
    'hex.usa.6-36',
    'hex.usa.5-37'
]

function trackOf(...paths: [RailroadId, readonly HexId[]][]): Track {
    const track: Track = {}
    for (const [railroadId, hexIds] of paths) {
        for (const hexId of hexIds) {
            const railroads = railroadsIn(track, hexId)
            if (!railroads.includes(railroadId)) {
                track[hexId] = [...railroads, railroadId]
            }
        }
    }
    return track
}

// Red Kansas City to Saint Louis to Cincinnati, Blue on to Pittsburgh; Blue also runs Kansas City
// to Saint Louis the long way north, and Saint Louis to Little Rock across Red's hex 8-36.
const NETWORK = trackOf(
    [RED, KANSAS_CITY_TO_SAINT_LOUIS],
    [RED, SAINT_LOUIS_TO_CINCINNATI],
    [BLUE, CINCINNATI_TO_PITTSBURGH],
    [BLUE, KANSAS_CITY_TO_SAINT_LOUIS_FAR_NORTH],
    [BLUE, SAINT_LOUIS_TO_LITTLE_ROCK_CROSSING]
)

// Red twice from Kansas City to Saint Louis; Blue on to Des Moines shares the north way's 7-37.
const BACKTRACK = trackOf(
    [RED, KANSAS_CITY_TO_SAINT_LOUIS_NORTH],
    [RED, KANSAS_CITY_TO_SAINT_LOUIS_SOUTH],
    [BLUE, SAINT_LOUIS_TO_DES_MOINES]
)

const SHARES: Record<string, Shares> = {
    p1: { [RED]: 1 },
    p2: { [BLUE]: 2 },
    p3: { [RED]: 1, [BLUE]: 1 }
}

function riding(track: Track = NETWORK, passengers?: CityId[]): HydratedRideTheRailsGameState {
    return buildState({
        playerCount: 3,
        round: 6,
        phase: PhaseName.Ride,
        track,
        shares: SHARES,
        passengers
    })
}

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

function hexOf(cityId: CityId): HexId {
    return usaCity(cityId).hexId
}

function litCities(session: RideTheRailsGameSession) {
    return session.journeyLit.map(({ cityId, railroadIds }) => ({ cityId, railroadIds }))
}

function routeOf(session: RideTheRailsGameSession) {
    return session.journeyDraft?.draftLinks.map((link) => [link.cityId, link.railroadId])
}

function spyOnApply() {
    return vi.spyOn(GameSession.prototype, 'applyAction').mockResolvedValue()
}

function spyOnActionUndo() {
    return vi.spyOn(GameSession.prototype, 'undoCommittedAction').mockResolvedValue()
}

async function settled(session: RideTheRailsGameSession) {
    await session.waitForVisibleTransitionSettled()
    flushSync()
}

async function startedIn(cityId: CityId, state = riding()) {
    const session = await openSessionOn(state)
    await session.pressHex(hexOf(cityId))
    return session
}

describe('choosing a start (R-3.3.1)', () => {
    it('lights every passenger city with a link out, with a pip per railroad leaving it', async () => {
        const session = await openSessionOn(riding())
        expect(session.journeyDraft).toBeUndefined()
        expect(litCities(session)).toEqual(
            expect.arrayContaining([
                { cityId: KANSAS_CITY, railroadIds: [RED, BLUE] },
                { cityId: PITTSBURGH, railroadIds: [BLUE] },
                { cityId: LITTLE_ROCK, railroadIds: [BLUE] }
            ])
        )
        expect(
            litCities(session)
                .map((city) => city.cityId)
                .sort()
        ).toEqual([CINCINNATI, KANSAS_CITY, LITTLE_ROCK, PITTSBURGH, SAINT_LOUIS].sort())
        expect(session.boardOffer.scrim?.holes).toEqual(
            session.journeyLit.map((city) => city.hexId)
        )
    })

    it('leaves a city without a passenger unlit', async () => {
        const session = await openSessionOn(riding(NETWORK, [KANSAS_CITY, PITTSBURGH]))
        expect(litCities(session).map((city) => city.cityId)).toEqual([PITTSBURGH, KANSAS_CITY])
    })

    it('lights nothing and dims nothing when no journey is possible', async () => {
        const session = await openSessionOn(riding({}))
        expect(session.journeyLit).toEqual([])
        expect(session.boardOffer.scrim).toBeUndefined()
    })

    it('offers nothing to a waiting seat', async () => {
        const session = await openSessionOn(riding())
        session.setViewingAsNonActivePlayer(true)
        flushSync()
        expect(session.journeyLit).toEqual([])
        expect(session.boardOffer.lit).toEqual([])
    })
})

describe('extending the route (R-3.3.2, R-3.3.3)', () => {
    it('lights the next cities with their pips once the start is picked', async () => {
        const state = riding()
        const session = await startedIn(KANSAS_CITY, state)
        expect(session.journeyDraft?.startCityId).toBe(KANSAS_CITY)
        expect(litCities(session)).toEqual(nextCities(state, KANSAS_CITY, []))
        expect(session.boardOffer.scrim?.holes).toEqual([
            hexOf(KANSAS_CITY),
            ...session.journeyLit.map((city) => city.hexId)
        ])
    })

    it('pushes the link on a city one railroad reaches, and previews its payments', async () => {
        const state = riding()
        const session = await startedIn(PITTSBURGH, state)
        await session.pressHex(hexOf(CINCINNATI))
        expect(routeOf(session)).toEqual([[CINCINNATI, BLUE]])
        const links = session.journeyDraft?.links
        assertExists(links)
        expect(links).toEqual([
            { railroadId: BLUE, hexIds: [...CINCINNATI_TO_PITTSBURGH].reverse() }
        ])
        expect(litCities(session)).toEqual(nextCities(state, PITTSBURGH, links))
        expect(session.journeyPreview).toEqual({
            cityIds: [PITTSBURGH, CINCINNATI],
            fare: 2,
            riderGain: 2,
            ...journeyPayments(state.players, 'p1', links)
        })
        expect(session.journeyPreview?.payments.map((payment) => payment.dividends)).toEqual([
            0, 2, 1
        ])
    })

    it('asks which railroad on a city two railroads reach, each chip with what the seat would gain', async () => {
        const session = await startedIn(KANSAS_CITY)
        await session.pressHex(hexOf(SAINT_LOUIS))
        expect(routeOf(session)).toEqual([])
        expect(session.journeyPopup).toEqual({
            cityId: SAINT_LOUIS,
            hexId: hexOf(SAINT_LOUIS),
            chips: [
                { railroadId: RED, gain: 3 },
                { railroadId: BLUE, gain: 2 }
            ]
        })

        session.chooseLinkRailroad(BLUE)
        expect(routeOf(session)).toEqual([[SAINT_LOUIS, BLUE]])
        expect(session.journeyPopup).toBeUndefined()
        expect(session.journeyDraft?.links[0].hexIds).toEqual(KANSAS_CITY_TO_SAINT_LOUIS_FAR_NORTH)
    })

    it('never lights a city on the route or one reached only through a hex the route used', async () => {
        const state = riding()
        const session = await startedIn(KANSAS_CITY, state)
        await session.pressHex(hexOf(SAINT_LOUIS))
        session.chooseLinkRailroad(RED)
        expect(litCities(session)).toEqual([{ cityId: CINCINNATI, railroadIds: [RED] }])
        const links = session.journeyDraft?.links
        assertExists(links)
        expect(litCities(session)).toEqual(nextCities(state, KANSAS_CITY, links))

        await session.pressHex(hexOf(CINCINNATI))
        expect(litCities(session)).toEqual([{ cityId: PITTSBURGH, railroadIds: [BLUE] }])
    })

    it('lights a city another way between the same cities still reaches, and the sent hexes take that way', async () => {
        const session = await startedIn(KANSAS_CITY, riding(BACKTRACK))
        await session.pressHex(hexOf(SAINT_LOUIS))
        expect(routeOf(session)).toEqual([[SAINT_LOUIS, RED]])
        expect(litCities(session)).toEqual([{ cityId: DES_MOINES, railroadIds: [BLUE] }])

        await session.pressHex(hexOf(DES_MOINES))
        expect(session.journeyDraft?.links.map((link) => link.hexIds)).toEqual([
            KANSAS_CITY_TO_SAINT_LOUIS_SOUTH,
            SAINT_LOUIS_TO_DES_MOINES
        ])
    })

    it('changes no stage on an unlit city', async () => {
        const session = await startedIn(KANSAS_CITY)
        await session.pressHex(hexOf(PITTSBURGH))
        expect(session.journeyDraft?.draftLinks).toEqual([])
    })
})

describe('riding the journey (R-3.3.3 to R-3.3.6)', () => {
    it('is enabled from the first link and sends the route the draft shows', async () => {
        const session = await startedIn(PITTSBURGH)
        expect(session.canRideJourney).toBe(false)
        const apply = spyOnApply()
        await session.rideJourney()
        expect(apply).not.toHaveBeenCalled()

        await session.pressHex(hexOf(CINCINNATI))
        expect(session.canRideJourney).toBe(true)
        await session.rideJourney()
        expect(apply).toHaveBeenCalledOnce()
        const action = apply.mock.calls[0][0]
        expect(isRideJourney(action) && action.links).toEqual(session.journeyDraft?.links)
    })

    it('pays every seat exactly the preview, and the new Game State clears the draft', async () => {
        const state = riding()
        const session = await startedIn(KANSAS_CITY, state)
        await session.pressHex(hexOf(SAINT_LOUIS))
        session.chooseLinkRailroad(RED)
        await session.pressHex(hexOf(CINCINNATI))
        await session.pressHex(hexOf(PITTSBURGH))
        expect(routeOf(session)).toEqual([
            [SAINT_LOUIS, RED],
            [CINCINNATI, RED],
            [PITTSBURGH, BLUE]
        ])
        const preview = session.journeyPreview
        assertExists(preview)
        const before = new Map(state.players.map((player) => [player.playerId, player.money]))

        await session.rideJourney()
        await settled(session)
        expect(session.gameState.actionCount).toBe(1)
        for (const payment of preview.payments) {
            const player = session.gameState.players.find((p) => p.playerId === payment.playerId)
            expect(player?.money).toBe(
                (before.get(payment.playerId) ?? 0) + payment.fare + payment.dividends
            )
        }
        expect(session.gameState.machineState).toBe(MachineState.Riding)
        expect(session.journeyDraft).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
    })
})

describe('Undo and the journey draft (docs/user-interactions.md)', () => {
    it('setting the start clears every later stage', () => {
        const stage = openRailroadChoice(
            pushDraftLink(pickJourneyStart({}, KANSAS_CITY), {
                cityId: SAINT_LOUIS,
                railroadId: RED
            }),
            CINCINNATI
        )
        expect(pickJourneyStart(stage, PITTSBURGH)).toEqual({
            start: { value: PITTSBURGH, source: 'manual' }
        })
    })

    it('Undo pops the last link, then the start, and undoes no action until the draft is empty', async () => {
        const actionUndo = spyOnActionUndo()
        const session = await startedIn(KANSAS_CITY)
        await session.pressHex(hexOf(SAINT_LOUIS))
        session.chooseLinkRailroad(RED)
        await session.pressHex(hexOf(CINCINNATI))
        expect(routeOf(session)).toEqual([
            [SAINT_LOUIS, RED],
            [CINCINNATI, RED]
        ])

        await session.undo()
        expect(routeOf(session)).toEqual([[SAINT_LOUIS, RED]])
        await session.undo()
        expect(routeOf(session)).toEqual([])
        await session.undo()
        expect(session.journeyDraft).toBeUndefined()
        expect(actionUndo).not.toHaveBeenCalled()
        expect(session.hasLocalSelection).toBe(false)

        await session.undo()
        expect(actionUndo).toHaveBeenCalledOnce()
    })

    it('Undo passes over an auto start to the action', () => {
        let stage: StagedSelectionState<JourneyStageValues> = setStagedSelectionValue<
            JourneyStageValues,
            'start'
        >({}, JourneyStageOrder, 'start', KANSAS_CITY, 'auto')
        const selection = undoableStagedSelection(
            JourneyStageOrder,
            () => stage,
            (next) => (stage = next)
        )
        expect(selection.hasManual()).toBe(false)
        expect(selection.undo()).toBe(false)
        expect(stage.start?.value).toBe(KANSAS_CITY)
    })

    it('rejects a stage outside the order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, unknown>, string>(
                {},
                JourneyStageOrder,
                'hex',
                hexOf(KANSAS_CITY),
                'manual'
            )
        ).toThrow()
    })

    it('pressing the picked start cuts the route back to it, and a second press drops the draft', async () => {
        const session = await startedIn(KANSAS_CITY)
        await session.pressHex(hexOf(SAINT_LOUIS))
        session.chooseLinkRailroad(RED)
        await session.pressHex(hexOf(CINCINNATI))

        await session.pressHex(hexOf(KANSAS_CITY))
        expect(session.journeyDraft?.startCityId).toBe(KANSAS_CITY)
        expect(routeOf(session)).toEqual([])

        await session.pressHex(hexOf(KANSAS_CITY))
        expect(session.journeyDraft).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)

        await session.pressHex(hexOf(PITTSBURGH))
        expect(session.journeyDraft?.startCityId).toBe(PITTSBURGH)
    })

    it('pressing a city the route reaches cuts it back to there, and Undo puts the rest back', async () => {
        const session = await startedIn(KANSAS_CITY)
        await session.pressHex(hexOf(SAINT_LOUIS))
        session.chooseLinkRailroad(RED)
        await session.pressHex(hexOf(CINCINNATI))
        await session.pressHex(hexOf(PITTSBURGH))

        await session.pressHex(hexOf(SAINT_LOUIS))
        expect(routeOf(session)).toEqual([[SAINT_LOUIS, RED]])

        await session.pressHex(hexOf(SAINT_LOUIS))
        expect(routeOf(session)).toEqual([[SAINT_LOUIS, RED]])

        await session.undo()
        expect(routeOf(session)).toEqual([
            [SAINT_LOUIS, RED],
            [CINCINNATI, RED],
            [PITTSBURGH, BLUE]
        ])
    })

    it('Undo closes the railroad popup before taking back any link, and a second press closes it', async () => {
        const session = await startedIn(KANSAS_CITY)
        await session.pressHex(hexOf(SAINT_LOUIS))
        expect(session.journeyPopup?.cityId).toBe(SAINT_LOUIS)
        await session.undo()
        expect(session.journeyPopup).toBeUndefined()
        expect(session.journeyDraft?.startCityId).toBe(KANSAS_CITY)

        await session.pressHex(hexOf(SAINT_LOUIS))
        await session.pressHex(hexOf(SAINT_LOUIS))
        expect(session.journeyPopup).toBeUndefined()
        expect(session.journeyDraft?.startCityId).toBe(KANSAS_CITY)
    })

    it('keeps no links on the start, the links through a city the route reaches, none off the route', () => {
        const links = [
            { cityId: SAINT_LOUIS, railroadId: RED },
            { cityId: CINCINNATI, railroadId: RED }
        ]
        expect(linksKeptAt(KANSAS_CITY, links, KANSAS_CITY)).toBe(0)
        expect(linksKeptAt(KANSAS_CITY, links, SAINT_LOUIS)).toBe(1)
        expect(linksKeptAt(KANSAS_CITY, links, CINCINNATI)).toBe(2)
        expect(linksKeptAt(KANSAS_CITY, links, PITTSBURGH)).toBeUndefined()
    })

    it('pushing a link clears the open railroad choice and keeps the earlier links for Undo', () => {
        const first = pushDraftLink(pickJourneyStart({}, KANSAS_CITY), {
            cityId: SAINT_LOUIS,
            railroadId: RED
        })
        const pushed = pushDraftLink(openRailroadChoice(first, LITTLE_ROCK), {
            cityId: CINCINNATI,
            railroadId: RED
        })
        expect(pushed.railroadChoice).toBeUndefined()
        expect(pushed.links?.previous?.value).toEqual([{ cityId: SAINT_LOUIS, railroadId: RED }])
    })

    it('a new Game State clears the draft', async () => {
        const session = await startedIn(KANSAS_CITY)
        await session.pressHex(hexOf(SAINT_LOUIS))
        session.chooseLinkRailroad(RED)
        await session.presentState(riding().dehydrate())
        flushSync()
        expect(session.journeyDraft).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
    })
})

describe('a draft re-checked against the displayed state', () => {
    const stage = openRailroadChoice(
        pushDraftLink(pickJourneyStart({}, KANSAS_CITY), { cityId: SAINT_LOUIS, railroadId: BLUE }),
        CINCINNATI
    )

    it('reads as empty when a link no longer holds or the start has lost its passenger', () => {
        const draft = pushDraftLink(pickJourneyStart({}, KANSAS_CITY), {
            cityId: SAINT_LOUIS,
            railroadId: RED
        })
        expect(heldJourneyStage(riding(), draft)).toBe(draft)
        expect(
            heldJourneyStage(riding(trackOf([BLUE, KANSAS_CITY_TO_SAINT_LOUIS_FAR_NORTH])), draft)
        ).toEqual({})
        expect(heldJourneyStage(riding(NETWORK, [SAINT_LOUIS]), draft)).toEqual({})
        const withoutPassenger = riding(NETWORK, [SAINT_LOUIS])
        const empty = journeyOffer(
            withoutPassenger,
            heldJourneyStage(withoutPassenger, draft),
            'p1'
        )
        expect(empty.draft).toBeUndefined()
        expect(empty.lit).toEqual(startCities(withoutPassenger))
    })

    it('closes a railroad choice on a city that no longer has two railroads, keeping the links', () => {
        const held = heldJourneyStage(riding(), stage)
        expect(held.railroadChoice).toBeUndefined()
        expect(draftLinks(held)).toEqual([{ cityId: SAINT_LOUIS, railroadId: BLUE }])
    })
})

describe('a block of track with millions of paths (R-3.3.2, R-3.3.3, R-X.1)', () => {
    // Red's whole railroad: Spokane, Seattle and the 25 non-city hexes nearest Spokane.
    const SPOKANE_BLOCK: HexId[] = [
        'hex.usa.0-10',
        'hex.usa.0-4',
        'hex.usa.0-8',
        'hex.usa.0-12',
        'hex.usa.1-9',
        'hex.usa.1-11',
        'hex.usa.0-6',
        'hex.usa.0-14',
        'hex.usa.1-7',
        'hex.usa.1-13',
        'hex.usa.2-8',
        'hex.usa.2-10',
        'hex.usa.2-12',
        'hex.usa.0-16',
        'hex.usa.1-5',
        'hex.usa.1-15',
        'hex.usa.2-6',
        'hex.usa.2-14',
        'hex.usa.3-7',
        'hex.usa.3-9',
        'hex.usa.3-11',
        'hex.usa.3-13',
        'hex.usa.0-18',
        'hex.usa.1-3',
        'hex.usa.2-16',
        'hex.usa.3-5',
        'hex.usa.3-15'
    ]
    const SPOKANE: CityId = 'city.usa.spokane'
    const SEATTLE: CityId = 'city.usa.seattle'

    it('offers the route out of Spokane and back without walking every path', () => {
        const state = riding(trackOf([RED, SPOKANE_BLOCK]))
        const started = heldJourneyStage(state, pickJourneyStart({}, SPOKANE))
        expect(journeyOffer(state, started, 'p1').lit.map((city) => city.cityId)).toEqual([SEATTLE])
        const linked = heldJourneyStage(
            state,
            pushDraftLink(started, { cityId: SEATTLE, railroadId: RED })
        )
        const offer = journeyOffer(state, linked, 'p1')
        expect(offer.draft?.links.map((link) => link.hexIds.at(-1))).toEqual([hexOf(SEATTLE)])
        expect(offer.lit).toEqual([])
    }, 2000)
})

describe('a route whose first link must leave room for a later one (R-3.3.2, R-3.3.3, R-X.1)', () => {
    // Red: Kansas City, Saint Louis and the 25 non-city hexes nearest Kansas City. Blue: Saint
    // Louis round the north and west of Kansas City to Oklahoma City, through 7-31, where Red's
    // first ways from Kansas City go.
    const KANSAS_CITY_BLOCK: HexId[] = [
        'hex.usa.7-31',
        'hex.usa.7-33',
        'hex.usa.8-30',
        'hex.usa.8-34',
        'hex.usa.9-31',
        'hex.usa.9-33',
        'hex.usa.6-30',
        'hex.usa.6-32',
        'hex.usa.6-34',
        'hex.usa.7-29',
        'hex.usa.7-35',
        'hex.usa.8-28',
        'hex.usa.8-36',
        'hex.usa.9-29',
        'hex.usa.9-35',
        'hex.usa.10-32',
        'hex.usa.10-34',
        'hex.usa.5-29',
        'hex.usa.5-33',
        'hex.usa.5-35',
        'hex.usa.6-28',
        'hex.usa.6-36',
        'hex.usa.7-27',
        'hex.usa.7-37',
        'hex.usa.8-26'
    ]
    const OKLAHOMA_CITY: CityId = 'city.usa.oklahoma-city'
    const BLUE_AROUND: HexId[] = [
        hexOf(SAINT_LOUIS),
        'hex.usa.7-37',
        'hex.usa.6-36',
        'hex.usa.6-34',
        'hex.usa.6-32',
        'hex.usa.7-31',
        'hex.usa.8-30',
        'hex.usa.9-29',
        hexOf(OKLAHOMA_CITY)
    ]

    it('lights the later city, and Ride sends a route that leaves its link the hexes it needs', () => {
        const state = riding(
            trackOf(
                [RED, [hexOf(KANSAS_CITY), hexOf(SAINT_LOUIS), ...KANSAS_CITY_BLOCK]],
                [BLUE, BLUE_AROUND]
            )
        )
        const started = heldJourneyStage(state, pickJourneyStart({}, KANSAS_CITY))
        const linked = heldJourneyStage(
            state,
            pushDraftLink(started, { cityId: SAINT_LOUIS, railroadId: RED })
        )
        expect(journeyOffer(state, linked, 'p1').lit).toContainEqual({
            cityId: OKLAHOMA_CITY,
            hexId: hexOf(OKLAHOMA_CITY),
            railroadIds: [BLUE]
        })
        const extended = heldJourneyStage(
            state,
            pushDraftLink(linked, { cityId: OKLAHOMA_CITY, railroadId: BLUE })
        )
        const links = journeyOffer(state, extended, 'p1').draft?.links ?? []
        expect(links.at(-1)).toEqual({ railroadId: BLUE, hexIds: BLUE_AROUND })
        expect(journeyRefusal(state, links)).toBeUndefined()
    }, 2000)
})
