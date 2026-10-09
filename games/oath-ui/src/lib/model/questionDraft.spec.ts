import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import {
    MachineState,
    PowerQuestionKind,
    Region,
    RerolledRollKind,
    SearchPlay,
    Suit,
    type PowerQuestion
} from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const ME = 'me'
const DRAWN = ['denizen.order.longbows', 'denizen.hearth.wayside-inn', 'denizen.beast.wolves']

type Seat = Partial<Parameters<typeof testPlayer>[0]>

function asked(question: PowerQuestion, relicIds: string[] = [], seats: { me?: Seat; ann?: Seat } = {}) {
    const state = testState(
        [
            testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', favor: 4, relicIds, ...seats.me }),
            testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'c1', favor: 2, ...seats.ann }),
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
    cardCount: DRAWN.length,
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

    it('Undo untaps the Pilgrimage stack one card at a time', async () => {
        const { session, draft } = asked(stack())
        draft.tapStack(DRAWN[2])
        draft.tapStack(DRAWN[0])
        expect(draft.stackTapped).toEqual([DRAWN[2], DRAWN[0]])

        await session.undo()
        expect(draft.stackTapped).toEqual([DRAWN[2]])
        await session.undo()
        expect(draft.stackTapped).toEqual([])
        expect(draft.hasManualSelection()).toBe(false)
    })

    it('an open question is not a pick: before any tap, Undo has nothing to take', () => {
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
        expect(draft.acceptComplete).toBe(false)
        expect(draft.acceptRefusedBecause).toBeUndefined()
        draft.chooseFloorWith('ann')
        expect(draft.acceptComplete).toBe(false)
        draft.chooseFloorWith(undefined)
        await draft.decline()
        expect(sent).toHaveBeenLastCalledWith({ kind: PowerQuestionKind.GatheringFloor })

        draft.chooseFloorWith('ann')
        draft.setFloorTerms({ fromProposer: { favor: 1 } })
        expect(draft.acceptComplete).toBe(true)
        await draft.accept()
        expect(sent).toHaveBeenLastCalledWith({
            kind: PowerQuestionKind.GatheringFloor,
            proposal: { withPlayerId: 'ann', terms: { fromProposer: { favor: 1 } } }
        })
    })

    it('burning starts with no count; it sends the favor chosen, and "None" sends zero', async () => {
        const { draft, sent } = asked({
            kind: PowerQuestionKind.BurnFavorForSecrets,
            cardId: 'denizen.arcane.alchemist',
            askedPlayerId: ME
        })
        expect(draft.burn).toBeUndefined()
        expect(draft.acceptComplete).toBe(false)
        expect(draft.acceptRefusedBecause).toBeUndefined()
        draft.setBurn(2)
        expect(draft.acceptComplete).toBe(true)
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

describe('a yes answer waits for its picks, and is refused only once complete', () => {
    it('Wild Mounts — "Discard instead" waits for a card; no red line before', () => {
        const PLANS = ['denizen.nomad.horse-archers', 'denizen.nomad.lancers']
        const INSTEAD = ['denizen.beast.war-tortoise', 'denizen.beast.wolves']
        const { draft } = asked({
            kind: PowerQuestionKind.DiscardInstead,
            cardId: 'denizen.nomad.wild-mounts',
            askedPlayerId: ME,
            planCardIds: PLANS,
            insteadCardIds: INSTEAD,
            actingPlayerId: ME
        })
        expect(draft.acceptComplete).toBe(false)
        expect(draft.acceptRefusedBecause).toBeUndefined()
        draft.chooseInstead(INSTEAD[0])
        expect(draft.acceptComplete).toBe(true)
    })

    it('Inquisitor — a player picked for the take with no prize leaves "Play it" waiting', () => {
        const ARCANE = ['denizen.arcane.jinx', 'denizen.arcane.tutor']
        const faceup = (cardId: string) => ({ cardId, faceUp: true })
        const { draft } = asked(
            {
                kind: PowerQuestionKind.PlayOrDiscardConspiracy,
                cardId: 'denizen.arcane.inquisitor',
                askedPlayerId: ME,
                holderPlayerId: 'ann',
                index: 0
            },
            [],
            {
                me: { secrets: 2, advisers: ARCANE.map(faceup) },
                ann: { advisers: [faceup('denizen.arcane.alchemist')], relicIds: ['relic.ring-of-devotion'] }
            }
        )
        expect(draft.takeTargets).toEqual(['ann'])
        expect(draft.acceptComplete).toBe(true)

        draft.chooseTakeTarget('ann')
        expect(draft.acceptComplete).toBe(false)
        expect(draft.acceptRefusedBecause).toBeUndefined()

        draft.chooseTakePrize(0)
        expect(draft.acceptComplete).toBe(true)
    })

    it('False Prophet — a refused play is not offered; at the limit "Adviser, facedown" waits for the adviser to discard', () => {
        const HELD = ['denizen.order.messenger', 'denizen.order.longbows', 'denizen.hearth.herald']
        const { draft } = asked(
            {
                kind: PowerQuestionKind.PlayOrDiscardVision,
                cardId: 'denizen.discord.false-prophet',
                askedPlayerId: ME,
                visionCardId: 'vision.conquest'
            },
            [],
            { me: { advisers: HELD.map((cardId) => ({ cardId, faceUp: false })) } }
        )
        expect(draft.visionDiscards).toEqual(HELD)
        expect(draft.visionPlays).not.toContain(SearchPlay.Adviser)
        expect(draft.visionPlays).toContain(SearchPlay.Discard)
        for (const play of draft.visionPlays) expect(draft.visionBlockedBecause(play)).toBeUndefined()

        draft.chooseVisionDiscard(HELD[1])
        expect(draft.visionPlays).toContain(SearchPlay.Adviser)
    })

    it('a question with nothing to pick is complete at once, and carries no cost unless it pays one', () => {
        const { draft } = asked({
            kind: PowerQuestionKind.JoinSite,
            cardId: 'denizen.nomad.the-gathering',
            askedPlayerId: ME,
            siteId: 'c1'
        })
        expect(draft.acceptComplete).toBe(true)
        expect(draft.acceptCost).toBeUndefined()
    })

    it('Jinx and Relic Thief — the yes carries the card’s printed cost', () => {
        const jinx = asked({
            kind: PowerQuestionKind.RerollDice,
            cardId: 'denizen.arcane.jinx',
            askedPlayerId: ME,
            powerIndex: 0,
            roll: { kind: RerolledRollKind.GamblingHall, bank: Suit.Arcane, shields: 1 }
        })
        expect(jinx.draft.acceptCost).toBe('1 secret')
        disposeSessions()
        const thief = asked({
            kind: PowerQuestionKind.RelicThiefRoll,
            cardId: 'denizen.discord.relic-thief',
            askedPlayerId: ME,
            powerIndex: 0,
            takerPlayerId: 'ann',
            relicCardIds: ['relic.ring-of-devotion']
        })
        expect(thief.draft.acceptCost).toBe('1 favor + 1 secret')
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
