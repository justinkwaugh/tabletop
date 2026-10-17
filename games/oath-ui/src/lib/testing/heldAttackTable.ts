import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    AnswerQuestion,
    Campaign,
    CURRENT_OATH_REVISION,
    CampaignTargetKind,
    MachineState,
    PlayerStatus,
    PowerQuestionKind,
    Region,
    allMapSlots,
    mapSlotId,
    mapSlotsFor
} from '@tabletop/oath'
import {
    CRADLE,
    HINTERLAND,
    PROVINCES,
    openTurn,
    testPlayer,
    testState
} from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

const FIXTURE_SITES: Record<Region, string[]> = {
    [Region.Cradle]: CRADLE,
    [Region.Provinces]: PROVINCES,
    [Region.Hinterland]: HINTERLAND
}

/**
 * R-5.5.4-H1 — Dana (an Exile, 5 warbands on their board) campaigns against Bea, who rules the
 * Fertile Valley with 2 warbands there, 3 on their board and Jinx as an adviser: the 3 defense dice
 * are rolled, 6 defense, and Dana's 4 attack dice wait on Bea's answer. From seed 1, kept, the attack
 * rolls 4 swords and a skull; rerolled, the defense makes 7 and the attack 2 swords.
 */
export function heldAttackTable(answer?: 'keep' | 'reroll'): PlayedTable {
    const site = mapSlotId(Region.Cradle, 0)
    const sites = Object.fromEntries(
        Object.values(Region).flatMap((region) =>
            mapSlotsFor(region).map((slotId, index) => [slotId, FIXTURE_SITES[region][index]])
        )
    )
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                siteId: site,
                supply: 6,
                warbandsOnBoard: { Dana: 5 },
                warbandsInPersonalBank: { Dana: 9 }
            }),
            testPlayer({
                playerId: 'Bea',
                color: Color.Yellow,
                siteId: site,
                favor: 4,
                secrets: 2,
                advisers: [{ cardId: 'denizen.arcane.jinx', faceUp: true }],
                warbandsOnBoard: { Bea: 3 },
                warbandsInPersonalBank: { Bea: 9 }
            }),
            testPlayer({
                playerId: 'Ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            oathRevision: CURRENT_OATH_REVISION,
            chancellorPlayerId: 'Ann',
            map: allMapSlots(),
            siteCards: { ...sites, [site]: 'site.fertile-valley' },
            denizensBySite: { [site]: [] },
            warbandsBySite: { [site]: { Bea: 2 } },
            prng: { seed: 1, invocations: 0 }
        }
    )
    openTurn(state, 'Dana')
    state.activePlayerIds = ['Dana']
    const table = tableOf(state)
    const envelope = { gameId: table.state.gameId, source: ActionSource.User }
    const declared = played(table, [
        createAction(Campaign, {
            ...envelope,
            playerId: 'Dana',
            defender: { kind: 'player', playerId: 'Bea' },
            targets: [
                { kind: CampaignTargetKind.Site, siteId: site },
                { kind: CampaignTargetKind.PawnAndFavor }
            ],
            attackDice: 4
        })
    ])
    if (!answer) return declared
    return played(declared, [
        createAction(AnswerQuestion, {
            ...envelope,
            playerId: 'Bea',
            answer: { kind: PowerQuestionKind.RerollDice, reroll: answer === 'reroll' }
        })
    ])
}
