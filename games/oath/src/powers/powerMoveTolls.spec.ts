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
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { required } from '../testing/required.js'
import '../powers/index.js'

const TOLL_ROADS = 'denizen.order.toll-roads'
const FORCED_LABOR = 'denizen.order.forced-labor'
const ORACLE = 'denizen.nomad.oracle'
const PALANQUIN = 'denizen.order.palanquin'
const WHISTLE = 'relic.whistle'
const HORSE = 'relic.brass-horse'
const SLANDER = 'denizen.discord.slander'

const atRevision = OathRevision.UiBatch1
const before = OathRevision.EngineFixes2

type Over = Record<string, Record<string, unknown>>

/** Rhys rules c1, which holds Toll Roads; Dana, their enemy, stands at c2. */
function table(over: Over = {}, state: Record<string, unknown> = {}, oathRevision: number = atRevision) {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: 'rhys', color: Color.Red, siteId: 'c1', favor: 3, secrets: 3, supply: 6, relicIds: [WHISTLE], warbandsOnBoard: { rhys: 3 }, ...over['rhys'] }),
            testPlayer({ playerId: 'dana', color: Color.Blue, siteId: 'c2', favor: 4, secrets: 1, supply: 6, ...over['dana'] })
        ]),
        {
            oathRevision,
            denizensBySite: { c1: [TOLL_ROADS], c2: [INN], p1: [], h1: [] },
            warbandsBySite: { c1: { rhys: 2 }, c2: { dana: 1 }, h1: { [IMPERIAL_WARBANDS]: 1 } },
            ...state
        }
    )
    openTurn(s, 'rhys')
    return s
}

function tollQuestion(s: ReturnType<typeof table>) {
    return s.pendingQuestions?.queue[0]
}

function payToll(s: ReturnType<typeof table>, pay: boolean, playerId = 'dana') {
    return answerQuestion(s, playerId, { kind: PowerQuestionKind.PayTravelToll, pay })
}

