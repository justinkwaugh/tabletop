import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { testPlayer, testState, openTurn, campaignRecords, withChancellor } from '../testing/fixture.js'
import { actionPowerUse, player, site, siteTarget } from '../testing/choices.js'
import { answerQuestion } from '../testing/steps.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { FILLER, INN } from '../testing/cards.js'
import { PowerQuestionKind } from '../model/question.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { OathRevision } from '../util/revision.js'
import { UseActionPower } from '../actions/useActionPower.js'
import { AnswerQuestion, HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import {
    CampaignResolveVictory,
    HydratedCampaignResolveVictory
} from '../actions/campaignResolveVictory.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import '../powers/index.js'

const DRUM = 'relic.dragonskin-drum'
const TOLL_ROADS = 'denizen.order.toll-roads'
const PALANQUIN = 'denizen.order.palanquin'
const WHISTLE = 'relic.whistle'
const HORSE = 'relic.brass-horse'

const atRevision = OathRevision.EngineFixes3
const before = OathRevision.UiBatch1

type Over = Record<string, Record<string, unknown>>

/** Rhys stands at c1 with the Whistle; Dana, who holds the Dragonskin Drum, stands at c2. Nobody's toll is in the way. */
function table(over: Over = {}, state: Record<string, unknown> = {}, oathRevision: number = atRevision) {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: 'rhys', color: Color.Red, siteId: 'c1', favor: 3, secrets: 3, supply: 6, relicIds: [WHISTLE], warbandsOnBoard: { rhys: 3 }, ...over['rhys'] }),
            testPlayer({ playerId: 'dana', color: Color.Blue, siteId: 'c2', favor: 4, secrets: 1, supply: 6, relicIds: [DRUM], warbandsOnBoard: { dana: 2 }, ...over['dana'] }),
            ...(over['chancellor'] ? [testPlayer({ playerId: 'chancellor', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h3', ...over['chancellor'] })] : [])
        ]),
        {
            oathRevision,
            denizensBySite: { c1: [], c2: [INN], p1: [], h1: [] },
            warbandsBySite: { c1: { rhys: 2 }, c2: { dana: 1 }, h1: { [IMPERIAL_WARBANDS]: 1 } },
            ...state
        }
    )
    openTurn(s, 'rhys')
    return s
}

/** Rhys rules c1, which now holds Toll Roads. */
const TOLL = { denizensBySite: { c1: [TOLL_ROADS], c2: [INN], p1: [], h1: [] } }

function asked(s: ReturnType<typeof table>) {
    return s.pendingQuestions?.queue[0]
}

function drum(s: ReturnType<typeof table>, gain: boolean, playerId = 'dana') {
    return answerQuestion(s, playerId, { kind: PowerQuestionKind.DragonskinDrum, gain })
}

const whistle = (s: ReturnType<typeof table>) => actionPowerUse('rhys', WHISTLE, [player('dana')]).apply(s)

