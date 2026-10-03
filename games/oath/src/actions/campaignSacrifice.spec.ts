import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { PlayerStatus } from '../model/oathEnums.js'
import { campaignRecords, testPlayer, testState } from '../testing/fixture.js'
import { expectWarbandsConserved } from '../testing/census.js'
import { CampaignTargetKind, type CampaignState, type WarbandGroup } from '../model/campaign.js'
import { HydratedCampaignSacrifice, CampaignSacrifice } from './campaignSacrifice.js'
import { ongoingCampaign } from '../testing/required.js'
import { buildAction } from '../testing/actions.js'
import { CampaignDefeatKills, HydratedCampaignDefeatKills } from './campaignDefeatKills.js'
import { HydratedResolveOathkeeper, ResolveOathkeeper } from './resolveOathkeeper.js'
import { MachineState } from '../definition/states.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { OathRevision } from '../util/revision.js'
import { defeatChoiceMatters } from '../util/force.js'

const CHANCELLOR = 'chancellor'
const CITIZEN = 'citizen'
const ATTACKER = 'attacker'
const DEFENDER = 'defender'

function midBattle(campaign: Partial<CampaignState> = {}) {
    const defendingForce: WarbandGroup[] = [
        { at: { kind: 'site', siteId: 'c1' }, owner: DEFENDER, count: 2 },
        { at: { kind: 'board', playerId: DEFENDER }, owner: DEFENDER, count: 1 }
    ]

    return testState(
        [
            testPlayer({
                playerId: ATTACKER,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                warbandsOnBoard: { [ATTACKER]: 4 },
                warbandsInPersonalBank: { [ATTACKER]: 8 }
            }),
            testPlayer({
                playerId: DEFENDER,
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                warbandsOnBoard: { [DEFENDER]: 1 },
                warbandsInPersonalBank: { [DEFENDER]: 11 }
            }),
            testPlayer({
                playerId: CHANCELLOR,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 6 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 18 }
            }),
            testPlayer({
                playerId: CITIZEN,
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'h2',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 0 },
                warbandsInPersonalBank: { [CITIZEN]: 14 }
            })
        ],
        {
            chancellorPlayerId: CHANCELLOR,
            warbandsBySite: { c1: { [DEFENDER]: 2 } },
            campaign: {
                attackerPlayerId: ATTACKER,
                defenderPlayerId: DEFENDER,
                nonImperialPlayerIds: [],
                allyPlayerIds: [],
                targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }],
                attackPool: 4,
                defensePool: 1,
                attackRoll: [],
                defenseRoll: [],
                defense: 5,
                swords: 3,
                defendingForce,
                defendingBandits: 0,
                ...campaignRecords(),
                ...campaign
            }
        }
    )
}

function sacrifice(fields: Record<string, unknown> = {}) {
    return new HydratedCampaignSacrifice(
        buildAction(CampaignSacrifice, {
            playerId: ATTACKER,
            sacrifice: 0,
            ...fields
        })
    )
}

function lose(playerId: string, kills: WarbandGroup[]) {
    return new HydratedCampaignDefeatKills(buildAction(CampaignDefeatKills, { playerId, kills }))
}

const ALL_DEFENDERS: WarbandGroup[] = [
    { at: { kind: 'site', siteId: 'c1' }, owner: DEFENDER, count: 2 },
    { at: { kind: 'board', playerId: DEFENDER }, owner: DEFENDER, count: 1 }
]

describe('who wins (R-5.5.5.b)', () => {
    it('gives the attacker the win only when the attack EXCEEDS the defense', () => {
        const state = midBattle({ swords: 6, defense: 5 })
        sacrifice().apply(state)
        expect(state.campaign?.attackerVictorious).toBe(true)
    })

    it('gives a tie to the defender', () => {
        const state = midBattle({ swords: 5, defense: 5 })
        sacrifice({
            defeatKills: [{ at: { kind: 'board', playerId: ATTACKER }, owner: ATTACKER, count: 2 }]
        }).apply(state)
        expect(state.campaign).toBeUndefined()
    })

    it('gives the defender the win when the attack falls short', () => {
        const state = midBattle({ swords: 2, defense: 5 })
        sacrifice({
            defeatKills: [{ at: { kind: 'board', playerId: ATTACKER }, owner: ATTACKER, count: 2 }]
        }).apply(state)
        expect(state.campaign).toBeUndefined()
    })
})

