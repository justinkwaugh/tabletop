import { describe, expect, it } from 'vitest'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { adviser } from '../testing/tables.js'
import { battlePlanUse, site } from '../testing/choices.js'
import { expectWarbandsConserved } from '../testing/census.js'
import { CampaignTargetKind, type CampaignTarget, type LossSource, type WarbandGroup } from '../model/campaign.js'
import type { OathPlayerState } from '../model/playerState.js'
import type { WarbandCounts } from '../model/warbandCounts.js'
import { PowerQuestionKind } from '../model/question.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { HydratedCampaign } from './campaign.js'
import { HydratedCampaignSacrifice } from './campaignSacrifice.js'
import { reasonSkullLossesInvalid, skullLossGroups } from '../util/campaignRoll.js'
import { ongoingCampaign } from '../testing/required.js'
import { rulesSite, warbandsAt } from '../util/rule.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

/** Law 5.5 step 5: "For each skull attacker immediately kills one warband in their force". */

const CAPTAINS = 'denizen.order.captains'
const VOW_OF_UNION = 'denizen.beast.vow-of-union'
const OUTRIDERS = 'denizen.order.outriders'
const STORM_CALLER = 'denizen.nomad.storm-caller'
const JINX = 'denizen.arcane.jinx'
const SNEAK_ATTACK = 'denizen.discord.sneak-attack'
const HOSPITAL = 'denizen.hearth.hospital'

const atRevision = OathRevision.EngineFixes3
const before = OathRevision.UiBatch1

const ATT = 'att'
const DEF = 'def'
const PAWN: CampaignTarget[] = [{ kind: CampaignTargetKind.PawnAndFavor }]
const game = testGame([ATT, DEF, 'chancellor'])

const onBoard = (playerId: string, count: number): WarbandGroup => ({ at: { kind: 'board', playerId }, owner: playerId, count })
const atSite = (siteId: string, owner: string, count: number): WarbandGroup => ({ at: { kind: 'site', siteId }, owner, count })
const fromSite = (siteId: string, owner = ATT): LossSource => ({ at: { kind: 'site', siteId }, owner })

/** Every step goes through `GameEngine`, so the machine state and the clock are the engine's. */
class Table {
    state: OathProjectedState
    processed: GameAction[] = []
    private seq = 0

    constructor(state: OathProjectedState, turn = ATT) {
        this.state = state
        this.state.turnManager = { series: [{ type: 'turn', playerId: turn, start: 0 }], turnOrder: [ATT, DEF, 'chancellor'], turnCounts: { [ATT]: 1, [DEF]: 1, chancellor: 1 } }
        this.state.activePlayerIds = [turn]
    }

    run(fields: { type: ActionType; playerId: string } & Record<string, unknown>) {
        const action: GameAction = { id: `sk-${(this.seq += 1)}`, gameId: 'game-1', source: ActionSource.User, index: this.state.actionCount, ...fields }
        const result = engine.run(action, this.state, game)
        this.state = result.updatedState
        this.processed = result.processedActions
        return this
    }

    campaign(playerId: string, defender: string, attackDice: number, fields: Record<string, unknown> = {}) {
        return this.run({ type: ActionType.Campaign, playerId, defender: { kind: 'player', playerId: defender }, targets: PAWN, attackDice, plans: [], ...fields })
    }

    pick(playerId: string, kills: WarbandGroup[]) {
        return this.run({ type: ActionType.CampaignSkullLosses, playerId, kills })
    }

    sacrifice(playerId: string) {
        const defeatKills = HydratedCampaignSacrifice.attackerDefeatKills(this.hydrated(), 0)
        return this.run({ type: ActionType.CampaignSacrifice, playerId, sacrifice: 0, defeatKills })
    }

    offered(playerId: string) {
        return engine.getValidActionTypesForPlayer(game, this.state, playerId)
    }

    hydrated() {
        return new HydratedOathGameState(structuredClone(this.state))
    }

    board(playerId = ATT) {
        return this.state.players.find((p) => p.playerId === playerId)?.warbandsOnBoard[playerId] ?? 0
    }

    at(siteId: string, owner = ATT) {
        return this.state.warbandsBySite[siteId]?.[owner] ?? 0
    }

    get skullsRolled() {
        return (this.state.campaign?.attackRoll ?? []).filter((face) => face.skulls > 0).length
    }

    get turnPlayer() {
        return this.state.turnManager.series.at(-1)?.playerId
    }
}

