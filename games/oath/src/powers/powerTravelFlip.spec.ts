import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { campaignRecords, openTurn, testPlayer, testState } from '../testing/fixture.js'
import { actionPowerUse, player, site, siteTarget } from '../testing/choices.js'
import { answerQuestion } from '../testing/steps.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { PowerMoveKind, PowerMoveTollOutcome } from '../model/powerMoveToll.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { PlayerStatus, Region } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathRevision } from '../util/revision.js'
import { reasonCannotTravelByPower } from '../util/powerTravel.js'
import { OathVisibility } from '../definition/runtime.js'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { AnswerQuestion, HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import {
    CampaignResolveVictory,
    HydratedCampaignResolveVictory
} from '../actions/campaignResolveVictory.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import '../powers/index.js'

const WHISTLE = 'relic.whistle'
const HORSE = 'relic.brass-horse'
const DRUM = 'relic.dragonskin-drum'
const PALANQUIN = 'denizen.order.palanquin'
const TOLL_ROADS = 'denizen.order.toll-roads'
const SPELL_BREAKER = 'denizen.nomad.spell-breaker'
const VOW_OF_UNION = 'denizen.beast.vow-of-union'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const MUSHROOMS = 'denizen.beast.mushrooms'
const STORYTELLER = 'denizen.hearth.storyteller'
const HIDDEN_PLACE = 'site.the-hidden-place'
const BURIED_GIANT = 'site.buried-giant'

const atRevision = OathRevision.EngineFixes11
const before = OathRevision.EngineFixes10

type Over = Record<string, Record<string, unknown>>

/**
 * Dana stands at The Hidden Place (c2) with the Whistle; Rhys, with two faceup secrets, stands
 * at p1. Ann, Rhys and Dana are exiles; Bea is the Chancellor.
 */
function table(over: Over = {}, state: Record<string, unknown> = {}, oathRevision: number = atRevision) {
    const s = testState(
        [
            testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c2', favor: 4, secrets: 3, supply: 6, relicIds: [WHISTLE], warbandsOnBoard: { dana: 3 }, warbandsInPersonalBank: { dana: 6 }, ...over['dana'] }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'p1', favor: 3, secrets: 2, supply: 4, warbandsOnBoard: { rhys: 2 }, warbandsInPersonalBank: { rhys: 6 }, ...over['rhys'] }),
            testPlayer({ playerId: 'ann', color: Color.Yellow, siteId: 'h1', favor: 2, secrets: 2, warbandsOnBoard: { ann: 2 }, warbandsInPersonalBank: { ann: 6 }, ...over['ann'] }),
            testPlayer({ playerId: 'bea', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', favor: 2, secrets: 2, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 }, ...over['bea'] })
        ],
        {
            oathRevision,
            chancellorPlayerId: 'bea',
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c2: { dana: 2 }, h1: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: { c1: 'site.plains', c2: HIDDEN_PLACE, p1: 'site.marshes', h1: 'site.river' },
            ...state
        }
    )
    openTurn(s, 'dana')
    return s
}

/** Dana rules The Hidden Place, which now holds Toll Roads. */
const TOLL = { denizensBySite: { c1: [], c2: [TOLL_ROADS], p1: [], h1: [] } }

const whistle = (s: HydratedOathGameState) => {
    const used = actionPowerUse('dana', WHISTLE, [player('rhys')])
    used.apply(s)
    return used
}
const flip = (s: HydratedOathGameState, yes: boolean, playerId = 'rhys') =>
    answerQuestion(s, playerId, { kind: PowerQuestionKind.FlipToTravel, flip: yes })
const toll = (s: HydratedOathGameState, pay: boolean, playerId = 'rhys') =>
    answerQuestion(s, playerId, { kind: PowerQuestionKind.PayTravelToll, pay })
const asked = (s: HydratedOathGameState) => s.pendingQuestions?.queue[0]
const queue = (s: HydratedOathGameState) => s.pendingQuestions?.queue ?? []
const secretsOf = (s: HydratedOathGameState, playerId: string) => {
    const p = s.getPlayerState(playerId)
    return { siteId: p.siteId, secrets: p.secrets, secretsFacedown: p.secretsFacedown }
}

describe('R-11.13-H1 — the Whistle used from The Hidden Place asks the summoned player to flip', () => {
    it('Rhys, with faceup secrets, is asked; nobody moves yet', () => {
        const s = table()
        const used = whistle(s)
        expect(queue(s)).toEqual([
            {
                kind: PowerQuestionKind.FlipToTravel,
                cardId: WHISTLE,
                askedPlayerId: 'rhys',
                move: PowerMoveKind.Whistle,
                powerCardId: WHISTLE,
                moverPlayerId: 'dana',
                fromSiteId: 'p1',
                siteId: 'c2'
            }
        ])
        expect(s.pendingQuestions?.askingPlayerId).toBe('dana')
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'p1', secrets: 2, secretsFacedown: 0 })
        expect(used.metadata?.summary).toBe('Whistle: rhys is asked to flip a secret to travel to c2')
    })

    it("yes: a secret flipped facedown, Rhys at Dana's site, and the Whistle's secret given", () => {
        const s = table()
        whistle(s)
        const answer = flip(s, true)
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'c2', secrets: 2, secretsFacedown: 1 })
        expect(s.tokensOn(WHISTLE).secrets).toBe(0)
        expect(answer.metadata?.summary).toBe('flipped a secret facedown and travelled to c2, taking 1 secret from the Whistle')
        expect(queue(s)).toEqual([])
        // Nothing hidden came out, so the answer can be taken back.
        expect(answer.revealsInfo).toBe(false)
    })

    it('no: Rhys stays, and the Whistle keeps its secret', () => {
        const s = table()
        whistle(s)
        const answer = flip(s, false)
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'p1', secrets: 2, secretsFacedown: 0 })
        expect(s.tokensOn(WHISTLE).secrets).toBe(1)
        expect(answer.metadata?.summary).toBe('kept their secrets and stayed at p1')
    })

    it('Rhys with no faceup secret is unable: nothing is asked', () => {
        const s = table({ rhys: { secrets: 0 } })
        const used = whistle(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('rhys').siteId).toBe('p1')
        expect(used.metadata?.summary).toBe('Whistle: rhys cannot travel to c2')
    })

    it('a flip without a faceup secret is refused at the answer', () => {
        const s = table()
        whistle(s)
        s.getPlayerState('rhys').secrets = 0
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'rhys', { kind: PowerQuestionKind.FlipToTravel, flip: true })).toBe('you have no faceup secret to flip')
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'rhys', { kind: PowerQuestionKind.FlipToTravel, flip: false })).toBeUndefined()
    })

    it("Spell Breaker forbids its ruler's enemy the flip: Rhys is unable", () => {
        const s = table({ dana: { advisers: [{ cardId: SPELL_BREAKER, faceUp: true }] } })
        whistle(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('rhys').siteId).toBe('p1')
    })

    it('Vow of Union still holds Rhys at a site Rhys rules', () => {
        const s = table({ rhys: { advisers: [{ cardId: VOW_OF_UNION, faceUp: true }] } }, { warbandsBySite: { c2: { dana: 2 }, p1: { rhys: 1 }, h1: { [IMPERIAL_WARBANDS]: 2 } } })
        expect(reasonCannotTravelByPower(s, 'rhys', 'c2')).toMatch(/Vow of Union/)
        whistle(s)
        expect(s.pendingQuestions).toBeUndefined()
    })

    it('the Dragonskin Drum is asked after the flip and the arrival, and not when Rhys stays', () => {
        const s = table({ rhys: { relicIds: [DRUM] } })
        whistle(s)
        expect(queue(s).map((q) => q.kind)).toEqual([PowerQuestionKind.FlipToTravel])
        flip(s, true)
        expect(queue(s)).toEqual([{ kind: PowerQuestionKind.DragonskinDrum, cardId: DRUM, askedPlayerId: 'rhys' }])

        const stays = table({ rhys: { relicIds: [DRUM] } })
        whistle(stays)
        flip(stays, false)
        expect(queue(stays)).toEqual([])
    })

    it('R-X.4 — before revision 15 Rhys cannot be summoned to The Hidden Place', () => {
        const s = table({}, {}, before)
        const used = whistle(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(used.metadata?.summary).toBe('Whistle: rhys cannot travel to c2')
    })
})

