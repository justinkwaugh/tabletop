import { describe, expect, it } from 'vitest'
import { Color, type GameAction } from '@tabletop/common'
import { Campaign } from '../actions/campaign.js'
import { CampaignDefend } from '../actions/campaignDefend.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { ongoingCampaign } from '../testing/required.js'
import { ATTACKER, DEFENDER, campaign, defend, finishCampaignSteps } from '../testing/steps.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const FIRE = 'relic.sticky-fire'
const FOG = 'denizen.arcane.billowing-fog'
const DOCTOR = 'denizen.hearth.traveling-doctor'

const atRevision = OathRevision.EngineFixes2
const before = OathRevision.CardFixes1

/** The attacker campaigns from c1 against the defender, whose pawn, board of four and one warband at c1 make a force of five. */
function table(oathRevision: number, seed: number, attacker: Record<string, unknown>, defender: Record<string, unknown>) {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: ATTACKER, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 5, favor: 4, secrets: 3, warbandsOnBoard: { [ATTACKER]: 5 }, warbandsInPersonalBank: { [ATTACKER]: 7 }, ...attacker }),
            testPlayer({ playerId: DEFENDER, color: Color.Yellow, status: PlayerStatus.Exile, siteId: 'c1', favor: 6, secrets: 3, warbandsOnBoard: { [DEFENDER]: 4 }, warbandsInPersonalBank: { [DEFENDER]: 6 }, ...defender })
        ]),
        {
            oathRevision,
            warbandsBySite: { c1: { [DEFENDER]: 1 } },
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            prng: { seed, invocations: 0 }
        }
    )
    openTurn(s, ATTACKER)
    return s
}

const faceup = (cardId: string) => ({ advisers: [{ cardId, faceUp: true }] })

/** The attacker's Sticky Fire against the defender's Billowing Fog. */
const fireOnFog = (oathRevision: number, seed: number) => table(oathRevision, seed, { relicIds: [FIRE] }, faceup(FOG))
/** The attacker's Traveling Doctor against the defender's Sticky Fire. */
const fireOnDoctor = (oathRevision: number, seed: number) => table(oathRevision, seed, { ...faceup(DOCTOR), warbandsOnBoard: { [ATTACKER]: 2 } }, { relicIds: [FIRE] })

const fireAttack = () => campaign({ plans: [battlePlanUse(FIRE)], attackDice: 5 })
const doctorAttack = () => campaign({ plans: [battlePlanUse(DOCTOR)], attackDice: 1 })

function inPlay(s: HydratedOathGameState, playerId: string): number {
    const onSites = Object.values(s.warbandsBySite).reduce((n, counts) => n + (counts[playerId] ?? 0), 0)
    return onSites + (s.getPlayerState(playerId).warbandsOnBoard[playerId] ?? 0)
}

/** The dice come from the seeded PRNG, so a test searches seeds for the outcome it needs. */
function seedWhere(attackerWins: boolean, build: (seed: number) => HydratedOathGameState, act: (s: HydratedOathGameState) => void): number {
    for (let seed = 1; seed < 80; seed++) {
        const s = build(seed)
        act(s)
        if (ongoingCampaign(s).swords > ongoingCampaign(s).defense === attackerWins) return seed
    }
    throw new Error('no seed gave that outcome')
}

const fogSeed = seedWhere(true, (seed) => fireOnFog(atRevision, seed), (s) => {
    fireAttack().apply(s)
    defend([battlePlanUse(FOG)]).apply(s)
})
const doctorSeed = seedWhere(false, (seed) => fireOnDoctor(atRevision, seed), (s) => {
    doctorAttack().apply(s)
    defend([battlePlanUse(FIRE)]).apply(s)
})

function fogBattle(oathRevision: number) {
    const s = fireOnFog(oathRevision, fogSeed)
    fireAttack().apply(s)
    defend([battlePlanUse(FOG)]).apply(s)
    return s
}

function doctorBattle(oathRevision: number) {
    const s = fireOnDoctor(oathRevision, doctorSeed)
    doctorAttack().apply(s)
    defend([battlePlanUse(FIRE)]).apply(s)
    return s
}

