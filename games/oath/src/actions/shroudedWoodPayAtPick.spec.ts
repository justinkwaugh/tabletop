import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedTravel, Travel } from './travel.js'
import { AnswerQuestion, HydratedAnswerQuestion } from './answerQuestion.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { reliquarySlotId } from '../util/setup.js'
import { payableWoodPicks } from '../util/shroudedWood.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const TYRANT = 'denizen.order.tyrant'
const atRevision = OathRevision.UiBatch1
const beforeRevision = OathRevision.EngineFixes2

/** R-6.6.2.a — every Reliquary space covered but Decadent's. */
const decadentUncovered = [0, 2, 3].map((i) => ({ slotId: reliquarySlotId(i) }))

const SITES = {
    c1: 'site.plains',
    c2: 'site.river',
    p1: 'site.shrouded-wood',
    p2: 'site.great-slums',
    p3: 'site.marshes',
    h1: 'site.mountain',
    h2: 'site.steppe',
    h3: 'site.wastes'
}

/**
 * `me` stands at the Shrouded Wood `woodAt`, which `foe` (an Exile) rules with one warband;
 * `me` is the Chancellor with Decadent uncovered unless `decadent` is false.
 */
function table(
    oathRevision: number,
    { supply, woodAt = 'p1', decadent = true, advisers = [] as string[] }: { supply: number; woodAt?: string; decadent?: boolean; advisers?: string[] }
) {
    const siteCards = woodAt === 'p1' ? SITES : { ...SITES, p1: 'site.marshes', [woodAt]: 'site.shrouded-wood' }
    const players = [
        testPlayer({
            playerId: 'me',
            color: Color.Purple,
            status: decadent ? PlayerStatus.Chancellor : PlayerStatus.Exile,
            siteId: woodAt,
            supply,
            warbandsOnBoard: decadent ? { [IMPERIAL_WARBANDS]: 3 } : { me: 3 },
            advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
        }),
        testPlayer({ playerId: 'foe', color: Color.Red, siteId: 'h3', supply: 4, warbandsOnBoard: { foe: 3 } })
    ]
    const s = testState(decadent ? players : withChancellor(players), {
        oathRevision,
        ...(decadent ? { chancellorPlayerId: 'me', reliquary: decadentUncovered } : {}),
        siteCards,
        denizensBySite: { c1: [], c2: [], p1: [], p2: [], p3: [], h1: [], h2: [], h3: [] },
        warbandsBySite: { [woodAt]: { foe: 1 }, p2: { foe: 2 } }
    })
    openTurn(s, 'me')
    return s
}

const leave = () => buildAction(Travel, { playerId: 'me' })
const pick = (siteId: string) => buildAction(AnswerQuestion, { playerId: 'foe', answer: { kind: PowerQuestionKind.ShroudedWoodDestination, siteId } })

function leaveAndPick(s: ReturnType<typeof table>, siteId: string) {
    const travel = new HydratedTravel(leave())
    travel.apply(s)
    const answer = new HydratedAnswerQuestion(pick(siteId))
    answer.apply(s)
    return { travel, answer }
}

