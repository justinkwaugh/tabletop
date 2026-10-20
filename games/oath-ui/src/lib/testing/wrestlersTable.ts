import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    AnswerConsent,
    Campaign,
    CampaignTargetKind,
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    PlayerStatus,
    Region,
    allMapSlots,
    mapSlotsFor,
    type WarbandCounts
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

export const WRESTLERS = 'denizen.order.wrestlers'
export const PLAINS = mapSlotsFor(Region.Cradle)[1]

export interface WrestlersScene {
    /** The Empire's warbands at the Plains. */
    atPlains?: number
    /** Ann's board, and Rhys's. */
    annBoard?: number
    rhysBoard?: number
    /** Dana takes Ann's pawn and favor instead (R-5.5.2): no site is targeted. */
    pawnTarget?: boolean
    revision?: number
}

/**
 * R-10.22 — Dana (an Exile) campaigns against Ann (the Chancellor) at the Plains, where the Empire
 * has two warbands; Ann stands there with three on their board and rules Wrestlers; Rhys (a
 * Citizen) stands there with two on their board and joins as Ann's Ally. Ann answers with battle
 * plans; Rhys has none to use.
 */
export function wrestlersDefends({
    atPlains = 2,
    annBoard = 3,
    rhysBoard = 2,
    pawnTarget = false,
    revision = CURRENT_OATH_REVISION
}: WrestlersScene = {}): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const board = (count: number): WarbandCounts =>
        count > 0 ? { [IMPERIAL_WARBANDS]: count } : {}
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: PLAINS,
                supply: 6,
                favor: 4,
                secrets: 2,
                warbandsOnBoard: { Dana: 6 },
                warbandsInPersonalBank: { Dana: 4 }
            }),
            testPlayer({
                playerId: 'Ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: PLAINS,
                favor: 3,
                secrets: 1,
                warbandsOnBoard: board(annBoard),
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 },
                advisers: [{ cardId: WRESTLERS, faceUp: true }]
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: PLAINS,
                favor: 2,
                secrets: 1,
                warbandsOnBoard: board(rhysBoard)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'Ann',
            oathkeeperPlayerId: 'Ann',
            oathRevision: revision,
            prng: { seed: 1, invocations: 0 },
            map: allMapSlots(),
            siteCards: { [home]: 'site.drowned-city', [PLAINS]: 'site.plains' },
            denizensBySite: { [home]: [], [PLAINS]: [] },
            warbandsBySite: { [PLAINS]: board(atPlains) }
        }
    )
    openTurn(state, 'Dana')
    state.activePlayerIds = ['Dana']
    const table = tableOf(state)
    const envelope = { gameId: table.state.gameId, source: ActionSource.User }
    return played(table, [
        createAction(Campaign, {
            ...envelope,
            playerId: 'Dana',
            defender: { kind: 'player', playerId: 'Ann' },
            targets: [
                pawnTarget
                    ? { kind: CampaignTargetKind.PawnAndFavor }
                    : { kind: CampaignTargetKind.Site, siteId: PLAINS }
            ],
            attackDice: 4,
            plans: []
        }),
        // R-5.5.2.a — Rhys asks to join, and Ann admits them.
        createAction(AnswerConsent, { ...envelope, playerId: 'Rhys', granted: true }),
        createAction(AnswerConsent, { ...envelope, playerId: 'Ann', granted: true })
    ])
}
