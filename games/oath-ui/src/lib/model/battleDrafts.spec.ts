import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert } from '@tabletop/common'
import {
    CampaignTargetKind,
    MachineState,
    PowerTiming,
    cardPowers,
    isCampaignAttackPlans,
    type CampaignState
} from '@tabletop/oath'
import { campaignRecords, required, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { IMPERIAL_WARBANDS } from '@tabletop/oath'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const ME = 'me'
const FOE = 'foe'
const WILD_MOUNTS = 'denizen.nomad.wild-mounts'
const MOUNTS_PLAN = required(
    cardPowers(WILD_MOUNTS).find((power) => power.timing === PowerTiming.BattlePlan),
    'Wild Mounts’ battle plan'
).powerIndex

function battle(machineState: MachineState, campaign: Partial<CampaignState>, onClock: string) {
    const state = testState(
        [
            testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', warbandsOnBoard: { [ME]: 4 } }),
            testPlayer({
                playerId: FOE,
                color: Color.Blue,
                siteId: 'c1',
                warbandsOnBoard: { [FOE]: 2 },
                advisers: [{ cardId: WILD_MOUNTS, faceUp: true }]
            })
        ],
        {
            machineState,
            activePlayerIds: [onClock],
            warbandsBySite: { c1: { [FOE]: 3 }, c2: { [FOE]: 2 } },
            campaign: {
                attackerPlayerId: ME,
                defenderPlayerId: FOE,
                nonImperialPlayerIds: [],
                allyPlayerIds: [],
                targets: [],
                attackPool: 0,
                defensePool: 0,
                attackRoll: [],
                defenseRoll: [],
                defense: 0,
                swords: 0,
                defendingForce: [],
                defendingBandits: 0,
                ...campaignRecords(),
                ...campaign
            }
        }
    )
    return openSessionOn(tableOf(state))
}

const SITES = [
    { kind: CampaignTargetKind.Site, siteId: 'c1' },
    { kind: CampaignTargetKind.Site, siteId: 'c2' }
] as const

/** R-5.5.7 — one entry holds every count and every bottomed relic, so Undo clears them together. */
describe('the spoils draft (docs/user-interactions.md)', () => {
    const won = () =>
        battle(MachineState.CampaignVictory, { attackerVictorious: true, targets: [...SITES] }, ME).victory

    it('a count on one site keeps the counts on the others', () => {
        const spoils = won()
        spoils.setPlaceCount('c1', ME, 2)
        spoils.setPlaceCount('c2', ME, 1)
        expect(spoils.placeCounts).toEqual({ c1: 2, c2: 1 })
    })

    it('Undo clears every count at once', () => {
        const spoils = won()
        spoils.setPlaceCount('c1', ME, 2)
        spoils.setPlaceCount('c2', ME, 1)
        expect(spoils.back()).toBe(true)
        expect(spoils.placeCounts).toEqual({ c1: 0, c2: 0 })
        expect(spoils.back()).toBe(false)
    })

    it('before any count there is nothing for Undo to take', () => {
        const spoils = won()
        expect(spoils.hasManualSelection()).toBe(false)
        expect(spoils.back()).toBe(false)
    })

    it('a site not taken, or more warbands than the force holds, is never placed', () => {
        const spoils = won()
        spoils.setPlaceCount('p1', ME, 1)
        expect(spoils.hasManualSelection()).toBe(false)
        spoils.setPlaceCount('c1', ME, 9)
        expect(spoils.placeCounts.c1).toBe(4)
    })

    it('recounting a site lowers the ceiling left for the others', () => {
        const spoils = won()
        spoils.setPlaceCount('c1', ME, 3)
        expect(spoils.ceilingAt('c2', ME)).toBe(1)
        spoils.setPlaceCount('c1', ME, 1)
        expect(spoils.ceilingAt('c2', ME)).toBe(3)
    })
})

/** R-5.5.3 — the defending side's plans are one entry. */
describe('R-5.5.2.a then R-5.5.3 — the attacker declares plans after the Citizens answer', () => {
    it('offers the attacker their plans and sends the ones ticked', async () => {
        const ARCHERS = 'denizen.nomad.horse-archers'
        const state = testState(
            [
                testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', warbandsOnBoard: { [ME]: 4 }, advisers: [{ cardId: ARCHERS, faceUp: true }] }),
                testPlayer({ playerId: FOE, color: Color.Blue, siteId: 'c1' })
            ],
            {
                machineState: MachineState.CampaignPlans,
                activePlayerIds: [ME],
                pendingCampaign: {
                    declaration: { attackerPlayerId: ME, defenderPlayerId: FOE, targets: [{ kind: CampaignTargetKind.PawnAndFavor }], attackDice: 2, plans: [], forceSiteIds: [], allyPlayerIds: [], attackerSiteId: 'c1' },
                    toAsk: [FOE],
                    awaitingAttackerPlans: true
                }
            }
        )
        const session = openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        const draft = session.attackPlans
        expect(draft.usable.map((p) => p.cardId)).toEqual([ARCHERS])
        expect(draft.plansComplete).toBe(false)
        draft.setPlan(draft.usable[0], true)
        expect(draft.plansComplete).toBe(true)
        expect(draft.usePlansRefusedBecause).toBeUndefined()
        await draft.declare(true)
        const action = sent.mock.calls[0][0]
        assert(isCampaignAttackPlans(action), 'the attacker\'s plans are sent')
        expect(action.plans?.map((p) => p.cardId)).toEqual([ARCHERS])

        draft.setPlan(draft.usable[0], true)
        await draft.declare(false)
        const none = sent.mock.calls[1][0]
        assert(isCampaignAttackPlans(none), 'no plans are sent')
        expect(none.plans ?? []).toEqual([])
    })
})

describe('R-5.5.7.III, R-11.7 — banishing from a Shrouded Wood', () => {
    it('lists no site: the Wood\'s ruler chooses, and the banish is sent for them to answer', async () => {
        const session = battle(MachineState.CampaignVictory, { attackerVictorious: true, targets: [{ kind: CampaignTargetKind.PawnAndFavor }] }, ME)
        session.gameState.siteCards = { ...session.gameState.siteCards, c1: 'site.shrouded-wood' }
        session.gameState.warbandsBySite = { ...session.gameState.warbandsBySite, c1: { [ME]: 1 } }
        const sent = vi.spyOn(session, 'resolveCampaignVictory').mockResolvedValue()
        const spoils = session.victory
        expect(spoils.woodChooses).toBe(true)
        expect(spoils.banishSites).toEqual([])
        spoils.setBanishByWood(true)
        await spoils.takeSpoils(false)
        expect(sent).toHaveBeenCalledWith([], false, [], undefined, true)
    })
})

describe('R-5.5.5, R-5.5.6, R-10.22 — the attacker picks their own losses', () => {
    function sacrificing() {
        const session = battle(MachineState.CampaignSacrifice, { swords: 1, defense: 2, sacrificeWorth: 1 }, ME)
        session.gameState.getPlayerState(ME).warbandsOnBoard = { [ME]: 4, [IMPERIAL_WARBANDS]: 1 }
        const sent = vi.spyOn(session, 'resolveCampaignSacrifice').mockResolvedValue()
        return { losses: session.attackerLosses, sent }
    }
    const board = { kind: 'board', playerId: ME } as const

    it('a winning sacrifice is sent with the warbands picked, and only once they add up', async () => {
        const { losses, sent } = sacrificing()
        expect(losses.needed).toBe(2)
        expect(losses.choosesSacrifice).toBe(true)
        expect(losses.winComplete).toBe(false)
        expect(losses.winRefusedBecause).toBeUndefined()
        losses.setSacrificed(1, 1)
        expect(losses.winComplete).toBe(false)
        losses.setSacrificed(0, 1)
        expect(losses.winComplete).toBe(true)
        expect(losses.winRefusedBecause).toBeUndefined()
        await losses.win()
        expect(sent).toHaveBeenCalledWith(
            2,
            [
                { at: board, owner: ME, count: 1 },
                { at: board, owner: IMPERIAL_WARBANDS, count: 1 }
            ],
            []
        )
    })

    it('a defeat is sent with the half picked', async () => {
        const { losses, sent } = sacrificing()
        expect(losses.defeatRequired).toBe(2)
        expect(losses.loseComplete).toBe(false)
        expect(losses.loseRefusedBecause).toBeUndefined()
        losses.setDefeated(1, 1)
        losses.setDefeated(0, 1)
        expect(losses.loseComplete).toBe(true)
        expect(losses.loseRefusedBecause).toBeUndefined()
        await losses.lose()
        expect(sent).toHaveBeenCalledWith(0, undefined, [
            { at: board, owner: ME, count: 1 },
            { at: board, owner: IMPERIAL_WARBANDS, count: 1 }
        ])
    })

    it('Undo clears the picks', () => {
        const { losses } = sacrificing()
        losses.setSacrificed(0, 2)
        expect(losses.back()).toBe(true)
        expect(losses.sacrificed).toEqual([0, 0])
    })

    it('a sacrifice is complete only at exactly the number needed', () => {
        const { losses } = sacrificing()
        losses.setSacrificed(0, 3)
        expect(losses.winComplete).toBe(false)
        losses.setSacrificed(0, 2)
        expect(losses.winComplete).toBe(true)
        losses.setSacrificed(1, 1)
        expect(losses.winComplete).toBe(false)
        expect(losses.winRefusedBecause).toBeUndefined()
    })
})

/** With nothing to sacrifice, the outcome is all the step says. */
describe('R-5.5.5 — a battle that needs no sacrifice', () => {
    it('is won when the swords beat the defense', () => {
        const session = battle(MachineState.CampaignSacrifice, { swords: 3, defense: 2 }, ME)
        expect(session.attackerLosses.needed).toBe(0)
        expect(session.attackerLosses.wonWithoutSacrifice).toBe(true)
    })

    it('follows a battle plan that decided it (Hearts and Minds, Peace Envoy)', () => {
        const lost = battle(MachineState.CampaignSacrifice, { swords: 0, defense: 5, decidedVictor: 'defender' }, ME)
        expect(lost.attackerLosses.needed).toBe(0)
        expect(lost.attackerLosses.wonWithoutSacrifice).toBe(false)
        const won = battle(MachineState.CampaignSacrifice, { swords: 0, defense: 5, decidedVictor: 'attacker' }, ME)
        expect(won.attackerLosses.wonWithoutSacrifice).toBe(true)
    })

    it('is not settled while a sacrifice could still win it', () => {
        const session = battle(MachineState.CampaignSacrifice, { swords: 1, defense: 2, sacrificeWorth: 1 }, ME)
        expect(session.attackerLosses.needed).toBe(2)
        expect(session.attackerLosses.wonWithoutSacrifice).toBe(false)
    })
})

describe('R-5.5.7.I — spoils from a board holding two owners\' warbands (R-6.6.2)', () => {
    it('offers each owner on each taken site, held to what the board carries of theirs', () => {
        const session = battle(MachineState.CampaignVictory, { attackerVictorious: true, targets: [...SITES] }, ME)
        session.gameState.getPlayerState(ME).warbandsOnBoard = { [ME]: 2, [IMPERIAL_WARBANDS]: 1 }
        const spoils = session.victory
        expect(spoils.forceOwners).toEqual([ME, IMPERIAL_WARBANDS])
        spoils.setPlaceCount('c1', IMPERIAL_WARBANDS, 5)
        spoils.setPlaceCount('c2', ME, 2)
        expect(spoils.placements).toEqual([
            { siteId: 'c1', owner: IMPERIAL_WARBANDS, count: 1 },
            { siteId: 'c2', owner: ME, count: 2 }
        ])
        expect(spoils.ceilingAt('c2', IMPERIAL_WARBANDS)).toBe(0)
    })
})

describe('R-5.5.7.III — banishing the defeated pawn', () => {
    it('is offered only when the pawn and favor were targeted, and is sent with the spoils', async () => {
        expect(battle(MachineState.CampaignVictory, { attackerVictorious: true, targets: [...SITES] }, ME).victory.banishSites).toEqual([])

        const session = battle(
            MachineState.CampaignVictory,
            { attackerVictorious: true, targets: [{ kind: CampaignTargetKind.PawnAndFavor }] },
            ME
        )
        const sent = vi.spyOn(session, 'resolveCampaignVictory').mockResolvedValue()
        const spoils = session.victory
        expect(spoils.banishSites).not.toContain('c1')
        expect(spoils.banishSites).toContain('c2')

        spoils.setBanishSite('c1')
        expect(spoils.banishSite).toBeUndefined()
        spoils.setBanishSite('c2')
        expect(spoils.banishSite).toBe('c2')
        await spoils.takeSpoils(false)
        expect(sent).toHaveBeenCalledWith([], false, [], 'c2', false)
    })
})

describe('the defence draft (docs/user-interactions.md)', () => {
    const defending = () =>
        battle(
            MachineState.CampaignPlans,
            { targets: [{ kind: CampaignTargetKind.PawnAndFavor }], pendingDefenderPlans: { queue: [FOE] } },
            FOE
        ).defence

    it('declaring the plan, then taking it back, leaves nothing declared', () => {
        const defence = defending()
        defence.setPlan({ cardId: WILD_MOUNTS, powerIndex: MOUNTS_PLAN }, true)
        expect(defence.plans).toEqual([{ cardId: WILD_MOUNTS, powerIndex: MOUNTS_PLAN }])
        defence.setPlan({ cardId: WILD_MOUNTS, powerIndex: MOUNTS_PLAN }, false)
        expect(defence.plans).toEqual([])
    })

    it('Undo clears the declared plans', () => {
        const defence = defending()
        defence.setPlan({ cardId: WILD_MOUNTS, powerIndex: MOUNTS_PLAN }, true)
        expect(defence.back()).toBe(true)
        expect(defence.plans).toEqual([])
        expect(defence.back()).toBe(false)
    })

    it('before any tick there is nothing for Undo to take', () => {
        const defence = defending()
        expect(defence.usable.map((power) => power.cardId)).toEqual([WILD_MOUNTS])
        expect(defence.hasManualSelection()).toBe(false)
    })

    it('a plan the defender cannot use is never declared', () => {
        const defence = defending()
        defence.setPlan({ cardId: 'denizen.order.relic-hunter', powerIndex: 0 }, true)
        expect(defence.hasManualSelection()).toBe(false)
    })

    it('Use plans waits for a ringed plan; No plans sends none, whatever is ringed', async () => {
        const session = battle(
            MachineState.CampaignPlans,
            { targets: [{ kind: CampaignTargetKind.PawnAndFavor }], pendingDefenderPlans: { queue: [FOE] } },
            FOE
        )
        const sent = vi.spyOn(session, 'defendCampaign').mockResolvedValue()
        const defence = session.defence
        expect(defence.plansComplete).toBe(false)
        expect(defence.usePlansRefusedBecause).toBeUndefined()
        expect(defence.noPlansRefusedBecause).toBeUndefined()
        defence.setPlan({ cardId: WILD_MOUNTS, powerIndex: MOUNTS_PLAN }, true)
        expect(defence.plansComplete).toBe(true)
        expect(defence.usePlansRefusedBecause).toBeUndefined()

        await defence.answer(false)
        expect(sent).toHaveBeenLastCalledWith([])
        await defence.answer(true)
        expect(sent).toHaveBeenLastCalledWith([{ cardId: WILD_MOUNTS, powerIndex: MOUNTS_PLAN }])
    })

    it('the attacker sees no plans of the defender’s to declare', () => {
        const session = battle(
            MachineState.CampaignPlans,
            { targets: [{ kind: CampaignTargetKind.PawnAndFavor }], pendingDefenderPlans: { queue: [FOE] } },
            ME
        )
        expect(session.defence.usable).toEqual([])
    })
})

/** R-5.5.6.a — the defeated defending side's losses, one entry for every group. */
describe('the losses draft (docs/user-interactions.md)', () => {
    const FORCE = [
        { at: { kind: 'site', siteId: 'c1' }, owner: FOE, count: 3 },
        { at: { kind: 'site', siteId: 'c2' }, owner: FOE, count: 2 }
    ] as const
    const defeated = () =>
        battle(
            MachineState.CampaignDefeat,
            {
                attackerVictorious: true,
                targets: [...SITES],
                defendingForce: FORCE.map((group) => ({ ...group, at: { ...group.at } })),
                pendingDefeatKills: { chooserPlayerId: FOE }
            },
            FOE
        ).defeat

    it('a count on one group keeps the counts on the others', () => {
        const defeat = defeated()
        defeat.setPicked(0, 1)
        defeat.setPicked(1, 1)
        expect(defeat.picked).toEqual([1, 1])
    })

    it('Undo clears every count at once', () => {
        const defeat = defeated()
        defeat.setPicked(0, 2)
        expect(defeat.back()).toBe(true)
        expect(defeat.picked).toEqual([0, 0])
        expect(defeat.back()).toBe(false)
    })

    it('before any count there is nothing for Undo to take', () => {
        const defeat = defeated()
        expect(defeat.required).toBeGreaterThan(0)
        expect(defeat.hasManualSelection()).toBe(false)
    })

    it('a count is held to its group', () => {
        const defeat = defeated()
        defeat.setPicked(1, 9)
        expect(defeat.picked).toEqual([0, 2])
        defeat.setPicked(5, 1)
        expect(defeat.picked).toEqual([0, 2])
    })

    it('Kill waits for the count; the engine is asked only once the count is right', () => {
        const defeat = defeated()
        const required = defeat.required
        expect(defeat.complete).toBe(false)
        expect(defeat.refusedBecause).toBeUndefined()
        defeat.setPicked(0, Math.min(required, 3))
        defeat.setPicked(1, required - Math.min(required, 3))
        expect(defeat.pickedTotal).toBe(required)
        expect(defeat.complete).toBe(true)
        expect(defeat.refusedBecause).toBeUndefined()
    })

    it('recounting a group replaces its count only', () => {
        const defeat = defeated()
        defeat.setPicked(0, 3)
        defeat.setPicked(1, 1)
        defeat.setPicked(0, 1)
        expect(defeat.picked).toEqual([1, 1])
    })
})
