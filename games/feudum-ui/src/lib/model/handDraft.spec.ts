import { flushSync } from 'svelte'
import { assertExists } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import {
    ActionCards,
    ActionType,
    HydratedFeudumGameState,
    MachineState,
    type ActionCardKind
} from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeudumHost, settled } from '$lib/testing/sessionHarness.js'
import { sendsOnPress } from './confirmingSend.js'
import { HandDraft, handDraftKey, type HandDraftValues } from './handDraft.svelte.js'
import type { FeudumGameSession } from './session.svelte.js'
import { StagedDraft } from './stagedDraft.svelte.js'

const FourCards: ActionCardKind[] = ['move', 'tax', 'guild', 'explore']
const AllCards = ActionCards.map(({ kind }) => kind)
const FifthCard = AllCards.find((kind) => !FourCards.includes(kind)) ?? 'conquer'

let host: FeudumHost | undefined

async function atHandSelection(numPlayers = 4): Promise<FeudumHost> {
    host = new FeudumHost(numPlayers)
    await host.playStartingGoods()
    await host.playStartingPawns()
    expect(host.state.machineState).toBe(MachineState.SelectingHands)
    return host
}

function draftCards(session: FeudumGameSession, cards: readonly ActionCardKind[]) {
    for (const kind of cards) session.toggleHandCard(kind)
    flushSync()
}

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    host?.close()
    host = undefined
    vi.restoreAllMocks()
})

describe('HandDraft (R-3.1, R-3.3): minimum tests', () => {
    const draft = (key: () => string | undefined = () => 'round-1') => new HandDraft(key)

    it('the one stage has nothing after it: a press keeps what the hand holds', () => {
        const hand = draft()
        hand.toggleCard('move')
        hand.choosePouch('saltpeter')
        hand.toggleCard('tax')
        expect(hand.hand).toEqual({ cards: ['move', 'tax'], pouchGood: 'saltpeter' })
    })

    it('Undo with a manual stage pops the latest press and takes no Action back', () => {
        const hand = draft()
        hand.toggleCard('move')
        hand.choosePouch('sulfur')

        expect(hand.localSelection.undo()).toBe(true)

        expect(hand.hand).toEqual({ cards: ['move'] })
    })

    it('Undo with only an auto stage falls through to the Action undo', () => {
        const hand = draft()
        hand.set('hand', { cards: ['move'] }, 'auto')

        expect(hand.localSelection.hasManual()).toBe(false)
        expect(hand.localSelection.undo()).toBe(false)
        expect(hand.hand).toEqual({ cards: ['move'] })
    })

    it('a stage the order lacks throws', () => {
        expect(() => new StagedDraft<HandDraftValues>([]).set('hand', { cards: [] })).toThrow(
            'does not exist in stage order'
        )
    })

    it('reselecting: a card press toggles, and the chosen pouch good pressed again drops it', () => {
        const hand = draft()
        hand.toggleCard('move')
        hand.toggleCard('move')
        expect(hand.hand.cards).toEqual([])

        hand.choosePouch('saltpeter')
        hand.choosePouch('saltpeter')
        expect(hand.hand.pouchGood).toBeUndefined()
    })

    it('stacked: Undo pops one press at a time, whichever kind it was', () => {
        const hand = draft()
        hand.toggleCard('move')
        hand.choosePouch('saltpeter')
        hand.toggleCard('tax')

        hand.localSelection.undo()
        expect(hand.hand).toEqual({ cards: ['move'], pouchGood: 'saltpeter' })
        hand.localSelection.undo()
        expect(hand.hand).toEqual({ cards: ['move'] })
        hand.localSelection.undo()
        expect(hand.hand).toEqual({ cards: [] })
        expect(hand.hasManual).toBe(false)
    })

    it('"No pouch" with none chosen is no press', () => {
        const hand = draft()
        hand.choosePouch(undefined)
        expect(hand.hasManual).toBe(false)
    })

    it('a draft is read back only under the key it was written with', () => {
        let key: string | undefined = 'round-1'
        const hand = draft(() => key)
        hand.toggleCard('move')

        key = 'round-2'
        expect(hand.hand.cards).toEqual([])
        expect(hand.hasManual).toBe(false)

        key = 'round-1'
        expect(hand.hand.cards).toEqual(['move'])

        key = undefined
        expect(hand.hand.cards).toEqual([])
    })

    it('the key is the round, until the seat finalises', async () => {
        const table = await atHandSelection()
        const [first, second] = table.order
        const state = new HydratedFeudumGameState(table.state)
        expect(handDraftKey(state, first)).toBeDefined()
        expect(handDraftKey(state, undefined)).toBeUndefined()

        await table.send(first, {
            type: ActionType.FinaliseHand,
            revealsInfo: true,
            cards: FourCards
        })
        const after = new HydratedFeudumGameState(table.state)
        expect(handDraftKey(after, first)).toBeUndefined()
        expect(handDraftKey(after, second)).toBe(handDraftKey(state, second))
    })
})

