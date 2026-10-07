import { describe, expect, it } from 'vitest'
import { Color, type GameAction } from '@tabletop/common'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { Campaign } from '../actions/campaign.js'
import { CampaignDefend, type HydratedCampaignDefend } from '../actions/campaignDefend.js'
import { CampaignSacrifice, HydratedCampaignSacrifice, isCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn, withChancellor } from '../testing/fixture.js'
import { ongoingCampaign } from '../testing/required.js'
import { buildAction } from '../testing/actions.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { ATTACKER, DEFENDER, campaign, defend, finishCampaign, finishCampaignSteps } from '../testing/steps.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const CAULDRON = 'relic.cursed-cauldron'
const BEAR_TRAPS = 'denizen.order.bear-traps'
const WRESTLERS = 'denizen.order.wrestlers'
const HOSPITAL = 'denizen.hearth.hospital'

const atRevision = OathRevision.CardFixes1
const before = OathRevision.PlanCostsAndSearchPlays

const ATTACKER_BANK = 4
const DEFENDER_BANK = 8

/** The attacker campaigns from c1 against the defender, who stands there and rules c1 and p1. */
function table(
    oathRevision: number,
    seed: number,
    cards: { c1?: string[]; p1?: string[] } = {},
    relics: { attacker?: string[]; defender?: string[] } = {}
) {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: ATTACKER, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 6, favor: 4, secrets: 3,
                warbandsOnBoard: { [ATTACKER]: 6 }, warbandsInPersonalBank: { [ATTACKER]: ATTACKER_BANK }, relicIds: relics.attacker ?? []
            }),
            testPlayer({
                playerId: DEFENDER, color: Color.Yellow, status: PlayerStatus.Exile, siteId: 'c1', favor: 4, secrets: 3,
                warbandsOnBoard: { [DEFENDER]: 2 }, warbandsInPersonalBank: { [DEFENDER]: DEFENDER_BANK }, relicIds: relics.defender ?? []
            })
        ]),
        {
            oathRevision,
            denizensBySite: { c1: cards.c1 ?? [], c2: [], p1: cards.p1 ?? [], h1: [] },
            warbandsBySite: { c1: { [DEFENDER]: 2 }, p1: { [DEFENDER]: 3 } },
            prng: { seed, invocations: 0 }
        }
    )
    openTurn(s, ATTACKER)
    return s
}

const bankOf = (s: HydratedOathGameState, playerId: string) =>
    s.getPlayerState(playerId).warbandsInPersonalBank[playerId] ?? 0

/** The defender answers with `plans` and holds the Cauldron; the dice come from the seed, so the seeds are searched. */
function defendedWithCauldron(
    oathRevision: number,
    plans: string[],
    cards: { c1?: string[]; p1?: string[] },
    wanted: (defended: HydratedCampaignDefend) => boolean
) {
    for (let seed = 1; seed < 400; seed++) {
        const s = table(oathRevision, seed, cards, { defender: [CAULDRON] })
        campaign({ attackDice: 6 }).apply(s)
        const defended = defend(plans.map(battlePlanUse))
        defended.apply(s)
        const roll = ongoingCampaign(s)
        if (roll.defense >= roll.swords && wanted(defended)) return { s, defended }
    }
    throw new Error('no seed gave that roll')
}

/** The defender answers with `plans`; the attacker holds the Cauldron and wins. */
function attackedWithCauldron(oathRevision: number, plans: string[], cards: { c1?: string[]; p1?: string[] }) {
    const s = table(oathRevision, 1, cards, { attacker: [CAULDRON] })
    campaign({ attackDice: 3, plans: [battlePlanUse(CAULDRON)] }).apply(s)
    if (plans.length > 0) defend(plans.map(battlePlanUse)).apply(s)
    // The roll as the test needs it: the attacker wins without a sacrifice.
    ongoingCampaign(s).swords = 9
    ongoingCampaign(s).defense = 0
    return s
}

