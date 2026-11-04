import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert, type Visibility } from '@tabletop/common'
import {
    ActionType,
    Banner,
    HydratedOathGameState,
    HydratedPlayFacedownAdviser,
    HydratedSearchResolve,
    MachineState,
    OathRevision,
    PowerTiming,
    SearchPlay,
    isPlayFacedownAdviser,
    powerIndexOf
} from '@tabletop/oath'
import { openTurn, served, testPlayer, testState } from '@tabletop/oath/testing'
import {
    disposeSessions,
    openSessionOn,
    tableOf,
    type PlayedTable
} from '$lib/testing/sessionHarness.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

// Crop Rotation's Q&A: it may be used along with the People's Favor. Each power that gives a card discarded first
// gives one (the Great Slum played to, Crop Rotation, the People's Favor), so from revision 32 the one "Discard first"
// row takes one card per power: it shows the cards picked and each that can still be added so the play can be
// completed, a tap on a picked card takes it back, and the play waits until the picks open it. With one power, and
// before revision 32, it takes one card, and tapping another replaces it.

const ME = 'dana'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const ALCHEMIST = 'denizen.arcane.alchemist'
const WRESTLERS = 'denizen.order.wrestlers'
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'
const SONGS = 'denizen.hearth.tavern-songs'
const PUB = 'denizen.hearth.rowdy-pub'
const HALL = 'denizen.discord.gambling-hall'

const FAVOR_HELD = {
    [Banner.PeoplesFavor]: { value: 1, mobSide: false, holderPlayerId: ME },
    [Banner.DarkestSecret]: { value: 1 }
}
const use = (cardId: string) => ({ cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Modifier) })

interface Table {
    revision?: OathRevision
    /** Dana's site, c1: the Plains (capacity 3) unless named. */
    site?: string
    c1?: string[]
    /** The River (capacity 2), in Dana's region. */
    c2?: string[]
    favor?: boolean
    crop?: boolean
}

/**
 * Dana at c1 holding the People's Favor, with Crop Rotation faceup as an adviser; the Plains holds the Wolves and the
 * Tents, the River the Rowdy Pub and the Gambling Hall. Searching, Dana holds Alchemist and Wrestlers with Crop
 * Rotation in use; in the Act Phase, Alchemist is a facedown adviser instead.
 */
