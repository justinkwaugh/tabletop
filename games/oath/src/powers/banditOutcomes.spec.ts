import { describe, expect, it } from 'vitest'
import { Color, type GameAction } from '@tabletop/common'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { Campaign } from '../actions/campaign.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { expectFavorConserved } from '../testing/census.js'
import { ongoingCampaign } from '../testing/required.js'
import { buildAction } from '../testing/actions.js'
import { siteTarget } from '../testing/choices.js'
import { INN, TENTS } from '../testing/cards.js'
import { ATTACKER, campaign, finishCampaign, finishCampaignSteps } from '../testing/steps.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const HONORS = 'denizen.order.battle-honors'
const PARADE = 'denizen.order.military-parade'
const DOCTOR = 'denizen.hearth.traveling-doctor'
const RENEWAL = 'denizen.discord.vow-of-renewal'
const CHANCELLOR = 'chancellor'

const atRevision = OathRevision.CardFixes1
const before = OathRevision.PlanCostsAndSearchPlays

/** The attacker, with a hearth and a nomad adviser, campaigns against the bandits at c1; the Chancellor holds Vow of Renewal. */
function table(oathRevision: number, banditCards: string[], seed = 1) {
    const s = testState(
        [
            testPlayer({
                playerId: ATTACKER, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 6, favor: 4, secrets: 3,
                warbandsOnBoard: { [ATTACKER]: 4 }, warbandsInPersonalBank: { [ATTACKER]: 6 },
                advisers: [{ cardId: INN, faceUp: true }, { cardId: TENTS, faceUp: true }]
            }),
            testPlayer({
                playerId: CHANCELLOR, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', favor: 2,
                advisers: [{ cardId: RENEWAL, faceUp: true }]
            })
        ],
        {
            oathRevision,
            denizensBySite: { c1: banditCards, c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: {} },
            prng: { seed, invocations: 0 }
        }
    )
    openTurn(s, ATTACKER)
    return s
}

function attackBandits(s: HydratedOathGameState, banditsWin: boolean) {
    const action = campaign({ defender: { kind: 'bandits' }, targets: [siteTarget('c1')], attackDice: 1 })
    action.apply(s)
    // The roll as the test needs it.
    ongoingCampaign(s).swords = banditsWin ? 0 : 9
    ongoingCampaign(s).defense = banditsWin ? 9 : 0
    return action
}

const banks = (s: { favorBank: Record<Suit, number> }) => ({ ...s.favorBank })

describe('R-10.3-H1 — favor a bank would pay the victorious bandits is burned (revision 4)', () => {
    it('Battle Honors burns two from the order bank; Military Parade one from each bank matching the attacker’s advisers', () => {
        const s = table(atRevision, [HONORS, PARADE])
        const used = attackBandits(s, true)
        expect(used.metadata?.battle?.plansUsed).toEqual([HONORS, PARADE])
        const was = banks(s)
        const supply = s.favorSupply
        let sacrifice: HydratedCampaignSacrifice | undefined
        expectFavorConserved(s, () => {
            sacrifice = finishCampaign(s)
        })
        expect(sacrifice?.metadata?.attackerVictorious).toBe(false)
        expect(banks(s)).toEqual({ ...was, [Suit.Order]: was[Suit.Order] - 2, [Suit.Hearth]: was[Suit.Hearth] - 1, [Suit.Nomad]: was[Suit.Nomad] - 1 })
        expect(s.favorSupply).toBe(supply + 4)
        expect(sacrifice?.metadata?.planNotes).toEqual([
            'Battle Honors: burned 2 favor from the order bank, the bandits being victorious',
            "Military Parade: burned 2 favor from the banks matching the attacker's advisers, the bandits being victorious"
        ])
    })

    it('no player burns it, so Vow of Renewal takes none of it', () => {
        const s = table(atRevision, [HONORS])
        attackBandits(s, true)
        finishCampaign(s)
        expect(s.getPlayerState(CHANCELLOR).favor).toBe(2)
    })

    it('a bank holding less burns what it has', () => {
        const s = table(atRevision, [HONORS])
        s.favorBank[Suit.Order] = 1
        attackBandits(s, true)
        const sacrifice = finishCampaign(s)
        expect(s.favorBank[Suit.Order]).toBe(0)
        expect(sacrifice.metadata?.planNotes).toEqual(['Battle Honors: burned 1 favor from the order bank, the bandits being victorious'])
    })

    it('defeated bandits burn nothing', () => {
        const s = table(atRevision, [HONORS, PARADE])
        attackBandits(s, false)
        const was = banks(s)
        const supply = s.favorSupply
        const { sacrifice } = finishCampaignSteps(s)
        expect(sacrifice.metadata?.attackerVictorious).toBe(true)
        expect(banks(s)).toEqual(was)
        expect(s.favorSupply).toBe(supply)
    })

    it("Traveling Doctor's discard has no ruled meaning for the bandits, so a defeat leaves it at their site", () => {
        const s = table(atRevision, [DOCTOR])
        attackBandits(s, false)
        finishCampaignSteps(s)
        expect(s.denizensBySite.c1).toEqual([DOCTOR])
    })
})