describe('Toll Roads on the Whistle — the pulled player pays or refuses', () => {
    it('asks the pulled player, and the Whistle waits on the answer', () => {
        const s = table()
        const used = actionPowerUse('rhys', WHISTLE, [player('dana')])
        used.apply(s)
        expect(tollQuestion(s)).toEqual({
            kind: PowerQuestionKind.PayTravelToll,
            cardId: TOLL_ROADS,
            askedPlayerId: 'dana',
            payeeId: 'rhys',
            move: PowerMoveKind.Whistle,
            powerCardId: WHISTLE,
            moverPlayerId: 'rhys',
            fromSiteId: 'c2',
            siteId: 'c1',
            burnFavor: undefined
        })
        expect(s.getPlayerState('dana').siteId).toBe('c2')
        expect(s.tokensOn(WHISTLE).secrets).toBe(1)
        expect(used.metadata?.tollMove).toMatchObject({ outcome: PowerMoveTollOutcome.Asked, movedPlayerId: 'dana', toSiteId: 'c1' })
    })

    it('paid: the favor goes to the ruler, then the pull and the secret', () => {
        const s = table()
        actionPowerUse('rhys', WHISTLE, [player('dana')]).apply(s)
        const answer = payToll(s, true)
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', favor: 3, secrets: 2 })
        expect(s.getPlayerState('rhys').favor).toBe(4)
        expect(s.tokensOn(WHISTLE).secrets).toBe(0)
        expect(answer.metadata?.tollMove).toEqual({
            move: PowerMoveKind.Whistle,
            powerCardId: WHISTLE,
            moverPlayerId: 'rhys',
            movedPlayerId: 'dana',
            fromSiteId: 'c2',
            toSiteId: 'c1',
            toll: { cardId: TOLL_ROADS, payeeId: 'rhys' },
            outcome: PowerMoveTollOutcome.Paid,
            secretsTaken: 1
        })
        expect(s.pendingQuestions?.queue).toEqual([])
    })

    it('refused: the pawn stays, and the secret stays on the Whistle', () => {
        const s = table()
        actionPowerUse('rhys', WHISTLE, [player('dana')]).apply(s)
        const answer = payToll(s, false)
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c2', favor: 4, secrets: 1 })
        expect(s.getPlayerState('rhys').favor).toBe(3)
        expect(s.tokensOn(WHISTLE).secrets).toBe(1)
        expect(answer.metadata?.tollMove?.outcome).toBe(PowerMoveTollOutcome.Refused)
    })

    it('no favor: nobody is asked, and the move is blocked', () => {
        const s = table({ dana: { favor: 0 } })
        const used = actionPowerUse('rhys', WHISTLE, [player('dana')])
        used.apply(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('dana').siteId).toBe('c2')
        expect(s.tokensOn(WHISTLE).secrets).toBe(1)
        expect(used.metadata?.tollMove).toMatchObject({ outcome: PowerMoveTollOutcome.NoFavor, fromSiteId: 'c2', toSiteId: 'c1' })
    })

    it('paying needs a favor in hand', () => {
        const s = table({ dana: { favor: 1 } })
        actionPowerUse('rhys', WHISTLE, [player('dana')]).apply(s)
        s.getPlayerState('dana').favor = 0
        expect(() => payToll(s, true)).toThrow(/paying takes 1 favor and you have 0/)
    })

    it("an Imperial ruler's toll goes to the Chancellor; a bandit ruler's is burned (R-10.3-H1)", () => {
        const imperial = table({ rhys: { siteId: 'h1' } }, { denizensBySite: { c1: [], c2: [INN], p1: [], h1: [TOLL_ROADS] } })
        actionPowerUse('rhys', WHISTLE, [player('dana')]).apply(imperial)
        expect(tollQuestion(imperial)).toMatchObject({ payeeId: 'chancellor', siteId: 'h1' })
        const chancellorFavor = imperial.getPlayerState('chancellor').favor
        payToll(imperial, true)
        expect(imperial.getPlayerState('chancellor').favor).toBe(chancellorFavor + 1)
        expect(imperial.getPlayerState('dana').siteId).toBe('h1')

        const bandits = table({ rhys: { siteId: 'p1' } }, { denizensBySite: { c1: [], c2: [INN], p1: [TOLL_ROADS], h1: [] } })
        actionPowerUse('rhys', WHISTLE, [player('dana')]).apply(bandits)
        expect(tollQuestion(bandits)).toMatchObject({ payeeId: undefined, siteId: 'p1' })
        const supply = bandits.favorSupply
        const answer = payToll(bandits, true)
        expect(bandits.favorSupply).toBe(supply + 1)
        expect(bandits.getPlayerState('dana')).toMatchObject({ siteId: 'p1', favor: 3 })
        expect(answer.metadata?.tollMove?.toll).toEqual({ cardId: TOLL_ROADS, payeeId: undefined })
    })

    it('R-X.4 — before the revision the pull is free, as it was recorded', () => {
        const s = table({}, {}, before)
        actionPowerUse('rhys', WHISTLE, [player('dana')]).apply(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', favor: 4, secrets: 2 })
    })
})

describe('Toll Roads on Palanquin — refusing moves neither pawn', () => {
    function palanquin(over: Over = {}) {
        return table({ rhys: { siteId: 'c2', advisers: [{ cardId: PALANQUIN, faceUp: true }], ...over['rhys'] }, ...over })
    }
    const use = (s: ReturnType<typeof table>) => {
        const used = actionPowerUse('rhys', PALANQUIN, [player('dana'), site('c1')])
        used.apply(s)
        return used
    }

    it('paid: both pawns go to the site', () => {
        const s = palanquin()
        use(s)
        expect(tollQuestion(s)).toMatchObject({ move: PowerMoveKind.Palanquin, powerCardId: PALANQUIN, askedPlayerId: 'dana', payeeId: 'rhys', fromSiteId: 'c2', siteId: 'c1' })
        expect(s.getPlayerState('rhys').siteId).toBe('c2')
        payToll(s, true)
        expect(s.getPlayerState('rhys').siteId).toBe('c1')
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', favor: 3 })
    })

    it("refused: neither moves, and the card's cost stays paid", () => {
        const s = palanquin()
        use(s)
        const placed = s.tokensOn(PALANQUIN).favor
        expect(placed).toBe(1)
        payToll(s, false)
        expect(s.getPlayerState('rhys').siteId).toBe('c2')
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c2', favor: 4 })
        expect(s.tokensOn(PALANQUIN).favor).toBe(placed)
    })

    it('no favor: nobody is asked, and neither moves', () => {
        const s = palanquin({ dana: { favor: 0 } })
        const used = use(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('rhys').siteId).toBe('c2')
        expect(s.getPlayerState('dana').siteId).toBe('c2')
        expect(used.metadata?.tollMove?.outcome).toBe(PowerMoveTollOutcome.NoFavor)
    })
})

describe('Toll Roads on a banish — the toll first, then the burn (R-5.5.7.III)', () => {
    /** Rhys won against Dana at c2, taking their pawn and favor; Rhys rules c1, which holds Toll Roads. */
    function won(over: Over = {}, oathRevision: number = atRevision) {
        return table({ rhys: { siteId: 'c2', ...over['rhys'] }, dana: { favor: 7, ...over['dana'] } }, {
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
        }, oathRevision)
    }
    function resolve(s: ReturnType<typeof table>, burnFavor: boolean, banishToSiteId = 'c1') {
        const action = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'rhys', placements: [], banishToSiteId, burnFavor }))
        action.apply(s)
        return action
    }

    it('asks the banished player, and the burn waits on the answer', () => {
        const s = won()
        const victory = resolve(s, true)
        expect(tollQuestion(s)).toMatchObject({ move: PowerMoveKind.Banish, askedPlayerId: 'dana', moverPlayerId: 'rhys', fromSiteId: 'c2', siteId: 'c1', burnFavor: true })
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c2', favor: 7 })
        expect(victory.metadata).toMatchObject({ favorBurned: 0, banishedToSiteId: undefined })
        expect(victory.metadata?.tollMove?.outcome).toBe(PowerMoveTollOutcome.Asked)
    })

    it('paid: the pawn goes, then half of what is left burns', () => {
        const s = won()
        resolve(s, true)
        const supply = s.favorSupply
        const answer = payToll(s, true)
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', favor: 3 })
        expect(s.getPlayerState('rhys').favor).toBe(4)
        expect(s.favorSupply).toBe(supply + 3)
        expect(answer.metadata?.tollMove).toMatchObject({ outcome: PowerMoveTollOutcome.Paid, favorBurned: 3 })
    })

    it('refused: the pawn stays, the rest of the victory stands, and half burns', () => {
        const s = won()
        resolve(s, true)
        const answer = payToll(s, false)
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c2', favor: 4 })
        expect(s.campaign).toBeUndefined()
        expect(answer.metadata?.tollMove).toMatchObject({ outcome: PowerMoveTollOutcome.Refused, favorBurned: 3 })
    })

    it('without the burn, the answer burns nothing', () => {
        const s = won()
        resolve(s, false)
        const answer = payToll(s, true)
        expect(s.getPlayerState('dana').favor).toBe(6)
        expect(answer.metadata?.tollMove?.favorBurned).toBeUndefined()
    })

    it('no favor: nobody is asked, the pawn stays, and the burn happens at once', () => {
        const s = won({ dana: { favor: 0 } })
        const victory = resolve(s, true)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('dana').siteId).toBe('c2')
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
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'h1', favor: 4 })
        expect(victory.revealsInfo).toBe(true)
        expect(victory.metadata).toMatchObject({ banishedToSiteId: 'h1', revealedSiteCardId: 'site.mountain', favorBurned: 3 })
        expect(victory.metadata?.tollMove).toBeUndefined()
    })

    it('R-X.4 — before the revision the banish is free and the burn immediate', () => {
        const s = won({}, before)
        resolve(s, true)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', favor: 4 })
    })

    describe("R-5.5.7.III, then R-5.5.8: the toll, the move and the burn, then the \"if you're victorious\" plans and the end", () => {
        function slandered() {
            const s = won()
            const campaign = required(s.campaign, 'Rhys has won')
            campaign.plansUsed = [SLANDER]
            campaign.plansUsedBy = { rhys: [SLANDER] }
            return s
        }

        it('Slander waits on Dana: the Campaign is open, and nothing of theirs is burned yet', () => {
            const s = slandered()
            const victory = resolve(s, true)
            expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c2', favor: 7 })
            expect(s.campaign?.banishPending).toEqual({})
            expect(victory.metadata?.triggered).toBeUndefined()
            expect(HydratedCampaignResolveVictory.reasonCannotResolveVictory(s, 'rhys', { placements: [], burnFavor: false })).toBe('the banish waits on an answer')
        })

        it('paid: they go, half of what is left burns, then Slander burns the rest, and the Campaign ends', () => {
            const s = slandered()
            resolve(s, true)
            const answer = payToll(s, true)
            expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', favor: 0 })
            expect(s.getPlayerState('rhys').favor).toBe(4)
            expect(answer.metadata?.tollMove).toMatchObject({ outcome: PowerMoveTollOutcome.Paid, favorBurned: 3 })
            expect(answer.metadata?.triggered).toEqual(['Slander: dana burned all 3 of their favor'])
            expect(s.campaign).toBeUndefined()
        })

        it('refused: they stay, half burns, then Slander', () => {
            const s = slandered()
            resolve(s, true)
            const answer = payToll(s, false)
            expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c2', favor: 0 })
            expect(answer.metadata?.triggered).toEqual(['Slander: dana burned all 4 of their favor'])
            expect(s.campaign).toBeUndefined()
        })

        it('with no favor nobody is asked, and the plans and the end follow at once', () => {
            const s = won({ dana: { favor: 0 } })
            required(s.campaign, 'Rhys has won').plansUsedBy = { rhys: [SLANDER] }
            const victory = resolve(s, true)
            expect(s.campaign).toBeUndefined()
            expect(victory.metadata?.triggered).toEqual(['Slander: dana burned all 0 of their favor'])
        })

        it('through the machine: the answer ends the Campaign, and the turn goes on where it would have (Martial Culture ends the Act Phase); replayed alike', () => {
            const start = slandered()
            required(start.campaign, 'Rhys has won').endsActPhaseAfter = true
            start.machineState = MachineState.CampaignVictory
            start.activePlayerIds = ['rhys']
            const raw = start.dehydrate()
            const game = testGame(['rhys', 'dana', 'chancellor'])
            const actions = []
            let recorded = raw
            for (const step of [
                buildAction(CampaignResolveVictory, { playerId: 'rhys', placements: [], banishToSiteId: 'c1', burnFavor: true }),
                buildAction(AnswerQuestion, { playerId: 'dana', answer: { kind: PowerQuestionKind.PayTravelToll, pay: true } })
            ]) {
                const ran = engine.runNext(step, structuredClone(recorded), game)
                actions.push(...ran.processedActions)
                recorded = ran.updatedState
                if (actions.length === 1) {
                    expect(recorded.machineState).toBe(MachineState.PowerQuestion)
                    expect(recorded.campaign).toBeDefined()
                }
            }
            expect(recorded.campaign).toBeUndefined()
            expect(recorded.pendingQuestions).toBeUndefined()
            // Martial Culture: Rhys's Act Phase ends, and their Rest, with no choice in it, follows.
            expect(actions.map((action) => action.type).slice(0, 3)).toEqual([ActionType.CampaignResolveVictory, ActionType.AnswerQuestion, ActionType.CompleteRest])
            expect(recorded.players.find((p) => p.playerId === 'dana')).toMatchObject({ siteId: 'c1', favor: 0 })

            let replayed = structuredClone(raw)
            for (const action of actions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded)
        })
    })
})

