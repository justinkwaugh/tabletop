import { describe, expect, it } from 'vitest'
import { Color, getPrng } from '@tabletop/common'
import { testPlayer, testState, openTurn, campaignRecords, withChancellor } from '../testing/fixture.js'
import { actionPowerUse, player, site, siteTarget } from '../testing/choices.js'
import { answerQuestion } from '../testing/steps.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { FILLER, INN } from '../testing/cards.js'
import { PowerQuestionKind } from '../model/question.js'
import { PowerMoveKind, PowerMoveTollOutcome } from '../model/powerMoveToll.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { createOathVault } from '../model/vault.js'
import { OathRevision } from '../util/revision.js'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { AnswerQuestion, HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import { HydratedTravel, Travel } from '../actions/travel.js'
import { payableWoodPicks, woodPick } from '../util/shroudedWood.js'
import { reliquarySlotId } from '../util/setup.js'
import { PlayerStatus } from '../model/oathEnums.js'
import {
    CampaignResolveVictory,
    HydratedCampaignResolveVictory
} from '../actions/campaignResolveVictory.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import '../powers/index.js'

const TOLL_ROADS = 'denizen.order.toll-roads'
const FORCED_LABOR = 'denizen.order.forced-labor'
const ORACLE = 'denizen.nomad.oracle'
const PALANQUIN = 'denizen.order.palanquin'
const WHISTLE = 'relic.whistle'
const HORSE = 'relic.brass-horse'

const atRevision = OathRevision.UiBatch1
const before = OathRevision.EngineFixes2

type Over = Record<string, Record<string, unknown>>

/** Cole rules c1, which holds Toll Roads; Jacob, his enemy, stands at c2. */
function table(over: Over = {}, state: Record<string, unknown> = {}, oathRevision: number = atRevision) {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: 'cole', color: Color.Red, siteId: 'c1', favor: 3, secrets: 3, supply: 6, relicIds: [WHISTLE], warbandsOnBoard: { cole: 3 }, ...over['cole'] }),
            testPlayer({ playerId: 'jacob', color: Color.Blue, siteId: 'c2', favor: 4, secrets: 1, supply: 6, ...over['jacob'] })
        ]),
        {
            oathRevision,
            denizensBySite: { c1: [TOLL_ROADS], c2: [INN], p1: [], h1: [] },
            warbandsBySite: { c1: { cole: 2 }, c2: { jacob: 1 }, h1: { [IMPERIAL_WARBANDS]: 1 } },
            ...state
        }
    )
    openTurn(s, 'cole')
    return s
}

function tollQuestion(s: ReturnType<typeof table>) {
    return s.pendingQuestions?.queue[0]
}

function payToll(s: ReturnType<typeof table>, pay: boolean, playerId = 'jacob') {
    return answerQuestion(s, playerId, { kind: PowerQuestionKind.PayTravelToll, pay })
}