describe('R-11.13-H1 — the flip, then Toll Roads: either refusal cancels the move, and nothing is spent on it', () => {
    it('the flip is asked first, then the toll; paying flips the secret and moves Rhys', () => {
        const s = table({}, TOLL)
        whistle(s)
        expect(queue(s).map((q) => q.kind)).toEqual([PowerQuestionKind.FlipToTravel])
        flip(s, true)
        // The secret is flipped only once the move is certain.
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'p1', secrets: 2, secretsFacedown: 0 })
        expect(asked(s)).toMatchObject({ kind: PowerQuestionKind.PayTravelToll, askedPlayerId: 'rhys', payeeId: 'dana', move: PowerMoveKind.Whistle, siteId: 'c2', flipSecret: true })
        const paid = toll(s, true)
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'c2', secrets: 2, secretsFacedown: 1 })
        expect(s.getPlayerState('rhys').favor).toBe(2)
        expect(s.getPlayerState('dana').favor).toBe(5)
        expect(paid.metadata?.tollMove).toMatchObject({ outcome: PowerMoveTollOutcome.Paid, secretsTaken: 1 })
    })

    it('a refused toll after the flip leaves no secret flipped and nothing paid', () => {
        const s = table({}, TOLL)
        whistle(s)
        flip(s, true)
        toll(s, false)
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'p1', secrets: 2, secretsFacedown: 0 })
        expect(s.getPlayerState('rhys').favor).toBe(3)
        expect(s.tokensOn(WHISTLE).secrets).toBe(1)
    })

    it('a refused flip asks no toll and pays nothing', () => {
        const s = table({}, TOLL)
        whistle(s)
        flip(s, false)
        expect(queue(s)).toEqual([])
        expect(s.getPlayerState('rhys')).toMatchObject({ siteId: 'p1', favor: 3, secrets: 2 })
    })

    it('with no favor for the toll, no flip is asked and Rhys stays', () => {
        const s = table({ rhys: { favor: 0 } }, TOLL)
        const used = whistle(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'p1', secrets: 2, secretsFacedown: 0 })
        expect(used.metadata?.tollMove?.outcome).toBe(PowerMoveTollOutcome.NoFavor)
    })
})