describe("Toll Roads on the Shrouded Wood ruler's pick, when a power moves the pawn (R-11.7)", () => {
    /** Rhys's Palanquin carries Dana out of Rhys's Shrouded Wood at c2; Rhys picks c1, where Toll Roads is. */
    function picked(over: Over = {}) {
        const s = table({ rhys: { siteId: 'c2', advisers: [{ cardId: PALANQUIN, faceUp: true }] }, dana: { ...over['dana'] } }, { siteCards: { c1: 'site.plains', c2: 'site.shrouded-wood', p1: 'site.marshes', h1: 'site.mountain' }, warbandsBySite: { c1: { rhys: 2 }, c2: { rhys: 1 }, h1: { [IMPERIAL_WARBANDS]: 1 } } })
        actionPowerUse('rhys', PALANQUIN, [player('dana'), site('p1')]).apply(s)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.ShroudedWoodDestination, askedPlayerId: 'rhys', travelerPlayerId: 'dana' })
        expect(s.pendingQuestions?.queue[0]).not.toHaveProperty('travel')
        const pick = answerQuestion(s, 'rhys', { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'c1' })
        return { s, pick }
    }

    it('the traveller is asked after the pick, and paying takes them there', () => {
        const { s, pick } = picked()
        expect(pick.metadata?.tollMove).toMatchObject({ move: PowerMoveKind.ShroudedWood, moverPlayerId: 'rhys', movedPlayerId: 'dana', outcome: PowerMoveTollOutcome.Asked })
        expect(tollQuestion(s)).toMatchObject({ askedPlayerId: 'dana', fromSiteId: 'c2', siteId: 'c1' })
        payToll(s, true)
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', favor: 3 })
    })

    it('refusing keeps the traveller in the Wood', () => {
        const { s } = picked()
        payToll(s, false)
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c2', favor: 4 })
    })

    it('with no favor nobody is asked, and the traveller stays in the Wood', () => {
        const { s, pick } = picked({ dana: { favor: 0 } })
        expect(s.pendingQuestions?.queue).toEqual([])
        expect(s.getPlayerState('dana').siteId).toBe('c2')
        expect(pick.metadata?.tollMove?.outcome).toBe(PowerMoveTollOutcome.NoFavor)
    })
})