describe('Toll Roads on the Whistle — the pulled player pays or refuses', () => {
    it('asks the pulled player, and the Whistle waits on the answer', () => {
        const s = table()
        const used = actionPowerUse('cole', WHISTLE, [player('jacob')])
        used.apply(s)
        expect(tollQuestion(s)).toEqual({
            kind: PowerQuestionKind.PayTravelToll,
            cardId: TOLL_ROADS,
            askedPlayerId: 'jacob',
            payeeId: 'cole',
            move: PowerMoveKind.Whistle,
            powerCardId: WHISTLE,
            moverPlayerId: 'cole',
            fromSiteId: 'c2',
            siteId: 'c1',
            burnFavor: undefined
        })
        expect(s.getPlayerState('jacob').siteId).toBe('c2')
        expect(s.tokensOn(WHISTLE).secrets).toBe(1)
        expect(used.metadata?.tollMove).toMatchObject({ outcome: PowerMoveTollOutcome.Asked, movedPlayerId: 'jacob', toSiteId: 'c1' })
    })

    it('paid: the favor goes to the ruler, then the pull and the secret', () => {
        const s = table()
        actionPowerUse('cole', WHISTLE, [player('jacob')]).apply(s)
        const answer = payToll(s, true)
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c1', favor: 3, secrets: 2 })
        expect(s.getPlayerState('cole').favor).toBe(4)
        expect(s.tokensOn(WHISTLE).secrets).toBe(0)
        expect(answer.metadata?.tollMove).toEqual({
            move: PowerMoveKind.Whistle,
            powerCardId: WHISTLE,
            moverPlayerId: 'cole',
            movedPlayerId: 'jacob',
            fromSiteId: 'c2',
            toSiteId: 'c1',
            toll: { cardId: TOLL_ROADS, payeeId: 'cole' },
            outcome: PowerMoveTollOutcome.Paid,
            secretsTaken: 1
        })
        expect(s.pendingQuestions?.queue).toEqual([])
    })

    it('refused: the pawn stays, and the secret stays on the Whistle', () => {
        const s = table()
        actionPowerUse('cole', WHISTLE, [player('jacob')]).apply(s)
        const answer = payToll(s, false)
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c2', favor: 4, secrets: 1 })
        expect(s.getPlayerState('cole').favor).toBe(3)
        expect(s.tokensOn(WHISTLE).secrets).toBe(1)
        expect(answer.metadata?.tollMove?.outcome).toBe(PowerMoveTollOutcome.Refused)
    })

    it('no favor: nobody is asked, and the move is blocked', () => {
        const s = table({ jacob: { favor: 0 } })
        const used = actionPowerUse('cole', WHISTLE, [player('jacob')])
        used.apply(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('jacob').siteId).toBe('c2')
        expect(s.tokensOn(WHISTLE).secrets).toBe(1)
        expect(used.metadata?.tollMove).toMatchObject({ outcome: PowerMoveTollOutcome.NoFavor, fromSiteId: 'c2', toSiteId: 'c1' })
    })

    it('paying needs a favor in hand', () => {
        const s = table({ jacob: { favor: 1 } })
        actionPowerUse('cole', WHISTLE, [player('jacob')]).apply(s)
        s.getPlayerState('jacob').favor = 0
        expect(() => payToll(s, true)).toThrow(/paying takes 1 favor and you have 0/)
    })

    it("an Imperial ruler's toll goes to the Chancellor; a bandit ruler's is burned (R-10.3-H1)", () => {
        const imperial = table({ cole: { siteId: 'h1' } }, { denizensBySite: { c1: [], c2: [INN], p1: [], h1: [TOLL_ROADS] } })
        actionPowerUse('cole', WHISTLE, [player('jacob')]).apply(imperial)
        expect(tollQuestion(imperial)).toMatchObject({ payeeId: 'chancellor', siteId: 'h1' })
        const chancellorFavor = imperial.getPlayerState('chancellor').favor
        payToll(imperial, true)
        expect(imperial.getPlayerState('chancellor').favor).toBe(chancellorFavor + 1)
        expect(imperial.getPlayerState('jacob').siteId).toBe('h1')

        const bandits = table({ cole: { siteId: 'p1' } }, { denizensBySite: { c1: [], c2: [INN], p1: [TOLL_ROADS], h1: [] } })
        actionPowerUse('cole', WHISTLE, [player('jacob')]).apply(bandits)
        expect(tollQuestion(bandits)).toMatchObject({ payeeId: undefined, siteId: 'p1' })
        const supply = bandits.favorSupply
        const answer = payToll(bandits, true)
        expect(bandits.favorSupply).toBe(supply + 1)
        expect(bandits.getPlayerState('jacob')).toMatchObject({ siteId: 'p1', favor: 3 })
        expect(answer.metadata?.tollMove?.toll).toEqual({ cardId: TOLL_ROADS, payeeId: undefined })
    })

    it('R-X.4 — before the revision the pull is free, as it was recorded', () => {
        const s = table({}, {}, before)
        actionPowerUse('cole', WHISTLE, [player('jacob')]).apply(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c1', favor: 4, secrets: 2 })
    })
})

describe('Toll Roads on Palanquin — refusing moves neither pawn', () => {
    function palanquin(over: Over = {}) {
        return table({ cole: { siteId: 'c2', advisers: [{ cardId: PALANQUIN, faceUp: true }], ...over['cole'] }, ...over })
    }
    const use = (s: ReturnType<typeof table>) => {
        const used = actionPowerUse('cole', PALANQUIN, [player('jacob'), site('c1')])
        used.apply(s)
        return used
    }

    it('paid: both pawns go to the site', () => {
        const s = palanquin()
        use(s)
        expect(tollQuestion(s)).toMatchObject({ move: PowerMoveKind.Palanquin, powerCardId: PALANQUIN, askedPlayerId: 'jacob', payeeId: 'cole', fromSiteId: 'c2', siteId: 'c1' })
        expect(s.getPlayerState('cole').siteId).toBe('c2')
        payToll(s, true)
        expect(s.getPlayerState('cole').siteId).toBe('c1')
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c1', favor: 3 })
    })

    it("refused: neither moves, and the card's cost stays paid", () => {
        const s = palanquin()
        use(s)
        const placed = s.tokensOn(PALANQUIN).favor
        expect(placed).toBe(1)
        payToll(s, false)
        expect(s.getPlayerState('cole').siteId).toBe('c2')
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c2', favor: 4 })
        expect(s.tokensOn(PALANQUIN).favor).toBe(placed)
    })

    it('no favor: nobody is asked, and neither moves', () => {
        const s = palanquin({ jacob: { favor: 0 } })
        const used = use(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('cole').siteId).toBe('c2')
        expect(s.getPlayerState('jacob').siteId).toBe('c2')
        expect(used.metadata?.tollMove?.outcome).toBe(PowerMoveTollOutcome.NoFavor)
    })
})

describe('Toll Roads on a banish — the toll first, then the burn (R-5.5.7.III)', () => {
    /** Cole won against Jacob at c2, taking his pawn and favor; Cole rules c1, which holds Toll Roads. */
    function won(over: Over = {}, oathRevision: number = atRevision) {
        return table({ cole: { siteId: 'c2', ...over['cole'] }, jacob: { favor: 7, ...over['jacob'] } }, {
            campaign: {
                attackerPlayerId: 'cole',
                defenderPlayerId: 'jacob',
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
        }, oathRevision)
    }
    function resolve(s: ReturnType<typeof table>, burnFavor: boolean, banishToSiteId = 'c1') {
        const action = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'cole', placements: [], banishToSiteId, burnFavor }))
        action.apply(s)
        return action
    }

    it('asks the banished player, and the burn waits on the answer', () => {
        const s = won()
        const victory = resolve(s, true)
        expect(tollQuestion(s)).toMatchObject({ move: PowerMoveKind.Banish, askedPlayerId: 'jacob', moverPlayerId: 'cole', fromSiteId: 'c2', siteId: 'c1', burnFavor: true })
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c2', favor: 7 })
        expect(victory.metadata).toMatchObject({ favorBurned: 0, banishedToSiteId: undefined })
        expect(victory.metadata?.tollMove?.outcome).toBe(PowerMoveTollOutcome.Asked)
    })

    it('paid: the pawn goes, then half of what is left burns', () => {
        const s = won()
        resolve(s, true)
        const supply = s.favorSupply
        const answer = payToll(s, true)
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c1', favor: 3 })
        expect(s.getPlayerState('cole').favor).toBe(4)
        expect(s.favorSupply).toBe(supply + 3)
        expect(answer.metadata?.tollMove).toMatchObject({ outcome: PowerMoveTollOutcome.Paid, favorBurned: 3 })
    })

    it('refused: the pawn stays, the rest of the victory stands, and half burns', () => {
        const s = won()
        resolve(s, true)
        const answer = payToll(s, false)
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c2', favor: 4 })
        expect(s.campaign).toBeUndefined()
        expect(answer.metadata?.tollMove).toMatchObject({ outcome: PowerMoveTollOutcome.Refused, favorBurned: 3 })
    })

    it('without the burn, the answer burns nothing', () => {
        const s = won()
        resolve(s, false)
        const answer = payToll(s, true)
        expect(s.getPlayerState('jacob').favor).toBe(6)
        expect(answer.metadata?.tollMove?.favorBurned).toBeUndefined()
    })

    it('no favor: nobody is asked, the pawn stays, and the burn happens at once', () => {
        const s = won({ jacob: { favor: 0 } })
        const victory = resolve(s, true)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('jacob').siteId).toBe('c2')
        expect(victory.metadata?.tollMove?.outcome).toBe(PowerMoveTollOutcome.NoFavor)
    })

    it('a facedown destination is ruled by nobody: no toll is asked, and the site is revealed as they arrive (R-5.6.2)', () => {
        const s = won()
        s.siteCards = { c1: 'c1', c2: 'c2', p1: 'p1' }
        s.warbandsBySite.h1 = {}
        s.vault = createOathVault({ siteFacedown: { h1: 'site.mountain' } }, getPrng(1))
        const victory = resolve(s, true, 'h1')
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.siteCardAt('h1')).toBe('site.mountain')
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'h1', favor: 4 })
        expect(victory.revealsInfo).toBe(true)
        expect(victory.metadata).toMatchObject({ banishedToSiteId: 'h1', revealedSiteCardId: 'site.mountain', favorBurned: 3 })
        expect(victory.metadata?.tollMove).toBeUndefined()
    })

    it('R-X.4 — before the revision the banish is free and the burn immediate', () => {
        const s = won({}, before)
        resolve(s, true)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c1', favor: 4 })
    })
})

