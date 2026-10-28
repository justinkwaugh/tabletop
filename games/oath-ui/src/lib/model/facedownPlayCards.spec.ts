import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert } from '@tabletop/common'
import {
    ActionType,
    CURRENT_OATH_REVISION,
    HydratedOathGameState,
    HydratedPlayFacedownAdviser,
    MachineState,
    OathRevision,
    PowerChoiceKind,
    PowerTiming,
    Region,
    SearchPlay,
    isPlayFacedownAdviser,
    type PlayFacedownAdviser,
    powerIndexOf
} from '@tabletop/oath'
import { FIXTURE_SITE_CAPACITY, openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { describeAction, type HistoryNames } from './actionDescription.js'
import type { OathGameSession } from './session.svelte.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const BOOK = 'relic.book-of-records'
const HORN = 'relic.cracked-horn'
const BRACKEN = 'denizen.beast.bracken'
const NEW_GROWTH = 'denizen.beast.new-growth'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const WILD_CRY = 'denizen.beast.wild-cry'
const WELCOMING_PARTY = 'denizen.hearth.welcoming-party'
const WAR_TORTOISE = 'denizen.beast.war-tortoise'
const INN = 'denizen.hearth.wayside-inn'
const TENTS = 'denizen.nomad.tents'
const WOLVES = 'denizen.beast.wolves'

const use = (cardId: string) => ({ cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Modifier) })

const names: HistoryNames = {
    player: (playerId) => ({ dana: 'Dana', rhys: 'Rhys' })[playerId] ?? playerId,
    site: (siteId) =>
        ({ c1: 'Great Slum', c2: 'Hidden Place', p1: 'Plains', h1: 'Mine' })[siteId] ?? siteId,
    seats: ['dana', 'rhys']
}

/**
 * Dana on turn at c1 with `facedown` as their one facedown adviser beside `faceup`, holding `relics`;
 * `here` at their site. Rhys sits at the Plains.
 */
function table(
    facedown: string,
    faceup: string[] = [],
    {
        relics = [],
        here = [],
        revision = CURRENT_OATH_REVISION
    }: { relics?: string[]; here?: string[]; revision?: number } = {}
) {
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                supply: 3,
                favor: 2,
                secrets: 2,
                relicIds: relics,
                advisers: [
                    { cardId: facedown, faceUp: false },
                    ...faceup.map((cardId) => ({ cardId, faceUp: true }))
                ]
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'p1' })
        ],
        {
            machineState: MachineState.ActPhase,
            oathRevision: revision,
            denizensBySite: { c1: here, c2: [], p1: [], h1: [] }
        }
    )
    openTurn(state, 'dana')
    return state
}

async function playing(state: HydratedOathGameState) {
    const session = await openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    session.chooseAction(ActionType.PlayFacedownAdviser)
    const lastSent = () => {
        const action = sent.mock.calls.at(-1)?.[0]
        assert(isPlayFacedownAdviser(action), 'a facedown adviser’s play is sent')
        return action
    }
    return { session, sent, lastSent }
}

const declared = (action: PlayFacedownAdviser) => (action.modifiers ?? []).map((m) => m.cardId)
const rows = (session: OathGameSession) => session.adviserCardRows.map((power) => power.cardId)

/** The History row of the play as sent, applied to the table it was sent from. */
function historyOf(state: HydratedOathGameState, action: PlayFacedownAdviser): string {
    const applied = new HydratedPlayFacedownAdviser(action)
    applied.apply(state)
    return describeAction(applied.dehydrate(), names, 'dana')
}

describe('R-6.1, R-7.4.1 — a card the engine applies by itself is never a row', () => {
    it('Book of Records: the site play shows no row and is sent at once; the History names it', async () => {
        const state = table(INN, [], { relics: [BOOK] })
        const { session, lastSent } = await playing(state)
        await session.chooseAdviserPlay(INN, SearchPlay.Site)
        expect(rows(session)).toEqual([])
        const action = lastSent()
        expect(declared(action)).toEqual([])
        expect(historyOf(state, action)).toBe(
            'played Wayside Inn to their site, gaining 1 secret (Book of Records)'
        )
    })
})