describe("Dragonskin Drum when a power moves its holder — asked after the move (its Q&A; R-X.4: revision 7)", () => {
    it('the Whistle: once the pawn arrives, its holder is asked "Gain 1 warband?"', () => {
        const s = table()
        whistle(s)
        expect(s.getPlayerState('dana').siteId).toBe('c1')
        expect(s.pendingQuestions?.askingPlayerId).toBe('rhys')
        expect(s.pendingQuestions?.queue).toEqual([
            { kind: PowerQuestionKind.DragonskinDrum, cardId: DRUM, askedPlayerId: 'dana' }
        ])
    })

    it('Gain: one warband from their bank to their board, recorded for the History', () => {
        const s = table()
        whistle(s)
        const answer = drum(s, true)
        const dana = s.getPlayerState('dana')
        expect(dana.warbandsOnBoard).toEqual({ dana: 3 })
        expect(dana.warbandsInPersonalBank).toEqual({ dana: 13 })
        expect(answer.metadata).toMatchObject({
            cardId: DRUM,
            kind: PowerQuestionKind.DragonskinDrum,
            summary: 'gained 1 warband',
            warbandGain: { owner: 'dana', count: 1 }
        })
        expect(s.pendingQuestions?.queue).toEqual([])
    })

    it('Skip: nothing is gained and nothing recorded', () => {
        const s = table()
        whistle(s)
        const answer = drum(s, false)
        expect(s.getPlayerState('dana').warbandsOnBoard).toEqual({ dana: 2 })
        expect(s.getPlayerState('dana').warbandsInPersonalBank).toEqual({ dana: 14 })
        expect(answer.metadata?.summary).toBe('skipped')
        expect(answer.metadata?.warbandGain).toBeUndefined()
    })

    it('only the holder answers, and only while the question is open', () => {
        const s = table()
        whistle(s)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'rhys', { kind: PowerQuestionKind.DragonskinDrum, gain: true })).toBe("the question is dana's to answer")
        drum(s, true)
        expect(() => drum(s, true)).toThrow(/no question is waiting/)
    })

    it('Brass Horse: its user is asked after travelling, after paying the toll as they go', () => {
        const s = table({ dana: { relicIds: [HORSE, DRUM] } }, TOLL)
        openTurn(s, 'dana')
        s.requireVault().discardPiles.cradle = [FILLER]
        s.discardPileCounts.cradle = 1
        actionPowerUse('dana', HORSE).apply(s)
        expect(asked(s)).toMatchObject({ kind: PowerQuestionKind.TravelFreeTo, siteIds: ['c1'] })
        answerQuestion(s, 'dana', { kind: PowerQuestionKind.TravelFreeTo, siteId: 'c1' })
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', favor: 3 })
        expect(s.pendingQuestions?.queue).toEqual([
            { kind: PowerQuestionKind.DragonskinDrum, cardId: DRUM, askedPlayerId: 'dana' }
        ])
        drum(s, true)
        expect(s.getPlayerState('dana').warbandsOnBoard).toEqual({ dana: 3 })
    })

    it('Palanquin: the player it carries is asked, not its user', () => {
        const s = table({ rhys: { siteId: 'c2', advisers: [{ cardId: PALANQUIN, faceUp: true }] } })
        actionPowerUse('rhys', PALANQUIN, [player('dana'), site('p1')]).apply(s)
        expect(s.getPlayerState('dana').siteId).toBe('p1')
        expect(asked(s)).toEqual({ kind: PowerQuestionKind.DragonskinDrum, cardId: DRUM, askedPlayerId: 'dana' })
    })

    it('a banish asks the banished holder, after the burn the spoils take', () => {
        const s = table({ rhys: { siteId: 'c2' }, dana: { favor: 6 } }, {
            campaign: {
                attackerPlayerId: 'rhys',
                defenderPlayerId: 'dana',
                nonImperialPlayerIds: [],
                allyPlayerIds: [],
                targets: [siteTarget('c2'), { kind: CampaignTargetKind.PawnAndFavor }],
                attackPool: 4,
                defensePool: 1,
                attackRoll: [],
                defenseRoll: [],
                defense: 2,
                swords: 5,
                defendingForce: [],
                defendingBandits: 0,
                ...campaignRecords(),
                attackerVictorious: true
            }
        })
        new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'rhys', placements: [], banishToSiteId: 'p1', burnFavor: true })).apply(s)
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'p1', favor: 3 })
        expect(asked(s)).toEqual({ kind: PowerQuestionKind.DragonskinDrum, cardId: DRUM, askedPlayerId: 'dana' })
    })

    it("the Shrouded Wood ruler's pick, when a power carries the holder out, is asked after the pick", () => {
        const s = table(
            { rhys: { siteId: 'c2', advisers: [{ cardId: PALANQUIN, faceUp: true }] } },
            { siteCards: { c1: 'site.plains', c2: 'site.shrouded-wood', p1: 'site.marshes', h1: 'site.mountain' }, warbandsBySite: { c1: { rhys: 2 }, c2: { rhys: 1 }, h1: { [IMPERIAL_WARBANDS]: 1 } } }
        )
        actionPowerUse('rhys', PALANQUIN, [player('dana'), site('p1')]).apply(s)
        expect(asked(s)).toMatchObject({ kind: PowerQuestionKind.ShroudedWoodDestination, travelerPlayerId: 'dana' })
        answerQuestion(s, 'rhys', { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'h1' })
        expect(s.getPlayerState('dana').siteId).toBe('h1')
        expect(s.pendingQuestions?.queue).toEqual([
            { kind: PowerQuestionKind.DragonskinDrum, cardId: DRUM, askedPlayerId: 'dana' }
        ])
    })

    it('a player without the Drum is not asked', () => {
        const s = table({ dana: { relicIds: [] } })
        whistle(s)
        expect(s.getPlayerState('dana').siteId).toBe('c1')
        expect(s.pendingQuestions).toBeUndefined()
    })
})

describe('Dragonskin Drum — not asked when the bank that would give the warband is empty', () => {
    it('an empty bank: the move happens, and nobody is asked', () => {
        const s = table({ dana: { warbandsInPersonalBank: {} } })
        whistle(s)
        expect(s.getPlayerState('dana').siteId).toBe('c1')
        expect(s.pendingQuestions).toBeUndefined()
    })

    it('a bank emptied before the answer refuses Gain; Skip still answers', () => {
        const s = table()
        whistle(s)
        s.getPlayerState('dana').warbandsInPersonalBank = { dana: 0 }
        expect(() => drum(s, true)).toThrow(/your warband bank is empty/)
        drum(s, false)
        expect(s.pendingQuestions?.queue).toEqual([])
    })
})