describe("Toll Roads on the Shrouded Wood ruler's pick, when a power moves the pawn (R-11.7)", () => {
    /** Cole's Palanquin carries Jacob out of Cole's Shrouded Wood at c2; Cole picks c1, where Toll Roads is. */
    function picked(over: Over = {}) {
        const s = table({ cole: { siteId: 'c2', advisers: [{ cardId: PALANQUIN, faceUp: true }] }, jacob: { ...over['jacob'] } }, { siteCards: { c1: 'site.plains', c2: 'site.shrouded-wood', p1: 'site.marshes', h1: 'site.mountain' }, warbandsBySite: { c1: { cole: 2 }, c2: { cole: 1 }, h1: { [IMPERIAL_WARBANDS]: 1 } } })
        actionPowerUse('cole', PALANQUIN, [player('jacob'), site('p1')]).apply(s)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.ShroudedWoodDestination, askedPlayerId: 'cole', travelerPlayerId: 'jacob' })
        expect(s.pendingQuestions?.queue[0]).not.toHaveProperty('travel')
        const pick = answerQuestion(s, 'cole', { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'c1' })
        return { s, pick }
    }

    it('the traveller is asked after the pick, and paying takes them there', () => {
        const { s, pick } = picked()
        expect(pick.metadata?.tollMove).toMatchObject({ move: PowerMoveKind.ShroudedWood, moverPlayerId: 'cole', movedPlayerId: 'jacob', outcome: PowerMoveTollOutcome.Asked })
        expect(tollQuestion(s)).toMatchObject({ askedPlayerId: 'jacob', fromSiteId: 'c2', siteId: 'c1' })
        payToll(s, true)
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c1', favor: 3 })
    })

    it('refusing keeps the traveller in the Wood', () => {
        const { s } = picked()
        payToll(s, false)
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c2', favor: 4 })
    })

    it('with no favor nobody is asked, and the traveller stays in the Wood', () => {
        const { s, pick } = picked({ jacob: { favor: 0 } })
        expect(s.pendingQuestions?.queue).toEqual([])
        expect(s.getPlayerState('jacob').siteId).toBe('c2')
        expect(pick.metadata?.tollMove?.outcome).toBe(PowerMoveTollOutcome.NoFavor)
    })
})