describe('R-6.1, R-7.4 — Wild Cry: a row above the confirm, in use from the start', () => {
    it('a beast card played to the site waits on the row, in use; the send carries it, and the History says what it gave', async () => {
        const state = table(WOLVES, [WILD_CRY])
        const { session, sent, lastSent } = await playing(state)
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Site)
        expect(sent).not.toHaveBeenCalled()
        expect(rows(session)).toEqual([WILD_CRY])
        expect(session.adviserRowsInUse).toEqual([use(WILD_CRY)])
        expect(session.adviserPlayComplete).toBe(true)
        await session.confirmAdviserPlay()
        const action = lastSent()
        expect(declared(action)).toEqual([WILD_CRY])
        expect(historyOf(state, action)).toBe(
            'played Wolves to their site, gaining 1 favor; gained 1 Supply and 2 warbands (Wild Cry)'
        )
    })

    it('a tap puts it down and the send leaves it out; Undo brings it back', async () => {
        const { session, lastSent } = await playing(table(WOLVES, [WILD_CRY]))
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Adviser)
        expect(rows(session)).toEqual([WILD_CRY])
        session.toggleAdviserCardRow(use(WILD_CRY))
        expect(session.adviserRowsInUse).toEqual([])
        await session.undo()
        expect(session.adviserRowsInUse).toEqual([use(WILD_CRY)])
        expect(session.adviserPlay).toBe(SearchPlay.Adviser)
        session.toggleAdviserCardRow(use(WILD_CRY))
        await session.confirmAdviserPlay()
        expect(declared(lastSent())).toEqual([])
    })

    it('is not a row where it gives nothing: a discard, or a card that is not a beast card', async () => {
        const discard = await playing(table(WOLVES, [WILD_CRY]))
        await discard.session.chooseAdviserPlay(WOLVES, SearchPlay.Discard)
        expect(declared(discard.lastSent())).toEqual([])

        const inn = await playing(table(INN, [WILD_CRY]))
        await inn.session.chooseAdviserPlay(INN, SearchPlay.Site)
        expect(declared(inn.lastSent())).toEqual([])
    })

    it('Welcoming Party is not listed: its own text excludes a facedown adviser', async () => {
        const { session, lastSent } = await playing(table(INN, [WELCOMING_PARTY]))
        await session.chooseAdviserPlay(INN, SearchPlay.Site)
        expect(declared(lastSent())).toEqual([])
    })
})

describe('R-6.1, R-7.4 — Crop Rotation: its cards join "Discard first", and picking one uses it', () => {
    it('a card at the site is offered; none picked, the play goes without it; one picked, the send declares Crop Rotation', async () => {
        const state = table(TENTS, [CROP_ROTATION], { here: [INN] })
        const { session, sent, lastSent } = await playing(state)
        await session.chooseAdviserPlay(TENTS, SearchPlay.Site)
        expect(sent).not.toHaveBeenCalled()
        expect(session.adviserDiscardFirstOptions).toEqual([INN])
        expect(rows(session)).toEqual([])
        expect(session.adviserModifiers).toEqual([])
        expect(session.adviserPlayReason).toBeUndefined()

        session.setAdviserDiscardFirst(INN)
        expect(session.adviserModifiers).toEqual([use(CROP_ROTATION)])
        expect(session.adviserPlayReason).toBeUndefined()
        await session.confirmAdviserPlay()
        const action = lastSent()
        expect(action.discardFirstCardId).toBe(INN)
        expect(declared(action)).toEqual([CROP_ROTATION])
        expect(historyOf(state, action)).toBe(
            'played Tents to their site, discarding Wayside Inn first (Crop Rotation), gaining 1 favor'
        )
    })

    it('at a full site the site play is offered, "Play" waits for a card to go first, and that card carries Crop Rotation', async () => {
        const full = [
            INN,
            ...Array.from(
                { length: FIXTURE_SITE_CAPACITY - 1 },
                (_, i) => `denizen.order.filler-${i}`
            )
        ]
        const { session, lastSent } = await playing(table(TENTS, [CROP_ROTATION], { here: full }))
        expect(session.facedownAdviserOptions[0]?.placements.map((p) => p.play)).toContain(
            SearchPlay.Site
        )
        await session.chooseAdviserPlay(TENTS, SearchPlay.Site)
        expect(session.adviserDiscardFirstOptions).toEqual(full)
        // The site has no room until a card goes: "Play" waits for the pick, and no red line shows.
        expect(session.adviserPlayComplete).toBe(false)
        session.setAdviserDiscardFirst(INN)
        expect(session.adviserPlayComplete).toBe(true)
        expect(session.adviserPlayReason).toBeUndefined()
        await session.confirmAdviserPlay()
        expect(declared(lastSent())).toEqual([CROP_ROTATION])
    })
})

