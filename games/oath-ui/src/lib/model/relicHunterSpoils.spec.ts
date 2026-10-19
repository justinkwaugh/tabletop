import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import {
    ActionType,
    CURRENT_OATH_REVISION,
    CampaignTargetKind,
    MachineState,
    PlayerStatus,
    type CampaignTarget
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

describe("the History says where a relic sent down came from and where it went", () => {
    const names: HistoryNames = {
        player: (playerId) => playerId,
        site: (slotId) => slotId,
        seats: ['Dana', 'Bea', 'Ann']
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
            expect(describeAction(record, names, viewer)).toBe('took the spoils: put Dragonskin Drum from Bea on the bottom of the relic deck')
        }
    })

    it("a facedown relic by name to the attacker, as a facedown relic to the rest; a kept one as ever", () => {
        const mine = victory({ bottomRelicIds: [DRUM], bottomRelicSlotIds: [SLOT] }, { relicsToDeckBottom: [DRUM, CUP] })
        expect(describeAction(mine, names, 'Dana')).toBe('took the spoils: put Dragonskin Drum from Bea on the bottom of the relic deck; put Cup of Plenty on the bottom of the relic deck')
        // Another seat's record carries no protected metadata.
        const theirs = victory({ bottomRelicIds: [DRUM], bottomRelicSlotIds: [SLOT] }, {})
        expect(describeAction(theirs, names, 'Bea')).toBe('took the spoils: put Dragonskin Drum from Bea on the bottom of the relic deck; put a facedown relic on the bottom of the relic deck')
        const kept = victory({ bottomRelicSlotIds: [SLOT] }, { relicsTaken: [DRUM] })
        expect(describeAction(kept, names, 'Bea')).toBe('took the spoils: took Dragonskin Drum; put a facedown relic on the bottom of the relic deck')
    })

    it("the Obsidian Cage sent down: the boards its warbands went back to", () => {
        const record = victory({ bottomRelicIds: ['relic.obsidian-cage'] }, { relicsToDeckBottom: ['relic.obsidian-cage'], triggered: ["Obsidian Cage: its warbands went back: 2 to Ann's board"] })
        expect(describeAction(record, names, 'Bea')).toBe("took the spoils: put Obsidian Cage from Bea on the bottom of the relic deck; its warbands went back: 2 to Ann's board (Obsidian Cage)")
    })
})
