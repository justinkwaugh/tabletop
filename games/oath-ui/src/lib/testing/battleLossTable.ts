import { ActionSource, Color, createAction, range } from '@tabletop/common'
import {
    CampaignDefeatKills,
    CampaignResolveVictory,
    CampaignSacrifice,
    CampaignTargetKind,
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    PlayerStatus,
    Region,
    allMapSlots,
    mapSlotsFor,
    type WarbandGroup
} from '@tabletop/oath'
import { campaignRecords, openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

export const HOSPITAL = 'denizen.hearth.hospital'
const [HOME, PLAINS] = mapSlotsFor(Region.Cradle)

/**
 * R-5.5.6.a — Dana (an Exile) campaigned against Ann (the Chancellor) at the Plains, with Rhys (a
 * Citizen) as Ann's Ally: 4 swords and 4 warbands sacrificed, 8 against 1 shield and 6 warbands (2 at
 * the Plains, 2 on Ann's board, 2 on Rhys's board). Dana won, so half the defence, 3, die, and as
 * the Chancellor Ann chooses which. With `hospital`, Ann rules the Drowned City, where Hospital is,
 * and used it as a battle plan: the warbands it would hold are Ann's, at the Plains and on Ann's
 * board (R-10.28-H2), not Rhys's. With `ended`, Ann picks the 2 at the Plains and 1 on Rhys's board,
 * and Dana takes the spoils: the Campaign ends.
 */
export function battleLossTable({
    hospital = false,
    ended = false
}: { hospital?: boolean; ended?: boolean } = {}): PlayedTable {
    const defendingForce: WarbandGroup[] = [
        { at: { kind: 'site', siteId: PLAINS }, owner: IMPERIAL_WARBANDS, count: 2 },
        { at: { kind: 'board', playerId: 'Ann' }, owner: IMPERIAL_WARBANDS, count: 2 },
        { at: { kind: 'board', playerId: 'Rhys' }, owner: IMPERIAL_WARBANDS, count: 2 }
    ]
    const plans = hospital
        ? {
              plansUsed: [HOSPITAL],
              plansUsedBy: { Ann: [HOSPITAL] },
              killRedirects: [{ playerId: 'Ann', siteId: HOME }]
          }
        : {}
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: PLAINS,
                warbandsOnBoard: { Dana: 6 },
                warbandsInPersonalBank: { Dana: 4 }
            }),
            testPlayer({
                playerId: 'Ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: PLAINS,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 }
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: PLAINS,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { Rhys: 14 }
            })
        ],
        {
            machineState: MachineState.CampaignSacrifice,
            chancellorPlayerId: 'Ann',
            oathRevision: CURRENT_OATH_REVISION,
            map: allMapSlots(),
            siteCards: { [HOME]: 'site.drowned-city', [PLAINS]: 'site.plains' },
            denizensBySite: { [HOME]: hospital ? [HOSPITAL] : [], [PLAINS]: [] },
            warbandsBySite: {
                [HOME]: { [IMPERIAL_WARBANDS]: 1 },
                [PLAINS]: { [IMPERIAL_WARBANDS]: 2 }
            },
            campaign: {
                attackerPlayerId: 'Dana',
                defenderPlayerId: 'Ann',
                nonImperialPlayerIds: [],
                allyPlayerIds: ['Rhys'],
                targets: [{ kind: CampaignTargetKind.Site, siteId: PLAINS }],
                attackPool: 4,
                defensePool: 1,
                attackRoll: range(0, 4).map(() => ({ swords: 1, hollowSwords: 0, skulls: 0 })),
                defenseRoll: [{ shields: 1, doubling: false }],
                defense: 7,
                swords: 4,
                defendingForce,
                defendingBandits: 0,
                ...campaignRecords(),
                ...plans
            }
        }
    )
    openTurn(state, 'Dana')
    state.activePlayerIds = ['Dana']
    const table = tableOf(state)
    const envelope = { gameId: table.state.gameId, source: ActionSource.User }
    const sacrificed = played(table, [
        createAction(CampaignSacrifice, { ...envelope, playerId: 'Dana', sacrifice: 4 })
    ])
    if (!ended) return sacrificed
    return played(sacrificed, [
        createAction(CampaignDefeatKills, {
            ...envelope,
            playerId: 'Ann',
            kills: [defendingForce[0], { ...defendingForce[2], count: 1 }]
        }),
        createAction(CampaignResolveVictory, {
            ...envelope,
            playerId: 'Dana',
            placements: [],
            burnFavor: false
        })
    ])
}
