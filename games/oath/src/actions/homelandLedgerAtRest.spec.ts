import { describe, expect, it } from 'vitest'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import { HydratedCampaignSacrifice } from './campaignSacrifice.js'
import { CompleteRest, HydratedCompleteRest } from './completeRest.js'
import { SearchPlay } from './searchResolve.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { Region } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { buildAction } from '../testing/actions.js'
import { battlePlanUse } from '../testing/choices.js'
import { engine } from '../testing/engine.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { adviser } from '../testing/tables.js'
import { playCard } from '../util/cardPlay.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const SNEAK_ATTACK = 'denizen.discord.sneak-attack'
const LANCERS = 'denizen.nomad.lancers'
const STORM_CALLER = 'denizen.nomad.storm-caller'
const STEPPE_NOMAD = 'c2:nomad'

const DANA = 'dana'
const RHYS = 'rhys'
const ANN = 'ann'
const PAWN: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }

/**
 * Dana's turn. Rhys rules c2, the Steppe (Homeland: a Nomad card played there gains a secret, unless a Nomad card was
 * discarded there this turn), where Lancers stands, and holds Sneak Attack.
 */
function board(revision: OathRevision) {
    return testState(
        withChancellor([
            testPlayer({ playerId: DANA, color: Color.Red, siteId: 'c1', favor: 4, secrets: 2, supply: 6, warbandsOnBoard: { [DANA]: 6 } }),
            testPlayer({ playerId: RHYS, color: Color.Blue, siteId: 'c1', favor: 3, secrets: 2, supply: 0, warbandsOnBoard: { [RHYS]: 4 }, advisers: [adviser(SNEAK_ATTACK)] }),
            testPlayer({ playerId: ANN, color: Color.Yellow, siteId: 'p1', favor: 0, supply: 6, warbandsOnBoard: { [ANN]: 2 }, warbandsInPersonalBank: { [ANN]: 12 } })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [LANCERS], p1: [] },
            warbandsBySite: { c2: { [RHYS]: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.steppe', p1: 'site.mountain', p2: 'site.river' }
        }
    )
}

const game = testGame([DANA, RHYS, ANN])

/** Every Campaign step goes through `GameEngine`, so the machine state and the questions are the engine's. */
class Table {
    state: OathProjectedState
    private seq = 0

    constructor(s: HydratedOathGameState) {
        this.state = s.dehydrate()
        this.state.turnManager = { series: [{ type: 'turn', playerId: DANA, start: 0 }], turnOrder: [DANA, RHYS, ANN], turnCounts: { [DANA]: 1, [RHYS]: 1, [ANN]: 1 } }
        this.state.activePlayerIds = [DANA]
    }

    run(fields: { type: ActionType; playerId: string } & Record<string, unknown>) {
        const action: GameAction = { id: `ledger-${(this.seq += 1)}`, gameId: 'game-1', source: ActionSource.User, index: this.state.actionCount, ...fields }
        this.state = engine.run(action, this.state, game).updatedState
        return this
    }

    /** No attack dice make a certain defeat (R-5.5.5.b). */
    campaignAndLose(playerId: string, defender: string, plans: string[] = []) {
        this.run({ type: ActionType.Campaign, playerId, defender: { kind: 'player', playerId: defender }, targets: [PAWN], attackDice: 0, plans: plans.map(battlePlanUse) })
        if (this.state.machineState === MachineState.CampaignPlans) this.run({ type: ActionType.CampaignDefend, playerId: defender, plans: [] })
        const defeatKills = HydratedCampaignSacrifice.attackerDefeatKills(new HydratedOathGameState(this.state), 0)
        return this.run({ type: ActionType.CampaignSacrifice, playerId, sacrifice: 0, defeatKills })
    }
}

/**
 * Dana campaigns against Rhys and loses; Rhys answers with Sneak Attack, a Campaign in Dana's turn, using Lancers
 * from the Steppe Rhys rules ("At end, discard"), so the Lancers' discard there is written to Rhys's Homeland ledger.
 */
function afterSneakAttack(revision: OathRevision) {
    const t = new Table(board(revision)).campaignAndLose(DANA, RHYS)
    expect(t.state.pendingQuestions?.queue[0]?.kind).toBe(PowerQuestionKind.SneakAttack)
    t.campaignAndLose(RHYS, DANA, [LANCERS])
    const s = new HydratedOathGameState(t.state)
    expect(s.turnManager.series.at(-1)?.playerId).toBe(DANA)
    expect(s.denizensAt('c2')).not.toContain(LANCERS)
    expect(s.getPlayerState(RHYS).homelandUsedThisTurn).toEqual([STEPPE_NOMAD])
    return s
}

const rest = (s: HydratedOathGameState, playerId: string) => new HydratedCompleteRest(buildAction(CompleteRest, { playerId })).apply(s)

/** Rhys's own turn, at the Steppe, plays a Nomad card there. */
function rhysPlaysToTheSteppe(s: HydratedOathGameState) {
    openTurn(s, RHYS)
    s.getPlayerState(RHYS).siteId = 'c2'
    const secrets = s.getPlayerState(RHYS).secrets
    const played = playCard(s, RHYS, STORM_CALLER, SearchPlay.Site, Region.Cradle)
    return { sitePower: played.sitePower, gained: s.getPlayerState(RHYS).secrets - secrets }
}

describe('a Homeland ledger entry lasts the turn in play (R-11.2: "during this turn")', () => {
    it("Rhys's discard in Dana's turn (Sneak Attack) is cleared at Dana's Rest, so in Rhys's own turn the Steppe pays Rhys its secret", () => {
        const s = afterSneakAttack(OathRevision.EngineFixes12)
        rest(s, DANA)
        expect(s.getPlayerState(RHYS).homelandUsedThisTurn).toEqual([])
        expect(rhysPlaysToTheSteppe(s)).toEqual({ sitePower: 'Steppe (Homeland): gained a secret', gained: 1 })
    })

    it("the turn holder's own entry still bars their gain for the rest of their turn, and is cleared at their Rest", () => {
        const s = board(OathRevision.EngineFixes12)
        openTurn(s, RHYS)
        s.getPlayerState(RHYS).siteId = 'c2'
        s.getPlayerState(RHYS).homelandUsedThisTurn = [STEPPE_NOMAD]
        const played = playCard(s, RHYS, STORM_CALLER, SearchPlay.Site, Region.Cradle)
        expect(played.sitePower).toMatch(/^Steppe: no Homeland gain/)
        rest(s, RHYS)
        expect(s.getPlayerState(RHYS).homelandUsedThisTurn).toEqual([])
    })

    it("a power's discard in its user's own turn (Salt the Earth's) still bars that user's gain there until their Rest", () => {
        const s = board(OathRevision.EngineFixes12)
        openTurn(s, DANA)
        s.getPlayerState(DANA).siteId = 'c2'
        playCard(s, DANA, 'denizen.discord.salt-the-earth', SearchPlay.Site, Region.Cradle)
        expect(s.denizensAt('c2')).not.toContain(LANCERS)
        expect(s.getPlayerState(DANA).homelandUsedThisTurn).toEqual([STEPPE_NOMAD])
        expect(playCard(s, DANA, STORM_CALLER, SearchPlay.Site, Region.Cradle).sitePower).toMatch(/^Steppe: no Homeland gain/)
        rest(s, DANA)
        expect(s.getPlayerState(DANA).homelandUsedThisTurn).toEqual([])
    })

    it("every seat's ledger is cleared at each Rest, the resting seat's and the others'", () => {
        const s = board(OathRevision.EngineFixes12)
        openTurn(s, DANA)
        s.getPlayerState(DANA).homelandUsedThisTurn = ['c1:discord']
        s.getPlayerState(RHYS).homelandUsedThisTurn = [STEPPE_NOMAD]
        s.getPlayerState(ANN).homelandUsedThisTurn = ['p1:order']
        rest(s, DANA)
        expect(s.players.flatMap((p) => p.homelandUsedThisTurn)).toEqual([])
    })

    describe('before revision 16 a recorded game replays as it was recorded', () => {
        it("only the resting seat's ledger is cleared", () => {
            const s = board(OathRevision.EngineFixes11)
            openTurn(s, DANA)
            s.getPlayerState(DANA).homelandUsedThisTurn = ['c1:discord']
            s.getPlayerState(RHYS).homelandUsedThisTurn = [STEPPE_NOMAD]
            rest(s, DANA)
            expect(s.getPlayerState(DANA).homelandUsedThisTurn).toEqual([])
            expect(s.getPlayerState(RHYS).homelandUsedThisTurn).toEqual([STEPPE_NOMAD])
        })

        it("so Rhys's Sneak Attack discard still bars the Steppe in Rhys's own turn", () => {
            const s = afterSneakAttack(OathRevision.EngineFixes11)
            rest(s, DANA)
            expect(s.getPlayerState(RHYS).homelandUsedThisTurn).toEqual([STEPPE_NOMAD])
            expect(rhysPlaysToTheSteppe(s).gained).toBe(0)
        })
    })
})