describe("R-11.13-H1 — the Brass Horse keeps The Hidden Place among its sites, flipping on the answer", () => {
    /** Dana, at c1 with the Brass Horse, reveals a Beast; Beasts lie at The Hidden Place (c2) and at h1. */
    function horse(over: Over = {}, oathRevision: number = atRevision) {
        const s = table({ dana: { siteId: 'c1', relicIds: [HORSE], ...over['dana'] } }, { denizensBySite: { c1: [], c2: [WOLVES], p1: [], h1: [MUSHROOMS] } }, oathRevision)
        s.requireVault().discardPiles[Region.Cradle] = [RANGERS]
        s.discardPileCounts[Region.Cradle] = 1
        actionPowerUse('dana', HORSE).apply(s)
        return s
    }
    const travel = (siteId: string, flipSecret?: boolean): QuestionAnswer => ({ kind: PowerQuestionKind.TravelFreeTo, siteId, flipSecret })

    it('offers The Hidden Place while Dana still has a faceup secret after the cost', () => {
        expect(asked(horse())).toEqual({ kind: PowerQuestionKind.TravelFreeTo, cardId: HORSE, askedPlayerId: 'dana', siteIds: ['c2', 'h1'] })
    })

    it('leaves it out when the cost took the last faceup secret', () => {
        expect(asked(horse({ dana: { secrets: 1 } }))).toMatchObject({ siteIds: ['h1'] })
    })

    it('refuses The Hidden Place without the flip, and a flip elsewhere', () => {
        const s = horse()
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'dana', travel('c2'))).toBe('travelling to c2 takes a faceup secret flipped facedown')
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'dana', travel('h1', true))).toBe('no site here asks for a secret to be flipped')
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'dana', travel('h1'))).toBeUndefined()
    })

    it('with the flip, one secret goes facedown and Dana travels for no Supply', () => {
        const s = horse()
        const answer = answerQuestion(s, 'dana', travel('c2', true))
        expect(secretsOf(s, 'dana')).toEqual({ siteId: 'c2', secrets: 1, secretsFacedown: 1 })
        expect(s.getPlayerState('dana').supply).toBe(6)
        expect(answer.metadata?.summary).toBe('flipped a secret facedown and travelled to c2 for no Supply')
    })

    it('R-X.4 — before revision 15 The Hidden Place is not offered', () => {
        expect(asked(horse({}, before))).toMatchObject({ siteIds: ['h1'] })
    })
})