/** R-5.5.8 — a victorious attacker's Cauldron reports on the victory's record. */
function cauldronNote(s: HydratedOathGameState): string | undefined {
    const { sacrifice, victory } = finishCampaignSteps(s)
    expect(sacrifice.metadata?.attackerVictorious).toBe(true)
    return victory?.metadata?.triggered?.find((note) => note.startsWith('Cursed Cauldron'))
}

const gainedNote = (n: number) => `Cursed Cauldron: gained ${n} warbands, one per enemy warband killed`

describe('Cursed Cauldron counts every enemy warband killed in the Campaign (revision 4)', () => {
    it("the skulls' kills count, with the defeated attacker's half", () => {
        const { s, defended } = defendedWithCauldron(atRevision, [CAULDRON], {}, (d) => (d.metadata?.skullsKilled ?? 0) > 0)
        const skulls = defended.metadata?.skullsKilled ?? 0
        const sacrifice = finishCampaign(s)
        expect(sacrifice.metadata?.attackerVictorious).toBe(false)
        const defeatKilled = sacrifice.metadata?.defeatKilled ?? 0
        const killed = bankOf(s, ATTACKER) - ATTACKER_BANK
        expect(killed).toBe(skulls + defeatKilled)
        expect(DEFENDER_BANK - bankOf(s, DEFENDER)).toBe(killed)
        expect(sacrifice.metadata?.planNotes).toContain(gainedNote(killed))
    })

    it("Bear Traps' kill counts", () => {
        const { s, defended } = defendedWithCauldron(atRevision, [BEAR_TRAPS, CAULDRON], { c1: [BEAR_TRAPS] }, (d) => d.metadata?.skullsKilled === 0)
        expect(defended.metadata?.planNotes).toContain(`Bear Traps: killed a warband on ${ATTACKER}'s board`)
        const sacrifice = finishCampaign(s)
        const defeatKilled = sacrifice.metadata?.defeatKilled ?? 0
        expect(bankOf(s, ATTACKER) - ATTACKER_BANK).toBe(1 + defeatKilled)
        expect(DEFENDER_BANK - bankOf(s, DEFENDER)).toBe(1 + defeatKilled)
    })

    it("a defender's sacrifice for Wrestlers counts for the attacker's Cauldron", () => {
        const s = attackedWithCauldron(atRevision, [WRESTLERS], { c1: [WRESTLERS] })
        // Wrestlers took one of the defender's four; R-5.5.6 then kills half of the three left, rounded down.
        expect(bankOf(s, DEFENDER) - DEFENDER_BANK).toBe(1)
        expect(cauldronNote(s)).toBe(gainedNote(2))
        expect(bankOf(s, DEFENDER) - DEFENDER_BANK).toBe(2)
    })

    it('warbands Hospital saves are not killed, so they do not count', () => {
        const saved = attackedWithCauldron(atRevision, [HOSPITAL], { p1: [HOSPITAL] })
        expect(saved.campaign?.killRedirects).toEqual([{ playerId: DEFENDER, siteId: 'p1' }])
        expect(cauldronNote(saved)).toBe(gainedNote(0))
        expect(bankOf(saved, DEFENDER)).toBe(DEFENDER_BANK)

        // Without Hospital the same two are killed and gained.
        const killed = attackedWithCauldron(atRevision, [], {})
        expect(cauldronNote(killed)).toBe(gainedNote(2))
        expect(bankOf(killed, DEFENDER) - DEFENDER_BANK).toBe(2)
    })
})

