import { describe, expect, it } from 'vitest'
import { Color, assert, type GameAction, type Visibility } from '@tabletop/common'
import { OathVisibility } from '../definition/runtime.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { ClaimDealKept, HydratedClaimDealKept, isClaimDealKept } from '../actions/claimDealKept.js'
import {
    HydratedLeaveDealUnconfirmed,
    LeaveDealUnconfirmed,
    isLeaveDealUnconfirmed
} from '../actions/leaveDealUnconfirmed.js'
import { AnswerQuestion, isAnswerQuestion } from '../actions/answerQuestion.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { FINAL_ROUND, isCompleteRest } from '../actions/completeRest.js'
import { HydratedResolveWake, ResolveWake } from '../actions/resolveWake.js'
import { HydratedRollEndDie, RollEndDie } from '../actions/rollEndDie.js'
import { HydratedOathGameState, OathGameStateValidator, type OathProjectedState } from '../model/gameState.js'
import { PowerQuestionKind, type OpenDeal } from '../model/question.js'
import { Banner, OathType, PlayerStatus, Suit } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { TRIBUNAL_ID } from '../data/cardPowers.js'
import { OathRevision } from '../util/revision.js'
import { forcedOutcome } from '../util/forcedOutcomes.js'
import { buildAction } from '../testing/actions.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { openTurn, testBanners, testPlayer, testState } from '../testing/fixture.js'
import { rulerTable, twoSeatActPhase } from '../testing/tables.js'
import '../powers/index.js'

// R-7.6.3-H1 — from revision 28 a Tribunal deal with a promise stays open until it is closed.
const SEATS = ['ruler', 'other', 'away']
const game = testGame(SEATS)
const MINE = 'I will not campaign against you next round.'
const THEIRS = 'Nor I against you.'
// R-1.7 — a game seats a Chancellor; here the seat away from the Tribunal.
const SEATED = { away: { status: PlayerStatus.Chancellor, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 } } }

const deal = (id: string, proposerPlayerId: string, counterpartyPlayerId: string, extra: Partial<OpenDeal> = {}): OpenDeal => ({
    id,
    proposerPlayerId,
    counterpartyPlayerId,
    proposerPromise: MINE,
    counterpartyPromise: THEIRS,
    round: 1,
    ...extra
})

/** The ruler's Act Phase in round 1, with these deals open. */
function table(openDeals: OpenDeal[], oathRevision = OathRevision.EngineFixes24): OathProjectedState {
    return rulerTable([], [], SEATED, { oathRevision, openDeals, chancellorPlayerId: 'away' }).dehydrate()
}

function run(action: GameAction, state: OathProjectedState) {
    return engine.runNext(action, state, game)
}

const claim = (playerId: string, dealId: string) => buildAction(ClaimDealKept, { playerId, dealId })
const leave = (playerId: string, dealId: string) => buildAction(LeaveDealUnconfirmed, { playerId, dealId })
const answer = (playerId: string, kept: boolean) =>
    buildAction(AnswerQuestion, { playerId, answer: { kind: PowerQuestionKind.DealKept, kept } })
const offered = (state: OathProjectedState, playerId: string) => engine.getValidActionTypesForPlayer(game, state, playerId)