describe('R-6.1, R-7.4 — New Growth: its sites join "To which site", and picking one uses it', () => {
    it('another site is offered; the site picked declares New Growth, and the History names the site and the card', async () => {
        const state = table(WOLVES, [NEW_GROWTH])
        const { session, lastSent } = await playing(state)
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Site)
        expect(session.adviserOtherSites).toContain('p1')
        expect(session.adviserOtherSites).not.toContain('c1')
        expect(session.adviserModifiers).toEqual([])

        session.setAdviserToSite('p1')
        expect(session.adviserModifiers).toEqual([use(NEW_GROWTH)])
        expect(session.adviserPlayReason).toBeUndefined()
        await session.confirmAdviserPlay()
        const action = lastSent()
        expect(action.toSiteId).toBe('p1')
        expect(declared(action)).toEqual([NEW_GROWTH])
        expect(historyOf(state, action)).toBe(
            'played Wolves to Plains (New Growth), gaining 1 favor'
        )
    })

    it('is not offered for a card it cannot move (not a beast or hearth card): the site play is sent at once', async () => {
        const { session, lastSent } = await playing(table(TENTS, [NEW_GROWTH]))
        await session.chooseAdviserPlay(TENTS, SearchPlay.Site)
        expect(declared(lastSent())).toEqual([])
    })
})

describe('R-6.1, R-7.4 — the Cracked Horn: a second place under "Discard"', () => {
    it('the discard pile is picked at the start; "Under the world deck" sends the Horn, and the History says where', async () => {
        const state = table(WOLVES, [], { relics: [HORN] })
        const { session, sent, lastSent } = await playing(state)
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Discard)
        expect(sent).not.toHaveBeenCalled()
        expect(session.adviserDiscardPlaces.map((power) => power.cardId)).toEqual([HORN])
        expect(session.adviserDiscardPlace).toBe('pile')
        expect(session.adviserModifiers).toEqual([])

        session.setAdviserDiscardPlace(use(HORN))
        expect(session.adviserModifiers).toEqual([use(HORN)])
        await session.undo()
        expect(session.adviserDiscardPlace).toBe('pile')
        session.setAdviserDiscardPlace(use(HORN))
        await session.confirmAdviserPlay()
        const action = lastSent()
        expect(declared(action)).toEqual([HORN])
        expect(historyOf(state, action)).toBe(
            'discarded a card under the world deck (Cracked Horn)'
        )
    })

    it('is offered under Discard only', async () => {
        const { session, lastSent } = await playing(table(WOLVES, [], { relics: [HORN] }))
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Adviser)
        expect(declared(lastSent())).toEqual([])
    })
})