describe('R-11.13-H1 — Palanquin to The Hidden Place: the carried player is asked before either pawn moves', () => {
    /** Dana, with Palanquin, stands with Rhys at c1. */
    function carry(over: Over = {}, state: Record<string, unknown> = {}, oathRevision: number = atRevision) {
        return table({ dana: { siteId: 'c1', relicIds: [], advisers: [{ cardId: PALANQUIN, faceUp: true }], ...over['dana'] }, rhys: { siteId: 'c1', ...over['rhys'] } }, { warbandsBySite: { c1: { dana: 1 }, h1: { [IMPERIAL_WARBANDS]: 2 } }, ...state }, oathRevision)
    }
    const palanquin = (s: HydratedOathGameState) => actionPowerUse('dana', PALANQUIN, [player('rhys'), site('c2')]).apply(s)
    const index = powerIndexOf(PALANQUIN, PowerTiming.Action)

    it('offers The Hidden Place when Rhys could flip, and not when Rhys could not', () => {
        expect(HydratedUseActionPower.reasonCannotUse(carry(), 'dana', PALANQUIN, index, [player('rhys'), site('c2')])).toBeUndefined()
        expect(HydratedUseActionPower.reasonCannotUse(carry({ rhys: { secrets: 0 } }), 'dana', PALANQUIN, index, [player('rhys'), site('c2')])).toMatch(/The Hidden Place/)
    })

    it('asks Rhys before anyone moves', () => {
        const s = carry()
        palanquin(s)
        expect(asked(s)).toEqual({ kind: PowerQuestionKind.FlipToTravel, cardId: PALANQUIN, askedPlayerId: 'rhys', move: PowerMoveKind.Palanquin, powerCardId: PALANQUIN, moverPlayerId: 'dana', fromSiteId: 'c1', siteId: 'c2' })
        expect(s.getPlayerState('dana').siteId).toBe('c1')
        expect(s.getPlayerState('rhys').siteId).toBe('c1')
    })

    it('no: neither moves', () => {
        const s = carry()
        palanquin(s)
        flip(s, false)
        expect(s.getPlayerState('dana').siteId).toBe('c1')
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'c1', secrets: 2, secretsFacedown: 0 })
    })

    it('yes: both go, and Rhys flips a secret', () => {
        const s = carry()
        palanquin(s)
        flip(s, true)
        expect(s.getPlayerState('dana').siteId).toBe('c2')
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'c2', secrets: 1, secretsFacedown: 1 })
    })

    it('with Toll Roads there: a refused toll after the flip moves neither and flips nothing', () => {
        const s = carry({}, { ...TOLL, warbandsBySite: { c1: { dana: 1 }, c2: { ann: 2 }, h1: { [IMPERIAL_WARBANDS]: 2 } } })
        palanquin(s)
        flip(s, true)
        expect(asked(s)).toMatchObject({ kind: PowerQuestionKind.PayTravelToll, askedPlayerId: 'rhys', payeeId: 'ann', move: PowerMoveKind.Palanquin, flipSecret: true })
        toll(s, false)
        expect(s.getPlayerState('dana').siteId).toBe('c1')
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'c1', secrets: 2, secretsFacedown: 0 })

        const paid = carry({}, { ...TOLL, warbandsBySite: { c1: { dana: 1 }, c2: { ann: 2 }, h1: { [IMPERIAL_WARBANDS]: 2 } } })
        palanquin(paid)
        flip(paid, true)
        toll(paid, true)
        expect(paid.getPlayerState('dana').siteId).toBe('c2')
        expect(secretsOf(paid, 'rhys')).toEqual({ siteId: 'c2', secrets: 1, secretsFacedown: 1 })
    })

    it('R-X.4 — before revision 15 The Hidden Place is not offered', () => {
        expect(HydratedUseActionPower.reasonCannotUse(carry({}, {}, before), 'dana', PALANQUIN, index, [player('rhys'), site('c2')])).toMatch(/The Hidden Place/)
    })
})