describe('R-7.6.3-H1 — claiming a deal kept', () => {
    it('a party claims it as a minor action: the other party is asked, and the deal records the turn it was claimed in', () => {
        const result = run(claim('ruler', 'd1'), table([deal('d1', 'other', 'ruler')]))
        const after = result.updatedState
        expect(after.machineState).toBe(MachineState.PowerQuestion)
        expect(after.activePlayerIds).toEqual(['other'])
        expect(after.pendingQuestions?.queue).toEqual([
            { kind: PowerQuestionKind.DealKept, cardId: TRIBUNAL_ID, askedPlayerId: 'other', claimantPlayerId: 'ruler', dealId: 'd1' }
        ])
        expect(after.openDeals).toEqual([deal('d1', 'other', 'ruler', { lastClaimedTurn: { round: 1, playerId: 'ruler' } })])
        expect(result.processedActions.find(isClaimDealKept)?.metadata).toEqual({ askedPlayerId: 'other' })
    })

    it('"Yes, it was kept" closes the deal, the answer records the deal it closed, and the turn goes on', () => {
        const open = deal('d1', 'ruler', 'other')
        const asked = run(claim('ruler', 'd1'), table([open, deal('d2', 'away', 'ruler')])).updatedState
        const result = run(answer('other', true), asked)
        const after = result.updatedState
        expect(after.openDeals?.map((d) => d.id)).toEqual(['d2'])
        expect(after.machineState).toBe(MachineState.ActPhase)
        expect(after.activePlayerIds).toEqual(['ruler'])
        const record = result.processedActions.find(isAnswerQuestion)
        expect(record?.metadata).toMatchObject({
            kind: PowerQuestionKind.DealKept,
            cardId: TRIBUNAL_ID,
            summary: 'confirmed the deal with ruler was kept',
            answeredDeal: { ...open, lastClaimedTurn: { round: 1, playerId: 'ruler' } }
        })
        // The last deal closed leaves no list behind, as before any deal was made.
        const last = run(answer('other', true), run(claim('ruler', 'd1'), table([open])).updatedState).updatedState
        expect(last.openDeals).toBeUndefined()
    })

    it('"Not kept" leaves the deal open, and it cannot be claimed again this turn: only leaving it is offered', () => {
        const asked = run(claim('ruler', 'd1'), table([deal('d1', 'ruler', 'other')])).updatedState
        const result = run(answer('other', false), asked)
        const after = result.updatedState
        expect(after.openDeals).toEqual([deal('d1', 'ruler', 'other', { lastClaimedTurn: { round: 1, playerId: 'ruler' } })])
        expect(result.processedActions.find(isAnswerQuestion)?.metadata?.summary).toBe('said the deal with ruler was not kept')
        expect(after.machineState).toBe(MachineState.ActPhase)
        expect(offered(after, 'ruler')).not.toContain(ActionType.ClaimDealKept)
        expect(offered(after, 'ruler')).toContain(ActionType.LeaveDealUnconfirmed)
        expect(HydratedClaimDealKept.reasonCannotClaim(new HydratedOathGameState(after), 'ruler', 'd1')).toBe(
            'this deal was already claimed kept this turn'
        )
        expect(() => run(claim('ruler', 'd1'), after)).toThrow()
    })

    it('one claim per deal per turn of the game: the other party may claim it in their turn, and either in a later round', () => {
        const claimed = deal('d1', 'ruler', 'other', { lastClaimedTurn: { round: 1, playerId: 'ruler' } })
        const reason = (turnOf: string, round: number, playerId: string) => {
            const s = new HydratedOathGameState(table([claimed]))
            s.round = round
            openTurn(s, turnOf)
            return HydratedClaimDealKept.reasonCannotClaim(s, playerId, 'd1')
        }
        expect(reason('ruler', 1, 'ruler')).toBe('this deal was already claimed kept this turn')
        expect(reason('other', 1, 'other')).toBeUndefined()
        expect(reason('ruler', 2, 'ruler')).toBeUndefined()
    })

    it('claims only a deal the player is party to, and another deal of theirs is still offered after one is claimed', () => {
        const s = new HydratedOathGameState(table([deal('d1', 'other', 'away'), deal('d2', 'ruler', 'away')]))
        expect(HydratedClaimDealKept.reasonCannotClaim(s, 'ruler', 'd1')).toBe('you have no open deal by that name')
        expect(HydratedClaimDealKept.reasonCannotClaim(s, 'ruler', 'd9')).toBe('you have no open deal by that name')
        const two = table([deal('d1', 'ruler', 'other'), deal('d2', 'ruler', 'away')])
        const once = run(answer('other', false), run(claim('ruler', 'd1'), two).updatedState).updatedState
        expect(offered(once, 'ruler')).toContain(ActionType.ClaimDealKept)
        expect(run(claim('ruler', 'd2'), once).updatedState.pendingQuestions?.queue[0]).toMatchObject({ askedPlayerId: 'away', dealId: 'd2' })
    })

    it('the question is refused, asked or answered, once its deal is no longer open, as an offer is', () => {
        const asked = new HydratedOathGameState(run(claim('ruler', 'd1'), table([deal('d1', 'ruler', 'other')])).updatedState)
        const question = { kind: PowerQuestionKind.DealKept, cardId: TRIBUNAL_ID, askedPlayerId: 'other', claimantPlayerId: 'ruler', dealId: 'd1' } as const
        expect(asked.pendingQuestions?.queue).toEqual([question])
        expect(forcedOutcome(asked, question)).toBeUndefined()
        expect(forcedOutcome(asked, { ...question, askedPlayerId: 'away' })).toBe('the deal is no longer open')
        asked.openDeals = undefined
        expect(forcedOutcome(asked, question)).toBe('the deal is no longer open')
        expect(() => run(answer('other', true), asked.dehydrate())).toThrow('the deal is no longer open')
    })
})