describe('Dragonskin Drum with Toll Roads — the toll first, then the Drum, only if the move happens', () => {
    it('the toll is asked first; paid, the pawn arrives and the Drum is asked next', () => {
        const s = table({}, TOLL)
        whistle(s)
        expect(s.pendingQuestions?.queue.map((q) => q.kind)).toEqual([PowerQuestionKind.PayTravelToll])
        answerQuestion(s, 'dana', { kind: PowerQuestionKind.PayTravelToll, pay: true })
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', favor: 3, secrets: 2 })
        expect(s.pendingQuestions?.queue).toEqual([
            { kind: PowerQuestionKind.DragonskinDrum, cardId: DRUM, askedPlayerId: 'dana' }
        ])
        drum(s, true)
        expect(s.getPlayerState('dana').warbandsOnBoard).toEqual({ dana: 3 })
    })

    it('refused: the pawn stays, and the Drum is not asked', () => {
        const s = table({}, TOLL)
        whistle(s)
        answerQuestion(s, 'dana', { kind: PowerQuestionKind.PayTravelToll, pay: false })
        expect(s.getPlayerState('dana').siteId).toBe('c2')
        expect(s.pendingQuestions?.queue).toEqual([])
    })

    it('no favor for the toll: the move is blocked, and the Drum is not asked', () => {
        const s = table({ dana: { favor: 0 } }, TOLL)
        whistle(s)
        expect(s.getPlayerState('dana').siteId).toBe('c2')
        expect(s.pendingQuestions).toBeUndefined()
    })
})

describe("Dragonskin Drum for a Citizen — the Empire's warband, from the Chancellor's bank (R-5.2.2, R-9.3)", () => {
    const citizen = (bank: Record<string, number>) =>
        table({
            dana: { status: PlayerStatus.Citizen, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 1 } },
            chancellor: { warbandsInPersonalBank: bank }
        })

    it('Gain: a purple warband from the Chancellor\'s bank onto the Citizen\'s board', () => {
        const s = citizen({ [IMPERIAL_WARBANDS]: 5 })
        whistle(s)
        expect(asked(s)).toEqual({ kind: PowerQuestionKind.DragonskinDrum, cardId: DRUM, askedPlayerId: 'dana' })
        const answer = drum(s, true)
        expect(s.getPlayerState('dana').warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 2 })
        expect(s.getPlayerState('dana').warbandsInPersonalBank).toEqual({ dana: 14 })
        expect(s.getPlayerState('chancellor').warbandsInPersonalBank).toEqual({ [IMPERIAL_WARBANDS]: 4 })
        expect(answer.metadata).toMatchObject({ summary: 'gained 1 Imperial warband', warbandGain: { owner: IMPERIAL_WARBANDS, count: 1 } })
    })

    it("an empty Empire's bank: not asked, whatever the Citizen's own bank holds", () => {
        const s = citizen({})
        whistle(s)
        expect(s.getPlayerState('dana').siteId).toBe('c1')
        expect(s.pendingQuestions).toBeUndefined()
    })
})

describe('R-X.4 — before revision 7 a power move asks nothing of the Drum, and replays as recorded', () => {
    it('the Whistle pulls the holder, and no question follows', () => {
        const s = table({}, {}, before)
        whistle(s)
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', warbandsOnBoard: { dana: 2 } })
        expect(s.pendingQuestions).toBeUndefined()
    })

    it('each revision replays its own record', () => {
        for (const revision of [before, atRevision]) {
            const start = table({}, {}, revision).dehydrate()
            const game = testGame(['rhys', 'dana', 'chancellor'])
            const used = engine.runNext(buildAction(UseActionPower, { playerId: 'rhys', cardId: WHISTLE, powerIndex: powerIndexOf(WHISTLE, PowerTiming.Action), choices: [player('dana')] }), structuredClone(start), game)
            const actions = [...used.processedActions]
            let recorded = used.updatedState
            if (revision === atRevision) {
                const answered = engine.runNext(buildAction(AnswerQuestion, { playerId: 'dana', answer: { kind: PowerQuestionKind.DragonskinDrum, gain: true } }), structuredClone(recorded), game)
                actions.push(...answered.processedActions)
                recorded = answered.updatedState
            }
            expect(recorded.players.find((p) => p.playerId === 'dana')?.warbandsOnBoard).toEqual({ dana: revision === atRevision ? 3 : 2 })

            let replayed = structuredClone(start)
            for (const action of actions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded)
        }
    })
})