describe('R-11.13-H1 — a banish to The Hidden Place asks the defender to flip', () => {
    /** Dana won against Rhys at p1, taking Rhys's pawn and favor. */
    function won(over: Over = {}, state: Record<string, unknown> = {}, oathRevision: number = atRevision) {
        return table({ dana: { siteId: 'p1', ...over['dana'] }, rhys: { favor: 6, ...over['rhys'] } }, {
            campaign: {
                attackerPlayerId: 'dana',
                defenderPlayerId: 'rhys',
                nonImperialPlayerIds: [],
                allyPlayerIds: [],
                targets: [siteTarget('p1'), { kind: CampaignTargetKind.PawnAndFavor }],
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
            },
            ...state
        }, oathRevision)
    }
    const banish = (siteId: string, burnFavor = true) =>
        new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'dana', placements: [], banishToSiteId: siteId, burnFavor }))
    const resolve = (s: HydratedOathGameState, siteId = 'c2', burnFavor = true) => {
        const action = banish(siteId, burnFavor)
        action.apply(s)
        return action
    }
    const reason = (s: HydratedOathGameState, siteId: string) => HydratedCampaignResolveVictory.reasonCannotResolveVictory(s, 'dana', banish(siteId))

    it('offers The Hidden Place when Rhys could flip, and not when Rhys could not', () => {
        expect(reason(won(), 'c2')).toBeUndefined()
        expect(reason(won({ rhys: { secrets: 0 } }), 'c2')).toMatch(/The Hidden Place/)
    })

    it('asks Rhys, and the burn and the end wait on the answer', () => {
        const s = won()
        const victory = resolve(s)
        expect(asked(s)).toEqual({ kind: PowerQuestionKind.FlipToTravel, cardId: HIDDEN_PLACE, askedPlayerId: 'rhys', move: PowerMoveKind.Banish, moverPlayerId: 'dana', fromSiteId: 'p1', siteId: 'c2' })
        expect(s.campaign?.banishPending).toEqual({ burnFavor: true })
        expect(s.getPlayerState('rhys')).toMatchObject({ siteId: 'p1', favor: 6 })
        expect(victory.metadata).toMatchObject({ favorBurned: 0, banishedToSiteId: undefined })
    })

    it('no: the pawn stays, the rest of the victory stands, and the Campaign ends', () => {
        const s = won()
        resolve(s)
        const answer = flip(s, false)
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'p1', secrets: 2, secretsFacedown: 0 })
        expect(s.getPlayerState('rhys').favor).toBe(3)
        expect(s.campaign).toBeUndefined()
        expect(answer.metadata?.triggered).toContain('dana burned 3 favor')
    })

    it('yes: flipped, banished, then half the favor burns and the Campaign ends', () => {
        const s = won()
        resolve(s)
        flip(s, true)
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'c2', secrets: 1, secretsFacedown: 1 })
        expect(s.getPlayerState('rhys').favor).toBe(3)
        expect(s.campaign).toBeUndefined()
    })

    it('with Toll Roads there: the flip, then the toll, then the burn; a refusal leaves Rhys and the secret', () => {
        const s = won({}, { ...TOLL, warbandsBySite: { c2: { ann: 2 }, h1: { [IMPERIAL_WARBANDS]: 2 } } })
        resolve(s)
        flip(s, true)
        expect(asked(s)).toMatchObject({ kind: PowerQuestionKind.PayTravelToll, move: PowerMoveKind.Banish, flipSecret: true })
        expect(s.campaign?.banishPending).toEqual({ burnFavor: true })
        toll(s, false)
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'p1', secrets: 2, secretsFacedown: 0 })
        expect(s.getPlayerState('rhys').favor).toBe(3)
        expect(s.campaign).toBeUndefined()
    })

    it('R-X.4 — before revision 15 The Hidden Place cannot be named', () => {
        expect(reason(won({}, {}, before), 'c2')).toMatch(/The Hidden Place/)
    })
})