describe('Toll Roads on Brass Horse — its user pays as they travel', () => {
    function horse(over: Over = {}) {
        const s = table({ dana: { relicIds: [HORSE], ...over['dana'] } })
        openTurn(s, 'dana')
        s.requireVault().discardPiles.cradle = [FILLER]
        s.discardPileCounts.cradle = 1
        actionPowerUse('dana', HORSE).apply(s)
        return s
    }

    it('offers the toll site, and travelling there gives the favor', () => {
        const s = horse()
        expect(tollQuestion(s)).toMatchObject({ kind: PowerQuestionKind.TravelFreeTo, siteIds: ['c1'] })
        const answer = answerQuestion(s, 'dana', { kind: PowerQuestionKind.TravelFreeTo, siteId: 'c1' })
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', favor: 3, supply: 6 })
        expect(s.getPlayerState('rhys').favor).toBe(4)
        expect(answer.metadata?.summary).toBe(`travelled to c1 for no Supply; paid rhys 1 favor (${TOLL_ROADS})`)
    })

    it('hides a site its user cannot pay for, and with none left travels as normal', () => {
        const s = horse({ dana: { favor: 0 } })
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('dana').freeTravelAtAction).toBe(s.actionCount + 1)
    })
})

describe('Forced Labor on Oracle — its draw is "as if you searched"', () => {
    /** Dana stands at c1, which Rhys rules, with Forced Labor and Oracle there. */
    function oracle(over: Over = {}, state: Record<string, unknown> = {}, oathRevision: number = atRevision, deck = [INN, 'vision.supremacy']) {
        const s = table({ ...over, dana: { siteId: 'c1', secrets: 2, ...over['dana'] } }, { denizensBySite: { c1: [FORCED_LABOR, ORACLE], c2: [INN], p1: [], h1: [] }, ...state }, oathRevision)
        openTurn(s, 'dana')
        s.vault = createOathVault({ composeWorldDeck: () => deck }, getPrng(1))
        return s
    }
    const oracleIndex = powerIndexOf(ORACLE, PowerTiming.Action)

    it('the toll is paid with the cost, and recorded', () => {
        const s = oracle()
        const used = actionPowerUse('dana', ORACLE)
        used.apply(s)
        expect(s.getPlayerState('dana')).toMatchObject({ favor: 3, handIds: ['vision.supremacy'] })
        expect(s.getPlayerState('rhys').favor).toBe(4)
        expect(used.metadata?.tollsGiven).toEqual([{ cardId: FORCED_LABOR, payeeId: 'rhys' }])
    })

    it('with no favor Oracle is not usable, and is not offered', () => {
        const s = oracle({ dana: { favor: 0 } })
        expect(HydratedUseActionPower.reasonCannotUse(s, 'dana', ORACLE, oracleIndex)).toBe('costs 1 favor in all, you hold 0')
        expect(HydratedUseActionPower.legalActionPowers(s, 'dana').map((p) => p.cardId)).not.toContain(ORACLE)
    })

    it('the bandits burn the favor', () => {
        const s = oracle({}, { warbandsBySite: { c2: { dana: 1 } } })
        const supply = s.favorSupply
        const used = actionPowerUse('dana', ORACLE)
        used.apply(s)
        expect(s.favorSupply).toBe(supply + 1)
        expect(used.metadata?.tollsGiven).toEqual([{ cardId: FORCED_LABOR, payeeId: undefined }])
    })

    it('the toll is paid even with no Vision left', () => {
        const s = oracle({}, {}, atRevision, [INN])
        const used = actionPowerUse('dana', ORACLE)
        used.apply(s)
        expect(used.metadata?.summary).toBe('Oracle: no Vision is left in the world deck')
        expect(s.getPlayerState('dana').favor).toBe(3)
    })

    it('R-X.4 — before the revision Oracle pays no toll', () => {
        const s = oracle({}, {}, before)
        const used = actionPowerUse('dana', ORACLE)
        used.apply(s)
        expect(s.getPlayerState('dana').favor).toBe(4)
        expect(used.metadata?.tollsGiven).toBeUndefined()
    })
})

