import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert } from '@tabletop/common'
import {
    ActionType,
    HydratedSearch,
    HydratedSearchResolve,
    MachineState,
    OathRevision,
    PowerQuestionKind,
    PowerTiming,
    Search,
    SearchPlay,
    SearchSource,
    isPlayFacedownAdviser,
    powerIndexOf,
    type HydratedOathGameState
} from '@tabletop/oath'
import { buildAction, openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { advisersToDiscardForVision } from './questionChoices.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

// Law 5.1.4.II: "If you are playing an adviser that would exceed your adviser limit, you must first discard an
// adviser." Family Wagon: "You can only have one adviser that is not a nomad." From revision 31 the engine accepts
// only discards that leave the player within their limit once the card is played, so each adviser picker offers
// only those.

const ME = 'me'
const WAGON = 'denizen.nomad.family-wagon'
const TENTS = 'denizen.nomad.tents'
const ELDERS = 'denizen.nomad.elders'
const SCOUTS = 'denizen.order.scouts'
const KEEP = 'denizen.order.keep'
const LONGBOWS = 'denizen.order.longbows'
const WOLVES = 'denizen.beast.wolves'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const INN = 'denizen.hearth.wayside-inn'
const WRESTLERS = 'denizen.order.wrestlers'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

type Row = { cardId: string; faceUp: boolean }
const up = (cardId: string): Row => ({ cardId, faceUp: true })
const down = (cardId: string): Row => ({ cardId, faceUp: false })

/** The seat at c1 holding `advisers` (limit 3), on turn in `machineState`. */
function table(oathRevision: OathRevision, advisers: Row[], machineState: MachineState) {
    const state = testState(
        [
            testPlayer({
                playerId: ME,
                color: Color.Red,
                siteId: 'c1',
                favor: 6,
                secrets: 2,
                supply: 7,
                advisers
            }),
            testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'c2', favor: 2, secrets: 2 })
        ],
        {
            machineState,
            oathRevision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [ME]: 1 } }
        }
    )
    openTurn(state, ME)
    return state
}

/** The seat has searched the world deck, drawing `top`, with `modifiers` declared. */
function searched(
    oathRevision: OathRevision,
    advisers: Row[],
    { top = [WOLVES, WRESTLERS], modifiers = [] }: { top?: string[]; modifiers?: string[] } = {}
): HydratedOathGameState {
    const state = table(oathRevision, advisers, MachineState.ActPhase)
    state.requireVault().worldDeck = [...top]
    new HydratedSearch(
        buildAction(Search, {
            playerId: ME,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: modifiers.map((cardId) => ({
                cardId,
                powerIndex: powerIndexOf(cardId, PowerTiming.Modifier)
            }))
        })
    ).apply(state)
    state.machineState = MachineState.Searching
    return state
}

async function searchDraftOn(state: HydratedOathGameState) {
    const session = await openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'resolveSearch').mockResolvedValue()
    return { session, draft: session.search, sent }
}

const sentChoice = (sent: { mock: { calls: unknown[][] } }) => {
    const [choice] = sent.mock.calls[0]
    return choice
}