describe("R-11.13-H1 — the Buried Giant's flip past the Narrow Pass on a power-made travel", () => {
    /** Rhys stands at the Buried Giant (c1); the Narrow Pass is p1; Dana is at p2 with the Whistle. */
    function giant(danaAt = 'p2', over: Over = {}) {
        return table({ dana: { siteId: danaAt, ...over['dana'] }, rhys: { siteId: 'c1', ...over['rhys'] } }, {
            warbandsBySite: { h1: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: { c1: BURIED_GIANT, c2: 'site.plains', p1: 'site.narrow-pass', p2: 'site.mountain', h1: 'site.river' }
        })
    }

    it('the Whistle from past the pass asks Rhys; yes brings Rhys, no keeps Rhys there', () => {
        const s = giant()
        whistle(s)
        expect(asked(s)).toEqual({ kind: PowerQuestionKind.FlipToTravel, cardId: WHISTLE, askedPlayerId: 'rhys', move: PowerMoveKind.Whistle, powerCardId: WHISTLE, moverPlayerId: 'dana', fromSiteId: 'c1', siteId: 'p2' })
        flip(s, true)
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'p2', secrets: 2, secretsFacedown: 1 })

        const stays = giant()
        whistle(stays)
        flip(stays, false)
        expect(secretsOf(stays, 'rhys')).toEqual({ siteId: 'c1', secrets: 2, secretsFacedown: 0 })
    })

    it('no question where the pass does not bind: at the pass itself, or within the region', () => {
        for (const danaAt of ['p1', 'c2']) {
            const s = giant(danaAt)
            whistle(s)
            expect(s.pendingQuestions).toBeUndefined()
            expect(secretsOf(s, 'rhys')).toEqual({ siteId: danaAt, secrets: 3, secretsFacedown: 0 })
        }
    })

    it('a banish past the pass has no card of its own, so its question names the Buried Giant', () => {
        const s = giant('c1')
        s.campaign = {
            attackerPlayerId: 'dana',
            defenderPlayerId: 'rhys',
            nonImperialPlayerIds: [],
            allyPlayerIds: [],
            targets: [siteTarget('c1'), { kind: CampaignTargetKind.PawnAndFavor }],
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
        new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'dana', placements: [], banishToSiteId: 'p2', burnFavor: false })).apply(s)
        expect(asked(s)).toEqual({ kind: PowerQuestionKind.FlipToTravel, cardId: BURIED_GIANT, askedPlayerId: 'rhys', move: PowerMoveKind.Banish, moverPlayerId: 'dana', fromSiteId: 'c1', siteId: 'p2' })
    })

    it('unable without a faceup secret', () => {
        const s = giant('p2', { rhys: { secrets: 0 } })
        whistle(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('rhys').siteId).toBe('c1')
    })
})

describe("R-11.7 — leaving a Shrouded Wood ignores The Hidden Place: the ruler's pick asks no flip", () => {
    it("Rhys, in Ann's Wood, Whistled by Dana from The Hidden Place: Ann picks The Hidden Place and Rhys flips nothing", () => {
        const s = table({ rhys: { siteId: 'h2' } }, {
            warbandsBySite: { c2: { dana: 2 }, h1: { [IMPERIAL_WARBANDS]: 2 }, h2: { ann: 2 } },
            siteCards: { c1: 'site.plains', c2: HIDDEN_PLACE, p1: 'site.marshes', h1: 'site.river', h2: 'site.shrouded-wood' }
        })
        whistle(s)
        expect(asked(s)).toMatchObject({ kind: PowerQuestionKind.ShroudedWoodDestination, askedPlayerId: 'ann' })
        answerQuestion(s, 'ann', { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'c2' })
        expect(secretsOf(s, 'rhys')).toEqual({ siteId: 'c2', secrets: 3, secretsFacedown: 0 })
        expect(queue(s)).toEqual([])
    })
})

describe('R-11.13-H1 on a player\'s own view', () => {
    const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

    /** The same answer on the server and on Dana's view, and neither changes the state or what Dana is served. */
    function sameOnOwnView<T>(s: HydratedOathGameState, check: (state: HydratedOathGameState) => T, expected: T) {
        const server = JSON.stringify(s.dehydrate())
        const seen = JSON.stringify(served(s, dana))
        expect(check(s)).toEqual(expected)
        expect(check(ownView(s))).toEqual(expected)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
        expect(JSON.stringify(served(s, dana))).toBe(seen)
    }

    // Rhys holds a facedown adviser, so Dana's view does not hold everything.
    const hidden = { advisers: [{ cardId: STORYTELLER, faceUp: false }] }

    it("the power-travel check, Palanquin's offer and the banish's check read only what Dana sees", () => {
        const s = table({ rhys: hidden })
        sameOnOwnView(s, (state) => reasonCannotTravelByPower(state, 'rhys', 'c2'), undefined)
        const none = table({ rhys: { ...hidden, secrets: 0 } })
        sameOnOwnView(none, (state) => reasonCannotTravelByPower(state, 'rhys', 'c2'), 'The Hidden Place: you cannot travel here unless you flip a secret facedown')

        const carried = table({ dana: { siteId: 'c1', relicIds: [], advisers: [{ cardId: PALANQUIN, faceUp: true }] }, rhys: { siteId: 'c1', ...hidden } }, { warbandsBySite: { c1: { dana: 1 }, h1: { [IMPERIAL_WARBANDS]: 2 } } })
        sameOnOwnView(carried, (state) => HydratedUseActionPower.reasonCannotUse(state, 'dana', PALANQUIN, powerIndexOf(PALANQUIN, PowerTiming.Action), [player('rhys'), site('c2')]), undefined)

        const won = table({ dana: { siteId: 'p1' }, rhys: { ...hidden, favor: 6 } }, {
            campaign: {
                attackerPlayerId: 'dana',
                defenderPlayerId: 'rhys',
                nonImperialPlayerIds: [],
                allyPlayerIds: [],
                targets: [siteTarget('p1'), { kind: CampaignTargetKind.PawnAndFavor }],
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
        const victory = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'dana', placements: [], banishToSiteId: 'c2', burnFavor: false }))
        sameOnOwnView(won, (state) => HydratedCampaignResolveVictory.reasonCannotResolveVictory(state, 'dana', victory), undefined)
    })
})