describe('R-X.4 — the Whistle into Toll Roads replays as it was recorded, at each revision', () => {
    it('before the revision a free pull; from it, a question and its answer', () => {
        for (const [revision, favor] of [[before, 4], [atRevision, 3]]) {
            const start = table({}, {}, revision).dehydrate()
            const game = testGame(['rhys', 'dana', 'chancellor'])
            const used = engine.runNext(buildAction(UseActionPower, { playerId: 'rhys', cardId: WHISTLE, powerIndex: powerIndexOf(WHISTLE, PowerTiming.Action), choices: [player('dana')] }), structuredClone(start), game)
            const actions = [...used.processedActions]
            let recorded = used.updatedState
            if (revision === atRevision) {
                const answered = engine.runNext(buildAction(AnswerQuestion, { playerId: 'dana', answer: { kind: PowerQuestionKind.PayTravelToll, pay: true } }), structuredClone(recorded), game)
                actions.push(...answered.processedActions)
                recorded = answered.updatedState
            }
            expect(recorded.players.find((p) => p.playerId === 'dana')).toMatchObject({ siteId: 'c1', favor })

            let replayed = structuredClone(start)
            for (const action of actions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded)
        }
    })
})

/** Rhys rules the Shrouded Wood at c2, where Dana stands, and c1, which holds Toll Roads. */
const WOOD = {
    siteCards: { c1: 'site.plains', c2: 'site.shrouded-wood', p1: 'site.marshes', h1: 'site.mountain' },
    warbandsBySite: { c1: { rhys: 2 }, c2: { rhys: 1 }, h1: { [IMPERIAL_WARBANDS]: 1 } }
}
const TYRANT = 'denizen.order.tyrant'