interface Scene {
    revision: number
    seed: number
    att?: Partial<OathPlayerState>
    def?: Partial<OathPlayerState>
    sites?: Record<string, WarbandCounts>
    denizens?: Record<string, string[]>
}

/** `att` (an Exile, 3 on the board) and `def` (an Exile, 4 on the board) both at c2. */
function scene({ revision, seed, att = {}, def = {}, sites = {}, denizens = {} }: Scene) {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: ATT, color: Color.Red, siteId: 'c2', supply: 6, favor: 4, secrets: 3, warbandsOnBoard: { [ATT]: 3 }, warbandsInPersonalBank: { [ATT]: 10 }, ...att }),
            testPlayer({ playerId: DEF, color: Color.Blue, siteId: 'c2', supply: 6, favor: 3, secrets: 2, warbandsOnBoard: { [DEF]: 4 }, warbandsInPersonalBank: { [DEF]: 10 }, ...def })
        ]),
        { oathRevision: revision, prng: { seed, invocations: 0 }, warbandsBySite: sites, denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...denizens } }
    )
    return new Table(s.dehydrate())
}

/** The dice come from the seeded PRNG, so a test searches seeds for the skulls it needs. */
function rolling(skulls: number, build: (seed: number) => Table): Table {
    for (let seed = 1; seed < 3000; seed++) {
        const t = build(seed)
        if (t.skullsRolled === skulls) return t
    }
    throw new Error(`no seed rolled ${skulls} skulls`)
}

/** Images 05, 06, 08: Captains at c2, which `att` rules with 2; their pawn at h1, 3 on the board. */
function captainsScene(revision: number, seed: number, def: Partial<OathPlayerState> = {}) {
    const t = scene({ revision, seed, att: { siteId: 'h1' }, def, sites: { c2: { [ATT]: 2 } }, denizens: { c2: [CAPTAINS] } })
    return t.run({ type: ActionType.UseActionPower, playerId: ATT, cardId: CAPTAINS, powerIndex: powerIndexOf(CAPTAINS, PowerTiming.Action), choices: [site('c2')] })
}

/** Image 07: Vow of Union, `att` ruling c2 (2) and p1 (2), with 1 on the board. */
function vowScene(revision: number, seed: number, att: Partial<OathPlayerState> = {}, sites: Record<string, WarbandCounts> = { c2: { [ATT]: 2 }, p1: { [ATT]: 2 } }) {
    return scene({ revision, seed, att: { warbandsOnBoard: { [ATT]: 1 }, advisers: [adviser(VOW_OF_UNION)], ...att }, sites })
}