describe('R-7.6.3-H1 — when the deals are offered', () => {
    it('Claim and Leave are offered only to a party with an open deal, in their own Act Phase', () => {
        const open = table([deal('d1', 'other', 'ruler')])
        expect(offered(open, 'ruler')).toEqual(expect.arrayContaining([ActionType.ClaimDealKept, ActionType.LeaveDealUnconfirmed]))
        expect(offered(table([deal('d1', 'other', 'away')]), 'ruler')).not.toContain(ActionType.ClaimDealKept)
        expect(offered(table([deal('d1', 'other', 'away')]), 'ruler')).not.toContain(ActionType.LeaveDealUnconfirmed)
        expect(offered(table([]), 'ruler')).not.toContain(ActionType.ClaimDealKept)
        // The other party waits for their own turn.
        expect(offered(open, 'other')).toEqual([])
        expect(() => run(claim('other', 'd1'), open)).toThrow()
        expect(() => run(leave('other', 'd1'), open)).toThrow()
    })

    it('while a free Travel is due they are hidden like every other minor action', () => {
        const s = rulerTable([], [], { ...SEATED, ruler: { freeTravelAtAction: 0 } }, { oathRevision: OathRevision.EngineFixes24, openDeals: [deal('d1', 'ruler', 'other')], chancellorPlayerId: 'away' })
        const types = offered(s.dehydrate(), 'ruler')
        expect(types).toContain(ActionType.Travel)
        expect(types).not.toContain(ActionType.ClaimDealKept)
        expect(types).not.toContain(ActionType.LeaveDealUnconfirmed)
    })
})

describe('R-7.6.3-H1 — leaving a deal unconfirmed', () => {
    it('either party closes it on their own turn, asking no one; the record keeps the deal with both promises', () => {
        const open = deal('d1', 'other', 'ruler')
        const result = run(leave('ruler', 'd1'), table([open, deal('d2', 'ruler', 'away')]))
        const after = result.updatedState
        expect(after.openDeals?.map((d) => d.id)).toEqual(['d2'])
        expect(after.pendingQuestions).toBeUndefined()
        expect(after.machineState).toBe(MachineState.ActPhase)
        expect(after.activePlayerIds).toEqual(['ruler'])
        const record = result.processedActions.find(isLeaveDealUnconfirmed)
        expect(record?.metadata).toEqual({ deal: open })
        expect(record?.revealsInfo).toBeFalsy()
        const last = run(leave('ruler', 'd1'), table([open])).updatedState
        expect(last.openDeals).toBeUndefined()
    })

    it('a claimed deal may still be left the same turn', () => {
        const asked = run(claim('ruler', 'd1'), table([deal('d1', 'ruler', 'other')])).updatedState
        const notKept = run(answer('other', false), asked).updatedState
        expect(run(leave('ruler', 'd1'), notKept).updatedState.openDeals).toBeUndefined()
    })

    it('leaves only a deal the player is party to', () => {
        const s = new HydratedOathGameState(table([deal('d1', 'other', 'away')]))
        expect(HydratedLeaveDealUnconfirmed.reasonCannotLeave(s, 'ruler', 'd1')).toBe('you have no open deal by that name')
        expect(HydratedLeaveDealUnconfirmed.reasonCannotLeave(s, 'other', 'd1')).toBeUndefined()
    })
})

describe('R-7.6.3-H1 — a deal’s claim, answer and closing are public', () => {
    const VIEWS: Visibility.Perspective[] = [...SEATS.map((playerId) => ({ kind: 'player', playerId }) as const), { kind: 'spectator' }]

    it('every seat and a spectator read the claim’s question, the deal it names, and each record in full', () => {
        const open = deal('d1', 'ruler', 'other')
        const claimed = run(claim('ruler', 'd1'), table([open]))
        const answered = run(answer('other', false), claimed.updatedState)
        const left = run(leave('ruler', 'd1'), answered.updatedState)
        const records = [...claimed.processedActions, ...answered.processedActions, ...left.processedActions]
        const metadataOf = (action: GameAction) => (action as { metadata?: unknown }).metadata
        const canonical = claimed.updatedState
        assert(OathGameStateValidator.Check(canonical), 'the engine returns the canonical state')
        for (const view of VIEWS) {
            const seen = OathVisibility.state.project(canonical, view)
            expect(seen.pendingQuestions?.queue, view.kind).toEqual(canonical.pendingQuestions?.queue)
            expect(seen.openDeals).toEqual(canonical.openDeals)
            for (const record of records) {
                const shown = OathVisibility.actions.project(record, view)
                expect(metadataOf(shown), `${record.type} to ${view.kind}`).toEqual(metadataOf(record))
                if ('dealId' in record) expect(shown).toHaveProperty('dealId', record.dealId)
            }
        }
    })
})