describe('R-11.7 — leaving a Shrouded Wood an enemy rules pays at the ruler’s pick', () => {
    it('the Travel spends nothing; a Decadent Chancellor pays 3 into the Hinterland, 0 into the Cradle, 2 into the Provinces', () => {
        for (const [siteId, paid] of [['h1', 3], ['c2', 0], ['p2', 2]] as const) {
            const s = table(atRevision, { supply: 5 })
            const travel = new HydratedTravel(leave())
            travel.apply(s)
            expect(s.getPlayerState('me').supply).toBe(5)
            expect(travel.metadata).toMatchObject({ destinationChooser: 'foe', supplySpent: 0, supplyRemaining: 5, paysAtPick: true })
            expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.ShroudedWoodDestination, askedPlayerId: 'foe', travelerPlayerId: 'me', travel: { free: false } })

            const answer = new HydratedAnswerQuestion(pick(siteId))
            answer.apply(s)
            expect(s.getPlayerState('me')).toMatchObject({ siteId, supply: 5 - paid })
            expect(answer.metadata?.woodPick).toEqual({ travelerPlayerId: 'me', siteId, supplySpent: paid, supplyRemaining: 5 - paid })
        }
    })

    it('the ruler may pick only a site the traveller can pay for', () => {
        const s = table(atRevision, { supply: 2 })
        new HydratedTravel(leave()).apply(s)
        const answer = (siteId: string): QuestionAnswer => ({ kind: PowerQuestionKind.ShroudedWoodDestination, siteId })
        for (const siteId of ['h1', 'h2', 'h3']) {
            expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'foe', answer(siteId))).toBe(`me cannot pay the 3 Supply to travel to ${siteId}: they have 2`)
        }
        for (const siteId of ['c1', 'c2', 'p2', 'p3']) {
            expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'foe', answer(siteId))).toBeUndefined()
        }
        expect(() => new HydratedAnswerQuestion(pick('h1')).apply(s)).toThrow(/cannot pay the 3 Supply/)
    })

    it('the Travel is refused while no site is payable', () => {
        const s = table(atRevision, { supply: 1, woodAt: 'c1' })
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, 'me', {})).toBe('foe would pick where you go, and you can pay for no site: the cheapest is 2 Supply, you have 1')
        expect(HydratedTravel.canDoTravel(s, 'me')).toBe(false)
        expect(() => new HydratedTravel(leave()).apply(s)).toThrow(/you can pay for no site/)

        s.getPlayerState('me').supply = 2
        expect(HydratedTravel.canDoTravel(s, 'me')).toBe(true)
    })

    it('the Narrow Pass and The Hidden Place are picks like any other: a Decadent Chancellor with 1 Supply may leave for them at 0', () => {
        const s = table(atRevision, { supply: 1 })
        s.siteCards = { ...s.siteCards, c1: 'site.narrow-pass', c2: 'site.the-hidden-place' }
        expect(payableWoodPicks(s, 'me', false).map((p) => [p.siteId, p.cost])).toEqual([['c1', 0], ['c2', 0]])
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, 'me', {})).toBeUndefined()
        leaveAndPick(s, 'c2')
        expect(s.getPlayerState('me')).toMatchObject({ siteId: 'c2', supply: 1 })
    })

    it('a free Travel pays nothing wherever the ruler picks, Decadent’s +1 included', () => {
        const s = table(atRevision, { supply: 0 })
        s.getPlayerState('me').freeTravelAtAction = s.actionCount
        expect(HydratedTravel.canDoTravel(s, 'me')).toBe(true)
        const { travel, answer } = leaveAndPick(s, 'h1')
        expect(travel.metadata).toMatchObject({ supplySpent: 0, paysAtPick: true })
        expect(s.getPlayerState('me')).toMatchObject({ siteId: 'h1', supply: 0 })
        expect(answer.metadata?.woodPick?.supplySpent).toBe(0)
    })

    it('Tyrant kills a warband at the site the ruler picks', () => {
        const s = table(atRevision, { supply: 3, decadent: false, advisers: [TYRANT] })
        const { answer } = leaveAndPick(s, 'p2')
        expect(s.warbandsBySite['p2']).toEqual({ foe: 1 })
        expect(s.getPlayerState('me')).toMatchObject({ siteId: 'p2', supply: 1 })
        expect(answer.metadata?.woodPick).toEqual({ travelerPlayerId: 'me', siteId: 'p2', supplySpent: 2, supplyRemaining: 1, notes: ['Tyrant killed a warband at p2'], warbandOwner: 'foe' })
    })

    it('before the revision the Travel pays 2 up front, any site may be picked, and Tyrant does not fire', () => {
        const s = table(beforeRevision, { supply: 2, advisers: [TYRANT] })
        const travel = new HydratedTravel(leave())
        travel.apply(s)
        expect(travel.metadata).toMatchObject({ supplySpent: 2, supplyRemaining: 0 })
        expect(travel.metadata?.paysAtPick).toBeUndefined()
        expect(s.pendingQuestions?.queue[0]).not.toHaveProperty('travel')
        const answer = new HydratedAnswerQuestion(pick('p2'))
        answer.apply(s)
        expect(s.getPlayerState('me')).toMatchObject({ siteId: 'p2', supply: 0 })
        expect(s.warbandsBySite['p2']).toEqual({ foe: 2 })
        expect(answer.metadata?.woodPick).toBeUndefined()
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(table(beforeRevision, { supply: 1 }), 'me', {})).toBe('costs 2 Supply, player has 1')
    })

    it('R-X.4 — each revision’s Travel and pick replay unchanged', () => {
        for (const [revision, supply] of [[beforeRevision, 3], [atRevision, 2]]) {
            const before = table(revision, { supply: 5, advisers: [TYRANT] }).dehydrate()
            const game = testGame(['me', 'foe'])
            const left = engine.runNext(leave(), structuredClone(before), game)
            const picked = engine.runNext(pick('h1'), left.updatedState, game)
            expect(picked.updatedState.players.find((p) => p.playerId === 'me')).toMatchObject({ siteId: 'h1', supply })

            let replayed = structuredClone(before)
            for (const action of [...left.processedActions, ...picked.processedActions]) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(picked.updatedState)
        }
    })
})
