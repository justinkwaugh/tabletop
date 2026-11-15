import { afterEach, describe, expect, it } from 'vitest'
import { ActionSource, Color, createAction, type GameAction } from '@tabletop/common'
import {
    AnswerQuestion,
    Campaign,
    CampaignSacrifice,
    CampaignTargetKind,
    CURRENT_OATH_REVISION,
    HydratedOathGameState,
    MachineState,
    OathVisibility,
    PlayerStatus,
    PowerQuestionKind,
    Region,
    allMapSlots,
    mapSlotsFor
} from '@tabletop/oath'
import {
    CRADLE,
    HINTERLAND,
    PROVINCES,
    openTurn,
    required,
    served,
    testPlayer,
    testState
} from '@tabletop/oath/testing'
import {
    disposeSessions,
    openSessionOn,
    played,
    tableOf,
    type PlayedTable
} from '$lib/testing/sessionHarness.js'
import { battleLine, currentCampaignSteps, resultWords } from './battleResult.js'
import { campaignLedger } from './campaignLedger.js'
import { seatsById } from './names.js'

afterEach(() => {
    disposeSessions()
})

const JINX = 'denizen.arcane.jinx'
const [VALLEY] = mapSlotsFor(Region.Cradle)
const [PLAINS] = mapSlotsFor(Region.Provinces)
const FIXTURE_SITES: Record<Region, string[]> = {
    [Region.Cradle]: CRADLE,
    [Region.Provinces]: PROVINCES,
    [Region.Hinterland]: HINTERLAND
}
const SITE_CARDS = Object.fromEntries(
    Object.values(Region).flatMap((region) =>
        mapSlotsFor(region).map((slotId, index) => [slotId, FIXTURE_SITES[region][index]])
    )
)
const DANA = { kind: 'player', playerId: 'Dana' } as const
const envelope = { gameId: 'g1', source: ActionSource.User }

/**
 * Jinx — Dana (a red Exile at the Fertile Valley, 5 warbands on their board, Jinx as an adviser) campaigns
 * against Rhys (a yellow Exile with 2 warbands at the Fertile Valley and 3 on their board) for the
 * Fertile Valley and
 * Rhys's pawn and favor. Only the attacker holds Jinx, so both rolls are made and Dana is asked before
 * the skulls kill. Played through the engine from seed 6.
 */
function declared(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: VALLEY,
                supply: 6,
                favor: 4,
                secrets: 2,
                advisers: [{ cardId: JINX, faceUp: true }],
                warbandsOnBoard: { Dana: 5 },
                warbandsInPersonalBank: { Dana: 9 }
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: VALLEY,
                favor: 4,
                secrets: 2,
                warbandsOnBoard: { Rhys: 3 },
                warbandsInPersonalBank: { Rhys: 9 }
            }),
            testPlayer({
                playerId: 'Ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: PLAINS
            })
        ],
        {
            machineState: MachineState.ActPhase,
            oathRevision: CURRENT_OATH_REVISION,
            chancellorPlayerId: 'Ann',
            map: allMapSlots(),
            siteCards: { ...SITE_CARDS, [VALLEY]: 'site.fertile-valley' },
            denizensBySite: { [VALLEY]: [] },
            warbandsBySite: { [VALLEY]: { Rhys: 2 } },
            prng: { seed: 6, invocations: 0 }
        }
    )
    openTurn(state, 'Dana')
    state.activePlayerIds = ['Dana']
    return played(tableOf(state), [
        createAction(Campaign, {
            ...envelope,
            playerId: 'Dana',
            defender: { kind: 'player', playerId: 'Rhys' },
            targets: [
                { kind: CampaignTargetKind.Site, siteId: VALLEY },
                { kind: CampaignTargetKind.PawnAndFavor }
            ],
            attackDice: 4
        })
    ])
}

function answered(reroll: boolean): PlayedTable {
    return played(declared(), [
        createAction(AnswerQuestion, {
            ...envelope,
            playerId: 'Dana',
            answer: { kind: PowerQuestionKind.RerollDice, reroll }
        })
    ])
}

const danaBoard = (table: PlayedTable) => table.state.players[0].warbandsOnBoard.Dana ?? 0

/** R-5.5.6 — Dana sacrifices none and so loses the battle, killing half their force on their board. */
function closed(table: PlayedTable): PlayedTable {
    return played(table, [
        createAction(CampaignSacrifice, {
            ...envelope,
            playerId: 'Dana',
            sacrifice: 0,
            defeatKills: [
                {
                    at: { kind: 'board' as const, playerId: 'Dana' },
                    owner: 'Dana',
                    count: Math.floor(danaBoard(table) / 2)
                }
            ]
        })
    ])
}

/** The table as Dana's seat is served it: the state and every recorded step. */
function servedToDana(table: PlayedTable): PlayedTable {
    return {
        state: served(table.state, DANA),
        actions: table.actions.map(
            (action) => OathVisibility.actions.project(action, DANA) as GameAction
        )
    }
}

function lineOn(table: PlayedTable): string {
    const view = new HydratedOathGameState(table.state)
    const campaign = required(view.campaign, 'the battle')
    return resultWords(battleLine(view, campaign, currentCampaignSteps(table.actions)))
}

async function attackerLost(table: PlayedTable): Promise<string | undefined> {
    const names = (await openSessionOn(table)).historyNames
    return campaignLedger(table.actions, seatsById(names)).sides[0]?.lost
}

describe('R-5.5.5 — Jinx: the warbands the skulls kill once the attacker answers, on Dana’s view', () => {
    it('Dana keeps the roll: the battle line counts the 1 warband its skull killed', () => {
        const kept = answered(false)
        expect(danaBoard(kept)).toBe(4)
        expect(lineOn(servedToDana(kept))).toMatch(/^1 \[skull\] rolled: 1 \[warband\] died\. /)
    })

    it('Dana rerolls: the battle line counts the 2 warbands the rerolled skulls killed', () => {
        const rerolled = answered(true)
        expect(danaBoard(rerolled)).toBe(3)
        expect(lineOn(servedToDana(rerolled))).toMatch(/^2 \[skull\] rolled: 2 \[warband\] died\. /)
    })

    it('Dana keeps the roll and loses: the ledger counts the skull’s warband with the defeat’s 2', async () => {
        const kept = closed(answered(false))
        expect(danaBoard(kept)).toBe(2)
        expect(await attackerLost(servedToDana(kept))).toBe(
            "3 warbands: 1 to skulls, 2 killed on Dana's board"
        )
    })

    it('Dana rerolls and loses: the ledger counts the rerolled skulls’ 2 warbands with the defeat’s 1', async () => {
        const rerolled = closed(answered(true))
        expect(danaBoard(rerolled)).toBe(2)
        expect(await attackerLost(servedToDana(rerolled))).toBe(
            "3 warbands: 2 to skulls, 1 killed on Dana's board"
        )
    })
})