describe('Toll Roads on a Travel out of a Shrouded Wood: asked at the pick, before any Supply (R-11.7, R-X.4)', () => {
    /** Dana's own Travel out of Rhys's Wood; Rhys is asked where they go. */
    function leave(over: Over = {}, state: Record<string, unknown> = WOOD, oathRevision: number = atRevision) {
        const s = table({ dana: { ...over['dana'] } }, state, oathRevision)
        openTurn(s, 'dana')
        if (over['dana']?.['free']) s.getPlayerState('dana').freeTravelAtAction = s.actionCount
        const travel = new HydratedTravel(buildAction(Travel, { playerId: 'dana' }))
        travel.apply(s)
        return { s, travel }
    }
    const pick = (s: ReturnType<typeof table>, siteId: string) => answerQuestion(s, 'rhys', { kind: PowerQuestionKind.ShroudedWoodDestination, siteId })

    it('the pick to a toll site asks Dana first, and nothing is paid or moved yet', () => {
        const { s } = leave()
        const picked = pick(s, 'c1')
        expect(picked.metadata?.tollMove).toMatchObject({ move: PowerMoveKind.ShroudedWood, moverPlayerId: 'rhys', movedPlayerId: 'dana', fromSiteId: 'c2', toSiteId: 'c1', outcome: PowerMoveTollOutcome.Asked })
        expect(picked.metadata?.woodPick).toBeUndefined()
        expect(tollQuestion(s)).toMatchObject({ kind: PowerQuestionKind.PayTravelToll, askedPlayerId: 'dana', payeeId: 'rhys', fromSiteId: 'c2', siteId: 'c1', travel: { free: false } })
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c2', supply: 6, favor: 4 })
    })

    it('paid: the favor to Rhys, then the Wood’s Supply folded for the site, the move, and Tyrant at the site', () => {
        const { s } = leave({ dana: { advisers: [{ cardId: TYRANT, faceUp: true }] } })
        pick(s, 'c1')
        const paid = payToll(s, true)
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', supply: 4, favor: 3 })
        expect(s.getPlayerState('rhys').favor).toBe(4)
        expect(s.warbandsBySite['c1']).toEqual({ rhys: 1 })
        expect(paid.metadata?.tollMove).toMatchObject({ outcome: PowerMoveTollOutcome.Paid, toll: { cardId: TOLL_ROADS, payeeId: 'rhys' } })
        expect(paid.metadata?.woodPick).toEqual({ travelerPlayerId: 'dana', siteId: 'c1', supplySpent: 2, supplyRemaining: 4, notes: ['Tyrant killed a warband at c1'], warbandOwner: 'rhys' })
        expect(s.pendingQuestions?.queue ?? []).toEqual([])
    })

    it('refused: Dana stays in the Wood, pays nothing, and the Travel is spent', () => {
        const { s } = leave({ dana: { free: true } })
        pick(s, 'c1')
        const refused = payToll(s, false)
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c2', supply: 6, favor: 4 })
        expect(s.getPlayerState('dana').freeTravelAtAction).toBeUndefined()
        expect(s.getPlayerState('rhys').favor).toBe(3)
        expect(refused.metadata?.tollMove?.outcome).toBe(PowerMoveTollOutcome.Refused)
        expect(refused.metadata?.woodPick).toBeUndefined()
        expect(s.pendingQuestions?.queue ?? []).toEqual([])
    })

    it('with no favor the toll site is not offered to Rhys; the other sites are', () => {
        const { s } = leave({ dana: { favor: 0 } })
        expect(payableWoodPicks(s, 'dana', { free: false }).map((p) => p.siteId)).not.toContain('c1')
        expect(payableWoodPicks(s, 'dana', { free: false }).map((p) => p.siteId)).toContain('p1')
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'rhys', { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'c1' })).toBe('dana has no favor for the toll to travel to c1')
        expect(() => pick(s, 'c1')).toThrow(/no favor for the toll/)
        pick(s, 'p1')
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'p1', supply: 4, favor: 0 })
    })

    it('when every site takes the toll and Dana has no favor, the Travel is refused', () => {
        const everywhere = {
            siteCards: { c1: 'site.plains', c2: 'site.shrouded-wood', p1: 'site.marshes', p2: 'site.river', p3: 'site.great-slums', h1: 'site.mountain', h2: 'site.steppe', h3: 'site.wastes' },
            warbandsBySite: { c1: { rhys: 2 }, c2: { rhys: 1 }, p1: { rhys: 1 }, p2: { rhys: 1 }, p3: { rhys: 1 }, h1: { rhys: 1 }, h2: { rhys: 1 }, h3: { rhys: 1 } }
        }
        const s = table({ dana: { favor: 0 } }, everywhere)
        openTurn(s, 'dana')
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, 'dana', {})).toBe('rhys would pick where you go, and every site takes a favor for its toll: you have 0')
        expect(HydratedTravel.canDoTravel(s, 'dana')).toBe(false)
        s.getPlayerState('dana').favor = 1
        expect(HydratedTravel.canDoTravel(s, 'dana')).toBe(true)
    })

    it('the cheapest Supply named is over the sites whose toll Dana can pay: a Cradle site at 0 they have no favor for is out of reach', () => {
        // Dana is the Chancellor with Decadent uncovered (R-6.6.2.a): 0 Supply into the Cradle, 2 into the Provinces.
        // Rhys rules the Wood and both Cradle sites, Toll Roads among them; Dana has no favor and 1 Supply.
        const s = testState(
            [
                testPlayer({ playerId: 'dana', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1', favor: 0, supply: 1, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 } }),
                testPlayer({ playerId: 'rhys', color: Color.Red, siteId: 'h3', supply: 4, warbandsOnBoard: { rhys: 3 } })
            ],
            {
                oathRevision: atRevision,
                chancellorPlayerId: 'dana',
                reliquary: [0, 2, 3].map((i) => ({ slotId: reliquarySlotId(i) })),
                siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.shrouded-wood', p2: 'site.great-slums', p3: 'site.marshes', h1: 'site.mountain', h2: 'site.steppe', h3: 'site.wastes' },
                denizensBySite: { c1: [TOLL_ROADS], c2: [], p1: [], p2: [], p3: [], h1: [], h2: [], h3: [] },
                warbandsBySite: { c1: { rhys: 1 }, c2: { rhys: 1 }, p1: { rhys: 1 } }
            }
        )
        openTurn(s, 'dana')
        expect(['c1', 'c2'].map((siteId) => woodPick(s, 'dana', siteId, { free: false }).cost)).toEqual([0, 0])
        expect(HydratedTravel.reasonCannotLeaveShroudedWood(s, 'dana', {})).toBe('rhys would pick where you go, and you can pay for no site: the cheapest is 2 Supply, you have 1')
        expect(HydratedTravel.canDoTravel(s, 'dana')).toBe(false)
        s.getPlayerState('dana').favor = 1
        expect(HydratedTravel.canDoTravel(s, 'dana')).toBe(true)
    })

    it('R-X.4 — before the revision the Travel pays 2 up front and the pick moves Dana with no toll', () => {
        const { s, travel } = leave({}, WOOD, before)
        expect(travel.metadata).toMatchObject({ supplySpent: 2, supplyRemaining: 4 })
        const picked = pick(s, 'c1')
        expect(picked.metadata?.tollMove).toBeUndefined()
        expect(s.pendingQuestions?.queue ?? []).toEqual([])
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', supply: 4, favor: 4 })
    })

    it('R-X.4 — recorded and replayed at each revision', () => {
        for (const [revision, favor, answers] of [[before, 4, false], [atRevision, 3, true]] as const) {
            const start = table({}, WOOD, revision)
            openTurn(start, 'dana')
            start.activePlayerIds = ['dana']
            const raw = start.dehydrate()
            const game = testGame(['rhys', 'dana', 'chancellor'])
            const actions = []
            let recorded = raw
            const steps = [
                buildAction(Travel, { playerId: 'dana' }),
                buildAction(AnswerQuestion, { playerId: 'rhys', answer: { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'c1' } }),
                ...(answers ? [buildAction(AnswerQuestion, { playerId: 'dana', answer: { kind: PowerQuestionKind.PayTravelToll, pay: true } })] : [])
            ]
            for (const step of steps) {
                const ran = engine.runNext(step, structuredClone(recorded), game)
                actions.push(...ran.processedActions)
                recorded = ran.updatedState
            }
            expect(recorded.players.find((p) => p.playerId === 'dana')).toMatchObject({ siteId: 'c1', favor, supply: 4 })

            let replayed = structuredClone(raw)
            for (const action of actions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded)
        }
    })
})