describe('the real session: what the hand draft survives (R-3.1; contract: Hand draft)', () => {
    it("S4 R-3.1-H1: another seat's finalise leaves the draft and ticks the row, its pouch good untold", async () => {
        const table = await atHandSelection()
        const [first, second] = table.order
        const session = await table.openSeat(second)
        draftCards(session, FourCards)
        session.choosePouch('sulfur')
        flushSync()

        expect(session.handPanel?.drafting?.primary).toEqual({
            label: 'Long live the king',
            note: "finalise · can't be undone",
            enabled: true
        })

        await table.send(first, {
            type: ActionType.FinaliseHand,
            revealsInfo: true,
            cards: [...FourCards, FifthCard],
            pouchGood: 'saltpeter'
        })
        flushSync()

        expect(session.hand.hand).toEqual({ cards: FourCards, pouchGood: 'sulfur' })
        expect(session.handPanel?.finaliseRow.find(({ playerId }) => playerId === first)).toEqual({
            playerId: first,
            finalised: true
        })
        expect(session.gameState.getPlayerState(first)).not.toHaveProperty('committedPouch')
        expect(session.handPanel?.drafting?.primary).toEqual({
            label: 'Long live the king',
            note: "finalise · can't be undone",
            enabled: true
        })
    })

    it('S9: a reconciliation leaves the draft', async () => {
        const table = await atHandSelection()
        const [first, second] = table.order
        const session = await table.openSeat(second)
        draftCards(session, FourCards)

        table.sendUnheard(first, {
            type: ActionType.FinaliseHand,
            revealsInfo: true,
            cards: FourCards
        })
        await table.reconcile(second)
        flushSync()

        expect(session.gameState.flow.selection?.finalised).toEqual([first])
        expect(session.hand.hand.cards).toEqual(FourCards)
    })

    it('S9: a new round opens empty', async () => {
        const table = await atHandSelection()
        const session = await table.openSeat(table.order[0])
        draftCards(session, FourCards)
        expect(session.hand.hand.cards).toEqual(FourCards)

        const nextRound = structuredClone(table.state)
        const round = nextRound.roundManager.series.at(-1)
        assertExists(round, 'A round is open')
        round.number += 1
        session.gameState = new HydratedFeudumGameState(nextRound)
        flushSync()

        expect(session.hand.hand.cards).toEqual([])
        expect(session.handPanel?.drafting?.count).toMatch(/^0 of /)
    })

    it('clears on Undo of the Action before it, with nothing left for the round', async () => {
        host = new FeudumHost()
        const table = host
        await table.playStartingGoods()
        await table.playStartingPawns(table.order.length - 1)
        const seat = table.setupSeat
        const session = await table.openSeat(seat)
        await session.pressStartingCharacter('farmer')
        await session.pressStartingSpace('space.desert.3')
        await session.waitForVisibleTransitionSettled()
        expect(session.gameState.machineState).toBe(MachineState.SelectingHands)

        draftCards(session, FourCards)
        await session.undoCommittedAction()
        await session.waitForVisibleTransitionSettled()
        expect(session.gameState.machineState).toBe(MachineState.PlacingStartingPawn)

        await session.pressStartingCharacter('farmer')
        await session.pressStartingSpace('space.desert.3')
        await session.waitForVisibleTransitionSettled()

        expect(session.gameState.machineState).toBe(MachineState.SelectingHands)
        expect(session.hand.hand.cards).toEqual([])
    })

    it('clears on entering History View and does not come back on leaving it', async () => {
        const table = await atHandSelection()
        const session = await table.openSeat(table.order[0])
        draftCards(session, FourCards)

        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        expect(session.handPanel).toBeUndefined()

        session.history.goToEnd()
        await settled(session)

        expect(session.isViewingHistory).toBe(false)
        expect(session.handPanel?.drafting?.count).toMatch(/^0 of /)
        expect(session.hand.hand.cards).toEqual([])
    })

    it('S8: clears on its own send, and Undo is not offered', async () => {
        const table = await atHandSelection()
        const [first, second] = table.order
        const session = await table.openSeat(first)
        const watcher = await table.openSeat(second)
        draftCards(session, FourCards)

        await session.finaliseHand()
        await session.waitForVisibleTransitionSettled()
        flushSync()

        expect(table.sent.get(first)?.[0]).toMatchObject({
            type: ActionType.FinaliseHand,
            revealsInfo: true,
            cards: FourCards
        })
        expect(session.hand.hasManual).toBe(false)
        expect(session.hasLocalSelection).toBe(false)
        expect(session.undoableAction).toBeUndefined()
        expect(session.handPanel?.drafting).toBeUndefined()

        // R-3.1-H1 No hand size is told before every seat has finalised.
        const mine = watcher.gameState.getPlayerState(first)
        expect(mine.handCount).toBe(0)
        expect(mine.hand).toBeUndefined()
    })
})