describe('R-X.4 — before revision 4 Cursed Cauldron counts the defeat kills alone, as recorded', () => {
    it("Bear Traps' kill and the skulls' are left out, and no tally is kept", () => {
        const { s } = defendedWithCauldron(before, [BEAR_TRAPS, CAULDRON], { c1: [BEAR_TRAPS] }, (d) => (d.metadata?.skullsKilled ?? 0) > 0)
        expect(ongoingCampaign(s).enemyWarbandsKilled).toBeUndefined()
        const sacrifice = finishCampaign(s)
        const defeatKilled = sacrifice.metadata?.defeatKilled ?? 0
        expect(bankOf(s, ATTACKER) - ATTACKER_BANK).toBeGreaterThan(1 + defeatKilled)
        expect(DEFENDER_BANK - bankOf(s, DEFENDER)).toBe(defeatKilled)
    })

    it('the warbands Hospital saves still count', () => {
        const s = attackedWithCauldron(before, [HOSPITAL], { p1: [HOSPITAL] })
        expect(cauldronNote(s)).toBe(gainedNote(2))
        expect(bankOf(s, DEFENDER)).toBe(DEFENDER_BANK)
    })
})

describe('R-X.4 — a Campaign with Bear Traps and the Cauldron replays as it was recorded', () => {
    const game = testGame([ATTACKER, DEFENDER, 'chancellor'])

    function record(oathRevision: number, seed: number) {
        const start = table(oathRevision, seed, { c1: [BEAR_TRAPS] }, { defender: [CAULDRON] }).dehydrate()
        let state: OathProjectedState = structuredClone(start)
        const processed: GameAction[] = []
        const run = (action: GameAction) => {
            const result = engine.runNext(action, state, game)
            processed.push(...result.processedActions)
            state = result.updatedState
        }
        run(buildAction(Campaign, { playerId: ATTACKER, defender: { kind: 'player', playerId: DEFENDER }, targets: [siteTarget('c1')], attackDice: 6 }))
        run(buildAction(CampaignDefend, { playerId: DEFENDER, plans: [battlePlanUse(BEAR_TRAPS), battlePlanUse(CAULDRON)] }))
        const rolled = state.campaign
        if (!rolled || rolled.swords > rolled.defense) return undefined
        const defeatKills = HydratedCampaignSacrifice.attackerDefeatKills(new HydratedOathGameState(state), 0)
        run(buildAction(CampaignSacrifice, { playerId: ATTACKER, sacrifice: 0, defeatKills }))
        const defeatKilled = processed.find(isCampaignSacrifice)?.metadata?.defeatKilled ?? 0
        return { start, processed, recorded: state, defeatKilled }
    }

    function recordedWhereDefenderWins(oathRevision: number) {
        for (let seed = 1; seed < 400; seed++) {
            const found = record(oathRevision, seed)
            if (found) return found
        }
        throw new Error('no seed gave the defender the win')
    }

    function replay(start: OathProjectedState, processed: readonly GameAction[]) {
        let replayed = structuredClone(start)
        for (const action of processed) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
        return replayed
    }

    const bankIn = (state: OathProjectedState, playerId: string) =>
        state.players.find((p) => p.playerId === playerId)?.warbandsInPersonalBank[playerId] ?? 0

    it.each([
        ['revision 3', before],
        ['revision 4', atRevision]
    ])('%s: every action replayed alone reaches the recorded state', (_name, oathRevision) => {
        const { start, processed, recorded } = recordedWhereDefenderWins(oathRevision)
        expect(recorded.campaign).toBeUndefined()
        expect(replay(start, processed)).toEqual(recorded)
    })

    it('revision 3 gained the defeat kills only; revision 4 gains every warband the attacker lost', () => {
        const old = recordedWhereDefenderWins(before)
        expect(DEFENDER_BANK - bankIn(old.recorded, DEFENDER)).toBe(old.defeatKilled)
        const now = recordedWhereDefenderWins(atRevision)
        expect(DEFENDER_BANK - bankIn(now.recorded, DEFENDER)).toBe(bankIn(now.recorded, ATTACKER) - ATTACKER_BANK)
        expect(bankIn(now.recorded, ATTACKER) - ATTACKER_BANK).toBeGreaterThan(now.defeatKilled)
    })
})
