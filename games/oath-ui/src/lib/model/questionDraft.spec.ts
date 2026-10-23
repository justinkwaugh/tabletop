import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import {
    ActionType,
    MachineState,
    PowerQuestionKind,
    Region,
    RerolledRollKind,
    SearchPlay,
    Suit,
    type ConspiracyPlay,
    type PowerQuestion,
    type QuestionAnswer
} from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { noExchangePicks } from './exchangeTerms.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const ME = 'me'
const DRAWN = ['denizen.order.longbows', 'denizen.hearth.wayside-inn', 'denizen.beast.wolves']

type Seat = Partial<Parameters<typeof testPlayer>[0]>
type WarbandsBySite = NonNullable<Parameters<typeof testState>[1]>['warbandsBySite']

async function asked(
    question: PowerQuestion,
    relicIds: string[] = [],
    seats: { me?: Seat; ann?: Seat } = {},
    warbandsBySite: WarbandsBySite = {}
) {
    const state = testState(
        [
            testPlayer({
                playerId: ME,
                color: Color.Red,
                siteId: 'c1',
                favor: 4,
                relicIds,
                ...seats.me
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                siteId: 'c1',
                favor: 2,
                ...seats.ann
            }),
            testPlayer({ playerId: 'bo', color: Color.Yellow, siteId: 'c1', favor: 2 })
        ],
        {
            machineState: MachineState.PowerQuestion,
            warbandsBySite,
            pendingQuestions: {
                queue: [question],
                askingPlayerId: ME,
                resumeMachineState: MachineState.ActPhase
            }
        }
    )
    const session = await openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'answerQuestion').mockResolvedValue()
    return { session, draft: session.question, sent }
}

const favorOne = { terms: { fromProposer: { favor: 1 } }, uncountedSiteIds: [] }

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
    it('choosing the partner clears the terms written for the last one', async () => {
        const { draft } = await asked(floor())
        draft.chooseFloorWith('ann')
        draft.setFloorTerms(favorOne)
        expect(draft.floorTerms).toEqual(favorOne)

        draft.chooseFloorWith('bo')
        expect(draft.floorWith).toBe('bo')
        expect(draft.floorTerms).toEqual(noExchangePicks())
    })

    it('Undo untaps the Pilgrimage stack one card at a time', async () => {
        const { session, draft } = await asked(stack())
        draft.tapStack(DRAWN[2])
        draft.tapStack(DRAWN[0])
        expect(draft.stackTapped).toEqual([DRAWN[2], DRAWN[0]])

        await session.undo()
        expect(draft.stackTapped).toEqual([DRAWN[2]])
        await session.undo()
        expect(draft.stackTapped).toEqual([])
        expect(draft.hasManualSelection()).toBe(false)
    })

    it('an open question is not a pick: before any tap, Undo has nothing to take', async () => {
        const { session, draft } = await asked(stack())
        expect(draft.isMine).toBe(true)
        expect(draft.hasManualSelection()).toBe(false)
        expect(draft.back()).toBe(false)
        expect(session.hasManualDraft).toBe(false)
    })

    it('a partner not at the site is never chosen', async () => {
        const { draft } = await asked(floor())
        draft.chooseFloorWith('nobody-here')
        expect(draft.floorWith).toBeUndefined()
        expect(draft.hasManualSelection()).toBe(false)
    })

    it('clearing the partner clears the terms under it', async () => {
        const { draft } = await asked(floor())
        draft.chooseFloorWith('ann')
        draft.setFloorTerms(favorOne)
        draft.chooseFloorWith(undefined)
        expect(draft.floorWith).toBeUndefined()
        expect(draft.floorTerms).toEqual(noExchangePicks())
        expect(draft.hasManualSelection()).toBe(false)
    })
})

