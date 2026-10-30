import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import {
    HydratedSearch,
    HydratedSearchResolve,
    MachineState,
    OathRevision,
    PowerTiming,
    Search,
    SearchPlay,
    SearchSource,
    powerIndexOf,
    type HydratedOathGameState
} from '@tabletop/oath'
import { buildAction, openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { emptyPicks } from './powerChoices.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

// Law 5.1.4.II: "If you are playing an adviser that would exceed your adviser limit, you must first discard an
// adviser." From revision 31 Land Warden's second card is offered as an adviser at the limit; after the kept card's
// placement a step of its own picks the adviser that goes, as the kept card's picker does. Law 7.4.3: Land Warden,
// the modifier in use, is not offered.

const ME = 'me'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const LONGBOWS = 'denizen.order.longbows'
const INN = 'denizen.hearth.wayside-inn'
const WRESTLERS = 'denizen.order.wrestlers'
const FABLED_FEAST = 'denizen.hearth.fabled-feast'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

const AT_LIMIT = [LAND_WARDEN, WOLVES, RANGERS]

/** The seat at c1 holds `advisers` faceup (limit 3) and has searched the world deck with Land Warden declared. */
function searched(
    oathRevision: OathRevision,
    { advisers = AT_LIMIT, top = [INN, LONGBOWS, WRESTLERS] } = {}
): HydratedOathGameState {
    const state = testState(
        [
            testPlayer({
                playerId: ME,
                color: Color.Red,
                siteId: 'c1',
                favor: 6,
                secrets: 2,
                supply: 7,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'c2', favor: 2, secrets: 2 })
        ],
        {
            oathRevision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [ME]: 1 } }
        }
    )
    openTurn(state, ME)
    state.requireVault().worldDeck = [...top]
    new HydratedSearch(
        buildAction(Search, {
            playerId: ME,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: [
                {
                    cardId: LAND_WARDEN,
                    powerIndex: powerIndexOf(LAND_WARDEN, PowerTiming.Modifier)
                }
            ]
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

const modesOf = (draft: { secondPlays: { cardId: string; mode: string }[] }, cardId: string) =>
    draft.secondPlays.filter((o) => o.cardId === cardId).map((o) => o.mode)

const keyOf = (faceUp: boolean) => `${LONGBOWS}|${SearchPlay.Adviser}|${faceUp}`

describe("from revision 31, Land Warden's second card as an adviser at the adviser limit", () => {
    it('with the Inn kept, Longbows offers both adviser plays at 3 of 3, as below the limit', async () => {
        const { draft } = await searchDraftOn(searched(FIXED))
        draft.keep(INN)
        expect(modesOf(draft, LONGBOWS)).toEqual([
            'to your site',
            'adviser, faceup',
            'adviser, facedown'
        ])
        const below = await searchDraftOn(searched(FIXED, { advisers: [LAND_WARDEN, WOLVES] }))
        below.draft.keep(INN)
        expect(modesOf(below.draft, LONGBOWS)).toEqual(modesOf(draft, LONGBOWS))
    })

    for (const faceUp of [true, false]) {
        const way = faceUp ? 'faceup' : 'facedown'

        it(`${way}: after the Inn's placement a step of its own asks for 1 adviser, the Wolves or the Rangers, not Land Warden`, async () => {
            const { draft, sent } = await searchDraftOn(searched(FIXED))
            draft.keep(INN)
            draft.setSecondPlay(keyOf(faceUp))
            expect(draft.second?.room).toEqual({
                needed: 1,
                discardable: [WOLVES, RANGERS],
                discards: [[WOLVES], [RANGERS]]
            })
            // The kept card's own picker is not asked: the Inn goes to the site.
            await draft.choosePlacement({ play: SearchPlay.Site })
            expect(draft.needsDisplaced).toBe(false)
            expect(draft.needsSecondDisplaced).toBe(true)
            expect(draft.secondRoom.needed).toBe(1)
            expect(draft.secondDisplaceable).toEqual([WOLVES, RANGERS])
            expect(draft.placed).toBe(false)
            expect(sent).not.toHaveBeenCalled()
        })

        it(`${way}: one tap on the Wolves ends the Search, and the engine accepts what is sent`, async () => {
            const { session, draft, sent } = await searchDraftOn(searched(FIXED))
            draft.keep(INN)
            draft.setSecondPlay(keyOf(faceUp))
            await draft.choosePlacement({ play: SearchPlay.Site })
            await draft.chooseSecondDisplaced(LAND_WARDEN)
            expect(draft.secondDisplaced).toEqual([])
            expect(sent).not.toHaveBeenCalled()
            await draft.chooseSecondDisplaced(WOLVES)
            expect(sent).toHaveBeenCalledTimes(1)
            const [choice] = sent.mock.calls[0]
            expect(choice).toEqual({
                keptCardId: INN,
                discardOrder: [WRESTLERS],
                play: SearchPlay.Site,
                secondPlay: {
                    cardId: LONGBOWS,
                    play: SearchPlay.Adviser,
                    faceUp,
                    discardedAdviserCardIds: [WOLVES]
                }
            })
            expect(
                HydratedSearchResolve.reasonCannotResolve(session.gameState, ME, choice)
            ).toBeUndefined()
        })
    }

    it('Undo from the discard step returns to the placements, with Longbows still picked', async () => {
        const { draft } = await searchDraftOn(searched(FIXED))
        draft.keep(INN)
        draft.setSecondPlay(keyOf(true))
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(draft.needsSecondDisplaced).toBe(true)
        expect(draft.back()).toBe(true)
        expect(draft.placement).toBeUndefined()
        expect(draft.needsSecondDisplaced).toBe(false)
        expect(draft.second?.key).toBe(keyOf(true))
    })

    it('the second card to your site asks no adviser', async () => {
        const { draft, sent } = await searchDraftOn(searched(FIXED))
        draft.keep(INN)
        draft.setSecondPlay(`${LONGBOWS}|${SearchPlay.Site}|`)
        expect(draft.second?.room).toEqual({ needed: 0, discardable: [], discards: [] })
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(draft.needsSecondDisplaced).toBe(false)
        expect(sent).toHaveBeenCalledTimes(1)
        expect(sent.mock.calls[0][0].secondPlay).toEqual({
            cardId: LONGBOWS,
            play: SearchPlay.Site
        })
    })

    it('below the limit the second adviser play asks no adviser and is sent with none', async () => {
        const { draft, sent } = await searchDraftOn(
            searched(FIXED, { advisers: [LAND_WARDEN, WOLVES] })
        )
        draft.keep(INN)
        draft.setSecondPlay(keyOf(true))
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(draft.needsSecondDisplaced).toBe(false)
        expect(sent.mock.calls[0][0].secondPlay).toEqual({
            cardId: LONGBOWS,
            play: SearchPlay.Adviser,
            faceUp: true
        })
    })

    it("the kept card's When Played picks come first, as it is played first; then the second card's adviser", async () => {
        const { session, draft, sent } = await searchDraftOn(
            searched(FIXED, { top: [FABLED_FEAST, LONGBOWS, WRESTLERS] })
        )
        draft.keep(FABLED_FEAST)
        draft.setSecondPlay(keyOf(true))
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(draft.needsWhenPlayed).toBe(true)
        expect(draft.needsSecondDisplaced).toBe(false)
        draft.setPicks({ ...emptyPicks(), option: { 0: 0 } })
        await draft.confirmWhenPlayed()
        expect(draft.needsSecondDisplaced).toBe(true)
        expect(sent).not.toHaveBeenCalled()
        // Undo from the adviser step returns to the When Played step, as Undo from the discard order does.
        expect(draft.back()).toBe(true)
        expect(draft.needsWhenPlayed).toBe(true)
        expect(draft.needsSecondDisplaced).toBe(false)
        draft.setPicks({ ...emptyPicks(), option: { 0: 0 } })
        await draft.confirmWhenPlayed()
        await draft.chooseSecondDisplaced(RANGERS)
        const [choice] = sent.mock.calls[0]
        expect(choice.keptCardId).toBe(FABLED_FEAST)
        expect(choice.secondPlay?.discardedAdviserCardIds).toEqual([RANGERS])
        expect(
            HydratedSearchResolve.reasonCannotResolve(session.gameState, ME, choice)
        ).toBeUndefined()
    })
})

describe('before revision 31 the second card at the limit is offered only to your site, as the engine accepts', () => {
    it('Longbows offers "to your site" alone at 3 of 3', async () => {
        const { draft } = await searchDraftOn(searched(BEFORE))
        draft.keep(INN)
        expect(modesOf(draft, LONGBOWS)).toEqual(['to your site'])
    })

    it('below the limit both adviser plays are offered, as they were', async () => {
        const { draft } = await searchDraftOn(searched(BEFORE, { advisers: [LAND_WARDEN, WOLVES] }))
        draft.keep(INN)
        expect(modesOf(draft, LONGBOWS)).toEqual([
            'to your site',
            'adviser, faceup',
            'adviser, facedown'
        ])
    })
})