function table(machineState: MachineState, options: Table = {}): HydratedOathGameState {
    const {
        revision = OathRevision.EngineFixes27,
        site = 'site.plains',
        c1 = [WOLVES, TENTS],
        c2 = [PUB, HALL],
        favor = true,
        crop = true
    } = options
    const searching = machineState === MachineState.Searching
    const state = testState(
        [
            testPlayer({
                playerId: ME,
                color: Color.Red,
                siteId: 'c1',
                favor: 2,
                supply: 4,
                secrets: 2,
                handIds: searching ? [ALCHEMIST, WRESTLERS] : [],
                advisers: [
                    ...(crop ? [{ cardId: CROP_ROTATION, faceUp: true }] : []),
                    ...(searching ? [] : [{ cardId: ALCHEMIST, faceUp: false }])
                ]
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2' })
        ],
        {
            machineState,
            oathRevision: revision,
            denizensBySite: { c1, c2, p1: [], h1: [] },
            siteCards: { c1: site, c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            ...(favor ? { banners: FAVOR_HELD } : {}),
            ...(searching && crop ? { pendingSearchModifiers: [use(CROP_ROTATION)] } : {})
        }
    )
    openTurn(state, ME)
    return state
}

async function searchOn(played: PlayedTable) {
    const session = await openSessionOn(played)
    const sent = vi.spyOn(session, 'resolveSearch').mockResolvedValue()
    const draft = session.search
    draft.keep(ALCHEMIST)
    return { session, draft, sent }
}

const search = (options: Table = {}) => searchOn(tableOf(table(MachineState.Searching, options)))

describe('the Search\'s "Discard first" row from revision 32: one card per power', () => {
    it("Crop Rotation with the People's Favor: all four offered; after the Tents all stay; after the Rowdy Pub too, the other two are hidden", async () => {
        const { session, draft, sent } = await search()
        expect(draft.discardFirstOptions).toEqual([WOLVES, TENTS, PUB, HALL])

        draft.tapDiscardFirst(TENTS)
        expect(draft.discardFirsts).toEqual([TENTS])
        expect(draft.discardFirstOptions).toEqual([WOLVES, TENTS, PUB, HALL])

        draft.tapDiscardFirst(PUB)
        expect(draft.discardFirsts).toEqual([TENTS, PUB])
        expect(draft.discardFirstOptions).toEqual([TENTS, PUB])

        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledWith(
            expect.objectContaining({
                keptCardId: ALCHEMIST,
                play: SearchPlay.Site,
                discardFirstCardIds: [TENTS, PUB]
            })
        )
        expect(sent).toHaveBeenCalledWith(
            expect.not.objectContaining({ discardFirstCardId: expect.anything() })
        )
        const [choice] = sent.mock.calls[0]
        expect(
            HydratedSearchResolve.reasonCannotResolve(session.gameState, ME, choice)
        ).toBeUndefined()
    })

    it("a River card first hides the other: Crop Rotation's card must be at the Plains", async () => {
        const { draft } = await search()
        draft.tapDiscardFirst(PUB)
        expect(draft.discardFirstOptions).toEqual([WOLVES, TENTS, PUB])
        draft.tapDiscardFirst(HALL)
        expect(draft.discardFirsts).toEqual([PUB])
    })

    it('tapping a picked card takes it back, and the hidden cards return', async () => {
        const { draft } = await search()
        draft.tapDiscardFirst(TENTS)
        draft.tapDiscardFirst(PUB)
        draft.tapDiscardFirst(TENTS)
        expect(draft.discardFirsts).toEqual([PUB])
        expect(draft.discardFirstOptions).toEqual([WOLVES, TENTS, PUB])
        draft.tapDiscardFirst(PUB)
        expect(draft.discardFirsts).toEqual([])
        expect(draft.discardFirstOptions).toEqual([WOLVES, TENTS, PUB, HALL])
    })

    it('one card picked is sent as one card, as before', async () => {
        const { draft, sent } = await search()
        draft.tapDiscardFirst(PUB)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledWith(expect.objectContaining({ discardFirstCardId: PUB }))
        expect(sent).toHaveBeenCalledWith(
            expect.not.objectContaining({ discardFirstCardIds: expect.anything() })
        )
    })

    it('a full Plains: a River card that opens the play only with a Plains card is offered, and the play waits for that card', async () => {
        const { session, draft, sent } = await search({ c1: [WOLVES, TENTS, SONGS] })
        expect(draft.discardFirstOptions).toEqual([WOLVES, TENTS, SONGS, PUB, HALL])

        draft.tapDiscardFirst(PUB)
        expect(draft.discardFirstOptions).toEqual([WOLVES, TENTS, SONGS, PUB])
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(draft.placement).toBeUndefined()
        expect(draft.placementReason).toMatch(/c1 is at its capacity of 3/)
        expect(sent).not.toHaveBeenCalled()

        draft.tapDiscardFirst(SONGS)
        expect(draft.placementReason).toBeUndefined()
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledWith(
            expect.objectContaining({ discardFirstCardIds: [PUB, SONGS] })
        )
        const [choice] = sent.mock.calls[0]
        expect(
            HydratedSearchResolve.reasonCannotResolve(session.gameState, ME, choice)
        ).toBeUndefined()
    })

    it('the Great Slum with Crop Rotation: two cards there, and the third hidden once two are picked', async () => {
        const { draft } = await search({
            site: 'site.great-slums',
            c1: [WOLVES, TENTS, SONGS],
            favor: false
        })
        expect(draft.discardFirstOptions).toEqual([WOLVES, TENTS, SONGS])
        draft.tapDiscardFirst(WOLVES)
        draft.tapDiscardFirst(TENTS)
        expect(draft.discardFirsts).toEqual([WOLVES, TENTS])
        expect(draft.discardFirstOptions).toEqual([WOLVES, TENTS])
    })

    it("on Dana's own view the row is the same", async () => {
        const dana: Visibility.Perspective = { kind: 'player', playerId: ME }
        const state = table(MachineState.Searching)
        const own = await searchOn({ state: served(state, dana), actions: [] })
        const host = await search()
        expect(own.draft.discardFirstOptions).toEqual(host.draft.discardFirstOptions)
        own.draft.tapDiscardFirst(TENTS)
        host.draft.tapDiscardFirst(TENTS)
        expect(own.draft.discardFirstOptions).toEqual(host.draft.discardFirstOptions)
    })
})

describe('the row as before, where one card may go', () => {
    it("the People's Favor alone: one card, and tapping another replaces it", async () => {
        const { draft } = await search({ crop: false })
        expect(draft.discardFirstOptions).toEqual([WOLVES, TENTS, PUB, HALL])
        draft.tapDiscardFirst(TENTS)
        draft.tapDiscardFirst(PUB)
        expect(draft.discardFirsts).toEqual([PUB])
        expect(draft.discardFirstOptions).toEqual([WOLVES, TENTS, PUB, HALL])
    })

    it('before revision 32, with both powers: one card, and tapping another replaces it', async () => {
        const { draft, sent } = await search({ revision: OathRevision.EngineFixes26 })
        expect(draft.discardFirstOptions).toEqual([WOLVES, TENTS, PUB, HALL])
        draft.tapDiscardFirst(TENTS)
        draft.tapDiscardFirst(PUB)
        expect(draft.discardFirsts).toEqual([PUB])
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledWith(expect.objectContaining({ discardFirstCardId: PUB }))
    })
})

describe('the facedown adviser play\'s "Discard first" from revision 32: one card per power', () => {
    async function facedownSitePlay(options: Table = {}) {
        const state = table(MachineState.ActPhase, options)
        const session = await openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        session.chooseAction(ActionType.PlayFacedownAdviser)
        await session.chooseAdviserPlay(ALCHEMIST, SearchPlay.Site)
        const lastSent = () => {
            const action = sent.mock.calls.at(-1)?.[0]
            assert(isPlayFacedownAdviser(action), 'a facedown adviser’s play is sent')
            return action
        }
        return { state, session, sent, lastSent }
    }

    it('the same offers after each pick; the play uses Crop Rotation for the second card and is accepted', async () => {
        const { state, session, lastSent } = await facedownSitePlay()
        expect(session.adviserDiscardFirstOptions).toEqual([WOLVES, TENTS, PUB, HALL])
        session.tapAdviserDiscardFirst(TENTS)
        expect(session.adviserDiscardFirstOptions).toEqual([WOLVES, TENTS, PUB, HALL])
        session.tapAdviserDiscardFirst(PUB)
        expect(session.adviserDiscardFirsts).toEqual([TENTS, PUB])
        expect(session.adviserDiscardFirstOptions).toEqual([TENTS, PUB])
        await session.confirmAdviserPlay()
        const action = lastSent()
        expect(action.discardFirstCardIds).toEqual([TENTS, PUB])
        expect(action.discardFirstCardId).toBeUndefined()
        expect((action.modifiers ?? []).map((m) => m.cardId)).toContain(CROP_ROTATION)
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(state, ME, action)).toBeUndefined()
    })

    it('a full Plains: "Play" waits while only a River card is picked', async () => {
        const { session, sent, lastSent } = await facedownSitePlay({ c1: [WOLVES, TENTS, SONGS] })
        expect(session.adviserDiscardFirstOptions).toEqual([WOLVES, TENTS, SONGS, PUB, HALL])
        session.tapAdviserDiscardFirst(PUB)
        expect(session.adviserPlayComplete).toBe(false)
        await session.confirmAdviserPlay()
        expect(sent).not.toHaveBeenCalled()
        session.tapAdviserDiscardFirst(WOLVES)
        expect(session.adviserPlayComplete).toBe(true)
        await session.confirmAdviserPlay()
        expect(lastSent().discardFirstCardIds).toEqual([PUB, WOLVES])
    })
})

describe('Undo takes back the cards picked to discard first, and nothing before them', () => {
    it('the Search: both picks go, the kept card stays', async () => {
        const { session, draft, sent } = await search()
        draft.tapDiscardFirst(TENTS)
        draft.tapDiscardFirst(PUB)
        await session.undo()
        expect(draft.discardFirsts).toEqual([])
        expect(draft.kept).toBe(ALCHEMIST)
        expect(draft.discardFirstOptions).toEqual([WOLVES, TENTS, PUB, HALL])
        expect(sent).not.toHaveBeenCalled()
    })

    it('the facedown play: both picks go, the play to a site stays chosen', async () => {
        const state = table(MachineState.ActPhase)
        const session = await openSessionOn(tableOf(state))
        vi.spyOn(session, 'applyAction').mockResolvedValue()
        session.chooseAction(ActionType.PlayFacedownAdviser)
        await session.chooseAdviserPlay(ALCHEMIST, SearchPlay.Site)
        session.tapAdviserDiscardFirst(TENTS)
        session.tapAdviserDiscardFirst(PUB)
        await session.undo()
        expect(session.adviserDiscardFirsts).toEqual([])
        expect(session.adviserPlay).toBe(SearchPlay.Site)
        expect(session.adviserDiscardFirstOptions).toEqual([WOLVES, TENTS, PUB, HALL])
    })
})