describe('R-X.4 — before revision 4 the bandits’ outcome plans do nothing, as recorded', () => {
    it('Battle Honors and Military Parade leave the banks', () => {
        const s = table(before, [HONORS, PARADE])
        attackBandits(s, true)
        const was = banks(s)
        const supply = s.favorSupply
        const sacrifice = finishCampaign(s)
        expect(sacrifice.metadata?.attackerVictorious).toBe(false)
        expect(banks(s)).toEqual(was)
        expect(s.favorSupply).toBe(supply)
        expect(sacrifice.metadata?.planNotes).toBeUndefined()
    })
})

describe('R-X.4 — a Campaign the bandits win with Battle Honors and Military Parade replays as it was recorded', () => {
    const game = testGame([ATTACKER, CHANCELLOR])

    function record(oathRevision: number, seed: number) {
        const start = table(oathRevision, [HONORS, PARADE], seed).dehydrate()
        let state: OathProjectedState = structuredClone(start)
        const processed: GameAction[] = []
        const run = (action: GameAction) => {
            const result = engine.runNext(action, state, game)
            processed.push(...result.processedActions)
            state = result.updatedState
        }
        run(buildAction(Campaign, { playerId: ATTACKER, defender: { kind: 'bandits' }, targets: [siteTarget('c1')], attackDice: 1 }))
        const rolled = state.campaign
        if (!rolled || rolled.swords > rolled.defense) return undefined
        const defeatKills = HydratedCampaignSacrifice.attackerDefeatKills(new HydratedOathGameState(state), 0)
        run(buildAction(CampaignSacrifice, { playerId: ATTACKER, sacrifice: 0, defeatKills }))
        return { start, processed, recorded: state }
    }

    function recordedWhereBanditsWin(oathRevision: number) {
        for (let seed = 1; seed < 400; seed++) {
            const found = record(oathRevision, seed)
            if (found) return found
        }
        throw new Error('no seed gave the bandits the win')
    }

    function replay(start: OathProjectedState, processed: readonly GameAction[]) {
        let replayed = structuredClone(start)
        for (const action of processed) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
        return replayed
    }

    it.each([
        ['revision 3', before],
        ['revision 4', atRevision]
    ])('%s: every action replayed alone reaches the recorded state', (_name, oathRevision) => {
        const { start, processed, recorded } = recordedWhereBanditsWin(oathRevision)
        expect(recorded.campaign).toBeUndefined()
        expect(replay(start, processed)).toEqual(recorded)
    })

    it('revision 3 left the banks; revision 4 burned four favor out of them', () => {
        const old = recordedWhereBanditsWin(before)
        expect(old.recorded.favorBank).toEqual(old.start.favorBank)
        expect(old.recorded.favorSupply).toBe(old.start.favorSupply)
        const now = recordedWhereBanditsWin(atRevision)
        expect(now.recorded.favorBank[Suit.Order]).toBe(now.start.favorBank[Suit.Order] - 2)
        expect(now.recorded.favorBank[Suit.Hearth]).toBe(now.start.favorBank[Suit.Hearth] - 1)
        expect(now.recorded.favorBank[Suit.Nomad]).toBe(now.start.favorBank[Suit.Nomad] - 1)
        expect(now.recorded.favorSupply).toBe(now.start.favorSupply + 4)
    })
})