describe('R-7.6.3-H1 — the deals still open when the game ends', () => {
    const p1p2 = deal('d1', 'p1', 'p2')
    const p2p1: OpenDeal = { id: 'd2', proposerPlayerId: 'p2', counterpartyPlayerId: 'p1', proposerPromise: THEIRS, round: 3 }

    function playToEnd(openDeals?: OpenDeal[]) {
        const twoSeats = testGame(['p1', 'p2'])
        const state = twoSeatActPhase('p2', { oathkeeperPlayerId: 'p1', round: FINAL_ROUND, oathRevision: OathRevision.EngineFixes24, ...(openDeals ? { openDeals } : {}) })
        // From the turn-flow revision the Rest with nothing to choose follows by itself, and ends the game.
        return engine.runNext(buildAction(EndActPhase, { playerId: 'p2' }), state, twoSeats)
    }

    it('the ending action records them and drops them, and the ending replays the same', () => {
        const result = playToEnd([p1p2, p2p1])
        expect(result.updatedState.machineState).toBe(MachineState.EndOfGame)
        expect(result.updatedState.openDeals).toBeUndefined()
        expect(result.processedActions.find(isCompleteRest)?.metadata?.openDealsDropped).toEqual([p1p2, p2p1])
        const again = playToEnd([p1p2, p2p1])
        expect(JSON.stringify(again.updatedState)).toBe(JSON.stringify(result.updatedState))
        expect(again.processedActions.find(isCompleteRest)?.metadata).toEqual(result.processedActions.find(isCompleteRest)?.metadata)
    })

    it('a game that ends with no deal open records none', () => {
        const rest = playToEnd().processedActions.find(isCompleteRest)
        expect(rest?.metadata).not.toHaveProperty('openDealsDropped')
    })

    it('a win at the Wake records and drops them too', () => {
        const state = testState(
            [
                testPlayer({ playerId: 'p1', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c1', warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 } }),
                testPlayer({ playerId: 'p2', color: Color.Red, status: PlayerStatus.Exile, siteId: 'c2', warbandsInPersonalBank: { p2: 4 } })
            ],
            {
                chancellorPlayerId: 'p1',
                oathRevision: OathRevision.EngineFixes24,
                oathType: OathType.ThePeople,
                oathkeeperPlayerId: 'p2',
                oathkeeperIsUsurper: true,
                banners: testBanners({ [Banner.PeoplesFavor]: 'p2' }, 2),
                openDeals: [p1p2]
            }
        )
        openTurn(state, 'p2')
        const wake = new HydratedResolveWake(buildAction(ResolveWake, { playerId: 'p2', favorSteps: [{ kind: 'return', toSuit: Suit.Discord }] }))
        wake.apply(state)
        expect(state.winningPlayerIds).toEqual(['p2'])
        expect(wake.metadata?.openDealsDropped).toEqual([p1p2])
        expect(state.openDeals).toBeUndefined()
    })

    it('a win on the end die records and drops them too; a roll that goes on keeps them open', () => {
        const rolled = (seed: number) => {
            const state = twoSeatActPhase('p2', { machineState: MachineState.EndOfRound, oathkeeperPlayerId: 'p1', round: 6, oathRevision: OathRevision.EngineFixes24, openDeals: [p1p2], prng: { seed, invocations: 0 } })
            const s = new HydratedOathGameState(state)
            const roll = new HydratedRollEndDie(buildAction(RollEndDie, { playerId: 'p1' }))
            roll.apply(s)
            return { s, roll }
        }
        const seeds = Array.from({ length: 200 }, (_, i) => i + 1)
        const win = seeds.map(rolled).find(({ s }) => s.winningPlayerIds.length > 0)
        const goesOn = seeds.map(rolled).find(({ s }) => s.winningPlayerIds.length === 0)
        expect(win?.roll.metadata?.openDealsDropped).toEqual([p1p2])
        expect(win?.s.openDeals).toBeUndefined()
        expect(goesOn?.roll.metadata).not.toHaveProperty('openDealsDropped')
        expect(goesOn?.s.openDeals).toEqual([p1p2])
    })
})