describe('R-5.5.5 (revision 7) — the attacker picks where the skulls kill, after the roll', () => {
    it('Captains, two skulls against a force of 3 on the board and 2 at c2: the attacker is on the clock to pick, and nothing has died', () => {
        const t = rolling(2, (seed) => captainsScene(atRevision, seed).campaign(ATT, DEF, 5))
        expect(t.state.machineState).toBe(MachineState.CampaignSkullLosses)
        expect(t.state.campaign?.pendingSkullLosses).toEqual({ skulls: 2 })
        expect(t.state.activePlayerIds).toEqual([ATT])
        expect(t.offered(ATT)).toEqual([ActionType.CampaignSkullLosses])
        expect(t.offered(DEF)).toEqual([])
        expect(t.board()).toBe(3)
        expect(t.at('c2')).toBe(2)
        expect(skullLossGroups(t.hydrated(), ongoingCampaign(t.state))).toEqual([onBoard(ATT, 3), atSite('c2', ATT, 2)])

        // The sacrifice waits for the pick.
        expect(() => t.sacrifice(ATT)).toThrow(/is not valid in state CampaignSkullLosses/)

        const hydrated = t.hydrated()
        expectWarbandsConserved(hydrated, () => t.pick(ATT, [onBoard(ATT, 2)]))
        expect(t.board()).toBe(1)
        expect(t.at('c2')).toBe(2)
        expect(t.state.campaign?.pendingSkullLosses).toBeUndefined()
        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
        expect(t.state.activePlayerIds).toEqual([ATT])
        // Cursed Cauldron, R-10.22 — the skulls' kills are the defender's enemy kills.
        expect(t.state.campaign?.enemyWarbandsKilled).toEqual({ attacker: 0, defender: 2 })
    })

    it('Vow of Union, three skulls against 1 on the board, 2 at c2 and 2 at p1: one from each place keeps both sites', () => {
        const t = rolling(3, (seed) => vowScene(atRevision, seed).campaign(ATT, DEF, 5))
        expect(t.state.machineState).toBe(MachineState.CampaignSkullLosses)
        expect(t.state.campaign?.pendingSkullLosses).toEqual({ skulls: 3 })
        expect(skullLossGroups(t.hydrated(), ongoingCampaign(t.state))).toEqual([onBoard(ATT, 1), atSite('c2', ATT, 2), atSite('p1', ATT, 2)])
        t.pick(ATT, [atSite('p1', ATT, 1), onBoard(ATT, 1), atSite('c2', ATT, 1)])
        expect([t.board(), t.at('c2'), t.at('p1')]).toEqual([0, 1, 1])
        const after = t.hydrated()
        expect(rulesSite(after, ATT, 'c2')).toBe(true)
        expect(rulesSite(after, ATT, 'p1')).toBe(true)
        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
    })

    it('the History reads the pick: the groups as applied, one per place, in the force’s order', () => {
        const t = rolling(3, (seed) => vowScene(atRevision, seed).campaign(ATT, DEF, 5))
        t.pick(ATT, [atSite('p1', ATT, 1), atSite('c2', ATT, 0), onBoard(ATT, 1), atSite('p1', ATT, 1)])
        expect(t.processed[0]).toMatchObject({ type: ActionType.CampaignSkullLosses, metadata: { killed: [onBoard(ATT, 1), atSite('p1', ATT, 2)] } })
        expect([t.board(), t.at('c2'), t.at('p1')]).toEqual([0, 2, 0])
    })

    it('Hospital still saves the picked warbands: set aside for its site, none to the bank', () => {
        const t = rolling(3, (seed) => scene({ revision: atRevision, seed, att: { warbandsOnBoard: { [ATT]: 1 }, advisers: [adviser(VOW_OF_UNION)] }, sites: { c2: { [ATT]: 2 }, p1: { [ATT]: 2 } }, denizens: { p1: [HOSPITAL] } }).campaign(ATT, DEF, 5, { plans: [battlePlanUse(HOSPITAL)] }))
        expect(t.state.machineState).toBe(MachineState.CampaignSkullLosses)
        const bank = t.state.players.find((p) => p.playerId === ATT)?.warbandsInPersonalBank[ATT]
        t.pick(ATT, [onBoard(ATT, 1), atSite('c2', ATT, 1), atSite('p1', ATT, 1)])
        expect([t.board(), t.at('c2'), t.at('p1')]).toEqual([0, 1, 1])
        expect(t.state.campaign?.heldForHospital?.reduce((total, held) => total + held.count, 0)).toBe(3)
        expect(t.state.players.find((p) => p.playerId === ATT)?.warbandsInPersonalBank[ATT]).toBe(bank)
    })

    it('after the defender’s reply: the roll waits for their plans, then the attacker picks', () => {
        const t = rolling(2, (seed) => {
            const asked = captainsScene(atRevision, seed, { advisers: [adviser(STORM_CALLER)] }).campaign(ATT, DEF, 5)
            expect(asked.state.machineState).toBe(MachineState.CampaignPlans)
            expect(asked.state.activePlayerIds).toEqual([DEF])
            return asked.run({ type: ActionType.CampaignDefend, playerId: DEF, plans: [battlePlanUse(STORM_CALLER)] })
        })
        expect(t.state.machineState).toBe(MachineState.CampaignSkullLosses)
        expect(t.state.activePlayerIds).toEqual([ATT])
        expect(t.board()).toBe(3)
        expect(t.at('c2')).toBe(2)
        t.pick(ATT, [atSite('c2', ATT, 1), onBoard(ATT, 1)])
        expect([t.board(), t.at('c2')]).toEqual([2, 1])
        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
    })

    it('Jinx, then the pick: the kills wait on the reroll question, and the attacker picks once it is answered', () => {
        const t = rolling(2, (seed) => vowScene(atRevision, seed, { advisers: [adviser(VOW_OF_UNION), adviser(JINX)] }).campaign(ATT, DEF, 5))
        expect(t.state.machineState).toBe(MachineState.PowerQuestion)
        expect(t.state.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.RerollDice, askedPlayerId: ATT })
        expect(t.state.campaign?.pendingSkullKills).toEqual({ skulls: 2, order: [] })
        t.run({ type: ActionType.AnswerQuestion, playerId: ATT, answer: { kind: PowerQuestionKind.RerollDice, reroll: false } })
        expect(t.state.campaign?.pendingSkullKills).toBeUndefined()
        expect(t.state.campaign?.pendingSkullLosses).toEqual({ skulls: 2 })
        expect(t.state.machineState).toBe(MachineState.CampaignSkullLosses)
        expect(t.state.activePlayerIds).toEqual([ATT])
        expect([t.board(), t.at('c2'), t.at('p1')]).toEqual([1, 2, 2])
        t.pick(ATT, [atSite('c2', ATT, 1), atSite('p1', ATT, 1)])
        expect([t.board(), t.at('c2'), t.at('p1')]).toEqual([1, 1, 1])
        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
    })

    it('out of turn (Sneak Attack): the holder picks in the held turn, as at the Battle step', () => {
        const t = rolling(1, (seed) => {
            const table = scene({ revision: atRevision, seed, att: { siteId: 'c1', warbandsOnBoard: { [ATT]: 6 } }, def: { siteId: 'c1', supply: 0, advisers: [adviser(SNEAK_ATTACK), adviser(VOW_OF_UNION)] }, sites: { c2: { [DEF]: 2 } } })
            // No attack dice make a certain defeat (R-5.5.5.b), and its end asks the holder.
            table.campaign(ATT, DEF, 0).sacrifice(ATT)
            expect(table.state.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.SneakAttack, askedPlayerId: DEF })
            return table.campaign(DEF, ATT, 3)
        })
        expect(t.state.heldTurn).toBeDefined()
        expect(t.turnPlayer).toBe(ATT)
        expect(t.state.machineState).toBe(MachineState.CampaignSkullLosses)
        expect(t.state.activePlayerIds).toEqual([DEF])
        expect(t.offered(DEF)).toEqual([ActionType.CampaignSkullLosses])
        expect(t.offered(ATT)).toEqual([])
        t.pick(DEF, [atSite('c2', DEF, 1)])
        expect(t.at('c2', DEF)).toBe(1)
        expect(t.board(DEF)).toBe(4)
        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
        expect(t.state.activePlayerIds).toEqual([DEF])
    })
})