describe('the question draft builds each answer', () => {
    it('the stack names positions, the last tapped card last', async () => {
        const { draft, sent } = await asked(stack())
        draft.tapStack(DRAWN[2])
        draft.tapStack(DRAWN[0])
        expect(draft.stackComplete).toBe(true)
        await draft.stack()
        expect(sent).toHaveBeenCalledWith({
            kind: PowerQuestionKind.OrderDrawnCards,
            order: [2, 0, 1]
        })
    })

    it('a proposal carries the partner and the terms; passing carries neither', async () => {
        const { draft, sent } = await asked(floor())
        expect(draft.acceptComplete).toBe(false)
        expect(draft.acceptRefusedBecause).toBeUndefined()
        draft.chooseFloorWith('ann')
        expect(draft.acceptComplete).toBe(false)
        draft.chooseFloorWith(undefined)
        await draft.decline()
        expect(sent).toHaveBeenLastCalledWith({ kind: PowerQuestionKind.GatheringFloor })

        draft.chooseFloorWith('ann')
        draft.setFloorTerms({ ...favorOne, uncountedSiteIds: ['c1'] })
        expect(draft.acceptComplete).toBe(false)
        expect(draft.acceptRefusedBecause).toBeUndefined()
        draft.setFloorTerms(favorOne)
        expect(draft.acceptComplete).toBe(true)
        await draft.accept()
        expect(sent).toHaveBeenLastCalledWith({
            kind: PowerQuestionKind.GatheringFloor,
            proposal: { withPlayerId: 'ann', terms: { fromProposer: { favor: 1 } } }
        })
    })

    it('burning starts with no count; it sends the favor chosen, and "None" sends zero', async () => {
        const { draft, sent } = await asked({
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
        expect(sent).toHaveBeenLastCalledWith({
            kind: PowerQuestionKind.BurnFavorForSecrets,
            favor: 2
        })
        await draft.decline()
        expect(sent).toHaveBeenLastCalledWith({
            kind: PowerQuestionKind.BurnFavorForSecrets,
            favor: 0
        })
    })

    it('burning: a count of 0 (a tap on the favor at the count) picks none again, and "Burn" waits', async () => {
        const { draft } = await asked({
            kind: PowerQuestionKind.BurnFavorForSecrets,
            cardId: 'denizen.arcane.alchemist',
            askedPlayerId: ME
        })
        draft.setBurn(2)
        expect(draft.burn).toBe(2)
        draft.setBurn(0)
        expect(draft.burn).toBeUndefined()
        expect(draft.acceptComplete).toBe(false)
    })

    // Vow of Kinship — what the board left owing, from its bank only as the player chooses (R-10.10-H1).
    describe('Plague Engines asks the Vow of Kinship holder how many to pay from the Nomad bank', () => {
        const pay = (owed: number): PowerQuestion => ({
            kind: PowerQuestionKind.PayFromHomeBank,
            cardId: 'denizen.arcane.plague-engines',
            askedPlayerId: ME,
            owed,
            toBank: Suit.Arcane
        })
        const holder = {
            me: { favor: 0, advisers: [{ cardId: 'denizen.nomad.vow-of-kinship', faceUp: true }] }
        }

        it('offers the payable pieces, none picked; "Pay" waits for a count, and "None" sends 0', async () => {
            const { draft, sent } = await asked(pay(2), [], holder)
            expect(draft.homeBank).toEqual({ suit: Suit.Nomad, payable: 2 })
            expect(draft.homeBankPay).toBeUndefined()
            expect(draft.acceptComplete).toBe(false)
            draft.setHomeBankPay(2)
            expect(draft.acceptComplete).toBe(true)
            expect(draft.acceptRefusedBecause).toBeUndefined()
            await draft.accept()
            expect(sent).toHaveBeenLastCalledWith({
                kind: PowerQuestionKind.PayFromHomeBank,
                favor: 2
            })
            await draft.decline()
            expect(sent).toHaveBeenLastCalledWith({
                kind: PowerQuestionKind.PayFromHomeBank,
                favor: 0
            })
        })

        it('a count of 0 picks none again; the pieces stop at what the bank holds', async () => {
            const { draft } = await asked(pay(5), [], holder)
            expect(draft.homeBank).toEqual({ suit: Suit.Nomad, payable: 3 })
            draft.setHomeBankPay(1)
            expect(draft.homeBankPay).toBe(1)
            draft.setHomeBankPay(0)
            expect(draft.homeBankPay).toBeUndefined()
            expect(draft.acceptComplete).toBe(false)
        })
    })

    it('Fae Merchant — offers every held relic but the Grand Scepter, and the drawn one unnamed', async () => {
        const CUP = 'relic.cup-of-plenty'
        const { draft, sent } = await asked(
            {
                kind: PowerQuestionKind.BottomRelic,
                cardId: 'denizen.beast.fae-merchant',
                askedPlayerId: ME,
                relicCardId: 'relic.map'
            },
            [CUP, 'relic.grand-scepter']
        )
        expect(draft.heldRelicsToBottom).toEqual([CUP])
        await draft.putOnBottom(CUP)
        expect(sent).toHaveBeenLastCalledWith({
            kind: PowerQuestionKind.BottomRelic,
            heldRelicCardId: CUP
        })
        await draft.putOnBottom()
        expect(sent).toHaveBeenLastCalledWith({
            kind: PowerQuestionKind.BottomRelic,
            heldRelicCardId: undefined
        })
    })
})

describe('a yes answer waits for its picks, and is refused only once complete', () => {
    it('Wild Mounts — "Discard instead" waits for a card; no red line before', async () => {
        const PLANS = ['denizen.nomad.horse-archers', 'denizen.nomad.lancers']
        const INSTEAD = ['denizen.beast.war-tortoise', 'denizen.beast.wolves']
        const { draft } = await asked({
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

    it('False Prophet — a refused play is not offered; at the limit "Adviser, facedown" waits for the adviser to discard', async () => {
        const HELD = ['denizen.order.messenger', 'denizen.order.longbows', 'denizen.hearth.herald']
        const { draft } = await asked(
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
        for (const play of draft.visionPlays)
            expect(draft.visionBlockedBecause(play)).toBeUndefined()

        draft.chooseVisionDiscard(HELD[1])
        expect(draft.visionPlays).toContain(SearchPlay.Adviser)
    })

    it('a question with nothing to pick is complete at once, and carries no cost unless it pays one', async () => {
        const { draft } = await asked({
            kind: PowerQuestionKind.JoinSite,
            cardId: 'denizen.nomad.the-gathering',
            askedPlayerId: ME,
            siteId: 'c1'
        })
        expect(draft.acceptComplete).toBe(true)
        expect(draft.acceptCost).toBeUndefined()
    })

    it('Jinx and Relic Thief — the yes carries the card’s printed cost', async () => {
        const jinx = await asked({
            kind: PowerQuestionKind.RerollDice,
            cardId: 'denizen.arcane.jinx',
            askedPlayerId: ME,
            powerIndex: 0,
            roll: { kind: RerolledRollKind.GamblingHall, bank: Suit.Arcane, shields: 1 }
        })
        expect(jinx.draft.acceptCost).toBe('1 secret')
        disposeSessions()
        const thief = await asked({
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

// R-5.1.4-H1 — Inquisitor's finder plays the Conspiracy faceup (with the take), facedown as an adviser, or discards it.
describe('Inquisitor — the Conspiracy: three answers, each pick after the answer that needs it', () => {
    const ARCANE = ['denizen.arcane.jinx', 'denizen.arcane.tutor']
    const FULL = [...ARCANE, 'denizen.hearth.herald']
    const RING = 'relic.ring-of-devotion'
    const faceup = (cardId: string) => ({ cardId, faceUp: true })
    const inquisitor: PowerQuestion = {
        kind: PowerQuestionKind.PlayOrDiscardConspiracy,
        cardId: 'denizen.arcane.inquisitor',
        askedPlayerId: ME,
        holderPlayerId: 'ann',
        index: 0
    }
    const answer = (fields: {
        play: boolean
        facedown?: true
        discardedAdviserCardId?: string
        conspiracy?: ConspiracyPlay
    }): QuestionAnswer => ({ kind: PowerQuestionKind.PlayOrDiscardConspiracy, ...fields })
    async function found(advisers: string[], ann: Seat = {}) {
        return await asked(inquisitor, [], {
            me: { secrets: 2, advisers: advisers.map(faceup) },
            ann: {
                advisers: [
                    { cardId: 'vision.conspiracy', faceUp: false },
                    faceup('denizen.arcane.alchemist')
                ],
                ...ann
            }
        })
    }

    it('offers "Adviser, facedown", "Play it" and "Discard", in the Search\'s order; "Discard" sends at once', async () => {
        const { draft, sent } = await found(ARCANE)
        expect(draft.conspiracyPlays).toEqual([
            SearchPlay.Adviser,
            SearchPlay.Conspiracy,
            SearchPlay.Discard
        ])
        expect(draft.conspiracyStep).toBeUndefined()
        await draft.chooseConspiracyPlay(SearchPlay.Discard)
        expect(sent).toHaveBeenLastCalledWith(answer({ play: false }))
    })

    it('"Play it" with no one to take from opens the take step, which says why per player; "Play" takes nothing', async () => {
        const { session, draft, sent } = await found(ARCANE)
        expect(draft.takeTargets).toEqual([])
        await draft.chooseConspiracyPlay(SearchPlay.Conspiracy)
        expect(sent).not.toHaveBeenCalled()
        expect(draft.conspiracyStep).toBe(SearchPlay.Conspiracy)
        expect(draft.takeNoTake).toEqual([
            {
                kind: 'words',
                parts: [
                    { kind: 'seat', playerId: 'ann', possessive: false },
                    { kind: 'text', text: ' holds no relic or banner.' }
                ]
            },
            {
                kind: 'words',
                parts: [
                    { kind: 'text', text: 'Needs 2 advisers matching ' },
                    { kind: 'seat', playerId: 'bo', possessive: true },
                    { kind: 'text', text: '; you have 0.' }
                ]
            }
        ])
        expect(draft.conspiracyStepComplete).toBe(true)
        expect(draft.conspiracyRefusedBecause).toBeUndefined()
        await draft.playConspiracy()
        expect(sent).toHaveBeenLastCalledWith(answer({ play: true }))

        await session.undo()
        expect(draft.conspiracyStep).toBeUndefined()
    })

    it('"Adviser, facedown" under the limit sends at once', async () => {
        const { draft, sent } = await found(ARCANE)
        await draft.chooseConspiracyPlay(SearchPlay.Adviser)
        expect(sent).toHaveBeenLastCalledWith(answer({ play: true, facedown: true }))
        expect(draft.hasManualSelection()).toBe(false)
    })

    it('a player the take can reach is a chip, and no line is said', async () => {
        const { draft } = await found(ARCANE, { relicIds: [RING] })
        expect(draft.takeTargets).toEqual(['ann'])
        expect(draft.takeNoTake).toEqual([])
    })

    it('"Play it" opens the take: nobody picked plays, a player with no prize waits, Undo returns to the answers', async () => {
        const { session, draft, sent } = await found(ARCANE, { relicIds: [RING] })
        await draft.chooseConspiracyPlay(SearchPlay.Conspiracy)
        expect(sent).not.toHaveBeenCalled()
        expect(draft.conspiracyStep).toBe(SearchPlay.Conspiracy)
        expect(draft.conspiracyStepComplete).toBe(true)

        draft.chooseTakeTarget('ann')
        expect(draft.conspiracyStepComplete).toBe(false)
        expect(draft.conspiracyRefusedBecause).toBeUndefined()
        draft.chooseTakePrize(0)
        expect(draft.conspiracyStepComplete).toBe(true)
        expect(draft.conspiracyRefusedBecause).toBeUndefined()
        await draft.playConspiracy()
        expect(sent).toHaveBeenLastCalledWith(
            answer({
                play: true,
                conspiracy: { targetPlayerId: 'ann', take: { kind: 'relic', cardId: RING } }
            })
        )

        await session.undo()
        await session.undo()
        await session.undo()
        expect(draft.conspiracyStep).toBeUndefined()
        expect(session.hasManualDraft).toBe(false)
    })

    it('at the adviser limit "Adviser, facedown" opens the discard; "Play" once one is picked sends it', async () => {
        const { session, draft, sent } = await found(FULL)
        expect(draft.conspiracyPlays).toContain(SearchPlay.Adviser)
        await draft.chooseConspiracyPlay(SearchPlay.Adviser)
        expect(sent).not.toHaveBeenCalled()
        expect(draft.conspiracyStep).toBe(SearchPlay.Adviser)
        expect(draft.conspiracyDiscards).toEqual(FULL)
        expect(draft.conspiracyStepComplete).toBe(false)

        draft.chooseConspiracyDiscard(FULL[1])
        expect(draft.conspiracyStepComplete).toBe(true)
        expect(draft.conspiracyRefusedBecause).toBeUndefined()
        await draft.playConspiracy()
        expect(sent).toHaveBeenLastCalledWith(
            answer({ play: true, facedown: true, discardedAdviserCardId: FULL[1] })
        )

        await session.undo()
        expect(draft.conspiracyDiscard).toBeUndefined()
        expect(draft.conspiracyStep).toBe(SearchPlay.Adviser)
        await session.undo()
        expect(draft.conspiracyStep).toBeUndefined()
    })

    it('a play the engine refuses is not offered: Gossip hides "Adviser, facedown"', async () => {
        const { draft } = await asked(inquisitor, [], {
            me: { advisers: ARCANE.map(faceup) },
            ann: {
                advisers: [
                    { cardId: 'vision.conspiracy', faceUp: false },
                    faceup('denizen.discord.gossip')
                ]
            }
        })
        expect(draft.conspiracyPlays).toEqual([SearchPlay.Conspiracy, SearchPlay.Discard])
    })
})

describe('Law Glossary "Discard" — ordering cards that leave play for one pile', () => {
    it('sends the order tapped, the last on top', async () => {
        const { draft, sent } = await asked({
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
        expect(sent).toHaveBeenCalledWith({
            kind: PowerQuestionKind.OrderDiscards,
            order: [2, 0, 1]
        })
    })
})

/** Enchantress's Q&A (revision 11) — a swap left the player over the limit: discard down, never the card received. */
describe('discarding down to the adviser limit after a swap', () => {
    const ENCHANTRESS = 'denizen.discord.enchantress'
    const WAGON = 'denizen.nomad.family-wagon'
    const TENTS = 'denizen.nomad.tents'
    const over = async (advisers: string[], count = 1, received = [ENCHANTRESS]) =>
        await asked(
            {
                kind: PowerQuestionKind.DiscardAdvisers,
                cardId: ENCHANTRESS,
                askedPlayerId: ME,
                actingPlayerId: 'ann',
                count,
                receivedCardIds: received,
                receivedFacedownCardIds: []
            },
            [],
            { me: { advisers: advisers.map((cardId) => ({ cardId, faceUp: true })) } }
        )

    it('offers every adviser but the one received; "Discard" waits for the pick and sends it', async () => {
        const { draft, sent } = await over([...DRAWN, ENCHANTRESS])
        expect(draft.adviserDiscardChoices).toEqual(DRAWN)
        expect(draft.adviserDiscardsComplete).toBe(false)
        expect(draft.adviserDiscardsBlockedBecause).toBeUndefined()
        draft.toggleAdviserDiscard(ENCHANTRESS)
        expect(draft.adviserDiscards).toEqual([])
        draft.toggleAdviserDiscard(DRAWN[0])
        // One to discard: a second tap moves the pick.
        draft.toggleAdviserDiscard(DRAWN[2])
        expect(draft.adviserDiscards).toEqual([DRAWN[2]])
        expect(draft.adviserDiscardsComplete).toBe(true)
        await draft.discardAdvisers()
        expect(sent).toHaveBeenCalledWith({
            kind: PowerQuestionKind.DiscardAdvisers,
            discardedAdviserCardIds: [DRAWN[2]]
        })
    })

    it('a tap on the pick takes it back, and Undo has nothing more to take', async () => {
        const { draft } = await over([...DRAWN, ENCHANTRESS])
        draft.toggleAdviserDiscard(DRAWN[1])
        draft.toggleAdviserDiscard(DRAWN[1])
        expect(draft.adviserDiscards).toEqual([])
        expect(draft.hasManualSelection()).toBe(false)
        draft.toggleAdviserDiscard(DRAWN[1])
        expect(draft.back()).toBe(true)
        expect(draft.adviserDiscards).toEqual([])
    })

    it('under Family Wagon a Nomad is not offered, since it would leave the player over', async () => {
        const { draft } = await over([WAGON, TENTS, DRAWN[0], DRAWN[1]], 1, [DRAWN[1]])
        expect(draft.adviserDiscardChoices).toEqual([WAGON, DRAWN[0]])
    })

    it('under Family Wagon with a locked non-Nomad, the Wagon goes first and then a Nomad it no longer exempts', async () => {
        const FALSE_PROPHET = 'denizen.discord.false-prophet'
        const ELDERS = 'denizen.nomad.elders'
        const STEED = 'denizen.nomad.a-fast-steed'
        const SCOUTS = 'denizen.order.scouts'
        const { draft, sent } = await over([WAGON, FALSE_PROPHET, ELDERS, STEED, SCOUTS], 2, [
            SCOUTS
        ])
        expect(draft.adviserDiscardCount).toBe(2)
        expect(draft.adviserDiscardChoices).toEqual([WAGON])
        draft.toggleAdviserDiscard(ELDERS)
        expect(draft.adviserDiscards).toEqual([])
        draft.toggleAdviserDiscard(WAGON)
        expect(draft.adviserDiscardChoices).toEqual([WAGON, ELDERS, STEED])
        expect(draft.adviserDiscardsComplete).toBe(false)
        draft.toggleAdviserDiscard(ELDERS)
        expect(draft.adviserDiscards).toEqual([WAGON, ELDERS])
        expect(draft.adviserDiscardsComplete).toBe(true)
        expect(draft.adviserDiscardsBlockedBecause).toBeUndefined()
        // Taking the Wagon back strands the Nomad after it.
        draft.toggleAdviserDiscard(WAGON)
        expect(draft.adviserDiscards).toEqual([])
        draft.toggleAdviserDiscard(WAGON)
        draft.toggleAdviserDiscard(STEED)
        await draft.discardAdvisers()
        expect(sent).toHaveBeenCalledWith({
            kind: PowerQuestionKind.DiscardAdvisers,
            discardedAdviserCardIds: [WAGON, STEED]
        })
    })
})

/** Second Wind out of turn (revision 7) — "Travel now? Free." then "Campaign now? Free.", each taken by the action. */
describe('a free action out of turn', () => {
    const SECOND_WIND = 'denizen.discord.second-wind'
    const VOW_OF_UNION = 'denizen.beast.vow-of-union'
    const freeAction = (action: ActionType.Travel | ActionType.Campaign): PowerQuestion => ({
        kind: PowerQuestionKind.FreeActionOutOfTurn,
        cardId: SECOND_WIND,
        askedPlayerId: ME,
        action
    })

    it('the yes opens the Travel menu for the holder; Undo goes back to the question; Skip sends the skip', async () => {
        const { session, draft, sent } = await asked(freeAction(ActionType.Travel), [], {
            me: { supply: 7 }
        })
        expect(draft.acceptComplete).toBe(true)
        expect(draft.acceptRefusedBecause).toBeUndefined()
        await draft.accept()
        expect(sent).not.toHaveBeenCalled()
        expect(session.selection.action).toBe(ActionType.Travel)
        expect(session.travelOutOfTurnOpen).toBe(true)
        expect(session.travelRows.length).toBeGreaterThan(0)

        await session.undo()
        expect(session.travelOutOfTurnOpen).toBe(false)
        await draft.decline()
        expect(sent).toHaveBeenCalledWith({
            kind: PowerQuestionKind.FreeActionOutOfTurn,
            take: false
        })
    })

    it('the yes opens the declare for the holder', async () => {
        const { session, draft } = await asked(freeAction(ActionType.Campaign), [], {
            me: { supply: 7 }
        })
        await draft.accept()
        expect(session.selection.action).toBe(ActionType.Campaign)
        expect(session.campaign.open).toBe(true)
    })

    it('an action the engine does not open is not offered, and no red line takes its place', async () => {
        const { draft } = await asked(
            freeAction(ActionType.Travel),
            [],
            {
                me: {
                    supply: 7,
                    advisers: [{ cardId: VOW_OF_UNION, faceUp: true }],
                    warbandsOnBoard: { [ME]: 2 }
                }
            },
            { c1: { [ME]: 1 } }
        )
        expect(draft.acceptComplete).toBe(false)
        expect(draft.acceptRefusedBecause).toBeUndefined()
    })
})