describe('Toll Roads on Brass Horse — its user pays as they travel', () => {
    function horse(over: Over = {}) {
        const s = table({ jacob: { relicIds: [HORSE], ...over['jacob'] } })
        openTurn(s, 'jacob')
        s.requireVault().discardPiles.cradle = [FILLER]
        s.discardPileCounts.cradle = 1
        actionPowerUse('jacob', HORSE).apply(s)
        return s
    }

    it('offers the toll site, and travelling there gives the favor', () => {
        const s = horse()
        expect(tollQuestion(s)).toMatchObject({ kind: PowerQuestionKind.TravelFreeTo, siteIds: ['c1'] })
        const answer = answerQuestion(s, 'jacob', { kind: PowerQuestionKind.TravelFreeTo, siteId: 'c1' })
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c1', favor: 3, supply: 6 })
        expect(s.getPlayerState('cole').favor).toBe(4)
        expect(answer.metadata?.summary).toBe(`travelled to c1 for no Supply; paid cole 1 favor (${TOLL_ROADS})`)
    })

    it('hides a site its user cannot pay for, and with none left travels as normal', () => {
        const s = horse({ jacob: { favor: 0 } })
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('jacob').freeTravelAtAction).toBe(s.actionCount + 1)
    })
})

describe('Forced Labor on Oracle — its draw is "as if you searched"', () => {
    /** Jacob stands at c1, which Cole rules, with Forced Labor and Oracle there. */
    function oracle(over: Over = {}, state: Record<string, unknown> = {}, oathRevision: number = atRevision, deck = [INN, 'vision.supremacy']) {
        const s = table({ ...over, jacob: { siteId: 'c1', secrets: 2, ...over['jacob'] } }, { denizensBySite: { c1: [FORCED_LABOR, ORACLE], c2: [INN], p1: [], h1: [] }, ...state }, oathRevision)
        openTurn(s, 'jacob')
        s.vault = createOathVault({ composeWorldDeck: () => deck }, getPrng(1))
        return s
    }
    const oracleIndex = powerIndexOf(ORACLE, PowerTiming.Action)

    it('the toll is paid with the cost, and recorded', () => {
        const s = oracle()
        const used = actionPowerUse('jacob', ORACLE)
        used.apply(s)
        expect(s.getPlayerState('jacob')).toMatchObject({ favor: 3, handIds: ['vision.supremacy'] })
        expect(s.getPlayerState('cole').favor).toBe(4)
        expect(used.metadata?.tollsGiven).toEqual([{ cardId: FORCED_LABOR, payeeId: 'cole' }])
    })

    it('with no favor Oracle is not usable, and is not offered', () => {
        const s = oracle({ jacob: { favor: 0 } })
        expect(HydratedUseActionPower.reasonCannotUse(s, 'jacob', ORACLE, oracleIndex)).toBe('costs 1 favor in all, you hold 0')
        expect(HydratedUseActionPower.legalActionPowers(s, 'jacob').map((p) => p.cardId)).not.toContain(ORACLE)
    })

    it('the bandits burn the favor', () => {
        const s = oracle({}, { warbandsBySite: { c2: { jacob: 1 } } })
        const supply = s.favorSupply
        const used = actionPowerUse('jacob', ORACLE)
        used.apply(s)
        expect(s.favorSupply).toBe(supply + 1)
        expect(used.metadata?.tollsGiven).toEqual([{ cardId: FORCED_LABOR, payeeId: undefined }])
    })

    it('the toll is paid even with no Vision left', () => {
        const s = oracle({}, {}, atRevision, [INN])
        const used = actionPowerUse('jacob', ORACLE)
        used.apply(s)
        expect(used.metadata?.summary).toBe('Oracle: no Vision is left in the world deck')
        expect(s.getPlayerState('jacob').favor).toBe(3)
    })

    it('R-X.4 — before the revision Oracle pays no toll', () => {
        const s = oracle({}, {}, before)
        const used = actionPowerUse('jacob', ORACLE)
        used.apply(s)
        expect(s.getPlayerState('jacob').favor).toBe(4)
        expect(used.metadata?.tollsGiven).toBeUndefined()
    })
})