describe('R-5.5.5 (revision 7) — no pause where the pick changes nothing', () => {
    it('one place: a force on the board alone loses its warbands there at once', () => {
        const t = rolling(2, (seed) => scene({ revision: atRevision, seed }).campaign(ATT, DEF, 3))
        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
        expect(t.state.campaign?.pendingSkullLosses).toBeUndefined()
        expect(t.board()).toBe(1)
    })

    it('every warband dies: two skulls against 1 on the board and 1 at c2', () => {
        const t = rolling(2, (seed) => vowScene(atRevision, seed, {}, { c2: { [ATT]: 1 } }).campaign(ATT, DEF, 2))
        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
        expect(t.state.campaign?.pendingSkullLosses).toBeUndefined()
        expect([t.board(), t.at('c2')]).toEqual([0, 0])
    })

    it('Outriders: the skulls are ignored, so nothing is asked and nothing dies', () => {
        const t = rolling(2, (seed) => vowScene(atRevision, seed, { advisers: [adviser(VOW_OF_UNION), adviser(OUTRIDERS)] }).campaign(ATT, DEF, 5, { plans: [battlePlanUse(OUTRIDERS)] }))
        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
        expect(t.state.campaign?.pendingSkullLosses).toBeUndefined()
        expect([t.board(), t.at('c2'), t.at('p1')]).toEqual([1, 2, 2])
    })

    it('no skull: nothing is asked', () => {
        const t = rolling(0, (seed) => vowScene(atRevision, seed).campaign(ATT, DEF, 5))
        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
        expect(t.state.campaign?.pendingSkullLosses).toBeUndefined()
        expect([t.board(), t.at('c2'), t.at('p1')]).toEqual([1, 2, 2])
    })
})