describe("R-11.13-H1 — the answers' checks on the asked player's own view", () => {
    const viewOf = (playerId: string): Visibility.Perspective => ({ kind: 'player', playerId })
    function sameOnOwnView<T>(s: HydratedOathGameState, playerId: string, check: (state: HydratedOathGameState) => T, expected: T) {
        const perspective = viewOf(playerId)
        const server = JSON.stringify(s.dehydrate())
        const seen = JSON.stringify(served(s, perspective))
        expect(check(s)).toEqual(expected)
        expect(check(OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, perspective)), perspective))).toEqual(expected)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
        expect(JSON.stringify(served(s, perspective))).toBe(seen)
    }
    // Dana holds a facedown adviser, so the asked player's view does not hold everything.
    const hidden = { advisers: [{ cardId: STORYTELLER, faceUp: false }] }

    it("Rhys's flip, and Dana's Brass Horse answer with and without the flip", () => {
        const s = table({ dana: hidden })
        whistle(s)
        sameOnOwnView(s, 'rhys', (state) => HydratedAnswerQuestion.reasonCannotAnswer(state, 'rhys', { kind: PowerQuestionKind.FlipToTravel, flip: true }), undefined)

        const h = table({ dana: { siteId: 'c1', relicIds: [HORSE] }, rhys: hidden }, { denizensBySite: { c1: [], c2: [WOLVES], p1: [], h1: [MUSHROOMS] } })
        h.requireVault().discardPiles[Region.Cradle] = [RANGERS]
        h.discardPileCounts[Region.Cradle] = 1
        actionPowerUse('dana', HORSE).apply(h)
        sameOnOwnView(h, 'dana', (state) => HydratedAnswerQuestion.reasonCannotAnswer(state, 'dana', { kind: PowerQuestionKind.TravelFreeTo, siteId: 'c2', flipSecret: true }), undefined)
        sameOnOwnView(h, 'dana', (state) => HydratedAnswerQuestion.reasonCannotAnswer(state, 'dana', { kind: PowerQuestionKind.TravelFreeTo, siteId: 'c2' }), 'travelling to c2 takes a faceup secret flipped facedown')
    })
})

describe('R-X.4 — the Whistle from The Hidden Place replays as it was recorded, at each revision', () => {
    it('before revision 15 nothing happens; from it, the flip and its answer', () => {
        for (const revision of [before, atRevision]) {
            const start = table({}, {}, revision).dehydrate()
            const game = testGame(['dana', 'rhys', 'ann', 'bea'])
            const used = engine.runNext(buildAction(UseActionPower, { playerId: 'dana', cardId: WHISTLE, powerIndex: powerIndexOf(WHISTLE, PowerTiming.Action), choices: [player('rhys')] }), structuredClone(start), game)
            const actions = [...used.processedActions]
            let recorded = used.updatedState
            if (revision === atRevision) {
                const answered = engine.runNext(buildAction(AnswerQuestion, { playerId: 'rhys', answer: { kind: PowerQuestionKind.FlipToTravel, flip: true } }), structuredClone(recorded), game)
                actions.push(...answered.processedActions)
                recorded = answered.updatedState
            }
            expect(recorded.players.find((p) => p.playerId === 'rhys')).toMatchObject({ siteId: revision === atRevision ? 'c2' : 'p1' })

            let replayed = structuredClone(start)
            for (const action of actions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded)
        }
    })
})