describe("A banish from a Shrouded Wood: the ruler's pick, any toll and the burn, then R-5.5.8 and the end (R-5.5.7.III, R-11.7, R-X.4)", () => {
    /** Rhys won against Dana, who stands in Rhys's Shrouded Wood at c2, taking their pawn and favor; Rhys used Slander. */
    function wood(oathRevision: number = atRevision) {
        return table({ rhys: { siteId: 'p1' }, dana: { favor: 7 } }, {
            ...WOOD,
            campaign: {
                attackerPlayerId: 'rhys',
                defenderPlayerId: 'dana',
                nonImperialPlayerIds: [],
                allyPlayerIds: [],
                targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
                attackPool: 4,
                defensePool: 1,
                attackRoll: [],
                defenseRoll: [],
                defense: 2,
                swords: 5,
                defendingForce: [],
                defendingBandits: 0,
                ...campaignRecords(),
                plansUsed: [SLANDER],
                plansUsedBy: { rhys: [SLANDER] },
                attackerVictorious: true
            }
        }, oathRevision)
    }
    function banish(s: ReturnType<typeof table>) {
        const action = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'rhys', placements: [], banish: true, burnFavor: true }))
        action.apply(s)
        return action
    }
    const pick = (s: ReturnType<typeof table>, siteId: string) => answerQuestion(s, 'rhys', { kind: PowerQuestionKind.ShroudedWoodDestination, siteId })

    it('nothing is burned, and the Campaign stays open, until Rhys picks', () => {
        const s = wood()
        const victory = banish(s)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.ShroudedWoodDestination, askedPlayerId: 'rhys', travelerPlayerId: 'dana' })
        expect(s.getPlayerState('dana').favor).toBe(7)
        expect(victory.metadata).toMatchObject({ favorBurned: 0 })
        expect(s.campaign?.banishPending).toEqual({ burnFavor: true })
    })

    it('a site with no toll: they go, half burns, then Slander, and the Campaign ends', () => {
        const s = wood()
        banish(s)
        const picked = pick(s, 'p1')
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'p1', favor: 0 })
        expect(picked.metadata?.triggered).toEqual(['rhys burned 3 favor', 'Slander: dana burned all 4 of their favor'])
        expect(s.campaign).toBeUndefined()
    })

    it('a Toll Roads site: Dana is asked with all their favor; paid, they go, then the burn and Slander', () => {
        const s = wood()
        banish(s)
        pick(s, 'c1')
        expect(tollQuestion(s)).toMatchObject({ kind: PowerQuestionKind.PayTravelToll, askedPlayerId: 'dana', move: PowerMoveKind.ShroudedWood })
        expect(s.campaign).toBeDefined()
        const answer = payToll(s, true)
        expect(s.getPlayerState('dana')).toMatchObject({ siteId: 'c1', favor: 0 })
        expect(s.getPlayerState('rhys').favor).toBe(4)
        expect(answer.metadata?.triggered).toEqual(['rhys burned 3 favor', 'Slander: dana burned all 3 of their favor'])
        expect(s.campaign).toBeUndefined()
    })

    it('R-X.4 — before the revision the burn and the plans come first and the pick ends nothing', () => {
        const s = wood(before)
        const victory = banish(s)
        expect(s.campaign).toBeUndefined()
        expect(victory.metadata?.favorBurned).toBe(3)
        expect(s.getPlayerState('dana').favor).toBe(0)
        const picked = pick(s, 'c1')
        expect(picked.metadata?.triggered).toBeUndefined()
        expect(s.getPlayerState('dana').siteId).toBe('c1')
    })
})