describe('R-X.4 — the Whistle into Toll Roads replays as it was recorded, at each revision', () => {
    it('before the revision a free pull; from it, a question and its answer', () => {
        for (const [revision, favor] of [[before, 4], [atRevision, 3]]) {
            const start = table({}, {}, revision).dehydrate()
            const game = testGame(['cole', 'jacob', 'chancellor'])
            const used = engine.runNext(buildAction(UseActionPower, { playerId: 'cole', cardId: WHISTLE, powerIndex: powerIndexOf(WHISTLE, PowerTiming.Action), choices: [player('jacob')] }), structuredClone(start), game)
            const actions = [...used.processedActions]
            let recorded = used.updatedState
            if (revision === atRevision) {
                const answered = engine.runNext(buildAction(AnswerQuestion, { playerId: 'jacob', answer: { kind: PowerQuestionKind.PayTravelToll, pay: true } }), structuredClone(recorded), game)
                actions.push(...answered.processedActions)
                recorded = answered.updatedState
            }
            expect(recorded.players.find((p) => p.playerId === 'jacob')).toMatchObject({ siteId: 'c1', favor })

            let replayed = structuredClone(start)
            for (const action of actions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded)
        }
    })
})

/** Cole rules the Shrouded Wood at c2, where Jacob stands, and c1, which holds Toll Roads. */
const WOOD = {
    siteCards: { c1: 'site.plains', c2: 'site.shrouded-wood', p1: 'site.marshes', h1: 'site.mountain' },
    warbandsBySite: { c1: { cole: 2 }, c2: { cole: 1 }, h1: { [IMPERIAL_WARBANDS]: 1 } }
}
const TYRANT = 'denizen.order.tyrant'