describe('Billowing Fog and Traveling Doctor ignore Sticky Fire (R-9.2, revision 5)', () => {
    it('Billowing Fog: the defeated defender loses no warband, and Sticky Fire’s favor is still given', () => {
        const s = fogBattle(atRevision)
        expect(inPlay(s, DEFENDER)).toBe(5)
        expect(HydratedCampaignSacrifice.defaultDefeatKills(s, 0)).toEqual([])
        const { sacrifice, victory } = finishCampaignSteps(s)
        expect(sacrifice.metadata?.attackerVictorious).toBe(true)
        expect(sacrifice.metadata?.defeatKilled).toBe(0)
        expect(inPlay(s, DEFENDER)).toBe(5)
        expect(s.getPlayerState(DEFENDER).favor).toBe(7)
        expect(s.getPlayerState(ATTACKER).favor).toBe(3)
        expect(victory?.metadata?.triggered).toContain('Sticky Fire: its kill was ignored; gave defender 1 favor')
    })

    it('Traveling Doctor: the defeated attacker loses no warband, and the defender’s Sticky Fire still gives its favor', () => {
        const s = doctorBattle(atRevision)
        const force = inPlay(s, ATTACKER)
        expect(force).toBeGreaterThan(0)
        expect(HydratedCampaignSacrifice.attackerDefeatKills(s, 0)).toEqual([])
        const { sacrifice } = finishCampaignSteps(s)
        expect(sacrifice.metadata?.attackerVictorious).toBe(false)
        expect(sacrifice.metadata?.defeatKilled).toBe(0)
        expect(inPlay(s, ATTACKER)).toBe(force)
        expect(s.getPlayerState(ATTACKER).favor).toBe(5)
        expect(sacrifice.metadata?.planNotes).toContain('Sticky Fire: its kill was ignored; gave attacker 1 favor')
    })
})

describe('R-X.4 — before revision 5, Sticky Fire takes effect over Billowing Fog and Traveling Doctor', () => {
    it('Billowing Fog: the whole defending force is killed', () => {
        const s = fogBattle(before)
        const { sacrifice, victory } = finishCampaignSteps(s)
        expect(sacrifice.metadata?.defeatKilled).toBe(5)
        expect(inPlay(s, DEFENDER)).toBe(0)
        expect(s.getPlayerState(DEFENDER).favor).toBe(7)
        expect(victory?.metadata?.triggered).toContain('Sticky Fire: the enemy force was killed entirely; gave defender 1 favor')
    })

    it('Traveling Doctor: the whole attacking force is killed', () => {
        const s = doctorBattle(before)
        const force = inPlay(s, ATTACKER)
        expect(force).toBeGreaterThan(0)
        const { sacrifice } = finishCampaignSteps(s)
        expect(sacrifice.metadata?.defeatKilled).toBe(force)
        expect(inPlay(s, ATTACKER)).toBe(0)
    })

    function playThrough(start: OathProjectedState, game: ReturnType<typeof testGame>, actions: ((state: OathProjectedState) => GameAction)[]) {
        let state = structuredClone(start)
        const processed: GameAction[] = []
        for (const next of actions) {
            const result = engine.runNext(next(state), state, game)
            processed.push(...result.processedActions)
            state = result.updatedState
        }
        return { state, processed }
    }

    const sacrificeStep = (state: OathProjectedState) =>
        buildAction(CampaignSacrifice, { playerId: ATTACKER, sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(new HydratedOathGameState(state), 0) })

    it('a Campaign recorded with Sticky Fire over Billowing Fog replays unchanged, the force killed', () => {
        const game = testGame([ATTACKER, DEFENDER])
        const start = fireOnFog(before, fogSeed).dehydrate()
        const recorded = playThrough(start, game, [
            () => buildAction(Campaign, { playerId: ATTACKER, defender: { kind: 'player', playerId: DEFENDER }, targets: [siteTarget('c1')], attackDice: 5, plans: [battlePlanUse(FIRE)] }),
            () => buildAction(CampaignDefend, { playerId: DEFENDER, plans: [battlePlanUse(FOG)] }),
            sacrificeStep,
            () => buildAction(CampaignResolveVictory, { playerId: ATTACKER, placements: [], burnFavor: false })
        ])
        expect(inPlay(new HydratedOathGameState(recorded.state), DEFENDER)).toBe(0)

        let replayed = structuredClone(start)
        for (const action of recorded.processed) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
        expect(replayed).toEqual(recorded.state)
    })

    it('a Campaign recorded with Sticky Fire over Traveling Doctor replays unchanged, the force killed', () => {
        const game = testGame([ATTACKER, DEFENDER])
        const start = fireOnDoctor(before, doctorSeed).dehydrate()
        const recorded = playThrough(start, game, [
            () => buildAction(Campaign, { playerId: ATTACKER, defender: { kind: 'player', playerId: DEFENDER }, targets: [siteTarget('c1')], attackDice: 1, plans: [battlePlanUse(DOCTOR)] }),
            () => buildAction(CampaignDefend, { playerId: DEFENDER, plans: [battlePlanUse(FIRE)] }),
            sacrificeStep
        ])
        expect(inPlay(new HydratedOathGameState(recorded.state), ATTACKER)).toBe(0)

        let replayed = structuredClone(start)
        for (const action of recorded.processed) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
        expect(replayed).toEqual(recorded.state)
    })
})
