import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { PlayerStatus } from '../model/oathEnums.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { cardPower, PowerTiming } from '../data/cardPowers.js'
import { HydratedLetPeek, LetPeekSubjectKind } from '../actions/letPeek.js'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { HydratedOfferCitizenship } from '../actions/offerCitizenship.js'
import { canUseGrandScepter } from '../util/imperial.js'
import { PowerQuestionKind } from '../model/question.js'
import { PowerChoiceKind } from '../util/powerChoice.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { actionPowerUse, siteTarget } from '../testing/choices.js'
import { rulerTable } from '../testing/tables.js'
import { ATTACKER, DEFENDER, answerQuestion, campaign, finishCampaign } from '../testing/steps.js'
import { ongoingCampaign } from '../testing/required.js'
import { OathRevision } from '../util/revision.js'
import { giveRelic, takeRelic } from '../util/relics.js'
import '../powers/index.js'

describe("the Grand Scepter's continuous lockout is dead while its three permissions are live", () => {
    function board() {
        return testState(
            [
                testPlayer({
                    playerId: 'chancellor',
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'c1'
                }),
                testPlayer({
                    playerId: 'holder',
                    color: Color.Red,
                    status: PlayerStatus.Exile,
                    siteId: 'c2',
                    relicIds: [GRAND_SCEPTER_ID]
                }),
                testPlayer({ playerId: 'target', color: Color.Blue, status: PlayerStatus.Exile, siteId: 'c2' })
            ],
            {
                chancellorPlayerId: 'chancellor',
                reliquary: [{ slotId: 'reliquary.0' }]
            }
        )
    }

    it('the registry knows the lockout, and the state can represent it', () => {
        const lockout = cardPower(GRAND_SCEPTER_ID, 0)
        expect(lockout?.timing).toBe(PowerTiming.Continuous)
        expect(lockout?.text).toMatch(/cannot use this if you took it on this turn/i)
    })

    it('taken this turn: showing an Exile a Reliquary relic is refused; next turn it opens', () => {
        const state = board()
        state.turnManager.series = [{ type: 'turn', playerId: 'holder', start: 4 }]
        state.grandScepterTakenOnTurnStart = 4

        expect(
            HydratedLetPeek.reasonCannotLetPeek(state, 'holder', 'target', { kind: LetPeekSubjectKind.Reliquary, slotId: 'reliquary.0' })
        ).toMatch(/cannot be used on the turn it was taken/)

        state.turnManager.series = [{ type: 'turn', playerId: 'holder', start: 9 }]
        expect(
            HydratedLetPeek.reasonCannotLetPeek(state, 'holder', 'target', { kind: LetPeekSubjectKind.Reliquary, slotId: 'reliquary.0' })
        ).toBeUndefined()
    })

    it('a holder who did not take it this turn shows it freely (no over-lock)', () => {
        const state = board()
        expect(
            HydratedLetPeek.reasonCannotLetPeek(state, 'holder', 'target', { kind: LetPeekSubjectKind.Reliquary, slotId: 'reliquary.0' })
        ).toBeUndefined()
    })
})

describe('Scepter double delivery: the same act is reachable through two doors with different gates', () => {
    function board() {
        return testState(
            [
                testPlayer({
                    playerId: 'chancellor',
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'c1'
                }),
                testPlayer({
                    playerId: 'holder',
                    color: Color.Red,
                    status: PlayerStatus.Exile,
                    siteId: 'c2',
                    relicIds: [GRAND_SCEPTER_ID]
                }),
                testPlayer({
                    playerId: 'target',
                    color: Color.Blue,
                    status: PlayerStatus.Exile,
                    siteId: 'c2'
                })
            ],
            {
                chancellorPlayerId: 'chancellor',
                reliquary: [{ slotId: 'reliquary.0' }]
            }
        )
    }

    it('the R-6 minor actions are open while the R-6.2 card power refuses', () => {
        const state = board()

        expect(
            HydratedLetPeek.reasonCannotLetPeek(state, 'holder', 'target', { kind: LetPeekSubjectKind.Reliquary, slotId: 'reliquary.0' })
        ).toBeUndefined()
        expect(
            HydratedOfferCitizenship.canDoOfferCitizenship(state, 'holder')
        ).toBe(true)

        // Power 1 is the Scepter's printed Peek.
        const holderHasAccess = HydratedUseActionPower.reasonCannotUse(
            state,
            'holder',
            GRAND_SCEPTER_ID,
            1
        )
        expect(holderHasAccess).toMatch(/power 1 cannot be used as an "Action:" power/)
    })
})

