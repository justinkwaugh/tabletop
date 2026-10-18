import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert } from '@tabletop/common'
import {
    Banner,
    CampaignTargetKind,
    HydratedCampaignSacrifice,
    MachineState,
    OathRevision,
    PlayerStatus,
    PowerChoiceKind,
    PowerTiming,
    cardPowers,
    isCampaignAttackPlans,
    type CampaignState
} from '@tabletop/oath'
import { campaignRecords, required, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { IMPERIAL_WARBANDS } from '@tabletop/oath'
import { emptyPicks } from './powerChoices.js'
import { withCount, withFrom, withTo, type MovePick } from './powerMoves.js'

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

async function battle(machineState: MachineState, campaign: Partial<CampaignState>, onClock: string) {
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
    return await openSessionOn(tableOf(state))
}

const SITES = [
    { kind: CampaignTargetKind.Site, siteId: 'c1' },
    { kind: CampaignTargetKind.Site, siteId: 'c2' }
] as const

/** R-5.5.7.I — the warbands step holds its counts as one entry, over a default of one per site. */
describe('the spoils draft (docs/user-interactions.md)', () => {
    const won = async () =>
        (await battle(MachineState.CampaignVictory, { attackerVictorious: true, targets: [...SITES] }, ME)).victory

    it('a count on one site keeps the counts on the others', async () => {
        const spoils = await won()
        spoils.setPlaceCount('c1', ME, 2)
        spoils.setPlaceCount('c2', ME, 0)
        expect(spoils.placeCounts).toEqual({ c1: 2, c2: 0 })
    })

    it("Undo takes back the step's counts at once, to the default", async () => {
        const spoils = await won()
        spoils.setPlaceCount('c1', ME, 2)
        spoils.setPlaceCount('c2', ME, 0)
        expect(spoils.back()).toBe(true)
        expect(spoils.placeCounts).toEqual({ c1: 1, c2: 1 })
        expect(spoils.back()).toBe(false)
    })

    it('before any count there is nothing for Undo to take', async () => {
        const spoils = await won()
        expect(spoils.hasManualSelection()).toBe(false)
        expect(spoils.back()).toBe(false)
    })

    it('a site not taken, or more warbands than the force holds, is never placed', async () => {
        const spoils = await won()
        spoils.setPlaceCount('p1', ME, 1)
        expect(spoils.hasManualSelection()).toBe(false)
        spoils.setPlaceCount('c1', ME, 9)
        expect(spoils.placeCounts.c1).toBe(3)
    })

    it('recounting a site lowers the ceiling left for the others', async () => {
        const spoils = await won()
        spoils.setPlaceCount('c1', ME, 3)
        expect(spoils.ceilingAt('c2', ME)).toBe(1)
        spoils.setPlaceCount('c1', ME, 1)
        expect(spoils.ceilingAt('c2', ME)).toBe(3)
    })

    it('a tap on the Nth warband places N, a tap on the count places none, and one past the ceiling is no pick', async () => {
        const spoils = await won()
        expect(spoils.forceOf(ME)).toBe(4)
        spoils.tapWarband('c1', ME, 3)
        expect(spoils.placeCounts).toEqual({ c1: 3, c2: 1 })
        spoils.tapWarband('c1', ME, 3)
        expect(spoils.placeCounts).toEqual({ c1: 0, c2: 1 })
        spoils.tapWarband('c1', ME, 3)
        expect(spoils.ceilingAt('c2', ME)).toBe(1)
        spoils.tapWarband('c2', ME, 2)
        spoils.tapWarband('c2', ME, 0)
        expect(spoils.placeCounts).toEqual({ c1: 3, c2: 1 })
        spoils.tapWarband('c2', ME, 1)
        expect(spoils.placeCounts).toEqual({ c1: 3, c2: 0 })
    })
})

/**
 * R-5.5.7 — the spoils one step at a time, in the Law's order: the warbands on the sites taken,
 * then the relics, then the defender's pawn, then the favor. A step with nothing to choose is
 * skipped; the last choice sends everything as one action.
 */
describe('the spoils one step at a time', () => {
    const RELIC_SLOT = 'c1.relic.0'
    const won = async (targets: CampaignState['targets'], board: Record<string, number> = { [ME]: 4 }) => {
        const session = await battle(MachineState.CampaignVictory, { attackerVictorious: true, targets }, ME)
        session.gameState.getPlayerState(ME).warbandsOnBoard = board
        session.gameState.relicsBySite = { c1: [{ slotId: RELIC_SLOT }] }
        return session
    }
    const RELIC = { kind: CampaignTargetKind.SiteRelic, slotId: RELIC_SLOT } as const
    const PAWN = { kind: CampaignTargetKind.PawnAndFavor } as const

    it("lists the steps in the Law's order and skips one with nothing to choose", async () => {
        expect((await won([PAWN, ...SITES])).victory.steps).toEqual(['warbands', 'pawn', 'favor'])
        expect((await won([RELIC, SITES[0]])).victory.steps).toEqual(['warbands', 'relics'])
        expect((await won([SITES[0]], {})).victory.steps).toEqual([])
        expect(
            (await won([{ kind: CampaignTargetKind.Banner, banner: Banner.PeoplesFavor }])).victory.steps
        ).toEqual([])
        const spoils = (await won([PAWN, ...SITES])).victory
        expect(spoils.step).toBe('warbands')
        expect(spoils.stepNumber).toBe(1)
    })

    it('a force that cannot place warbands at sites (Ring of Devotion) skips the warbands step and places none', async () => {
        const session = await won([PAWN, ...SITES])
        session.gameState.getPlayerState(ME).relicIds = ['relic.ring-of-devotion']
        expect(session.victory.steps).toEqual(['pawn', 'favor'])
        expect(session.victory.placements).toEqual([])
    })

    it('starts with 1 warband at each site taken when the force holds enough', async () => {
        const spoils = (await won([...SITES])).victory
        expect(spoils.placeCounts).toEqual({ c1: 1, c2: 1 })
        expect(spoils.placedTotal).toBe(2)
        expect(spoils.hasManualSelection()).toBe(false)
    })

    it("with fewer warbands than sites, fills the sites in the map's order", async () => {
        const spoils = (await won([SITES[1], SITES[0]], { [ME]: 1 })).victory
        expect(spoils.placeCounts).toEqual({ c1: 1, c2: 0 })
    })

    it("fills the default from the player's own warbands first, then the Empire's", async () => {
        const spoils = (await won([...SITES], { [IMPERIAL_WARBANDS]: 1, [ME]: 1 })).victory
        expect(spoils.forceOwners).toEqual([ME, IMPERIAL_WARBANDS])
        expect(spoils.placements).toEqual([
            { siteId: 'c1', owner: ME, count: 1 },
            { siteId: 'c2', owner: IMPERIAL_WARBANDS, count: 1 }
        ])
    })

    it('with one row, a tap on a number moves on; Undo returns with that number still marked', async () => {
        const spoils = (await won([PAWN, SITES[0]])).victory
        expect(spoils.warbandRows).toEqual([{ siteId: 'c1', owner: ME }])
        expect(spoils.nextShown).toBe(true)
        spoils.setPlaceCount('c1', ME, 3)
        expect(spoils.step).toBe('pawn')
        expect(spoils.stepNumber).toBe(2)
        expect(spoils.back()).toBe(true)
        expect(spoils.step).toBe('warbands')
        expect(spoils.countAt('c1', ME)).toBe(3)
        expect(spoils.back()).toBe(true)
        expect(spoils.countAt('c1', ME)).toBe(1)
        expect(spoils.back()).toBe(false)
    })

    it('with one row, a tap on the marked warband places none and moves on', async () => {
        const spoils = (await won([PAWN, SITES[0]])).victory
        expect(spoils.countAt('c1', ME)).toBe(1)
        spoils.tapWarband('c1', ME, 1)
        expect(spoils.step).toBe('pawn')
        expect(spoils.countAt('c1', ME)).toBe(0)
        expect(spoils.placements).toEqual([])
    })

    it('with several rows, a tap sets a count and Next moves on; Next alone accepts the default', async () => {
        const spoils = (await won([PAWN, ...SITES])).victory
        spoils.setPlaceCount('c2', ME, 0)
        expect(spoils.step).toBe('warbands')
        expect(spoils.nextShown).toBe(true)
        spoils.next()
        expect(spoils.step).toBe('pawn')
        expect(spoils.placeCounts).toEqual({ c1: 1, c2: 0 })

        const fresh = (await won([PAWN, ...SITES])).victory
        fresh.next()
        expect(fresh.step).toBe('pawn')
        expect(fresh.placeCounts).toEqual({ c1: 1, c2: 1 })
        expect(fresh.back()).toBe(true)
        expect(fresh.step).toBe('warbands')
        expect(fresh.back()).toBe(false)
    })

    it('a relic starts with no choice; with one relic a tap moves on, and the choice is sent', async () => {
        const session = await won([RELIC, SITES[0], PAWN])
        const sent = vi.spyOn(session, 'resolveCampaignVictory').mockResolvedValue()
        const spoils = session.victory
        spoils.next()
        expect(spoils.step).toBe('relics')
        expect(spoils.relicChoice(RELIC_SLOT)).toBeUndefined()
        expect(spoils.nextShown).toBe(false)
        spoils.setRelic(RELIC_SLOT, true)
        expect(spoils.step).toBe('pawn')
        expect(spoils.back()).toBe(true)
        expect(spoils.step).toBe('relics')
        expect(spoils.relicChoice(RELIC_SLOT)).toBe('bottom')
        spoils.setRelic(RELIC_SLOT, true)
        spoils.leavePawn()
        expect(spoils.step).toBe('favor')
        await spoils.takeSpoils(false)
        expect(sent).toHaveBeenCalledWith(
            [{ siteId: 'c1', owner: ME, count: 1 }],
            false,
            [RELIC_SLOT],
            undefined,
            false
        )
    })

    it('the last step is not left by a tap: its "Take spoils" sends, once its picks are made', async () => {
        const session = await won([RELIC, SITES[0]])
        const sent = vi.spyOn(session, 'resolveCampaignVictory').mockResolvedValue()
        const spoils = session.victory
        spoils.setPlaceCount('c1', ME, 2)
        expect(spoils.step).toBe('relics')
        expect(spoils.isLastStep).toBe(true)
        expect(spoils.sendShown).toBe(false)
        spoils.setRelic(RELIC_SLOT, false)
        expect(spoils.step).toBe('relics')
        expect(spoils.relicChoice(RELIC_SLOT)).toBe('keep')
        expect(spoils.sendShown).toBe(true)
        expect(spoils.nextShown).toBe(false)
        await spoils.takeSpoils(false)
        expect(sent).toHaveBeenCalledWith(
            [{ siteId: 'c1', owner: ME, count: 2 }],
            false,
            [],
            undefined,
            false
        )
    })

    it('with nothing to choose, "Take spoils" is all there is', async () => {
        const spoils = (await won([SITES[0]], {})).victory
        expect(spoils.step).toBeUndefined()
        expect(spoils.sendShown).toBe(true)
    })

    it('a lit site banishes the pawn there and moves on; Undo returns to the pawn', async () => {
        const session = await won([PAWN, SITES[0]])
        const sent = vi.spyOn(session, 'resolveCampaignVictory').mockResolvedValue()
        const spoils = session.victory
        spoils.next()
        expect(spoils.step).toBe('pawn')
        expect(spoils.mapSites).toContain('c2')
        expect(spoils.mapSites).not.toContain('c1')
        spoils.banishTo('c1')
        expect(spoils.step).toBe('pawn')
        spoils.banishTo('c2')
        expect(spoils.step).toBe('favor')
        expect(spoils.mapSites).toEqual([])
        expect(spoils.back()).toBe(true)
        expect(spoils.step).toBe('pawn')
        spoils.banishTo('c2')
        await spoils.takeSpoils(true)
        expect(sent).toHaveBeenCalledWith(
            [{ siteId: 'c1', owner: ME, count: 1 }],
            true,
            [],
            'c2',
            false
        )
    })

    it('the lit sites are offered on the map while the pawn step is open, and the rest dims', async () => {
        const session = await won([PAWN, SITES[0]])
        expect(session.siteOffers).toEqual([])
        session.victory.next()
        const offers = session.siteOffers
        expect(offers.map((offer) => offer.slotId)).toEqual(session.victory.mapSites)
        expect(offers.every((offer) => offer.intent === 'banish')).toBe(true)
        expect(session.mapDimmed).toBe(true)
        expect(session.mapPick).toEqual({
            kind: 'banish',
            sites: session.victory.mapSites,
            choosing: true
        })
        session.victory.leavePawn()
        expect(session.siteOffers).toEqual([])
        expect(session.mapPick).toBeUndefined()
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
        const session = await openSessionOn(tableOf(state))
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
    it('lights no site: "Let <ruler> choose" moves on, and the banish is sent for them to answer', async () => {
        const session = await battle(MachineState.CampaignVictory, { attackerVictorious: true, targets: [{ kind: CampaignTargetKind.PawnAndFavor }] }, ME)
        session.gameState.siteCards = { ...session.gameState.siteCards, c1: 'site.shrouded-wood' }
        session.gameState.warbandsBySite = { ...session.gameState.warbandsBySite, c1: { [ME]: 1 } }
        const sent = vi.spyOn(session, 'resolveCampaignVictory').mockResolvedValue()
        const spoils = session.victory
        expect(spoils.woodChooses).toBe(true)
        expect(spoils.woodRuler).toBe(ME)
        expect(spoils.step).toBe('pawn')
        expect(spoils.banishSites).toEqual([])
        expect(spoils.mapSites).toEqual([])
        spoils.letWoodRulerChoose()
        expect(spoils.step).toBe('favor')
        await spoils.takeSpoils(false)
        expect(sent).toHaveBeenCalledWith([], false, [], undefined, true)
    })
})

describe('R-5.5.5, R-5.5.6, R-10.22 — the attacker picks their own losses', () => {
    async function sacrificing() {
        const session = await battle(MachineState.CampaignSacrifice, { swords: 1, defense: 2, sacrificeWorth: 1 }, ME)
        session.gameState.getPlayerState(ME).warbandsOnBoard = { [ME]: 4, [IMPERIAL_WARBANDS]: 1 }
        const sent = vi.spyOn(session, 'resolveCampaignSacrifice').mockResolvedValue()
        return { losses: session.attackerLosses, sent }
    }
    const board = { kind: 'board', playerId: ME } as const

    it('a winning sacrifice is sent with the warbands picked, and only once they add up', async () => {
        const { losses, sent } = await sacrificing()
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
        const { losses, sent } = await sacrificing()
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

    it('Undo clears the picks', async () => {
        const { losses } = await sacrificing()
        losses.setSacrificed(0, 2)
        expect(losses.back()).toBe(true)
        expect(losses.sacrificed).toEqual([0, 0])
    })

    it('a sacrifice is complete only at exactly the number needed, and never picks past it', async () => {
        const { losses } = await sacrificing()
        losses.setSacrificed(0, 1)
        expect(losses.winComplete).toBe(false)
        losses.setSacrificed(0, 3)
        expect(losses.sacrificed).toEqual([2, 0])
        expect(losses.winComplete).toBe(true)
        losses.setSacrificed(1, 1)
        expect(losses.sacrificed).toEqual([2, 0])
        expect(losses.winComplete).toBe(true)
        expect(losses.winRefusedBecause).toBeUndefined()
    })
})

/** R-5.5.6 — with one owner, every survivor reaches the same board, so the half that dies is not a pick. */
describe('R-5.5.6 — the attacker’s defeat rows only when the pick matters', () => {
    async function inTwoPlaces(onBoard: Record<string, number>) {
        const session = await battle(
            MachineState.CampaignSacrifice,
            { swords: 1, defense: 2, sacrificeWorth: 1, forceSiteIds: ['c2'] },
            ME
        )
        session.gameState.getPlayerState(ME).warbandsOnBoard = onBoard
        session.gameState.warbandsBySite = { c1: { [FOE]: 3 }, c2: { [ME]: 2 } }
        const sent = vi.spyOn(session, 'resolveCampaignSacrifice').mockResolvedValue()
        return { losses: session.attackerLosses, sent }
    }

    it('a force of one owner on the board and at a site: the sacrifice is picked, the defeat is not', async () => {
        const { losses, sent } = await inTwoPlaces({ [ME]: 4 })
        expect(losses.force).toHaveLength(2)
        expect(losses.choosesSacrifice).toBe(true)
        expect(losses.choosesDefeat).toBe(false)
        expect(losses.loseComplete).toBe(true)
        await losses.lose()
        expect(sent).toHaveBeenCalledWith(0, undefined, expect.any(Array))
    })

    it('a force that mixes owners (before revision 5) still picks the half that dies', async () => {
        const { losses } = await inTwoPlaces({ [ME]: 4, [IMPERIAL_WARBANDS]: 1 })
        expect(losses.choosesDefeat).toBe(true)
        expect(losses.loseComplete).toBe(false)
    })
})

/** R-5.5.5 — from revision 7 the attacker picks where the skulls kill, after the roll. */
describe('the skull losses draft', () => {
    async function skulls(count: number) {
        const session = await battle(
            MachineState.CampaignSkullLosses,
            { forceSiteIds: ['c2'], pendingSkullLosses: { skulls: count } },
            ME
        )
        session.gameState.warbandsBySite = { c1: { [FOE]: 3 }, c2: { [ME]: 2 } }
        const sent = vi.spyOn(session, 'chooseSkullLosses').mockResolvedValue()
        return { draft: session.skullLosses, sent }
    }
    const onBoard = { kind: 'board', playerId: ME } as const
    const atC2 = { kind: 'site', siteId: 'c2' } as const

    it('offers each place in the force, with nothing picked', async () => {
        const { draft } = await skulls(2)
        expect(draft.required).toBe(2)
        expect(draft.groups).toEqual([
            { at: onBoard, owner: ME, count: 4 },
            { at: atC2, owner: ME, count: 2 }
        ])
        expect(draft.picked).toEqual([0, 0])
        expect(draft.complete).toBe(false)
    })

    it('a tap on the Nth warband kills N there; a tap on the warband at the count kills none there', async () => {
        const { draft } = await skulls(2)
        draft.tap(0, 2)
        expect(draft.picked).toEqual([2, 0])
        draft.tap(0, 2)
        expect(draft.picked).toEqual([0, 0])
        draft.tap(0, 3)
        draft.tap(0, 1)
        expect(draft.picked).toEqual([1, 0])
    })

    it('Kill waits for exactly the skulls, and sends the warbands picked by place', async () => {
        const { draft, sent } = await skulls(2)
        draft.tap(0, 1)
        expect(draft.complete).toBe(false)
        await draft.kill()
        expect(sent).not.toHaveBeenCalled()
        draft.tap(1, 2)
        expect(draft.pickedTotal).toBe(3)
        expect(draft.complete).toBe(false)
        draft.tap(1, 1)
        expect(draft.complete).toBe(true)
        expect(draft.refusedBecause).toBeUndefined()
        await draft.kill()
        expect(sent).toHaveBeenCalledWith([
            { at: onBoard, owner: ME, count: 1 },
            { at: atC2, owner: ME, count: 1 }
        ])
    })

    it('Undo clears the picks', async () => {
        const { draft } = await skulls(2)
        draft.tap(1, 2)
        expect(draft.back()).toBe(true)
        expect(draft.picked).toEqual([0, 0])
    })

    it('is empty for the defender', async () => {
        const session = await battle(
            MachineState.CampaignSkullLosses,
            { forceSiteIds: ['c2'], pendingSkullLosses: { skulls: 2 } },
            FOE
        )
        expect(session.skullLosses.groups).toEqual([])
    })
})

/**
 * R-5.5.5, R-5.5.6, R-5.5.5-H1 — a force of one owner in two places (Captains, Wild Allies, Vow
 * of Union): the sacrifice is picked by place, the defeated half is the engine's.
 */
describe('the sacrifice from a force in two places', () => {
    const RULED = 'p1'
    const board = { kind: 'board', playerId: ME } as const
    const site = { kind: 'site', siteId: RULED } as const

    async function split(onBoard: number, atSite: number, owner: string = ME) {
        const session = await battle(
            MachineState.CampaignSacrifice,
            { swords: 1, defense: 3, sacrificeWorth: 1, forceSiteIds: [RULED], asIfSiteId: RULED },
            ME
        )
        session.gameState.getPlayerState(ME).warbandsOnBoard = { [owner]: onBoard }
        session.gameState.warbandsBySite[RULED] = { [owner]: atSite }
        const sent = vi.spyOn(session, 'resolveCampaignSacrifice').mockResolvedValue()
        return { session, losses: session.attackerLosses, sent }
    }

    it('asks which warbands, place by place, with nothing picked', async () => {
        const { losses } = await split(3, 2)
        expect(losses.needed).toBe(3)
        expect(losses.force).toEqual([
            { at: site, owner: ME, count: 2 },
            { at: board, owner: ME, count: 3 }
        ])
        expect(losses.choosesSacrifice).toBe(true)
        expect(losses.sacrificed).toEqual([0, 0])
        expect(losses.winComplete).toBe(false)
        expect(losses.hasManualSelection()).toBe(false)
    })

    it('no place gives more than the number needed leaves it; lowering one opens the others again', async () => {
        const { losses } = await split(3, 2)
        expect([losses.ceilingAt('sacrificed', 0), losses.ceilingAt('sacrificed', 1)]).toEqual([2, 3])
        losses.setSacrificed(1, 2)
        expect([losses.ceilingAt('sacrificed', 0), losses.ceilingAt('sacrificed', 1)]).toEqual([1, 3])
        losses.setSacrificed(0, 2)
        expect(losses.sacrificed).toEqual([1, 2])
        expect(losses.winComplete).toBe(true)
        expect([losses.ceilingAt('sacrificed', 0), losses.ceilingAt('sacrificed', 1)]).toEqual([1, 2])
        losses.setSacrificed(1, 0)
        expect([losses.ceilingAt('sacrificed', 0), losses.ceilingAt('sacrificed', 1)]).toEqual([2, 2])
        expect(losses.winComplete).toBe(false)
        losses.setSacrificed(0, 0)
        expect([losses.ceilingAt('sacrificed', 0), losses.ceilingAt('sacrificed', 1)]).toEqual([2, 3])
    })

    it('a win is sent with the warbands picked at each place', async () => {
        const { losses, sent } = await split(3, 2)
        losses.setSacrificed(1, 2)
        losses.setSacrificed(0, 1)
        expect(losses.winRefusedBecause).toBeUndefined()
        await losses.win()
        expect(sent).toHaveBeenCalledWith(
            3,
            [
                { at: site, owner: ME, count: 1 },
                { at: board, owner: ME, count: 2 }
            ],
            []
        )
    })

    it('asks no defeated half of one owner, so "Sacrifice nothing" is complete and sends the default half', async () => {
        const { session, losses, sent } = await split(3, 2)
        expect(losses.defeatRequired).toBe(2)
        expect(losses.choosesDefeat).toBe(false)
        expect(losses.loseComplete).toBe(true)
        expect(losses.loseRefusedBecause).toBeUndefined()
        losses.setDefeated(0, 2)
        expect(losses.defeated).toEqual([0, 0])
        await losses.lose()
        expect(sent).toHaveBeenCalledWith(
            0,
            undefined,
            HydratedCampaignSacrifice.attackerDefeatKills(session.gameState, 0)
        )
    })

    it('from revision 7, asks no defeated half of a Citizen’s Imperial warbands on the board and at a site they rule', async () => {
        const { session, losses } = await split(3, 2, IMPERIAL_WARBANDS)
        session.gameState.getPlayerState(ME).status = PlayerStatus.Citizen
        // Every survivor of a defeated attacker ends on their own board (R-5.5.6-H2).
        session.gameState.oathRevision = OathRevision.EngineFixes3
        expect(losses.force.map((group) => group.owner)).toEqual([IMPERIAL_WARBANDS, IMPERIAL_WARBANDS])
        expect(losses.choosesSacrifice).toBe(true)
        expect(losses.choosesDefeat).toBe(false)
    })

    it('asks the defeated half of a force that mixes owners (a game from before revision 5)', async () => {
        const { session, losses } = await split(3, 2)
        session.gameState.getPlayerState(ME).warbandsOnBoard = { [ME]: 3, [IMPERIAL_WARBANDS]: 1 }
        expect(losses.choosesDefeat).toBe(true)
        expect(losses.loseComplete).toBe(false)
    })

    it('a split with one answer, the whole force, starts picked', async () => {
        const { losses } = await split(2, 1)
        expect(losses.sacrificed).toEqual([1, 2])
        expect(losses.winComplete).toBe(true)
        expect(losses.winRefusedBecause).toBeUndefined()
        expect(losses.hasManualSelection()).toBe(false)
        losses.setSacrificed(1, 1)
        expect(losses.sacrificed).toEqual([1, 1])
        expect(losses.winComplete).toBe(false)
    })

    it('with too few warbands to win, asks no split and says why the win is refused', async () => {
        const { losses } = await split(1, 1)
        expect(losses.needed).toBe(3)
        expect(losses.choosesSacrifice).toBe(false)
        expect(losses.winComplete).toBe(true)
        expect(losses.winRefusedBecause).toBe('only 2 warbands in your force to sacrifice')
        expect(losses.loseComplete).toBe(true)
        expect(losses.loseRefusedBecause).toBeUndefined()
    })
})

/** With nothing to sacrifice, the outcome is all the step says. */
describe('R-5.5.5 — a battle that needs no sacrifice', () => {
    it('is won when the swords beat the defense', async () => {
        const session = await battle(MachineState.CampaignSacrifice, { swords: 3, defense: 2 }, ME)
        expect(session.attackerLosses.needed).toBe(0)
        expect(session.attackerLosses.wonWithoutSacrifice).toBe(true)
    })

    it('follows a battle plan that decided it (Hearts and Minds, Peace Envoy)', async () => {
        const lost = await battle(MachineState.CampaignSacrifice, { swords: 0, defense: 5, decidedVictor: 'defender' }, ME)
        expect(lost.attackerLosses.needed).toBe(0)
        expect(lost.attackerLosses.wonWithoutSacrifice).toBe(false)
        const won = await battle(MachineState.CampaignSacrifice, { swords: 0, defense: 5, decidedVictor: 'attacker' }, ME)
        expect(won.attackerLosses.wonWithoutSacrifice).toBe(true)
    })

    it('is not settled while a sacrifice could still win it', async () => {
        const session = await battle(MachineState.CampaignSacrifice, { swords: 1, defense: 2, sacrificeWorth: 1 }, ME)
        expect(session.attackerLosses.needed).toBe(2)
        expect(session.attackerLosses.wonWithoutSacrifice).toBe(false)
    })
})

describe('R-5.5.7.I — spoils from a board holding two owners\' warbands (R-6.6.2)', () => {
    it('offers each owner on each taken site, held to what the board carries of theirs', async () => {
        const session = await battle(MachineState.CampaignVictory, { attackerVictorious: true, targets: [...SITES] }, ME)
        session.gameState.getPlayerState(ME).warbandsOnBoard = { [ME]: 2, [IMPERIAL_WARBANDS]: 1 }
        const spoils = session.victory
        expect(spoils.forceOwners).toEqual([ME, IMPERIAL_WARBANDS])
        spoils.setPlaceCount('c1', ME, 0)
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
        expect((await battle(MachineState.CampaignVictory, { attackerVictorious: true, targets: [...SITES] }, ME)).victory.banishSites).toEqual([])

        const session = await battle(
            MachineState.CampaignVictory,
            { attackerVictorious: true, targets: [{ kind: CampaignTargetKind.PawnAndFavor }] },
            ME
        )
        const sent = vi.spyOn(session, 'resolveCampaignVictory').mockResolvedValue()
        const spoils = session.victory
        expect(spoils.banishSites).not.toContain('c1')
        expect(spoils.banishSites).toContain('c2')

        spoils.banishTo('c1')
        expect(spoils.banishSite).toBeUndefined()
        spoils.banishTo('c2')
        expect(spoils.banishSite).toBe('c2')
        await spoils.takeSpoils(false)
        expect(sent).toHaveBeenCalledWith([], false, [], 'c2', false)
    })
})

describe('the defence draft (docs/user-interactions.md)', () => {
    const defending = async () =>
        (await battle(
            MachineState.CampaignPlans,
            { targets: [{ kind: CampaignTargetKind.PawnAndFavor }], pendingDefenderPlans: { queue: [FOE] } },
            FOE
        )).defence

    it('declaring the plan, then taking it back, leaves nothing declared', async () => {
        const defence = await defending()
        defence.setPlan({ cardId: WILD_MOUNTS, powerIndex: MOUNTS_PLAN }, true)
        expect(defence.plans).toEqual([{ cardId: WILD_MOUNTS, powerIndex: MOUNTS_PLAN }])
        defence.setPlan({ cardId: WILD_MOUNTS, powerIndex: MOUNTS_PLAN }, false)
        expect(defence.plans).toEqual([])
    })

    it('Undo clears the declared plans', async () => {
        const defence = await defending()
        defence.setPlan({ cardId: WILD_MOUNTS, powerIndex: MOUNTS_PLAN }, true)
        expect(defence.back()).toBe(true)
        expect(defence.plans).toEqual([])
        expect(defence.back()).toBe(false)
    })

    it('before any tick there is nothing for Undo to take', async () => {
        const defence = await defending()
        expect(defence.usable.map((power) => power.cardId)).toEqual([WILD_MOUNTS])
        expect(defence.hasManualSelection()).toBe(false)
    })

    it('a plan the defender cannot use is never declared', async () => {
        const defence = await defending()
        defence.setPlan({ cardId: 'denizen.order.relic-hunter', powerIndex: 0 }, true)
        expect(defence.hasManualSelection()).toBe(false)
    })

    it('Use plans waits for a ringed plan; No plans sends none, whatever is ringed', async () => {
        const session = await battle(
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

    it('the attacker sees no plans of the defender’s to declare', async () => {
        const session = await battle(
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
    const defeated = async () =>
        (await battle(
            MachineState.CampaignDefeat,
            {
                attackerVictorious: true,
                targets: [...SITES],
                defendingForce: FORCE.map((group) => ({ ...group, at: { ...group.at } })),
                pendingDefeatKills: { chooserPlayerId: FOE }
            },
            FOE
        )).defeat

    it('a count on one group keeps the counts on the others', async () => {
        const defeat = await defeated()
        defeat.setPicked(0, 1)
        defeat.setPicked(1, 1)
        expect(defeat.picked).toEqual([1, 1])
    })

    it('Undo clears every count at once', async () => {
        const defeat = await defeated()
        defeat.setPicked(0, 2)
        expect(defeat.back()).toBe(true)
        expect(defeat.picked).toEqual([0, 0])
        expect(defeat.back()).toBe(false)
    })

    it('before any count there is nothing for Undo to take', async () => {
        const defeat = await defeated()
        expect(defeat.required).toBeGreaterThan(0)
        expect(defeat.hasManualSelection()).toBe(false)
    })

    it('a count is held to its group', async () => {
        const defeat = await defeated()
        defeat.setPicked(1, 9)
        expect(defeat.picked).toEqual([0, 2])
        defeat.setPicked(5, 1)
        expect(defeat.picked).toEqual([0, 2])
    })

    it('Kill waits for the count; the engine is asked only once the count is right', async () => {
        const defeat = await defeated()
        const required = defeat.required
        expect(defeat.complete).toBe(false)
        expect(defeat.refusedBecause).toBeUndefined()
        defeat.setPicked(0, Math.min(required, 3))
        defeat.setPicked(1, required - Math.min(required, 3))
        expect(defeat.pickedTotal).toBe(required)
        expect(defeat.complete).toBe(true)
        expect(defeat.refusedBecause).toBeUndefined()
    })

    it('recounting a group replaces its count only', async () => {
        const defeat = await defeated()
        defeat.setPicked(0, 2)
        defeat.setPicked(0, 1)
        defeat.setPicked(1, 1)
        expect(defeat.picked).toEqual([1, 1])
    })

    it('no group gives more than the count owed leaves it; lowering one opens the other again', async () => {
        const defeat = await defeated()
        expect(defeat.required).toBe(2)
        expect([defeat.ceilingAt(0), defeat.ceilingAt(1)]).toEqual([2, 2])
        defeat.setPicked(0, 2)
        expect([defeat.ceilingAt(0), defeat.ceilingAt(1)]).toEqual([2, 0])
        defeat.setPicked(1, 1)
        expect(defeat.picked).toEqual([2, 0])
        defeat.setPicked(0, 1)
        expect([defeat.ceilingAt(0), defeat.ceilingAt(1)]).toEqual([2, 1])
        defeat.setPicked(1, 1)
        expect(defeat.picked).toEqual([1, 1])
    })
})

/**
 * Warning Signals: "Move any warbands to and from your board and any sites you rule (except the
 * last warband from a site)" — Messenger's text, so Messenger's moves, one at a time.
 */
describe('Warning Signals’ moves in the defence draft', () => {
    const WARNING = 'denizen.nomad.warning-signals'
    const WARNING_PLAN = {
        cardId: WARNING,
        powerIndex: required(
            cardPowers(WARNING).find((power) => power.timing === PowerTiming.BattlePlan),
            'Warning Signals’ battle plan'
        ).powerIndex
    }
    const GIANT = 'denizen.nomad.mountain-giant'
    const GIANT_PLAN = {
        cardId: GIANT,
        powerIndex: required(
            cardPowers(GIANT).find((power) => power.timing === PowerTiming.BattlePlan),
            'Mountain Giant’s battle plan'
        ).powerIndex
    }
    const onBoard = { at: { kind: 'board' as const, playerId: FOE }, owner: FOE }
    const at = (siteId: string) => ({ at: { kind: 'site' as const, siteId }, owner: FOE })

    /**
     * FOE defends with 2 on their board, 3 at c1 and 2 at c2, and Warning Signals as an adviser
     * (with Mountain Giant beside it, and the secret it costs, when asked).
     */
    async function warned(
        board: Record<string, number> = { [FOE]: 2 },
        sites: Record<string, Record<string, number>> = { c1: { [FOE]: 3 }, c2: { [FOE]: 2 } },
        giant = false
    ) {
        const state = testState(
            [
                testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', warbandsOnBoard: { [ME]: 4 } }),
                testPlayer({
                    playerId: FOE,
                    color: Color.Blue,
                    siteId: 'c1',
                    warbandsOnBoard: board,
                    secrets: giant ? 1 : 0,
                    advisers: [
                        { cardId: WARNING, faceUp: true },
                        ...(giant ? [{ cardId: GIANT, faceUp: true }] : [])
                    ]
                })
            ],
            {
                machineState: MachineState.CampaignPlans,
                activePlayerIds: [FOE],
                warbandsBySite: sites,
                campaign: {
                    attackerPlayerId: ME,
                    defenderPlayerId: FOE,
                    nonImperialPlayerIds: [],
                    allyPlayerIds: [],
                    targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
                    attackPool: 0,
                    defensePool: 0,
                    attackRoll: [],
                    defenseRoll: [],
                    defense: 0,
                    swords: 0,
                    defendingForce: [],
                    defendingBandits: 0,
                    pendingDefenderPlans: { queue: [FOE] },
                    ...campaignRecords()
                }
            }
        )
        const session = await openSessionOn(tableOf(state))
        session.defence.setPlan(WARNING_PLAN, true)
        return session
    }

    it('the first From opens empty; each next move is offered on the state the moves before it leave', async () => {
        const defence = (await warned()).defence
        const first = required(defence.movesOf(WARNING_PLAN)?.open, 'a From opens')
        expect(first.from).toBeUndefined()
        expect(first.sources).toEqual([
            { ...onBoard, count: 2 },
            { ...at('c1'), count: 2 },
            { ...at('c2'), count: 1 }
        ])
        expect(defence.plansComplete).toBe(false)

        defence.setMoves(WARNING_PLAN, [{ from: at('c1'), count: 2, to: { kind: 'board' } }])
        const moves = required(defence.movesOf(WARNING_PLAN), 'Warning Signals’ moves')
        expect(moves.whole).toHaveLength(1)
        expect(moves.open?.from).toBeUndefined()
        expect(moves.open?.sources).toEqual([
            { ...onBoard, count: 4 },
            { ...at('c2'), count: 1 }
        ])
        expect(defence.plansComplete).toBe(true)
    })

    it('board warbands go to two sites in one use; the send is the flat list, a site only where they go to one', async () => {
        const session = await warned()
        const sent = vi.spyOn(session, 'defendCampaign').mockResolvedValue()
        const defence = session.defence
        defence.setMoves(WARNING_PLAN, [
            { from: onBoard, count: 1, to: { kind: 'site', siteId: 'c1' } },
            { from: onBoard, count: 1, to: { kind: 'site', siteId: 'c2' } },
            { from: at('c1'), count: 2, to: { kind: 'board' } }
        ])
        expect(defence.movesOf(WARNING_PLAN)?.whole).toHaveLength(3)
        expect(defence.usePlansRefusedBecause).toBeUndefined()
        await defence.answer(true)
        expect(sent).toHaveBeenLastCalledWith([
            {
                ...WARNING_PLAN,
                choices: [
                    { kind: PowerChoiceKind.Warbands, group: { ...onBoard, count: 1 } },
                    { kind: PowerChoiceKind.Site, siteId: 'c1' },
                    { kind: PowerChoiceKind.Warbands, group: { ...onBoard, count: 1 } },
                    { kind: PowerChoiceKind.Site, siteId: 'c2' },
                    { kind: PowerChoiceKind.Warbands, group: { ...at('c1'), count: 2 } }
                ]
            }
        ])
    })

    it('Undo takes back one pick, then the move before, then the plan', async () => {
        const defence = (await warned()).defence
        // Each part is its own tap, as the panel sends it.
        const tap = (pick: (picks: MovePick[]) => MovePick[]) =>
            defence.setMoves(WARNING_PLAN, pick(defence.planPicksOf(WARNING_PLAN).moves))
        const shown = () => defence.movesOf(WARNING_PLAN)?.open?.count
        tap((picks) => withFrom(picks, 0, at('c1')))
        tap((picks) => withCount(picks, 0, shown(), 2))
        tap((picks) => withTo(picks, 0, { kind: 'board' }))
        tap((picks) => withFrom(picks, 1, onBoard))
        tap((picks) => withCount(picks, 1, shown(), 3))
        expect(defence.planPicksOf(WARNING_PLAN).moves).toEqual([
            { from: at('c1'), count: 2, to: { kind: 'board' } },
            { from: onBoard, count: 3 }
        ])
        expect(defence.movesOf(WARNING_PLAN)?.open?.count).toBe(3)
        expect(defence.back()).toBe(true)
        expect(defence.movesOf(WARNING_PLAN)?.open?.count).toBeUndefined()
        expect(defence.movesOf(WARNING_PLAN)?.open?.from).toEqual(onBoard)
        expect(defence.back()).toBe(true)
        expect(defence.movesOf(WARNING_PLAN)?.open?.from).toBeUndefined()
        expect(defence.movesOf(WARNING_PLAN)?.whole).toHaveLength(1)
        expect(defence.back()).toBe(true)
        expect(defence.movesOf(WARNING_PLAN)?.whole).toHaveLength(0)
        expect(defence.movesOf(WARNING_PLAN)?.open?.count).toBe(2)
        expect(defence.back()).toBe(true)
        expect(defence.back()).toBe(true)
        expect(defence.movesOf(WARNING_PLAN)?.open?.from).toBeUndefined()
        expect(defence.isDeclared(WARNING_PLAN)).toBe(true)
        expect(defence.back()).toBe(true)
        expect(defence.isDeclared(WARNING_PLAN)).toBe(false)
    })

    it('Undo takes back the last tap, across plans: a count changed after another plan’s pick comes back as it was', async () => {
        const defence = (await warned(undefined, undefined, true)).defence
        const moves = () => defence.planPicksOf(WARNING_PLAN).moves
        const count = (n: number) =>
            defence.setMoves(
                WARNING_PLAN,
                withCount(moves(), 0, defence.movesOf(WARNING_PLAN)?.open?.count, n)
            )
        const threes = { ...emptyPicks(), option: { 0: 0 } }

        defence.setMoves(WARNING_PLAN, withFrom(moves(), 0, at('c1')))
        count(1)
        defence.setPlan(GIANT_PLAN, true)
        defence.setPlanPicks(GIANT_PLAN, threes)
        count(2)
        expect(moves()).toEqual([{ from: at('c1'), count: 2 }])

        expect(defence.back()).toBe(true)
        expect(moves()).toEqual([{ from: at('c1'), count: 1 }])
        expect(defence.planPicksOf(GIANT_PLAN)).toEqual(threes)
        expect(defence.back()).toBe(true)
        expect(moves()).toEqual([{ from: at('c1'), count: 1 }])
        expect(defence.planPicksOf(GIANT_PLAN)).toEqual(emptyPicks())
        expect(defence.isDeclared(GIANT_PLAN)).toBe(true)
        expect(defence.back()).toBe(true)
        expect(defence.isDeclared(GIANT_PLAN)).toBe(false)
        expect(moves()).toEqual([{ from: at('c1'), count: 1 }])
        expect(defence.back()).toBe(true)
        expect(moves()).toEqual([{ from: at('c1') }])
        expect(defence.back()).toBe(true)
        expect(moves()).toEqual([])
        expect(defence.isDeclared(WARNING_PLAN)).toBe(true)
        // The moves Undo cleared stay cleared.
        expect(defence.back()).toBe(true)
        expect(moves()).toEqual([])
        expect(defence.isDeclared(WARNING_PLAN)).toBe(false)
        expect(defence.hasManualSelection()).toBe(false)
        expect(defence.back()).toBe(false)
    })

    it('a lone From starts made; after the 16th whole move no From opens', async () => {
        const defence = (await warned({ [FOE]: 16 }, { c1: { [FOE]: 1 } })).defence
        expect(defence.movesOf(WARNING_PLAN)?.open?.from).toEqual(onBoard)
        defence.setMoves(WARNING_PLAN, Array.from({ length: 16 }, () => ({ from: onBoard, count: 1 })))
        const moves = required(defence.movesOf(WARNING_PLAN), 'Warning Signals’ moves')
        expect(moves.whole).toHaveLength(16)
        expect(moves.whole.every((move) => move.to.kind === 'site' && move.to.siteId === 'c1')).toBe(true)
        expect(moves.open).toBeUndefined()
        expect(defence.plansComplete).toBe(true)
        expect(defence.usePlansRefusedBecause).toBeUndefined()
    })
})