describe('Toll Roads on a Travel out of a Shrouded Wood: asked at the pick, before any Supply (R-11.7, R-X.4)', () => {
    /** Jacob's own Travel out of Cole's Wood; Cole is asked where he goes. */
    function leave(over: Over = {}, state: Record<string, unknown> = WOOD, oathRevision: number = atRevision) {
        const s = table({ jacob: { ...over['jacob'] } }, state, oathRevision)
        openTurn(s, 'jacob')
        if (over['jacob']?.['free']) s.getPlayerState('jacob').freeTravelAtAction = s.actionCount
        const travel = new HydratedTravel(buildAction(Travel, { playerId: 'jacob' }))
        travel.apply(s)
        return { s, travel }
    }
    const pick = (s: ReturnType<typeof table>, siteId: string) => answerQuestion(s, 'cole', { kind: PowerQuestionKind.ShroudedWoodDestination, siteId })

    it('the pick to a toll site asks Jacob first, and nothing is paid or moved yet', () => {
        const { s } = leave()
        const picked = pick(s, 'c1')
        expect(picked.metadata?.tollMove).toMatchObject({ move: PowerMoveKind.ShroudedWood, moverPlayerId: 'cole', movedPlayerId: 'jacob', fromSiteId: 'c2', toSiteId: 'c1', outcome: PowerMoveTollOutcome.Asked })
        expect(picked.metadata?.woodPick).toBeUndefined()
        expect(tollQuestion(s)).toMatchObject({ kind: PowerQuestionKind.PayTravelToll, askedPlayerId: 'jacob', payeeId: 'cole', fromSiteId: 'c2', siteId: 'c1', travel: { free: false } })
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c2', supply: 6, favor: 4 })
    })

    it('paid: the favor to Cole, then the Wood’s Supply folded for the site, the move, and Tyrant at the site', () => {
        const { s } = leave({ jacob: { advisers: [{ cardId: TYRANT, faceUp: true }] } })
        pick(s, 'c1')
        const paid = payToll(s, true)
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c1', supply: 4, favor: 3 })
        expect(s.getPlayerState('cole').favor).toBe(4)
        expect(s.warbandsBySite['c1']).toEqual({ cole: 1 })
        expect(paid.metadata?.tollMove).toMatchObject({ outcome: PowerMoveTollOutcome.Paid, toll: { cardId: TOLL_ROADS, payeeId: 'cole' } })
        expect(paid.metadata?.woodPick).toEqual({ travelerPlayerId: 'jacob', siteId: 'c1', supplySpent: 2, supplyRemaining: 4, notes: ['Tyrant killed a warband at c1'], warbandOwner: 'cole' })
        expect(s.pendingQuestions?.queue ?? []).toEqual([])
    })

    it('refused: Jacob stays in the Wood, pays nothing, and the Travel is spent', () => {
        const { s } = leave({ jacob: { free: true } })
        pick(s, 'c1')
        const refused = payToll(s, false)
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c2', supply: 6, favor: 4 })
        expect(s.getPlayerState('jacob').freeTravelAtAction).toBeUndefined()
        expect(s.getPlayerState('cole').favor).toBe(3)
        expect(refused.metadata?.tollMove?.outcome).toBe(PowerMoveTollOutcome.Refused)
        expect(refused.metadata?.woodPick).toBeUndefined()
        expect(s.pendingQuestions?.queue ?? []).toEqual([])
    })

    it('with no favor the toll site is not offered to Cole; the other sites are', () => {
        const { s } = leave({ jacob: { favor: 0 } })
        expect(payableWoodPicks(s, 'jacob', false).map((p) => p.siteId)).not.toContain('c1')
        expect(payableWoodPicks(s, 'jacob', false).map((p) => p.siteId)).toContain('p1')
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'cole', { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'c1' })).toBe('jacob has no favor for the toll to travel to c1')
        expect(() => pick(s, 'c1')).toThrow(/no favor for the toll/)
        pick(s, 'p1')
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'p1', supply: 4, favor: 0 })
    })

    it('when every site takes the toll and Jacob has no favor, the Travel is refused', () => {
        const everywhere = {
            siteCards: { c1: 'site.plains', c2: 'site.shrouded-wood', p1: 'site.marshes', p2: 'site.river', p3: 'site.great-slums', h1: 'site.mountain', h2: 'site.steppe', h3: 'site.wastes' },
            warbandsBySite: { c1: { cole: 2 }, c2: { cole: 1 }, p1: { cole: 1 }, p2: { cole: 1 }, p3: { cole: 1 }, h1: { cole: 1 }, h2: { cole: 1 }, h3: { cole: 1 } }
        }
        const s = table({ jacob: { favor: 0 } }, everywhere)
        openTurn(s, 'jacob')
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, 'jacob', {})).toBe('cole would pick where you go, and every site takes a favor for its toll: you have 0')
        expect(HydratedTravel.canDoTravel(s, 'jacob')).toBe(false)
        s.getPlayerState('jacob').favor = 1
        expect(HydratedTravel.canDoTravel(s, 'jacob')).toBe(true)
    })

    it('the cheapest Supply named is over the sites whose toll Jacob can pay: a Cradle site at 0 he has no favor for is out of reach', () => {
        // Jacob is the Chancellor with Decadent uncovered (R-6.6.2.a): 0 Supply into the Cradle, 2 into the Provinces.
        // Cole rules the Wood and both Cradle sites, Toll Roads among them; Jacob has no favor and 1 Supply.
        const s = testState(
            [
                testPlayer({ playerId: 'jacob', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1', favor: 0, supply: 1, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 } }),
                testPlayer({ playerId: 'cole', color: Color.Red, siteId: 'h3', supply: 4, warbandsOnBoard: { cole: 3 } })
            ],
            {
                oathRevision: atRevision,
                chancellorPlayerId: 'jacob',
                reliquary: [0, 2, 3].map((i) => ({ slotId: reliquarySlotId(i) })),
                siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.shrouded-wood', p2: 'site.great-slums', p3: 'site.marshes', h1: 'site.mountain', h2: 'site.steppe', h3: 'site.wastes' },
                denizensBySite: { c1: [TOLL_ROADS], c2: [], p1: [], p2: [], p3: [], h1: [], h2: [], h3: [] },
                warbandsBySite: { c1: { cole: 1 }, c2: { cole: 1 }, p1: { cole: 1 } }
            }
        )
        openTurn(s, 'jacob')
        expect(['c1', 'c2'].map((siteId) => woodPick(s, 'jacob', siteId, false).cost)).toEqual([0, 0])
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, 'jacob', {})).toBe('cole would pick where you go, and you can pay for no site: the cheapest is 2 Supply, you have 1')
        expect(HydratedTravel.canDoTravel(s, 'jacob')).toBe(false)
        s.getPlayerState('jacob').favor = 1
        expect(HydratedTravel.canDoTravel(s, 'jacob')).toBe(true)
    })

    it('R-X.4 — before the revision the Travel pays 2 up front and the pick moves Jacob with no toll', () => {
        const { s, travel } = leave({}, WOOD, before)
        expect(travel.metadata).toMatchObject({ supplySpent: 2, supplyRemaining: 4 })
        const picked = pick(s, 'c1')
        expect(picked.metadata?.tollMove).toBeUndefined()
        expect(s.pendingQuestions?.queue ?? []).toEqual([])
        expect(s.getPlayerState('jacob')).toMatchObject({ siteId: 'c1', supply: 4, favor: 4 })
    })

    it('R-X.4 — recorded and replayed at each revision', () => {
        for (const [revision, favor, answers] of [[before, 4, false], [atRevision, 3, true]] as const) {
            const start = table({}, WOOD, revision)
            openTurn(start, 'jacob')
            start.activePlayerIds = ['jacob']
            const raw = start.dehydrate()
            const game = testGame(['cole', 'jacob', 'chancellor'])
            const actions = []
            let recorded = raw
            const steps = [
                buildAction(Travel, { playerId: 'jacob' }),
                buildAction(AnswerQuestion, { playerId: 'cole', answer: { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'c1' } }),
                ...(answers ? [buildAction(AnswerQuestion, { playerId: 'jacob', answer: { kind: PowerQuestionKind.PayTravelToll, pay: true } })] : [])
            ]
            for (const step of steps) {
                const ran = engine.runNext(step, structuredClone(recorded), game)
                actions.push(...ran.processedActions)
                recorded = ran.updatedState
            }
            expect(recorded.players.find((p) => p.playerId === 'jacob')).toMatchObject({ siteId: 'c1', favor, supply: 4 })

            let replayed = structuredClone(raw)
            for (const action of actions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded)
        }
    })
})