describe('The Grand Scepter given in an exchange is not taken (its Q&A: "Take and give are unique keywords")', () => {
    const TINKERS_FAIR = 'denizen.hearth.tinkers-fair'

    it("received through Tinker's Fair on its new holder's turn, it can be used at once", () => {
        const s = rulerTable([TINKERS_FAIR], [], { other: { relicIds: [GRAND_SCEPTER_ID] } })
        actionPowerUse('ruler', TINKERS_FAIR, [
            { kind: PowerChoiceKind.Exchange, withPlayerId: 'other', terms: { fromProposer: { favor: 1 }, fromCounterparty: { relicCardIds: [GRAND_SCEPTER_ID] } } }
        ]).apply(s)
        answerQuestion(s, 'other', { kind: PowerQuestionKind.Exchange, accept: true })
        expect(s.getPlayerState('ruler').relicIds).toEqual([GRAND_SCEPTER_ID])
        expect(s.grandScepterTakenOnTurnStart).toBeUndefined()
        expect(canUseGrandScepter(s, 'ruler')).toBe(true)
    })

    it('taken from a defeated defender, it is still locked for the turn', () => {
        for (let seed = 1; seed < 200; seed++) {
            const s = testState(
                [
                    testPlayer({ playerId: ATTACKER, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', warbandsOnBoard: { [ATTACKER]: 10 } }),
                    testPlayer({ playerId: DEFENDER, color: Color.Yellow, status: PlayerStatus.Exile, siteId: 'c1', relicIds: [GRAND_SCEPTER_ID] })
                ],
                { warbandsBySite: { c1: { [DEFENDER]: 1 } }, prng: { seed, invocations: 0 } }
            )
            openTurn(s, ATTACKER)
            campaign({ targets: [siteTarget('c1'), { kind: CampaignTargetKind.Relic, cardId: GRAND_SCEPTER_ID }], attackDice: 10 }).apply(s)
            if (ongoingCampaign(s).swords <= ongoingCampaign(s).defense) continue
            finishCampaign(s)
            expect(s.getPlayerState(ATTACKER).relicIds).toEqual([GRAND_SCEPTER_ID])
            expect(canUseGrandScepter(s, ATTACKER)).toBe(false)
            return
        }
        throw new Error('no seed gave the attacker the victory')
    })

    it('won in a Campaign and given away on the same turn, its new holder did not take it and may use it', () => {
        for (let seed = 1; seed < 200; seed++) {
            const s = testState(
                [
                    testPlayer({ playerId: ATTACKER, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', favor: 2, warbandsOnBoard: { [ATTACKER]: 10 }, advisers: [{ cardId: TINKERS_FAIR, faceUp: true }] }),
                    testPlayer({ playerId: DEFENDER, color: Color.Yellow, status: PlayerStatus.Exile, siteId: 'c1', relicIds: [GRAND_SCEPTER_ID] }),
                    testPlayer({ playerId: 'receiver', color: Color.Blue, status: PlayerStatus.Exile, siteId: 'c1', favor: 2 }),
                    testPlayer({ playerId: 'peeker', color: Color.White, status: PlayerStatus.Exile, siteId: 'c2' })
                ],
                { oathRevision: OathRevision.EngineFixes2, warbandsBySite: { c1: { [DEFENDER]: 1 } }, prng: { seed, invocations: 0 } }
            )
            openTurn(s, ATTACKER)
            campaign({ targets: [siteTarget('c1'), { kind: CampaignTargetKind.Relic, cardId: GRAND_SCEPTER_ID }], attackDice: 10 }).apply(s)
            if (ongoingCampaign(s).swords <= ongoingCampaign(s).defense) continue
            finishCampaign(s)
            expect(canUseGrandScepter(s, ATTACKER)).toBe(false)

            actionPowerUse(ATTACKER, TINKERS_FAIR, [
                { kind: PowerChoiceKind.Exchange, withPlayerId: 'receiver', terms: { fromProposer: { relicCardIds: [GRAND_SCEPTER_ID] }, fromCounterparty: { favor: 1 } } }
            ]).apply(s)
            answerQuestion(s, 'receiver', { kind: PowerQuestionKind.Exchange, accept: true })
            expect(s.getPlayerState('receiver').relicIds).toEqual([GRAND_SCEPTER_ID])
            expect(canUseGrandScepter(s, 'receiver')).toBe(true)
            expect(HydratedLetPeek.reasonCannotLetPeek(s, 'receiver', 'peeker', { kind: LetPeekSubjectKind.Reliquary, slotId: 'reliquary.0' })).toBeUndefined()
            return
        }
        throw new Error('no seed gave the attacker the victory')
    })

    function handedOn(oathRevision: number) {
        const s = testState(
            [
                testPlayer({ playerId: 'taker', color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1' }),
                testPlayer({ playerId: 'given', color: Color.Blue, status: PlayerStatus.Exile, siteId: 'c1' })
            ],
            { oathRevision }
        )
        openTurn(s, 'taker')
        takeRelic(s, 'taker', GRAND_SCEPTER_ID)
        giveRelic(s, 'taker', 'given', GRAND_SCEPTER_ID)
        return s
    }

    it('one who took it this turn is still locked when it is given back to them', () => {
        const s = handedOn(OathRevision.EngineFixes2)
        expect(canUseGrandScepter(s, 'given')).toBe(true)
        giveRelic(s, 'given', 'taker', GRAND_SCEPTER_ID)
        expect(canUseGrandScepter(s, 'taker')).toBe(false)
    })

    it('R-X.4 — before revision 5 a take named no taker, so whoever then held it was locked for the turn', () => {
        const s = handedOn(OathRevision.CardFixes1)
        expect(s.grandScepterTakenBy).toBeUndefined()
        expect(canUseGrandScepter(s, 'given')).toBe(false)
    })
})