describe('the sacrifice (R-5.5.5, R-5.5.5.c, R-9.5)', () => {
    it('adds one to the attack per warband sacrificed', () => {
        const state = midBattle({ swords: 3, defense: 5 })
        sacrifice({ sacrifice: 3 }).apply(state)

        expect(state.campaign?.attackerVictorious).toBe(true)
        expect(state.getPlayerState(ATTACKER).warbandsOnBoard[ATTACKER]).toBe(1)
    })

    it('kills the sacrificed warbands back to their own bank (R-10.13, R-10.22)', () => {
        const state = midBattle({ swords: 3, defense: 5 })
        expectWarbandsConserved(state, () =>
            sacrifice({ sacrifice: 3 }).apply(state)
        )
        expect(state.getPlayerState(ATTACKER).warbandsInPersonalBank[ATTACKER]).toBe(8 + 3)
    })

    it('records whose warbands were sacrificed when they are one owner’s, as a Citizen’s Imperial ones (R-10.13)', () => {
        const own = sacrifice({ sacrifice: 3 })
        own.apply(midBattle({ swords: 3, defense: 5 }))
        expect(own.metadata?.sacrificedOwner).toBe(ATTACKER)

        const citizen = midBattle({ swords: 3, defense: 5, attackerPlayerId: CITIZEN })
        citizen.getPlayerState(CITIZEN).warbandsOnBoard = { [IMPERIAL_WARBANDS]: 4 }
        const imperial = sacrifice({ playerId: CITIZEN, sacrifice: 3 })
        imperial.apply(citizen)
        expect(imperial.metadata?.sacrificedOwner).toBe(IMPERIAL_WARBANDS)
        expect(citizen.getPlayerState(CITIZEN).warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(1)

        const mixed = midBattle({ swords: 3, defense: 5, attackerPlayerId: CITIZEN })
        mixed.getPlayerState(CITIZEN).warbandsOnBoard = { [IMPERIAL_WARBANDS]: 2, [CITIZEN]: 1 }
        const both = sacrifice({
            playerId: CITIZEN,
            sacrifice: 3,
            sacrificeKills: [
                { at: { kind: 'board', playerId: CITIZEN }, owner: IMPERIAL_WARBANDS, count: 2 },
                { at: { kind: 'board', playerId: CITIZEN }, owner: CITIZEN, count: 1 }
            ]
        })
        both.apply(mixed)
        expect(both.metadata?.sacrificedOwner).toBeUndefined()
    })

    it('refuses more than exactly enough', () => {
        const state = midBattle({ swords: 3, defense: 5 })
        expect(() => sacrifice({ sacrifice: 4 }).apply(state)).toThrow(/exactly 3/)
    })

    it('refuses fewer than enough', () => {
        const state = midBattle({ swords: 3, defense: 5 })
        expect(() => sacrifice({ sacrifice: 2 }).apply(state)).toThrow(/exactly 3/)
    })

    it('allows sacrificing nothing and losing', () => {
        const state = midBattle({ swords: 3, defense: 5 })
        expect(() =>
            sacrifice({
                sacrifice: 0,
                defeatKills: [
                    { at: { kind: 'board', playerId: ATTACKER }, owner: ATTACKER, count: 2 }
                ]
            }).apply(state)
        ).not.toThrow()
    })

    it('refuses any sacrifice when the swords already win (R-9.5)', () => {
        const state = midBattle({ swords: 6, defense: 5 })
        expect(() => sacrifice({ sacrifice: 1 }).apply(state)).toThrow(/already victorious/)
    })

    it('refuses a sacrifice larger than the force', () => {
        const state = midBattle({ swords: 0, defense: 12 })
        expect(() => sacrifice({ sacrifice: 13 }).apply(state)).toThrow(
            /only 4 warbands in your force/
        )
    })

    it('refuses a negative sacrifice', () => {
        const valid = buildAction(CampaignSacrifice, { playerId: ATTACKER, sacrifice: 0 })
        expect(() => new HydratedCampaignSacrifice({ ...valid, sacrifice: -1 })).toThrow(
            /at least 0|must be >= 0/
        )
    })
})

describe('resolving defeat (R-5.5.6)', () => {
    it('kills half the defeated force, rounded down', () => {
        const state = midBattle({ swords: 0, defense: 9 })
        expectWarbandsConserved(state, () =>
            sacrifice({
                defeatKills: [
                    { at: { kind: 'board', playerId: ATTACKER }, owner: ATTACKER, count: 2 }
                ]
            }).apply(state)
        )
        expect(state.getPlayerState(ATTACKER).warbandsOnBoard[ATTACKER]).toBe(2)
        expect(state.getPlayerState(ATTACKER).warbandsInPersonalBank[ATTACKER]).toBe(10)
    })

    it('rounds an odd force down, not up', () => {
        const state = midBattle({ swords: 9, defense: 1 })
        sacrifice().apply(state)
        lose(DEFENDER, [ALL_DEFENDERS[1]]).apply(state)
        expect(state.getPlayerState(DEFENDER).warbandsInPersonalBank[DEFENDER]).toBe(12)
    })

    it('refuses a kill count that is not exactly half', () => {
        const state = midBattle({ swords: 9, defense: 1 })
        sacrifice().apply(state)
        expect(() => lose(DEFENDER, ALL_DEFENDERS).apply(state)).toThrow(/must kill exactly 1/)
    })

    it('refuses a kill drawn from outside the defeated force (R-10.9)', () => {
        const state = midBattle({ swords: 9, defense: 1 })
        sacrifice().apply(state)
        expect(() =>
            lose(DEFENDER, [
                { at: { kind: 'board', playerId: CHANCELLOR }, owner: IMPERIAL_WARBANDS, count: 1 }
            ]).apply(state)
        ).toThrow(/not in the force/)
    })

    it('moves the surviving force off the targeted sites and onto the board', () => {
        const state = midBattle({ swords: 9, defense: 1 })
        expectWarbandsConserved(state, () => {
            sacrifice().apply(state)
            lose(DEFENDER, [ALL_DEFENDERS[1]]).apply(state)
        })

        expect(state.warbandsBySite['c1'][DEFENDER]).toBe(0)
        expect(state.getPlayerState(DEFENDER).warbandsOnBoard[DEFENDER]).toBe(2)
    })

    it('leaves warbands that were already on a board where they are', () => {
        const state = midBattle({ swords: 9, defense: 1 })
        sacrifice().apply(state)
        lose(DEFENDER, [{ at: { kind: 'site', siteId: 'c1' }, owner: DEFENDER, count: 1 }]).apply(state)

        expect(state.getPlayerState(DEFENDER).warbandsOnBoard[DEFENDER]).toBe(2)
    })

    it('kills nothing when the defeated force is a single warband', () => {
        const state = midBattle({
            swords: 9,
            defense: 1,
            defendingForce: [
                { at: { kind: 'site', siteId: 'c1' }, owner: DEFENDER, count: 1 }
            ]
        })
        expectWarbandsConserved(state, () => sacrifice({ defeatKills: [] }).apply(state))
        expect(state.getPlayerState(DEFENDER).warbandsInPersonalBank[DEFENDER]).toBe(11)
    })

    it('asks nobody when the defeated force leaves no choice: one group loses what it must', () => {
        const state = midBattle({
            swords: 9,
            defense: 1,
            defendingForce: [
                { at: { kind: 'site', siteId: 'c1' }, owner: DEFENDER, count: 2 }
            ]
        })
        sacrifice().apply(state)
        expect(state.campaign?.pendingDefeatKills).toBeUndefined()
        expect(state.getPlayerState(DEFENDER).warbandsInPersonalBank[DEFENDER]).toBe(12)
    })

    it('the defending side chooses its own losses, never the attacker', () => {
        const state = midBattle({ swords: 9, defense: 1 })
        expect(() => sacrifice({ defeatKills: [ALL_DEFENDERS[1]] }).apply(state)).toThrow(
            /defending side chooses its own losses/
        )
        sacrifice().apply(state)
        expect(state.campaign?.pendingDefeatKills).toEqual({ chooserPlayerId: DEFENDER })
        expect(() => lose(ATTACKER, [ALL_DEFENDERS[1]]).apply(state)).toThrow(
            /defender chooses the defending side's losses/
        )
    })

    it('kills no bandits', () => {
        const state = midBattle({
            swords: 9,
            defense: 1,
            defenderPlayerId: undefined,
            defendingForce: [],
            defendingBandits: 3
        })
        expect(() => sacrifice({ defeatKills: [] }).apply(state)).not.toThrow()
        expect(state.campaign?.attackerVictorious).toBe(true)
    })
})

describe('the Chancellor chooses for an Imperial defence (R-5.5.6.a)', () => {
    function imperialDefence() {
        const state = midBattle({
            defenderPlayerId: CITIZEN,
            allyPlayerIds: [CHANCELLOR],
            swords: 9,
            defense: 1,
            defendingForce: [
                { at: { kind: 'site', siteId: 'c1' }, owner: IMPERIAL_WARBANDS, count: 2 },
                { at: { kind: 'board', playerId: CHANCELLOR }, owner: IMPERIAL_WARBANDS, count: 2 }
            ]
        })
        state.warbandsBySite['c1'] = { [IMPERIAL_WARBANDS]: 2 }
        return state
    }

    it('asks the Chancellor, not the defending Citizen, and spends the choice across the whole force', () => {
        const state = imperialDefence()
        expectWarbandsConserved(state, () => {
            sacrifice().apply(state)
            expect(state.campaign?.pendingDefeatKills).toEqual({ chooserPlayerId: CHANCELLOR })
            expect(() => lose(CITIZEN, []).apply(state)).toThrow(/chancellor chooses/)
            lose(CHANCELLOR, [
                { at: { kind: 'board', playerId: CHANCELLOR }, owner: IMPERIAL_WARBANDS, count: 2 }
            ]).apply(state)
        })
        expect(state.getPlayerState(CHANCELLOR).warbandsInPersonalBank[IMPERIAL_WARBANDS]).toBe(20)
        expect(state.getPlayerState(CHANCELLOR).warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(6)
    })

    it('sends surviving Imperial warbands off a site to the Chancellor, not the Citizen', () => {
        const state = imperialDefence()
        sacrifice().apply(state)
        lose(CHANCELLOR, [
            { at: { kind: 'board', playerId: CHANCELLOR }, owner: IMPERIAL_WARBANDS, count: 2 }
        ]).apply(state)

        expect(state.warbandsBySite['c1'][IMPERIAL_WARBANDS]).toBe(0)
        expect(state.getPlayerState(CHANCELLOR).warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(6)
        expect(state.getPlayerState(CITIZEN).warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(0)
    })
})

describe('R-5.5.6.a — the defending side is asked only when its losses can differ (turn-flow revision)', () => {
    // No card reads which site a defeated warband stood at: Hospital sets aside by owner, Obsidian
    // Cage takes every survivor, and Sticky Fire kills the whole force.
    const ACROSS_TWO_SITES: WarbandGroup[] = [
        { at: { kind: 'site', siteId: 'c1' }, owner: DEFENDER, count: 2 },
        { at: { kind: 'site', siteId: 'c2' }, owner: DEFENDER, count: 2 }
    ]

    function won(force: WarbandGroup[], campaign: Partial<CampaignState> = {}, createdBeforeRevisions = false) {
        const state = midBattle({ swords: 9, defense: 1, defendingForce: force, ...campaign })
        state.oathRevision = createdBeforeRevisions ? undefined : OathRevision.TurnFlow
        state.warbandsBySite = { c1: { [DEFENDER]: 2 }, c2: { [DEFENDER]: 2 } }
        state.getPlayerState(DEFENDER).warbandsOnBoard = {}
        return state
    }

    it('takes the default kills at once for one owner over several sites', () => {
        const state = won(ACROSS_TWO_SITES)
        const action = sacrifice()
        expectWarbandsConserved(state, () => action.apply(state))
        expect(state.campaign?.pendingDefeatKills).toBeUndefined()
        expect(action.metadata?.awaitingLossesOf).toBeUndefined()
        expect(action.metadata?.defeatKilled).toBe(2)
        expect(state.getPlayerState(DEFENDER).warbandsOnBoard[DEFENDER]).toBe(2)
    })

    it('still asks when the force mixes owners: an Imperial defence with a Citizen’s own warbands', () => {
        const state = won([
            { at: { kind: 'site', siteId: 'c1' }, owner: IMPERIAL_WARBANDS, count: 2 },
            { at: { kind: 'site', siteId: 'c2' }, owner: CITIZEN, count: 2 }
        ], { defenderPlayerId: CITIZEN, allyPlayerIds: [CHANCELLOR] })
        state.warbandsBySite = { c1: { [IMPERIAL_WARBANDS]: 2 }, c2: { [CITIZEN]: 2 } }
        sacrifice().apply(state)
        expect(state.campaign?.pendingDefeatKills).toEqual({ chooserPlayerId: CHANCELLOR })
    })

    it('still asks when part of the force stands on a board', () => {
        const state = won(ALL_DEFENDERS)
        state.getPlayerState(DEFENDER).warbandsOnBoard = { [DEFENDER]: 1 }
        sacrifice().apply(state)
        expect(state.campaign?.pendingDefeatKills).toEqual({ chooserPlayerId: DEFENDER })
    })

    it('does not ask for Hospital alone: it sets the same warbands aside wherever they stood', () => {
        const state = won(ACROSS_TWO_SITES, { killRedirects: [{ playerId: DEFENDER, siteId: 'c2' }] })
        const action = sacrifice()
        action.apply(state)
        expect(state.campaign?.pendingDefeatKills).toBeUndefined()
        expect(action.metadata?.defeatKilled).toBe(2)
        expect(state.campaign?.heldForHospital).toEqual([{ playerId: DEFENDER, siteId: 'c2', owner: DEFENDER, count: 2 }])
        expect(state.getPlayerState(DEFENDER).warbandsOnBoard[DEFENDER]).toBe(2)
    })

    it('still asks in a game created before the revision, as its stored Campaigns were recorded (R-X.4)', () => {
        const state = won(ACROSS_TWO_SITES, {}, true)
        sacrifice().apply(state)
        expect(state.campaign?.pendingDefeatKills).toEqual({ chooserPlayerId: DEFENDER })
        lose(DEFENDER, [{ at: { kind: 'site', siteId: 'c2' }, owner: DEFENDER, count: 2 }]).apply(state)
        expect(state.campaign?.pendingDefeatKills).toBeUndefined()
    })

    it('reads the force alone', () => {
        expect(defeatChoiceMatters(ACROSS_TWO_SITES)).toBe(false)
        expect(defeatChoiceMatters(ALL_DEFENDERS)).toBe(true)
    })
})

describe('R-5.5.6 — the default kill allocation an interface can offer', () => {
    it('kills half the DEFENDER’s force when the sacrifice wins', () => {
        const state = midBattle()
        const kills = HydratedCampaignSacrifice.defaultDefeatKills(state, 3)

        expect(kills.reduce((n, g) => n + g.count, 0)).toBe(1)
        expect(kills[0].at).toEqual({ kind: 'site', siteId: 'c1' })
    })

    it('kills half the ATTACKER’s own force when the sacrifice does not win', () => {
        const state = midBattle()
        const kills = HydratedCampaignSacrifice.defaultDefeatKills(state, 0)

        expect(kills.reduce((n, g) => n + g.count, 0)).toBe(2)
        expect(kills[0].at).toEqual({ kind: 'board', playerId: ATTACKER })
    })

    /** R-5.5.5.c permits only two sacrifices: none, or exactly enough to win. */
    it('produces an allocation the engine accepts, for both legal amounts', () => {
        const needed = HydratedCampaignSacrifice.sacrificeNeeded(ongoingCampaign(midBattle()))
        expect(needed).toBe(3)

        for (const amount of [0, needed]) {
            const state = midBattle()
            const reason = HydratedCampaignSacrifice.reasonCannotResolve(state, ATTACKER, {
                sacrifice: amount,
                defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(state, amount)
            })
            expect(reason, `sacrifice ${amount}`).toBeUndefined()
        }
    })
})

describe('what happens next', () => {
    it('keeps the campaign on state when the attacker is victorious (R-5.5.7)', () => {
        const state = midBattle({ swords: 9, defense: 1 })
        sacrifice().apply(state)
        lose(DEFENDER, [ALL_DEFENDERS[1]]).apply(state)
        expect(state.campaign?.attackerVictorious).toBe(true)
    })

    it('clears the campaign when the attacker is defeated -- there is no step 7', () => {
        const state = midBattle({ swords: 0, defense: 9 })
        sacrifice({
            defeatKills: [
                { at: { kind: 'board', playerId: ATTACKER }, owner: ATTACKER, count: 2 }
            ]
        }).apply(state)
        expect(state.campaign).toBeUndefined()
    })

    it('refuses to resolve when no Campaign is under way', () => {
        const state = midBattle()
        state.campaign = undefined
        expect(() => sacrifice().apply(state)).toThrow(/no Campaign/)
    })

    it('refuses a player who is not the attacker', () => {
        const state = midBattle({ swords: 9, defense: 1 })
        expect(() => sacrifice({ playerId: DEFENDER }).apply(state)).toThrow(
            /only the attacker/
        )
    })

    it('refuses to resolve twice', () => {
        const state = midBattle({ swords: 9, defense: 1 })
        sacrifice().apply(state)
        expect(() => sacrifice().apply(state)).toThrow(/already resolved/)
    })
})

describe('R-5.5.4 — the defending force recorded at the roll', () => {
    // R-2.11-H1 re-evaluates the title after the roll too, so R-2.11.b's choice can detour before the sacrifice.
    it('survives an Oathkeeper choice between the roll and the sacrifice', () => {
        const state = midBattle({ swords: 9, defense: 1 })
        const recorded = structuredClone(ongoingCampaign(state).defendingForce)
        state.machineState = MachineState.OathkeeperChoice
        state.pendingOathkeeperChoice = {
            holderPlayerId: CHANCELLOR,
            candidates: [ATTACKER, DEFENDER],
            resumeMachineState: MachineState.CampaignSacrifice
        }
        const choice = new HydratedResolveOathkeeper(
            buildAction(ResolveOathkeeper, { playerId: CHANCELLOR, chosenPlayerId: DEFENDER })
        )
        choice.apply(state)
        expect(choice.metadata?.resumeMachineState).toBe(MachineState.CampaignSacrifice)
        expect(state.oathkeeperPlayerId).toBe(DEFENDER)
        expect(ongoingCampaign(state).defendingForce).toEqual(recorded)

        sacrifice().apply(state)
        expect(state.campaign?.attackerVictorious).toBe(true)
        expect(state.campaign?.defendingForce).toEqual(recorded)
    })
})
