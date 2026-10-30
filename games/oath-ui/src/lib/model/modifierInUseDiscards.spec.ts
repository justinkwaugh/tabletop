import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import {
    Banner,
    HydratedSearch,
    HydratedSearchResolve,
    MachineState,
    OathRevision,
    PowerChoiceKind,
    PowerQuestionKind,
    PowerTiming,
    Search,
    SearchPlay,
    SearchResolve,
    SearchSource,
    powerIndexOf,
    type HydratedOathGameState,
    type ModifierUse
} from '@tabletop/oath'
import { buildAction, openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

// Law 7.4.3: "A modifier cannot be discarded during the major action it is modifying." From revision 31 the
// pickers leave out a modifier the Search uses, as the engine refuses it; before it they offer it, as the engine
// accepts it.

const ME = 'me'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const LONGBOWS = 'denizen.order.longbows'
const INN = 'denizen.hearth.wayside-inn'
const TUTOR = 'denizen.arcane.tutor'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const WELCOMING = 'denizen.hearth.welcoming-party'
const TWIN = 'denizen.nomad.twin-brother'
const WAGON = 'denizen.nomad.family-wagon'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

const use = (cardId: string): ModifierUse => ({
    cardId,
    powerIndex: powerIndexOf(cardId, PowerTiming.Modifier)
})

interface Table {
    advisers: string[]
    modifiers: ModifierUse[]
    top: string[]
    atSite?: string[]
    annAdvisers?: string[]
    table?: Record<string, unknown>
}

/** The seat at c1 has searched the world deck with `modifiers` declared, holding `advisers` faceup (limit 3). */
function searched(oathRevision: OathRevision, t: Table): HydratedOathGameState {
    const state = testState(
        [
            testPlayer({
                playerId: ME,
                color: Color.Red,
                siteId: 'c1',
                favor: 6,
                secrets: 2,
                supply: 7,
                advisers: t.advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                siteId: 'c2',
                favor: 2,
                secrets: 2,
                advisers: (t.annAdvisers ?? []).map((cardId) => ({ cardId, faceUp: true }))
            })
        ],
        {
            oathRevision,
            denizensBySite: { c1: t.atSite ?? [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [ME]: 1 } },
            ...t.table
        }
    )
    openTurn(state, ME)
    state.requireVault().worldDeck = [...t.top]
    new HydratedSearch(
        buildAction(Search, {
            playerId: ME,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: t.modifiers
        })
    ).apply(state)
    // R-5.1.3 — the drawn cards wait to be kept, as the turn's handler leaves the table after a Search.
    state.machineState = MachineState.Searching
    return state
}

async function searchDraftOn(state: HydratedOathGameState) {
    const session = await openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'resolveSearch').mockResolvedValue()
    return { session, draft: session.search, sent }
}

describe('the adviser-limit picker of a Search play leaves out a modifier in use', () => {
    const WARDEN: Table = {
        advisers: [LAND_WARDEN, WOLVES, RANGERS],
        modifiers: [use(LAND_WARDEN)],
        // Two cards drawn, so the one not kept needs no discard order before the play is sent.
        top: [LONGBOWS, INN]
    }

    it('from revision 31, Longbows kept faceup offers the Wolves and the Rangers, not Land Warden; the pick is accepted', async () => {
        const { session, draft, sent } = await searchDraftOn(searched(FIXED, WARDEN))
        draft.keep(LONGBOWS)
        const faceup = draft.placements.find((o) => o.play === SearchPlay.Adviser && o.faceUp)
        expect(faceup?.room).toEqual({ needed: 1, discardable: [WOLVES, RANGERS] })
        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
        await draft.chooseDisplaced(LAND_WARDEN)
        expect(sent).not.toHaveBeenCalled()
        await draft.chooseDisplaced(WOLVES)
        expect(sent).toHaveBeenCalledWith(
            expect.objectContaining({ keptCardId: LONGBOWS, discardedAdviserCardIds: [WOLVES] })
        )
        const [choice] = sent.mock.calls[0]
        expect(
            HydratedSearchResolve.reasonCannotResolve(session.gameState, ME, choice)
        ).toBeUndefined()
    })

    it('before revision 31, Land Warden is offered too, as the engine accepts it', async () => {
        const { draft } = await searchDraftOn(searched(BEFORE, WARDEN))
        draft.keep(LONGBOWS)
        const faceup = draft.placements.find((o) => o.play === SearchPlay.Adviser && o.faceUp)
        expect(faceup?.room).toEqual({ needed: 1, discardable: [LAND_WARDEN, WOLVES, RANGERS] })
    })
})