describe('R-6.1, Bracken — its piles and their side under "To", nothing picked; Discard waits for both', () => {
    it('lists all three piles, even the pawn’s own; nothing is picked and the play waits', async () => {
        const { session, sent } = await playing(table(WOLVES, [BRACKEN]))
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Discard)
        expect(sent).not.toHaveBeenCalled()
        expect(session.adviserDiscardPileCard?.cardId).toBe(BRACKEN)
        expect(session.adviserDiscardPiles).toEqual([
            Region.Cradle,
            Region.Provinces,
            Region.Hinterland
        ])
        expect(session.adviserDiscardPlace).toEqual({})
        expect(session.adviserPlayComplete).toBe(false)
        session.setAdviserDiscardPile(Region.Hinterland)
        expect(session.adviserPlayComplete).toBe(false)
        session.setAdviserDiscardSide(true)
        expect(session.adviserPlayComplete).toBe(true)
    })

    it('a side picked first keeps it when the pile is picked', async () => {
        const { session } = await playing(table(WOLVES, [BRACKEN]))
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Discard)
        session.setAdviserDiscardSide(true)
        expect(session.adviserPlayComplete).toBe(false)
        session.setAdviserDiscardPile(Region.Cradle)
        expect(session.adviserDiscardPlace).toEqual({ region: Region.Cradle, bottom: true })
        expect(session.adviserPlayComplete).toBe(true)
    })

    it('another pile, or the bottom, uses Bracken: the play is sent with its pile and side', async () => {
        const state = table(WOLVES, [BRACKEN])
        const { session, lastSent } = await playing(state)
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Discard)
        session.setAdviserDiscardPile(Region.Hinterland)
        session.setAdviserDiscardSide(true)
        expect(session.adviserPlayReason).toBeUndefined()
        await session.confirmAdviserPlay()
        const action = lastSent()
        expect(action.modifiers).toEqual([
            {
                ...use(BRACKEN),
                choices: [
                    { kind: PowerChoiceKind.Region, region: Region.Hinterland },
                    { kind: PowerChoiceKind.Yes }
                ]
            }
        ])
        const applied = new HydratedPlayFacedownAdviser(action)
        applied.apply(state)
        expect(applied.metadata?.discardPileRegion).toBe(Region.Hinterland)
        expect(applied.metadata?.discardToBottom).toBe(true)
    })

    it('the usual pile on top is where the discard goes anyway: sent without Bracken', async () => {
        const { session, lastSent } = await playing(table(WOLVES, [BRACKEN]))
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Discard)
        // R-10.5 — from the Cradle, the Provinces pile.
        session.setAdviserDiscardPile(Region.Provinces)
        session.setAdviserDiscardSide(false)
        await session.confirmAdviserPlay()
        expect(declared(lastSent())).toEqual([])
    })

    it('with the Cracked Horn, "Under the world deck" is in the same list; picking it sends the Horn alone', async () => {
        const { session, lastSent } = await playing(table(WOLVES, [BRACKEN], { relics: [HORN] }))
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Discard)
        expect(session.adviserDiscardPlaces.map((power) => power.cardId)).toEqual([HORN])
        expect(session.adviserDiscardPlace).toEqual({})
        session.setAdviserDiscardPile(Region.Hinterland)
        session.setAdviserDiscardPlace(use(HORN))
        expect(session.adviserDiscardPlace).toEqual(use(HORN))
        expect(session.adviserPlayComplete).toBe(true)
        await session.confirmAdviserPlay()
        expect(declared(lastSent())).toEqual([HORN])
    })

    it('is offered under Discard only: the site play is sent at once without it', async () => {
        const { session, lastSent } = await playing(table(WOLVES, [BRACKEN]))
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Site)
        expect(declared(lastSent())).toEqual([])
    })
})

describe('R-X.4 — a game created before the facedown play took modifiers offers no card', () => {
    it('the same cards are no row, no site, no discard first and no place; each play is sent at once with none', async () => {
        const cards = { relics: [HORN], here: [INN, NEW_GROWTH] }
        const old = () =>
            table(WAR_TORTOISE, [WILD_CRY, CROP_ROTATION], {
                ...cards,
                revision: OathRevision.TurnFlow
            })
        // The same table in a game of today offers every one of them.
        const today = (await playing(table(WAR_TORTOISE, [WILD_CRY, CROP_ROTATION], cards))).session
            .facedownAdviserOptions[0]?.placements
        const offered = (play: SearchPlay) => today?.find((p) => p.play === play)?.cards
        expect(offered(SearchPlay.Site)?.rows.map((r) => r.cardId)).toEqual([WILD_CRY])
        expect(
            offered(SearchPlay.Site)
                ?.placing.map((r) => r.cardId)
                .sort()
        ).toEqual([NEW_GROWTH, CROP_ROTATION])
        expect(offered(SearchPlay.Discard)?.places.map((r) => r.cardId)).toEqual([HORN])
        for (const play of [SearchPlay.Site, SearchPlay.Adviser, SearchPlay.Discard]) {
            const { session, lastSent } = await playing(old())
            expect(
                session.facedownAdviserOptions[0]?.placements.every(
                    (p) =>
                        p.cards.rows.length + p.cards.places.length + p.cards.placing.length === 0
                )
            ).toBe(true)
            await session.chooseAdviserPlay(WAR_TORTOISE, play)
            expect(declared(lastSent())).toEqual([])
        }
    })
})
