import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import {
    ActionType,
    CURRENT_OATH_REVISION,
    CampaignTargetKind,
    IMPERIAL_WARBANDS,
    MachineState,
    OathRevision,
    PlayerStatus,
    type CampaignTarget,
    type WarbandCounts
} from '@tabletop/oath'
import {
    campaignRecords,
    openTurn,
    served,
    testPlayer,
    testState,
    testVaultWithRelics
} from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { describeAction, type HistoryNames } from './actionDescription.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

// Relic Hunter: "You may put any relics you take on the bottom of the relic deck."
const HUNTER = 'denizen.order.relic-hunter'
const DRUM = 'relic.dragonskin-drum'
const CUP = 'relic.cup-of-plenty'
const CAGE = 'relic.obsidian-cage'
const SLOT = 'p1-r1'
const SITE_RELIC: CampaignTarget = { kind: CampaignTargetKind.SiteRelic, slotId: SLOT }
const THE_DRUM: CampaignTarget = { kind: CampaignTargetKind.Relic, cardId: DRUM }
const SITES: CampaignTarget[] = [
    { kind: CampaignTargetKind.Site, siteId: 'c1' },
    { kind: CampaignTargetKind.Site, siteId: 'p1' }
]

/** Dana won against Bea, both at c1; Bea held the Drum, and a Cup lay facedown at p1. */
function wonState(targets: CampaignTarget[], plans: string[] = [HUNTER]) {
    const state = testState(
        [
            testPlayer({ playerId: 'Dana', color: Color.Red, siteId: 'c1', warbandsOnBoard: {}, advisers: [{ cardId: HUNTER, faceUp: true }], peekedRelics: { [SLOT]: CUP } }),
            testPlayer({ playerId: 'Bea', color: Color.Blue, siteId: 'c1', relicIds: [DRUM] }),
            testPlayer({ playerId: 'Ann', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1' })
        ],
        {
            oathRevision: CURRENT_OATH_REVISION,
            chancellorPlayerId: 'Ann',
            machineState: MachineState.CampaignVictory,
            relicsBySite: { p1: [{ slotId: SLOT }] },
            vault: testVaultWithRelics({ [SLOT]: CUP }),
            campaign: {
                attackerPlayerId: 'Dana',
                defenderPlayerId: 'Bea',
                nonImperialPlayerIds: [],
                allyPlayerIds: [],
                targets,
                attackPool: 3,
                defensePool: 2,
                attackRoll: [],
                defenseRoll: [],
                defense: 0,
                swords: 3,
                defendingForce: [],
                defendingBandits: 0,
                ...campaignRecords(),
                plansUsedBy: plans.length > 0 ? { Dana: plans } : {},
                attackerVictorious: true
            }
        }
    )
    openTurn(state, 'Dana')
    state.activePlayerIds = ['Dana']
    return state
}
const won = async (targets: CampaignTarget[], plans?: string[]) => await openSessionOn(tableOf(wonState(targets, plans)))

describe('the spoils draft: Relic Hunter gives every relic taken the same row', () => {
    it("the defender's relic gets a row after the site's, by its card; a tap on each, then both are sent", async () => {
        const session = await won([...SITES, SITE_RELIC, THE_DRUM])
        const sent = vi.spyOn(session, 'resolveCampaignVictory').mockResolvedValue()
        const spoils = session.victory
        expect(spoils.steps).toEqual(['relics'])
        expect(spoils.relicRows).toEqual([
            { kind: 'site', key: SLOT, slotId: SLOT },
            { kind: 'held', key: DRUM, cardId: DRUM }
        ])
        expect(spoils.relicChoice(DRUM)).toBeUndefined()
        expect(spoils.sendShown).toBe(false)
        spoils.setRelic(SLOT, false)
        expect(spoils.sendShown).toBe(false)
        spoils.setRelic(DRUM, true)
        expect(spoils.relicChoice(DRUM)).toBe('bottom')
        expect(spoils.sendShown).toBe(true)
        expect(spoils.blockedBecause).toBeUndefined()
        await spoils.takeSpoils(false)
        expect(sent).toHaveBeenCalledWith([], false, { bottomRelicSlotIds: [], bottomRelicIds: [DRUM] }, undefined, false)
    })

    it('a relic taken from the defender alone opens the step, which was skipped without a facedown relic', async () => {
        const session = await won([SITES[0], THE_DRUM, { kind: CampaignTargetKind.PawnAndFavor }])
        const sent = vi.spyOn(session, 'resolveCampaignVictory').mockResolvedValue()
        const spoils = session.victory
        expect(spoils.steps).toEqual(['relics', 'pawn', 'favor'])
        expect(spoils.step).toBe('relics')
        spoils.setRelic(DRUM, true)
        expect(spoils.step).toBe('pawn')
        // Undo takes the Drum's pick back, and the step with it.
        expect(spoils.back()).toBe(true)
        expect(spoils.step).toBe('relics')
        expect(spoils.relicChoice(DRUM)).toBe('bottom')
        expect(spoils.back()).toBe(true)
        expect(spoils.relicChoice(DRUM)).toBeUndefined()
        spoils.setRelic(DRUM, false)
        spoils.leavePawn()
        await spoils.takeSpoils(false)
        expect(sent).toHaveBeenCalledWith([], false, { bottomRelicSlotIds: [], bottomRelicIds: [] }, undefined, false)
    })

    it('without Relic Hunter as the plan, nothing changes: the relic is simply taken, with no step', async () => {
        const spoils = (await won([SITES[0], THE_DRUM], [])).victory
        expect(spoils.relicRows).toEqual([])
        expect(spoils.steps).toEqual([])
        expect(spoils.sendShown).toBe(true)
        spoils.setRelic(DRUM, true)
        expect(spoils.relicChoice(DRUM)).toBeUndefined()
    })

    it("on the attacker's own served view, the rows and the check need nothing hidden: not the relic deck's order", async () => {
        const state = wonState([...SITES, SITE_RELIC, THE_DRUM])
        const view = served(state, { kind: 'player', playerId: 'Dana' })
        expect(view.vault).toBeUndefined()
        const spoils = (await openSessionOn({ state: view, actions: [] })).victory
        expect(spoils.relicRows.map((row) => row.key)).toEqual([SLOT, DRUM])
        spoils.setRelic(SLOT, true)
        spoils.setRelic(DRUM, true)
        expect(spoils.bottoms).toEqual({ bottomRelicSlotIds: [SLOT], bottomRelicIds: [DRUM] })
        expect(spoils.blockedBecause).toBeUndefined()
    })
})

const THE_CAGE: CampaignTarget = { kind: CampaignTargetKind.Relic, cardId: CAGE }

/**
 * Dana won against Bea at c1 with Relic Hunter, taking c1, the facedown Cup at p1 and
 * Bea's Obsidian Cage, which holds what `caged` says. Ann is the Chancellor; the Citizens given
 * (Rhys, then Cass) are the other Imperial boards.
 */
function cageState({ caged = { [IMPERIAL_WARBANDS]: 2 }, citizens = ['Rhys'], revision = CURRENT_OATH_REVISION, pawn = false }: { caged?: WarbandCounts; citizens?: string[]; revision?: OathRevision; pawn?: boolean } = {}) {
    const state = testState(
        [
            testPlayer({ playerId: 'Dana', color: Color.Red, siteId: 'c1', warbandsOnBoard: {}, advisers: [{ cardId: HUNTER, faceUp: true }], peekedRelics: { [SLOT]: CUP } }),
            testPlayer({ playerId: 'Bea', color: Color.Yellow, siteId: 'c1', relicIds: [CAGE] }),
            testPlayer({ playerId: 'Ann', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 } }),
            ...citizens.map((playerId, index) => testPlayer({ playerId, color: [Color.Blue, Color.Brown][index] ?? Color.Blue, status: PlayerStatus.Citizen, siteId: 'h1', warbandsOnBoard: { [IMPERIAL_WARBANDS]: 1 } }))
        ],
        {
            oathRevision: revision,
            chancellorPlayerId: 'Ann',
            machineState: MachineState.CampaignVictory,
            relicsBySite: { p1: [{ slotId: SLOT }] },
            vault: testVaultWithRelics({ [SLOT]: CUP }),
            warbandsOnCards: { [CAGE]: caged },
            campaign: {
                attackerPlayerId: 'Dana',
                defenderPlayerId: 'Bea',
                nonImperialPlayerIds: [],
                allyPlayerIds: [],
                targets: [SITES[0], SITES[1], SITE_RELIC, THE_CAGE, ...(pawn ? [{ kind: CampaignTargetKind.PawnAndFavor } as const] : [])],
                attackPool: 3,
                defensePool: 4,
                attackRoll: [],
                defenseRoll: [],
                defense: 2,
                swords: 3,
                defendingForce: [],
                defendingBandits: 0,
                ...campaignRecords(),
                plansUsedBy: { Dana: [HUNTER] },
                attackerVictorious: true
            }
        }
    )
    openTurn(state, 'Dana')
    state.activePlayerIds = ['Dana']
    return state
}
const wonCage = async (options?: Parameters<typeof cageState>[0]) => await openSessionOn(tableOf(cageState(options)))

describe("Relic Hunter sends Bea's Obsidian Cage down: its purple warbands get a step of their own (R-10.13-H1)", () => {
    it('the step follows "Relics taken" only once the Cage is sent down; "Next" in place of "Take spoils" until it is done', async () => {
        const spoils = (await wonCage()).victory
        expect(spoils.steps).toEqual(['relics'])
        spoils.setRelic(SLOT, false)
        spoils.setRelic(CAGE, true)
        expect(spoils.steps).toEqual(['relics', 'cage'])
        expect(spoils.cageBoards).toEqual(['Ann', 'Rhys'])
        expect(spoils.cageWarbands).toBe(2)
        expect(spoils.step).toBe('relics')
        expect(spoils.nextShown).toBe(true)
        expect(spoils.sendShown).toBe(false)
        // "Keep it" drops the step: the Cage goes to Dana with its warbands.
        spoils.setRelic(CAGE, false)
        expect(spoils.steps).toEqual(['relics'])
        expect(spoils.cageBoards).toEqual([])
        expect(spoils.nextShown).toBe(false)
        expect(spoils.sendShown).toBe(true)
        expect(spoils.bottoms).toEqual({ bottomRelicSlotIds: [], bottomRelicIds: [] })
    })

    it("no step for another colour, a Citizen's old colour, one Imperial board, or a game before revision 17", async () => {
        const cases: Parameters<typeof cageState>[0][] = [
            { caged: { Dana: 2 } },
            { caged: { Rhys: 2 } },
            { citizens: [] },
            { revision: OathRevision.EngineFixes12 }
        ]
        for (const options of cases) {
            const session = await wonCage(options)
            const sent = vi.spyOn(session, 'resolveCampaignVictory').mockResolvedValue()
            const spoils = session.victory
            spoils.setRelic(SLOT, false)
            spoils.setRelic(CAGE, true)
            expect(spoils.steps, JSON.stringify(options)).toEqual(['relics'])
            expect(spoils.sendShown).toBe(true)
            expect(spoils.blockedBecause, JSON.stringify(options)).toBeUndefined()
            await spoils.takeSpoils(false)
            expect(sent).toHaveBeenCalledWith([], false, { bottomRelicSlotIds: [], bottomRelicIds: [CAGE] }, undefined, false)
            disposeSessions()
        }
    })

    it('a tap on one row fills the other so the rows total 2; "Take spoils" waits for them, then sends the placement', async () => {
        const session = await wonCage()
        const sent = vi.spyOn(session, 'resolveCampaignVictory').mockResolvedValue()
        const spoils = session.victory
        spoils.setRelic(SLOT, false)
        spoils.setRelic(CAGE, true)
        spoils.next()
        expect(spoils.step).toBe('cage')
        expect(spoils.stepNumber).toBe(2)
        expect(spoils.cageCounts).toEqual([0, 0])
        expect(spoils.sendShown).toBe(false)
        await spoils.takeSpoils(false)
        expect(sent).not.toHaveBeenCalled()
        spoils.setCageCount(0, 1)
        expect(spoils.cageCounts).toEqual([1, 1])
        expect(spoils.sendShown).toBe(true)
        spoils.setCageCount(1, 2)
        expect(spoils.cageCounts).toEqual([0, 2])
        spoils.setCageCount(0, 1)
        expect(spoils.blockedBecause).toBeUndefined()
        await spoils.takeSpoils(false)
        expect(sent).toHaveBeenCalledWith([], false, { bottomRelicSlotIds: [], bottomRelicIds: [CAGE], cagePlacement: [{ playerId: 'Ann', count: 1 }, { playerId: 'Rhys', count: 1 }] }, undefined, false)
    })

    it('with three Imperial boards no row fills another: a row takes what the others leave, and "Take spoils" waits for all', async () => {
        const spoils = (await wonCage({ citizens: ['Rhys', 'Cass'] })).victory
        spoils.setRelic(SLOT, true)
        spoils.setRelic(CAGE, true)
        spoils.next()
        expect(spoils.cageBoards).toEqual(['Ann', 'Rhys', 'Cass'])
        spoils.setCageCount(0, 1)
        expect(spoils.cageCounts).toEqual([1, 0, 0])
        expect(spoils.cageCeilingAt(2)).toBe(1)
        expect(spoils.sendShown).toBe(false)
        spoils.setCageCount(2, 2)
        expect(spoils.cageCounts).toEqual([1, 0, 1])
        expect(spoils.sendShown).toBe(true)
        expect(spoils.bottoms).toEqual({ bottomRelicSlotIds: [SLOT], bottomRelicIds: [CAGE], cagePlacement: [{ playerId: 'Ann', count: 1 }, { playerId: 'Cass', count: 1 }] })
    })

    it('before the pawn: the step adds one to the count, and its "Next" waits for the warbands', async () => {
        const spoils = (await wonCage({ pawn: true })).victory
        expect(spoils.steps).toEqual(['relics', 'pawn', 'favor'])
        spoils.setRelic(SLOT, false)
        spoils.setRelic(CAGE, true)
        expect(spoils.steps).toEqual(['relics', 'cage', 'pawn', 'favor'])
        spoils.next()
        expect(spoils.nextShown).toBe(false)
        spoils.setCageCount(1, 1)
        expect(spoils.nextShown).toBe(true)
        expect(spoils.sendShown).toBe(false)
        spoils.next()
        expect(spoils.step).toBe('pawn')
        expect(spoils.stepNumber).toBe(3)
    })

    it('Undo walks back through the step; "Keep it" then drops its picks, and "Bottom" opens it empty again', async () => {
        const spoils = (await wonCage()).victory
        spoils.setRelic(SLOT, false)
        spoils.setRelic(CAGE, true)
        spoils.next()
        spoils.setCageCount(0, 2)
        expect(spoils.back()).toBe(true)
        expect(spoils.step).toBe('cage')
        expect(spoils.cageCounts).toEqual([0, 0])
        expect(spoils.back()).toBe(true)
        expect(spoils.step).toBe('relics')
        expect(spoils.relicChoice(CAGE)).toBe('bottom')
        spoils.next()
        spoils.setCageCount(0, 2)
        expect(spoils.back()).toBe(true)
        expect(spoils.back()).toBe(true)
        spoils.setRelic(CAGE, false)
        expect(spoils.steps).toEqual(['relics'])
        expect(spoils.cageCounts).toEqual([])
        spoils.setRelic(CAGE, true)
        spoils.next()
        expect(spoils.cageCounts).toEqual([0, 0])
    })

    it("on the attacker's own served view: the step's boards and its check need nothing hidden", async () => {
        const view = served(cageState(), { kind: 'player', playerId: 'Dana' })
        expect(view.vault).toBeUndefined()
        const spoils = (await openSessionOn({ state: view, actions: [] })).victory
        spoils.setRelic(SLOT, true)
        spoils.setRelic(CAGE, true)
        expect(spoils.steps).toEqual(['relics', 'cage'])
        spoils.next()
        expect(spoils.cageBoards).toEqual(['Ann', 'Rhys'])
        expect(spoils.sendShown).toBe(false)
        spoils.setCageCount(0, 1)
        expect(spoils.sendShown).toBe(true)
        expect(spoils.blockedBecause).toBeUndefined()
    })
})

describe("the History says where a relic sent down came from and where it went", () => {
    const names: HistoryNames = {
        player: (playerId) => playerId,
        site: (slotId) => slotId,
        seats: ['Dana', 'Bea', 'Ann', 'Rhys']
    }
    function victory(fields: Record<string, unknown>, metadata: Record<string, unknown>): GameAction {
        const record: Record<string, unknown> = {
            placements: [],
            burnFavor: false,
            ...fields,
            metadata: { warbandsPlaced: 0, relicsTaken: [], bannersSeized: [], seizeBurned: 0, favorBurned: 0, defenderPlayerId: 'Bea', ...metadata }
        }
        return { id: 'a1', gameId: 'g1', source: ActionSource.User, type: ActionType.CampaignResolveVictory, playerId: 'Dana', ...record }
    }

    it("the defender's relic by name and whose it was, to every seat", () => {
        const record = victory({ bottomRelicIds: [DRUM] }, { relicsToDeckBottom: [DRUM] })
        for (const viewer of ['Dana', 'Bea', undefined]) {
            expect(describeAction(record, names, viewer)).toBe('took the spoils: put Dragonskin Drum from Bea on the bottom of the relic deck (Relic Hunter)')
        }
    })

    it("a facedown relic by name to the attacker, as a facedown relic to the rest; a kept one as ever", () => {
        const mine = victory({ bottomRelicIds: [DRUM], bottomRelicSlotIds: [SLOT] }, { relicsToDeckBottom: [DRUM, CUP] })
        expect(describeAction(mine, names, 'Dana')).toBe('took the spoils: put Dragonskin Drum from Bea on the bottom of the relic deck (Relic Hunter); put Cup of Plenty on the bottom of the relic deck (Relic Hunter)')
        // Another seat's record carries no protected metadata.
        const theirs = victory({ bottomRelicIds: [DRUM], bottomRelicSlotIds: [SLOT] }, {})
        expect(describeAction(theirs, names, 'Bea')).toBe('took the spoils: put Dragonskin Drum from Bea on the bottom of the relic deck (Relic Hunter); put a facedown relic on the bottom of the relic deck (Relic Hunter)')
        const kept = victory({ bottomRelicSlotIds: [SLOT] }, { relicsTaken: [DRUM] })
        expect(describeAction(kept, names, 'Bea')).toBe('took the spoils: took Dragonskin Drum; put a facedown relic on the bottom of the relic deck (Relic Hunter)')
    })

    it("the Obsidian Cage sent down: (Relic Hunter), then the boards its warbands went back to, right after it", () => {
        const wentBack = "its warbands went back: 1 to Ann's board, 1 to Rhys's board"
        const record = victory({ bottomRelicIds: [CAGE], cagePlacement: [{ playerId: 'Ann', count: 1 }, { playerId: 'Rhys', count: 1 }] }, { relicsToDeckBottom: [CAGE], cageWentBack: wentBack })
        expect(describeAction(record, names, 'Bea')).toBe("took the spoils: put Obsidian Cage from Bea on the bottom of the relic deck (Relic Hunter); its warbands went back: 1 to Ann's board, 1 to Rhys's board")
        expect(describeAction(record, names, 'Ann')).toBe("took the spoils: put Obsidian Cage from Bea on the bottom of the relic deck (Relic Hunter); its warbands went back: 1 to your board, 1 to Rhys's board")
        // With another relic sent down from Bea, the Cage has a clause of its own, so "its" is the Cage's.
        const both = victory({ bottomRelicIds: [DRUM, CAGE], bottomRelicSlotIds: [SLOT] }, { relicsToDeckBottom: [DRUM, CAGE, CUP], cageWentBack: "its warbands went back: 2 to Ann's board" })
        expect(describeAction(both, names, 'Dana')).toBe("took the spoils: put Dragonskin Drum from Bea on the bottom of the relic deck (Relic Hunter); put Obsidian Cage from Bea on the bottom of the relic deck (Relic Hunter); its warbands went back: 2 to Ann's board; put Cup of Plenty on the bottom of the relic deck (Relic Hunter)")
    })
})