describe('the Search picker for the kept card under Family Wagon', () => {
    it('from revision 31 it offers Scouts and the Wagon, not Tents; Scouts is sent and the engine accepts it', async () => {
        const state = searched(FIXED, [up(WAGON), up(SCOUTS), up(TENTS)])
        const { draft, sent } = await searchDraftOn(state)
        draft.keep(WOLVES)
        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
        expect(draft.needsDisplaced).toBe(true)
        expect(draft.displaceable).toEqual([WAGON, SCOUTS])
        await draft.chooseDisplaced(TENTS)
        expect(draft.displaced).toEqual([])
        expect(sent).not.toHaveBeenCalled()
        await draft.chooseDisplaced(SCOUTS)
        expect(sent).toHaveBeenCalledTimes(1)
        const choice = {
            keptCardId: WOLVES,
            discardOrder: [WRESTLERS],
            play: SearchPlay.Adviser,
            faceUp: true,
            discardedAdviserCardIds: [SCOUTS]
        }
        expect(sentChoice(sent)).toEqual(choice)
        expect(HydratedSearchResolve.reasonCannotResolve(state, ME, choice)).toBeUndefined()
    })

    it('before revision 31 it offers Tents too, as the engine accepts it', async () => {
        const state = searched(BEFORE, [up(WAGON), up(SCOUTS), up(TENTS)])
        const { draft, sent } = await searchDraftOn(state)
        draft.keep(WOLVES)
        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
        expect(draft.displaceable).toEqual([WAGON, SCOUTS, TENTS])
        await draft.chooseDisplaced(TENTS)
        expect(sent).toHaveBeenCalledTimes(1)
        expect(sentChoice(sent)).toMatchObject({ discardedAdviserCardIds: [TENTS] })
    })

    it('from revision 31, with no discard that meets the limit, neither adviser play is offered', async () => {
        const advisers = [up(WAGON), up(KEEP), up(TENTS), up(ELDERS)]
        const fixed = await searchDraftOn(searched(FIXED, advisers))
        fixed.draft.keep(WOLVES)
        const adviserPlays = (placements: { play: SearchPlay }[]) =>
            placements.filter((option) => option.play === SearchPlay.Adviser)
        expect(adviserPlays(fixed.draft.placements)).toEqual([])
        expect(fixed.draft.placements.map((option) => option.play)).toContain(SearchPlay.Site)
        const before = await searchDraftOn(searched(BEFORE, advisers))
        before.draft.keep(WOLVES)
        expect(adviserPlays(before.draft.placements)).toHaveLength(2)
    })

    it('two to discard: after Tents only the Wagon completes a discard, and Scouts is not taken', async () => {
        const state = searched(FIXED, [up(WAGON), up(SCOUTS), up(TENTS), down(ELDERS)])
        const { draft, sent } = await searchDraftOn(state)
        draft.keep(WOLVES)
        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
        expect(draft.room.needed).toBe(2)
        expect(draft.displaceable).toEqual([WAGON, SCOUTS, TENTS, ELDERS])
        await draft.chooseDisplaced(TENTS)
        expect(draft.displaceable).toEqual([WAGON, TENTS])
        await draft.chooseDisplaced(SCOUTS)
        expect(draft.displaced).toEqual([TENTS])
        expect(sent).not.toHaveBeenCalled()
        await draft.chooseDisplaced(WAGON)
        expect(sentChoice(sent)).toMatchObject({ discardedAdviserCardIds: [TENTS, WAGON] })
    })

    it('two to discard before revision 31: after Tents every adviser is still offered', async () => {
        const state = searched(BEFORE, [up(WAGON), up(SCOUTS), up(TENTS), down(ELDERS)])
        const { draft, sent } = await searchDraftOn(state)
        draft.keep(WOLVES)
        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
        await draft.chooseDisplaced(TENTS)
        expect(draft.displaceable).toEqual([WAGON, SCOUTS, TENTS, ELDERS])
        await draft.chooseDisplaced(SCOUTS)
        expect(sentChoice(sent)).toMatchObject({ discardedAdviserCardIds: [TENTS, SCOUTS] })
    })
})

