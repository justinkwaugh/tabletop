import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import { MachineState, PowerQuestionKind, Region, type PowerQuestion } from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const ME = 'me'
const DRAWN = ['denizen.order.longbows', 'denizen.hearth.wayside-inn', 'denizen.beast.wolves']

function asked(question: PowerQuestion, relicIds: string[] = []) {
    const state = testState(
        [
            testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', favor: 4, relicIds }),
            testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'c1', favor: 2 }),
            testPlayer({ playerId: 'bo', color: Color.Yellow, siteId: 'c1', favor: 2 })
        ],
        {
            machineState: MachineState.PowerQuestion,
            pendingQuestions: {
                queue: [question],
                askingPlayerId: ME,
                resumeMachineState: MachineState.ActPhase
            }
        }
    )
    const session = openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'answerQuestion').mockResolvedValue()
    return { session, draft: session.question, sent }
}

const floor = (): PowerQuestion => ({
    kind: PowerQuestionKind.GatheringFloor,
    cardId: 'denizen.nomad.the-gathering',
    askedPlayerId: ME,
    siteId: 'c1'
})

const stack = (): PowerQuestion => ({
    kind: PowerQuestionKind.OrderDrawnCards,
    cardId: 'denizen.nomad.pilgrimage',
    askedPlayerId: ME,
    region: Region.Cradle,
    cardIds: DRAWN
})

/** The five cases `docs/user-interactions.md` requires of each staged flow, for a question's answer. */
describe('the question draft (docs/user-interactions.md)', () => {
    it('choosing the partner clears the terms written for the last one', () => {
        const { draft } = asked(floor())
        draft.chooseFloorWith('ann')
        draft.setFloorTerms({ fromProposer: { favor: 1 } })
        expect(draft.floorTerms).toEqual({ fromProposer: { favor: 1 } })

        draft.chooseFloorWith('bo')
        expect(draft.floorWith).toBe('bo')
        expect(draft.floorTerms).toEqual({})
    })

    it('Back untaps the Pilgrimage stack one card at a time', () => {
        const { session, draft } = asked(stack())
        draft.tapStack(DRAWN[2])
        draft.tapStack(DRAWN[0])
        expect(draft.stackTapped).toEqual([DRAWN[2], DRAWN[0]])

        session.back()
        expect(draft.stackTapped).toEqual([DRAWN[2]])
        session.back()
        expect(draft.stackTapped).toEqual([])
        expect(draft.hasManualSelection()).toBe(false)
    })

    it('an open question is not a pick: before any tap, Back and Undo have nothing to take', () => {
        const { session, draft } = asked(stack())
        expect(draft.isMine).toBe(true)
        expect(draft.hasManualSelection()).toBe(false)
        expect(draft.back()).toBe(false)
        expect(session.hasManualDraft).toBe(false)
    })

    it('a partner not at the site is never chosen', () => {
        const { draft } = asked(floor())
        draft.chooseFloorWith('nobody-here')
        expect(draft.floorWith).toBeUndefined()
        expect(draft.hasManualSelection()).toBe(false)
    })

    it('clearing the partner clears the terms under it', () => {
        const { draft } = asked(floor())
        draft.chooseFloorWith('ann')
        draft.setFloorTerms({ fromProposer: { favor: 1 } })
        draft.chooseFloorWith(undefined)
        expect(draft.floorWith).toBeUndefined()
        expect(draft.floorTerms).toEqual({})
        expect(draft.hasManualSelection()).toBe(false)
    })
})

describe('the question draft builds each answer', () => {
    it('the stack names positions, the last tapped card last', async () => {
        const { draft, sent } = asked(stack())
        draft.tapStack(DRAWN[2])
        draft.tapStack(DRAWN[0])
        expect(draft.stackComplete).toBe(true)
        await draft.stack()
        expect(sent).toHaveBeenCalledWith({ kind: PowerQuestionKind.OrderDrawnCards, order: [2, 0, 1] })
    })

    it('a proposal carries the partner and the terms; passing carries neither', async () => {
        const { draft, sent } = asked(floor())
        expect(draft.acceptBlockedBecause).toBe('choose a player')
        await draft.decline()
        expect(sent).toHaveBeenLastCalledWith({ kind: PowerQuestionKind.GatheringFloor })

        draft.chooseFloorWith('ann')
        draft.setFloorTerms({ fromProposer: { favor: 1 } })
        await draft.accept()
        expect(sent).toHaveBeenLastCalledWith({
            kind: PowerQuestionKind.GatheringFloor,
            proposal: { withPlayerId: 'ann', terms: { fromProposer: { favor: 1 } } }
        })
    })

    it('burning sends the favor chosen, and burning none sends zero', async () => {
        const { draft, sent } = asked({
            kind: PowerQuestionKind.BurnFavorForSecrets,
            cardId: 'denizen.arcane.alchemist',
            askedPlayerId: ME
        })
        draft.setBurn(2)
        await draft.accept()
        expect(sent).toHaveBeenLastCalledWith({ kind: PowerQuestionKind.BurnFavorForSecrets, favor: 2 })
        await draft.decline()
        expect(sent).toHaveBeenLastCalledWith({ kind: PowerQuestionKind.BurnFavorForSecrets, favor: 0 })
    })

    it('Fae Merchant — offers every held relic but the Grand Scepter, and the drawn one unnamed', async () => {
        const CUP = 'relic.cup-of-plenty'
        const { draft, sent } = asked({ kind: PowerQuestionKind.BottomRelic, cardId: 'denizen.beast.fae-merchant', askedPlayerId: ME, relicCardId: 'relic.map' }, [CUP, 'relic.grand-scepter'])
        expect(draft.heldRelicsToBottom).toEqual([CUP])
        await draft.putOnBottom(CUP)
        expect(sent).toHaveBeenLastCalledWith({ kind: PowerQuestionKind.BottomRelic, heldRelicCardId: CUP })
        await draft.putOnBottom()
        expect(sent).toHaveBeenLastCalledWith({ kind: PowerQuestionKind.BottomRelic, heldRelicCardId: undefined })
    })
})

describe('Law Glossary "Discard" — ordering cards that leave play for one pile', () => {
    it('sends the order tapped, the last on top', async () => {
        const { draft, sent } = asked({
            kind: PowerQuestionKind.OrderDiscards,
            cardId: 'denizen.hearth.salt-the-earth',
            askedPlayerId: ME,
            cardIds: DRAWN,
            fromRegion: Region.Cradle
        })
        expect(draft.stackCards).toEqual(DRAWN)
        draft.tapStack(DRAWN[2])
        draft.tapStack(DRAWN[0])
        await draft.stack()
        expect(sent).toHaveBeenCalledWith({ kind: PowerQuestionKind.OrderDiscards, order: [2, 0, 1] })
    })
})