describe('the real session: the hand panel (R-3.1, R-3.3)', () => {
    it('S5: saltpeter asks a fifth card; five with no pouch are too many; Undo takes a press', async () => {
        const table = await atHandSelection()
        const session = await table.openSeat(table.order[0])

        draftCards(session, FourCards)
        session.choosePouch('saltpeter')
        flushSync()
        expect(session.handPanel?.drafting?.count).toBe('4 of 5')
        expect(session.handPanel?.drafting?.primary.enabled).toBe(false)

        session.toggleHandCard(FifthCard)
        flushSync()
        expect(session.handPanel?.drafting?.count).toBe('5 of 5')
        expect(session.handPanel?.drafting?.primary.enabled).toBe(true)

        session.choosePouch(undefined)
        flushSync()
        expect(session.handPanel?.drafting?.count).toBe('5 of 4')
        expect(session.handPanel?.drafting?.primary.enabled).toBe(false)

        await session.undo()
        flushSync()
        expect(session.hand.hand.pouchGood).toBe('saltpeter')
        await session.undo()
        expect(session.hand.hand.cards).toEqual(FourCards)
    })

    it('S6: barrel-only sulfur is dimmed with its line, and a press does nothing', async () => {
        host = new FeudumHost()
        const table = host
        await table.playStartingGoods(() => ({
            goods: ['saltpeter', 'sulfur', 'iron'],
            sulfurToBarrel: true
        }))
        await table.playStartingPawns()
        const session = await table.openSeat(table.order[0])

        session.choosePouch('sulfur')
        flushSync()

        expect(session.hand.hand.pouchGood).toBeUndefined()
        const row = session.handPanel?.drafting?.pouch.find(({ good }) => good === 'sulfur')
        expect(row?.refusal).toBe("Barrel sulfur can't go in the pouch.")
    })

    it('labels the pouch rows', async () => {
        const table = await atHandSelection()
        const session = await table.openSeat(table.order[0])
        flushSync()
        expect(session.handPanel?.drafting?.pouch.map(({ label }) => label)).toEqual([
            'No pouch',
            'Saltpeter: 5 cards',
            'Sulfur: two cards back to back'
        ])
    })

    it('R-3.1 the plan: each press fills the next slot, the card shows its number, saltpeter opens a fifth', async () => {
        const table = await atHandSelection()
        const [first] = table.order
        table.edit((state) => {
            state.getPlayerState(first).goods.saltpeter = 1
        })
        const session = await table.openSeat(first)
        const drafting = () => session.handPanel?.drafting
        const slotOf = (kind: ActionCardKind) =>
            drafting()?.cards.find((card) => card.kind === kind)?.slot

        expect(drafting()?.slots).toEqual([undefined, undefined, undefined, undefined])
        draftCards(session, ['tax', 'move'])
        expect(drafting()?.slots).toEqual(['tax', 'move', undefined, undefined])
        expect([slotOf('tax'), slotOf('move'), slotOf('guild')]).toEqual([1, 2, undefined])

        session.choosePouch('saltpeter')
        flushSync()
        expect(drafting()?.slots).toHaveLength(5)

        session.toggleHandCard('tax')
        flushSync()
        expect(drafting()?.slots).toEqual(['move', undefined, undefined, undefined, undefined])
        expect(slotOf('move')).toBe(1)
    })

    it('R-3.1 more cards than slots stand in slots of their own, so each can be taken back', async () => {
        const table = await atHandSelection()
        const session = await table.openSeat(table.order[0])
        draftCards(session, [...FourCards, FifthCard])
        expect(session.handPanel?.drafting?.slots).toEqual([...FourCards, FifthCard])
        expect(session.handPanel?.drafting?.count).toBe('5 of 4')
    })

    it('R-3.3 the pouch choices: a short name and what each does', async () => {
        const table = await atHandSelection()
        const session = await table.openSeat(table.order[0])
        flushSync()
        expect(
            session.handPanel?.drafting?.pouch.map(({ title, caption }) => [title, caption])
        ).toEqual([
            ['No pouch', '4 cards'],
            ['+1 card', 'opens a fifth slot'],
            ['2 in a row', 'once this round']
        ])
    })

    it("R-X.2 the send reads Long live the king, its second line that it finalises and can't be undone", async () => {
        const table = await atHandSelection()
        const session = await table.openSeat(table.order[0])
        draftCards(session, FourCards)
        expect(session.handPanel?.drafting?.primary).toEqual({
            label: 'Long live the king',
            note: "finalise · can't be undone",
            enabled: true
        })
    })

    it("R-3.1, R-5.1 a seat's picks reach no other seat, before its finalise or after", async () => {
        const table = await atHandSelection()
        const [first, second] = table.order
        const mine = await table.openSeat(first)
        const theirs = await table.openSeat(second)
        draftCards(mine, FourCards)
        await settled(theirs)
        flushSync()

        const unpicked = () => {
            const drafting = theirs.handPanel?.drafting
            expect(drafting?.cards.every(({ picked, slot }) => !picked && slot === undefined)).toBe(
                true
            )
            expect(drafting?.slots.every((slot) => slot === undefined)).toBe(true)
        }
        unpicked()

        await mine.finaliseHand()
        await settled(theirs)
        flushSync()
        expect(theirs.gameState.getPlayerState(first).hand).toBeUndefined()
        expect(theirs.handPanel?.finaliseRow.find(({ playerId }) => playerId === first)).toEqual({
            playerId: first,
            finalised: true
        })
        unpicked()
    })

    it('S7: the Conquer warning warns and does not disable', async () => {
        const table = await atHandSelection()
        const session = await table.openSeat(table.order[0])
        draftCards(session, ['conquer', 'move', 'tax', 'guild'])

        const drafting = session.handPanel?.drafting
        expect(drafting?.conquerWarning).toBe(
            'Conquer may end up your last card; it would be forfeited.'
        )
        expect(drafting?.primary.enabled).toBe(true)
    })

    it('no card or pouch press sends: the preview reveals, so the send waits for its press', async () => {
        const table = await atHandSelection()
        const [first] = table.order
        const session = await table.openSeat(first)
        draftCards(session, FourCards)

        expect(sendsOnPress(session.hand, { revealsInfo: true })).toBe(false)
        expect(table.sent.get(first)).toBeUndefined()
    })

    it('an illegal hand does not send', async () => {
        const table = await atHandSelection()
        const [first] = table.order
        const session = await table.openSeat(first)
        draftCards(session, FourCards.slice(0, 3))

        await session.finaliseHand()

        expect(table.sent.get(first)).toBeUndefined()
    })

    it('R-3.1-H1 a seat later in turn order may finalise before an earlier one', async () => {
        const table = await atHandSelection()
        const [, second] = table.order
        const session = await table.openSeat(second)
        draftCards(session, FourCards)

        await session.finaliseHand()

        expect(table.sent.get(second)?.[0]).toMatchObject({
            type: ActionType.FinaliseHand,
            cards: FourCards
        })
    })

    it('Undo pops a press and never reaches the Action while one is held', async () => {
        const table = await atHandSelection()
        const session = await table.openSeat(table.order[0])
        const undoAction = vi.spyOn(GameSession.prototype, 'undoCommittedAction')
        draftCards(session, ['move'])

        await session.undo()

        expect(session.hand.hand.cards).toEqual([])
        expect(undoAction).not.toHaveBeenCalled()
    })

    it('a hand or pouch press while viewing History does nothing', async () => {
        const table = await atHandSelection()
        const [first, second, third] = table.order
        const session = await table.openSeat(third)
        draftCards(session, ['move'])
        for (const playerId of [first, second]) {
            await table.send(playerId, {
                type: ActionType.FinaliseHand,
                revealsInfo: true,
                cards: FourCards
            })
        }
        await settled(session)

        // Back to a hand selection this seat hasn't finalised, where it could still draft.
        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        expect(session.gameState.flow.selection?.finalised).toEqual([first])
        const toggleCard = vi.spyOn(session.hand, 'toggleCard')
        const choosePouch = vi.spyOn(session.hand, 'choosePouch')

        session.toggleHandCard('tax')
        session.choosePouch('sulfur')
        flushSync()

        expect(toggleCard).not.toHaveBeenCalled()
        expect(choosePouch).not.toHaveBeenCalled()
        expect(session.hand.hand.cards).not.toContain('tax')
        expect(session.hand.hand.pouchGood).toBeUndefined()
    })

    it('R-3.1-H1 the row lists every seat in turn order and marks none as next', async () => {
        const table = await atHandSelection()
        const session = await table.openSeat(table.order[1])
        flushSync()
        const row = session.handPanel?.finaliseRow
        expect(row?.map(({ playerId }) => playerId)).toEqual(table.order)
        for (const entry of row ?? []) {
            expect(entry).not.toHaveProperty('next')
        }
    })
})