describe("the picker for Land Warden's second card under Family Wagon", () => {
    const WARDEN = [up(LAND_WARDEN), up(WAGON), up(TENTS)]
    const wardenSearch = (revision: OathRevision) =>
        searched(revision, WARDEN, { top: [INN, LONGBOWS, WRESTLERS], modifiers: [LAND_WARDEN] })
    const keyOf = (faceUp: boolean) => `${LONGBOWS}|${SearchPlay.Adviser}|${faceUp}`

    for (const faceUp of [true, false]) {
        const way = faceUp ? 'faceup' : 'facedown'

        it(`${way}: from revision 31 only the Wagon is offered: Land Warden is in use and Tents leaves the seat over`, async () => {
            const state = wardenSearch(FIXED)
            const { draft, sent } = await searchDraftOn(state)
            draft.keep(INN)
            draft.setSecondPlay(keyOf(faceUp))
            await draft.choosePlacement({ play: SearchPlay.Site })
            expect(draft.needsSecondDisplaced).toBe(true)
            expect(draft.secondDisplaceable).toEqual([WAGON])
            await draft.chooseSecondDisplaced(TENTS)
            expect(draft.secondDisplaced).toEqual([])
            await draft.chooseSecondDisplaced(WAGON)
            expect(sent).toHaveBeenCalledTimes(1)
            const choice = {
                keptCardId: INN,
                discardOrder: [WRESTLERS],
                play: SearchPlay.Site,
                secondPlay: {
                    cardId: LONGBOWS,
                    play: SearchPlay.Adviser,
                    faceUp,
                    discardedAdviserCardIds: [WAGON]
                }
            }
            expect(sentChoice(sent)).toEqual(choice)
            expect(HydratedSearchResolve.reasonCannotResolve(state, ME, choice)).toBeUndefined()
        })
    }

    it('before revision 31 the second card at the limit is offered only to your site, as before', async () => {
        const { draft } = await searchDraftOn(wardenSearch(BEFORE))
        draft.keep(INN)
        expect(
            draft.secondPlays.filter((option) => option.cardId === LONGBOWS).map((o) => o.mode)
        ).toEqual(['to your site'])
    })
})

describe('the picker for a facedown adviser played faceup under Family Wagon (R-6.1)', () => {
    async function flipping(revision: OathRevision) {
        const state = table(
            revision,
            [down(WOLVES), up(WAGON), up(SCOUTS), up(TENTS)],
            MachineState.ActPhase
        )
        const session = await openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        session.chooseAction(ActionType.PlayFacedownAdviser)
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Adviser)
        const lastSent = () => {
            const action = sent.mock.calls.at(-1)?.[0]
            assert(isPlayFacedownAdviser(action), 'a facedown adviser’s play is sent')
            return action
        }
        return { session, lastSent }
    }

    it('from revision 31 it offers the Wagon and Scouts, not Tents; Scouts is sent', async () => {
        const { session, lastSent } = await flipping(FIXED)
        expect(session.adviserPlayRoom.needed).toBe(1)
        expect(session.adviserPlayDiscardable).toEqual([WAGON, SCOUTS])
        session.toggleAdviserPlayDiscard(TENTS)
        expect(session.adviserPlayDiscards).toEqual([])
        session.toggleAdviserPlayDiscard(SCOUTS)
        await session.confirmAdviserPlay()
        expect(lastSent().discardedAdviserCardIds).toEqual([SCOUTS])
    })

    it('before revision 31 it offers Tents too, and sends it', async () => {
        const { session, lastSent } = await flipping(BEFORE)
        expect(session.adviserPlayDiscardable).toEqual([WAGON, SCOUTS, TENTS])
        session.toggleAdviserPlayDiscard(TENTS)
        await session.confirmAdviserPlay()
        expect(lastSent().discardedAdviserCardIds).toEqual([TENTS])
    })
})

describe("False Prophet's Vision played facedown under Family Wagon", () => {
    const asked = (revision: OathRevision) => {
        const state = table(
            revision,
            [up(WAGON), up(SCOUTS), up(TENTS)],
            MachineState.PowerQuestion
        )
        state.pendingQuestions = {
            askingPlayerId: 'ann',
            resumeMachineState: MachineState.ActPhase,
            queue: [
                {
                    kind: PowerQuestionKind.PlayOrDiscardVision,
                    cardId: 'denizen.discord.false-prophet',
                    askedPlayerId: ME,
                    visionCardId: 'vision.conquest'
                }
            ]
        }
        return state
    }

    it('from revision 31 the Wagon and Scouts are offered, not Tents', () => {
        expect(advisersToDiscardForVision(asked(FIXED), ME)).toEqual([WAGON, SCOUTS])
    })

    it('before revision 31 Tents is offered too', () => {
        expect(advisersToDiscardForVision(asked(BEFORE), ME)).toEqual([WAGON, SCOUTS, TENTS])
    })
})
