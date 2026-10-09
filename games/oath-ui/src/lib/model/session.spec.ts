import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameSession } from '@tabletop/frontend-components'
import { Color, assert } from '@tabletop/common'
import { ActionType, Banner, LetPeekSubjectKind, MachineState, PowerChoiceKind, SearchPlay, isLetPeek, isPlayFacedownAdviser, type LetPeekSubject } from '@tabletop/oath'
import { FIXTURE_SITE_CAPACITY, openTurn, required, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, searchingTable, setupTable, tableOf } from '$lib/testing/sessionHarness.js'
import { emptyPicks } from './powerChoices.js'

// docs/user-interactions.md — Undo unwinds manual picks before any sent action, and nothing is offered from history.
function openSession() {
    return openSessionOn(searchingTable())
}

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

describe('OathGameSession — Undo and the history gate', () => {
    it('opens on the Search the chancellor drew, with nothing picked', () => {
        const session = openSession()
        expect(session.gameState.machineState).toBe(MachineState.Searching)
        expect(session.search.drawn).toHaveLength(3)
        expect(session.hasManualDraft).toBe(false)
    })

    it('Undo with a Search pick on screen steps back through it instead of undoing the Search', async () => {
        const session = openSession()
        const historyUndo = vi.spyOn(GameSession.prototype, 'undo').mockResolvedValue()
        const [first] = session.search.drawn
        session.search.keep(first)
        expect(session.hasManualDraft).toBe(true)

        await session.undo()
        expect(session.search.kept).toBeUndefined()
        expect(historyUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(historyUndo).toHaveBeenCalledTimes(1)
    })

    it('Undo unwinds one pick at a time: the placement, then the kept card', async () => {
        const session = openSession()
        const [first] = session.search.drawn
        session.search.keep(first)
        void session.search.choosePlacement({ play: SearchPlay.Discard })
        expect(session.search.placement).toEqual({ play: SearchPlay.Discard })

        await session.undo()
        expect(session.search.placement).toBeUndefined()
        expect(session.search.kept).toBe(first)

        await session.undo()
        expect(session.search.kept).toBeUndefined()
        expect(session.hasManualDraft).toBe(false)
    })

    it('a pick in the action grid is a draft too, and Undo returns to the grid', async () => {
        const session = openSession()
        const historyUndo = vi.spyOn(GameSession.prototype, 'undo').mockResolvedValue()
        session.chooseAction(ActionType.Travel)
        expect(session.hasManualDraft).toBe(true)
        await session.undo()
        expect(session.selection.action).toBeUndefined()
        expect(historyUndo).not.toHaveBeenCalled()
    })

    it('a new visible state ends every draft before it is published', () => {
        const session = openSession()
        const [first] = session.search.drawn
        session.search.keep(first)
        session.beforeNewState()
        expect(session.search.kept).toBeUndefined()
        expect(session.hasManualDraft).toBe(false)
    })

    it('while the visible state is updating, a draft reads as empty and comes back if nothing replaced it', () => {
        const session = openSession()
        const [first] = session.search.drawn
        session.search.keep(first)
        session.updatingVisibleState = true
        expect(session.search.drawn).toEqual([])
        expect(session.search.kept).toBeUndefined()
        session.updatingVisibleState = false
        expect(session.search.kept).toBe(first)
    })

    it('while an action is being sent, every draft reads as empty and the staged action offers nothing', () => {
        const session = openSession()
        const [first] = session.search.drawn
        session.search.keep(first)
        session.processingActions = true
        expect(session.liveSeatId).toBeUndefined()
        expect(session.search.kept).toBeUndefined()
        session.processingActions = false
        expect(session.search.kept).toBe(first)
    })

    it('with only the auto-staged Setup action left, Undo reverses the last Processed Action', async () => {
        const session = openSessionOn(setupTable())
        const historyUndo = vi.spyOn(GameSession.prototype, 'undo').mockResolvedValue()
        // R-1.23 — the Chancellor's only start is taken for them, so the adviser is the first pick.
        expect(session.setup.siteId).toBeDefined()
        const [adviser] = required(session.myPlayerState?.handIds, 'the hand of the seat on the clock')
        await session.setup.chooseAdviser(adviser)
        expect(session.selection.sourceOf('action')).toBe('auto')

        await session.undo()
        expect(session.setup.adviserCardId).toBeUndefined()
        expect(historyUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(historyUndo).toHaveBeenCalledTimes(1)
        expect(session.selection.action).toBe(ActionType.SetupChoice)
    })

    it('offers nothing and sends nothing while history is on screen', async () => {
        const session = openSession()
        const [first] = session.search.drawn
        vi.spyOn(session, 'isViewingHistory', 'get').mockReturnValue(true)
        expect(session.liveSeatId).toBeUndefined()
        expect(session.search.drawn).toEqual([])
        session.search.keep(first)
        expect(session.hasManualDraft).toBe(false)
        await expect(session.endActPhase()).rejects.toThrow(/never from history/)
    })
})

describe('R-6.1, R-7.3.3 — turning a facedown adviser faceup asks its When Played choices', () => {
    const SALAD_DAYS = 'denizen.hearth.salad-days'

    function flipping() {
        const state = testState(
            [testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', advisers: [{ cardId: SALAD_DAYS, faceUp: false }] })],
            { machineState: MachineState.ActPhase }
        )
        openTurn(state, 'me')
        const session = openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        session.selection.set('action', ActionType.PlayFacedownAdviser)
        return { session, sent }
    }

    it('Salad Days turned faceup waits for three different banks, then sends them', async () => {
        const { session, sent } = flipping()
        const faceup = session.facedownAdviserOptions[0].placements.find((p) => p.play === SearchPlay.Adviser)
        expect(faceup?.blockedBecause).toBeUndefined()

        await session.chooseAdviserPlay(SALAD_DAYS, SearchPlay.Adviser)
        expect(sent).not.toHaveBeenCalled()
        expect(session.adviserPlay).toBe(SearchPlay.Adviser)
        expect(session.adviserPlayChoices).toHaveLength(3)
        expect(session.adviserPlayReason).toMatch(/different/)

        session.setAdviserPlayPicks({ ...emptyPicks(), option: { 0: 0, 1: 1, 2: 2 } })
        expect(session.adviserPlayReason).toBeUndefined()
        await session.confirmAdviserPlay()
        const action = sent.mock.calls[0][0]
        assert(isPlayFacedownAdviser(action), 'the flip is sent')
        const banks = (action.choices ?? []).map((c) => (c.kind === PowerChoiceKind.FavorBank ? c.suit : undefined))
        expect(new Set(banks).size).toBe(3)
    })

    it('a play that shows no card is sent at once', async () => {
        const { session, sent } = flipping()
        await session.chooseAdviserPlay(SALAD_DAYS, SearchPlay.Discard)
        expect(sent).toHaveBeenCalledOnce()
    })
})

describe("R-6.1, R-5.1.4.I — the People's Favor's holder plays a facedown adviser to another site", () => {
    it('stages the site play, offers the region’s sites and a card to discard there, and sends them', async () => {
        const ERRAND_BOY = 'denizen.beast.errand-boy'
        const WAYSIDE_INN = 'denizen.hearth.wayside-inn'
        const full = Array.from({ length: FIXTURE_SITE_CAPACITY - 1 }, (_, i) => `denizen.order.filler-${i}`)
        const state = testState(
            [testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', advisers: [{ cardId: ERRAND_BOY, faceUp: false }] })],
            {
                machineState: MachineState.ActPhase,
                denizensBySite: { c1: [], c2: [WAYSIDE_INN, ...full], p1: [] },
                banners: {
                    [Banner.PeoplesFavor]: { value: 1, mobSide: false, holderPlayerId: 'me' },
                    [Banner.DarkestSecret]: { value: 1 }
                }
            }
        )
        openTurn(state, 'me')
        const session = openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        session.selection.set('action', ActionType.PlayFacedownAdviser)

        await session.chooseAdviserPlay(ERRAND_BOY, SearchPlay.Site)
        expect(sent).not.toHaveBeenCalled()
        expect(session.adviserOtherSites).toContain('c2')
        expect(session.adviserOtherSites).not.toContain('p1')

        session.setAdviserToSite('c2')
        expect(session.adviserPlayReason).toMatch(/at its capacity/)
        session.setAdviserDiscardFirst(WAYSIDE_INN)
        expect(session.adviserPlayReason).toBeUndefined()

        await session.confirmAdviserPlay()
        const action = sent.mock.calls[0][0]
        assert(isPlayFacedownAdviser(action), 'the play is sent')
        expect(action.toSiteId).toBe('c2')
        expect(action.discardFirstCardId).toBe(WAYSIDE_INN)
    })
})

describe('R-6.1, R-5.1.4.IV — turning the Conspiracy faceup offers its take', () => {
    it('waits for the take, then sends it with the play', async () => {
        const state = testState(
            [
                testPlayer({
                    playerId: 'me',
                    color: Color.Red,
                    siteId: 'c1',
                    secrets: 2,
                    advisers: [
                        { cardId: 'vision.conspiracy', faceUp: false },
                        { cardId: 'denizen.hearth.wayside-inn', faceUp: true },
                        { cardId: 'denizen.hearth.awaited-return', faceUp: true }
                    ]
                }),
                testPlayer({
                    playerId: 'ann',
                    color: Color.Blue,
                    siteId: 'c1',
                    relicIds: ['relic.cup-of-plenty'],
                    advisers: [{ cardId: 'denizen.hearth.salad-days', faceUp: true }]
                })
            ],
            { machineState: MachineState.ActPhase }
        )
        openTurn(state, 'me')
        const session = openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        session.selection.set('action', ActionType.PlayFacedownAdviser)
        session.chooseAdviser('vision.conspiracy')

        await session.chooseAdviserPlay('vision.conspiracy', SearchPlay.Conspiracy)
        expect(sent).not.toHaveBeenCalled()
        expect(session.adviserConspiracyTargets).toEqual(['ann'])
        session.setAdviserConspiracyPick({ targetPlayerId: 'ann', prizeIndex: 0 })
        await session.confirmAdviserPlay()
        const action = sent.mock.calls[0][0]
        assert(isPlayFacedownAdviser(action), 'the flip is sent')
        expect(action.conspiracy).toEqual({
            targetPlayerId: 'ann',
            take: { kind: 'relic', cardId: 'relic.cup-of-plenty' }
        })
    })
})

describe('R-6.1, R-7.6.4 — turning a limiter faceup at the limit discards first', () => {
    it('asks which adviser goes, then sends it', async () => {
        const SILVER = 'denizen.discord.silver-tongue'
        const state = testState(
            [
                testPlayer({
                    playerId: 'me',
                    color: Color.Red,
                    siteId: 'c1',
                    advisers: [
                        { cardId: 'denizen.hearth.wayside-inn', faceUp: true },
                        { cardId: 'denizen.nomad.tents', faceUp: true },
                        { cardId: SILVER, faceUp: false }
                    ]
                })
            ],
            { machineState: MachineState.ActPhase }
        )
        openTurn(state, 'me')
        const session = openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        session.selection.set('action', ActionType.PlayFacedownAdviser)
        session.chooseAdviser(SILVER)
        await session.chooseAdviserPlay(SILVER, SearchPlay.Adviser)
        expect(sent).not.toHaveBeenCalled()
        expect(session.adviserPlayRoom.needed).toBe(1)
        expect(session.adviserPlayReason).toMatch(/adviser limit of 2/)
        session.toggleAdviserPlayDiscard('denizen.nomad.tents')
        await session.confirmAdviserPlay()
        const action = sent.mock.calls[0][0]
        assert(isPlayFacedownAdviser(action), 'the flip is sent')
        expect(action.discardedAdviserCardIds).toEqual(['denizen.nomad.tents'])
    })
})

/** Visual contract, "Coexistence" — one let-peek picker; in this seat's Act Phase it is the staged action. */
describe('the let-peek picker beside a staged Act Phase action', () => {
    const TUTOR = 'denizen.arcane.tutor'
    function table(turnPlayerId: string) {
        const state = testState(
            [
                testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', advisers: [{ cardId: TUTOR, faceUp: false }] }),
                testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'c1', advisers: [{ cardId: 'denizen.beast.wolves', faceUp: false }] })
            ],
            { machineState: MachineState.ActPhase }
        )
        openTurn(state, turnPlayerId)
        state.activePlayerIds = [turnPlayerId]
        return openSessionOn(tableOf(state))
    }

    it('in your Act Phase, the seat card stages Let another peek in place of the staged action, and a second press leaves it', () => {
        const session = table('me')
        session.chooseAction(ActionType.Travel)
        expect(session.letPeekIsStaged).toBe(true)

        session.toggleLetPeek()
        expect(session.selection.action).toBe(ActionType.LetPeek)
        expect(session.letPeekOpen).toBe(true)

        session.toggleLetPeek()
        expect(session.selection.action).toBeUndefined()
        expect(session.letPeekOpen).toBe(false)
    })

    it('choosing another action from the grid closes the picker', () => {
        const session = table('me')
        session.toggleLetPeek()
        session.chooseAction(ActionType.Travel)
        expect(session.letPeekOpen).toBe(false)
    })

    it('in your Act Phase, Undo closes the picker, as it puts down any staged action', async () => {
        const session = table('me')
        session.toggleLetPeek()
        expect(session.hasManualDraft).toBe(true)
        await session.undo()
        expect(session.letPeekOpen).toBe(false)
        expect(session.selection.action).toBeUndefined()
    })
})

describe('R-6.1, R-9.4 — letting another player peek', () => {
    it('offers each facedown adviser to each other player, and sends the one chosen', async () => {
        const TUTOR = 'denizen.arcane.tutor'
        const state = testState(
            [
                testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', advisers: [{ cardId: TUTOR, faceUp: false }] }),
                testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'c1' })
            ],
            { machineState: MachineState.ActPhase }
        )
        openTurn(state, 'me')
        const session = openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        session.selection.set('action', ActionType.LetPeek)
        const subject: LetPeekSubject = { kind: LetPeekSubjectKind.Adviser, cardId: TUTOR }
        expect(session.letPeekShows).toEqual([{ subject, toPlayerIds: ['ann'] }])
        await session.letPeek(subject, 'ann')
        const action = sent.mock.calls[0][0]
        assert(isLetPeek(action), 'the peek is sent')
        expect(action.toPlayerId).toBe('ann')
        expect(action.subject).toEqual(subject)
    })

    it('R-9.4 — "at any time": offered from the seat card with no action chosen, sent out of turn, closed by a new state', async () => {
        const TUTOR = 'denizen.arcane.tutor'
        const state = testState(
            [
                testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', advisers: [{ cardId: TUTOR, faceUp: false }] }),
                testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'c1' })
            ],
            { machineState: MachineState.ActPhase }
        )
        openTurn(state, 'me')
        const session = openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        expect(session.selection.action).toBeUndefined()
        expect(session.canLetPeek).toBe(true)
        expect(session.letPeekShows).toHaveLength(1)

        session.toggleLetPeek()
        expect(session.letPeekOpen).toBe(true)
        session.beforeNewState()
        expect(session.letPeekOpen).toBe(false)

        session.toggleLetPeek()
        await session.letPeek({ kind: LetPeekSubjectKind.Adviser, cardId: TUTOR }, 'ann')
        const action = sent.mock.calls[0][0]
        assert(isLetPeek(action), 'the peek is sent')
        expect(action.outOfTurn).toBe(true)
        expect(session.letPeekOpen).toBe(false)
    })
})