describe('the discard-first picker of a site play leaves out a site modifier in use', () => {
    const scenes: [string, Table][] = [
        [
            'Crop Rotation',
            {
                advisers: [CROP_ROTATION],
                modifiers: [use(CROP_ROTATION), use(WELCOMING)],
                top: [INN, LONGBOWS, TUTOR],
                atSite: [WELCOMING, WOLVES, RANGERS]
            }
        ],
        [
            "the People's Favor",
            {
                advisers: [],
                modifiers: [use(WELCOMING)],
                top: [INN, LONGBOWS, TUTOR],
                atSite: [WELCOMING, WOLVES, RANGERS],
                table: {
                    banners: {
                        [Banner.PeoplesFavor]: { value: 1, mobSide: false, holderPlayerId: ME },
                        [Banner.DarkestSecret]: { value: 1 }
                    }
                }
            }
        ],
        [
            'the Great Slum',
            {
                advisers: [],
                modifiers: [use(WELCOMING)],
                top: [INN, LONGBOWS, TUTOR],
                atSite: [WELCOMING, WOLVES, RANGERS],
                table: {
                    siteCards: {
                        c1: 'site.great-slums',
                        c2: 'site.river',
                        p1: 'site.marshes',
                        h1: 'site.mountain'
                    }
                }
            }
        ]
    ]
    for (const [scene, t] of scenes) {
        it(`from revision 31, ${scene}: the Inn's discard-first rows leave out Welcoming Party`, async () => {
            const { draft } = await searchDraftOn(searched(FIXED, t))
            draft.keep(INN)
            expect(draft.discardFirstOptions).toContain(WOLVES)
            expect(draft.discardFirstOptions).not.toContain(WELCOMING)
            draft.setDiscardFirst(WELCOMING)
            expect(draft.discardFirst).toBeUndefined()
        })

        it(`before revision 31, ${scene}: Welcoming Party is offered to discard first`, async () => {
            const { draft } = await searchDraftOn(searched(BEFORE, t))
            draft.keep(INN)
            expect(draft.discardFirstOptions).toEqual(expect.arrayContaining([WELCOMING, WOLVES]))
        })
    }
})

describe("the discard question after Twin Brother's swap leaves out a modifier in use", () => {
    /** The seat kept Twin Brother faceup and swapped it for Ann's Family Wagon, the Inn played second. */
    async function swapped(oathRevision: OathRevision) {
        const state = searched(oathRevision, {
            advisers: [LAND_WARDEN, WOLVES],
            modifiers: [use(LAND_WARDEN)],
            top: [TWIN, INN, TUTOR],
            annAdvisers: [WAGON]
        })
        new HydratedSearchResolve(
            buildAction(SearchResolve, {
                playerId: ME,
                keptCardId: TWIN,
                discardOrder: [TUTOR],
                play: SearchPlay.Adviser,
                faceUp: true,
                choices: [{ kind: PowerChoiceKind.Card, cardId: WAGON }],
                secondPlay: { cardId: INN, play: SearchPlay.Site }
            })
        ).apply(state)
        expect(state.pendingQuestions?.queue[0]?.kind).toBe(PowerQuestionKind.DiscardAdvisers)
        state.machineState = MachineState.PowerQuestion
        const session = await openSessionOn(tableOf(state))
        return session.question
    }

    it('from revision 31, only the Wolves are offered', async () => {
        const draft = await swapped(FIXED)
        expect(draft.adviserDiscardCount).toBe(1)
        expect(draft.adviserDiscardChoices).toEqual([WOLVES])
        draft.toggleAdviserDiscard(LAND_WARDEN)
        expect(draft.adviserDiscards).toEqual([])
    })

    it('before revision 31, Land Warden is offered too', async () => {
        const draft = await swapped(BEFORE)
        expect(draft.adviserDiscardChoices).toEqual([LAND_WARDEN, WOLVES])
    })
})