describe('R-5.5.5 (revision 7) — a pick is refused unless it is exactly the skulls, from the force', () => {
    const paused = () => rolling(2, (seed) => captainsScene(atRevision, seed).campaign(ATT, DEF, 5))

    it('the wrong total: fewer or more than the skulls', () => {
        const t = paused()
        expect(() => t.pick(ATT, [onBoard(ATT, 1)])).toThrow(/must kill exactly 2, not 1/)
        expect(() => t.pick(ATT, [onBoard(ATT, 2), atSite('c2', ATT, 1)])).toThrow(/must kill exactly 2, not 3/)
        expect(t.state.machineState).toBe(MachineState.CampaignSkullLosses)
    })

    it('more than a place holds: three skulls, all at c2, which holds 2', () => {
        const t = rolling(3, (seed) => vowScene(atRevision, seed).campaign(ATT, DEF, 5))
        expect(reasonSkullLossesInvalid(t.hydrated(), ATT, [atSite('c2', ATT, 3)])).toMatch(/the force holds 2 there/)
        expect(() => t.pick(ATT, [atSite('c2', ATT, 3)])).toThrow(/the force holds 2 there/)
    })

    it('outside the force: another site of theirs, the defender’s warbands, or a site the bandits hold', () => {
        const t = paused()
        const s = t.hydrated()
        s.warbandsBySite.p1 = { [ATT]: 2 }
        expect(reasonSkullLossesInvalid(s, ATT, [atSite('p1', ATT, 2)])).toMatch(/not in the force/)
        expect(reasonSkullLossesInvalid(t.hydrated(), ATT, [onBoard(DEF, 2)])).toMatch(/not in the force/)
        // Bandit Crown — bandits "cannot be killed, moved, or sacrificed"; a site with no warbands is theirs.
        expect(reasonSkullLossesInvalid(t.hydrated(), ATT, [atSite('h2', ATT, 2)])).toMatch(/not in the force/)
        expect(() => t.pick(ATT, [atSite('h2', ATT, 2)])).toThrow(/not in the force/)
    })

    it('only the attacker picks, and only while the skulls wait', () => {
        const t = paused()
        expect(reasonSkullLossesInvalid(t.hydrated(), DEF, [onBoard(ATT, 2)])).toMatch(/only the attacker/)
        expect(() => t.pick(DEF, [onBoard(ATT, 2)])).toThrow(/not an active player/)
        t.pick(ATT, [onBoard(ATT, 2)])
        expect(reasonSkullLossesInvalid(t.hydrated(), ATT, [onBoard(ATT, 2)])).toMatch(/no skulls/)
        expect(() => t.pick(ATT, [onBoard(ATT, 2)])).toThrow(/is not valid in state CampaignSacrifice/)
    })
})

describe('R-5.5.5, R-X.4 — the declared loss order', () => {
    it('revision 7 refuses a loss order with the declare: the losses are picked after the roll', () => {
        const t = vowScene(atRevision, 1)
        const declaration = { defender: { kind: 'player' as const, playerId: DEF }, targets: PAWN, attackDice: 5 }
        expect(HydratedCampaign.reasonCannotCampaign(t.hydrated(), ATT, declaration)).toBeUndefined()
        expect(HydratedCampaign.reasonCannotCampaign(t.hydrated(), ATT, { ...declaration, skullLossOrder: [] })).toBeUndefined()
        expect(HydratedCampaign.reasonCannotCampaign(t.hydrated(), ATT, { ...declaration, skullLossOrder: [fromSite('p1')] })).toMatch(/picked after the roll/)
        expect(() => t.campaign(ATT, DEF, 5, { skullLossOrder: [fromSite('p1')] })).toThrow(/picked after the roll/)
    })

    it('before revision 7 the declared order kills at once, as it always did: p1 first, then the board', () => {
        const t = rolling(3, (seed) => vowScene(before, seed).campaign(ATT, DEF, 5, { skullLossOrder: [fromSite('p1')] }))
        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
        expect(t.state.campaign?.pendingSkullLosses).toBeUndefined()
        expect([t.at('p1'), t.board(), t.at('c2')]).toEqual([0, 0, 2])
        expect(rulesSite(t.hydrated(), ATT, 'p1')).toBe(false)
    })

    it('before revision 7, any order empties the second place it reaches (the split above is not possible)', () => {
        for (const order of [[], [fromSite('c2')], [fromSite('p1')], [fromSite('c2'), fromSite('p1')]]) {
            const t = rolling(3, (seed) => vowScene(before, seed).campaign(ATT, DEF, 5, { skullLossOrder: order }))
            expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
            const left = [t.at('c2'), t.at('p1')]
            expect(left.filter((count) => count === 0)).toHaveLength(1)
        }
    })

    it('before revision 7 the Captains force with two skulls kills from the board first, with no pause', () => {
        const t = rolling(2, (seed) => captainsScene(before, seed).campaign(ATT, DEF, 5))
        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
        expect([t.board(), t.at('c2')]).toEqual([1, 2])
        expect(warbandsAt(t.hydrated(), 'c2')[ATT]).toBe(2)
    })
})
