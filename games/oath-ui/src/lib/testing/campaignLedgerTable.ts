import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    Campaign,
    CampaignDefeatKills,
    CampaignDefend,
    CampaignResolveVictory,
    CampaignSacrifice,
    CampaignTargetKind,
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    PlayerStatus,
    PowerTiming,
    Region,
    allMapSlots,
    isCampaignSacrifice,
    mapSlotsFor,
    powerIndexOf
} from '@tabletop/oath'
import { openTurn, testPlayer, testState, testVaultWithRelics } from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

export const FIELD_PROMOTION = 'denizen.order.field-promotion'
export const BEAR_TRAPS = 'denizen.order.bear-traps'
export const CUP_OF_PLENTY = 'relic.cup-of-plenty'

const [GREAT_SLUM, FERTILE_VALLEY] = mapSlotsFor(Region.Cradle)
const [PLAINS, RIVER, STEPPE] = mapSlotsFor(Region.Provinces)
const [MINE, SALT_FLATS, MOUNTAIN] = mapSlotsFor(Region.Hinterland)

export { PLAINS, RIVER }

const plan = (cardId: string) => ({
    cardId,
    powerIndex: powerIndexOf(cardId, PowerTiming.BattlePlan)
})

export interface CampaignLedgerScene {
    /** The game's revision: 25 and later record the dice as rolled on the closing step. */
    revision?: number
    /** Dana's sacrifice: 1 wins 10 to 9; none loses the tie (R-5.5.5.b). */
    sacrifice?: number
}

/**
 * R-5.5 — Dana (a red Exile at the Plains, 9 warbands on their board, Field Promotion as an
 * adviser) campaigns against Rhys (a yellow Exile who rules the Plains with 1 warband there, stands
 * there, holds the Cup of Plenty and has Bear Traps as an adviser) for the Plains, the Cup and
 * Rhys's pawn and favor. Ann is the purple Chancellor at the Great Slum. Every step is played
 * through the engine from seed 2: 9 dice (Bear Traps −1) roll 9 swords and 2 skulls against 3
 * shields doubled to 6 and 3 warbands; Dana sacrifices 1 to win 10 to 9, Rhys loses their warband
 * at the Plains, and Dana takes the spoils, banishing Rhys to the River. With no sacrifice, the
 * tie is Rhys's and the Campaign ends there.
 */
export function campaignLedgerTable({
    revision = CURRENT_OATH_REVISION,
    sacrifice = 1
}: CampaignLedgerScene = {}): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: PLAINS,
                supply: 7,
                favor: 4,
                secrets: 1,
                warbandsOnBoard: { Dana: 9 },
                warbandsInPersonalBank: { Dana: 5 },
                advisers: [{ cardId: FIELD_PROMOTION, faceUp: true }]
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: PLAINS,
                supply: 5,
                favor: 5,
                secrets: 1,
                warbandsOnBoard: { Rhys: 2 },
                warbandsInPersonalBank: { Rhys: 11 },
                relicIds: [CUP_OF_PLENTY],
                advisers: [{ cardId: BEAR_TRAPS, faceUp: true }]
            }),
            testPlayer({
                playerId: 'Ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: GREAT_SLUM,
                favor: 4,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 14 }
            })
        ],
        {
            machineState: MachineState.ActPhase,
            oathRevision: revision,
            chancellorPlayerId: 'Ann',
            map: allMapSlots(),
            siteCards: {
                [GREAT_SLUM]: 'site.great-slums',
                [FERTILE_VALLEY]: 'site.fertile-valley',
                [PLAINS]: 'site.plains',
                [RIVER]: 'site.river',
                [STEPPE]: 'site.steppe',
                [MINE]: 'site.mine',
                [SALT_FLATS]: 'site.salt-flats',
                [MOUNTAIN]: 'site.mountain'
            },
            warbandsBySite: { [PLAINS]: { Rhys: 1 }, [GREAT_SLUM]: { [IMPERIAL_WARBANDS]: 2 } },
            prng: { seed: 2, invocations: 0 }
        }
    )
    openTurn(state, 'Dana')
    state.activePlayerIds = ['Dana']
    state.vault = testVaultWithRelics({})
    const table = tableOf(state)
    const envelope = { gameId: table.state.gameId, source: ActionSource.User }
    const sacrificed = played(table, [
        createAction(Campaign, {
            ...envelope,
            playerId: 'Dana',
            defender: { kind: 'player', playerId: 'Rhys' },
            targets: [
                { kind: CampaignTargetKind.Site, siteId: PLAINS },
                { kind: CampaignTargetKind.Relic, cardId: CUP_OF_PLENTY },
                { kind: CampaignTargetKind.PawnAndFavor }
            ],
            attackDice: 9,
            plans: [plan(FIELD_PROMOTION)]
        }),
        createAction(CampaignDefend, { ...envelope, playerId: 'Rhys', plans: [plan(BEAR_TRAPS)] }),
        createAction(CampaignSacrifice, {
            ...envelope,
            playerId: 'Dana',
            sacrifice,
            // R-5.5.6 — defeated, Dana loses half their force: 6 on their board after the roll.
            ...(sacrifice > 0
                ? {}
                : { defeatKills: [{ at: { kind: 'board' as const, playerId: 'Dana' }, owner: 'Dana', count: 3 }] })
        })
    ])
    const closing = sacrificed.actions.at(-1)
    if (isCampaignSacrifice(closing) && closing.metadata?.attackerVictorious === false) return sacrificed
    // R-5.5.6.a — before revision 7 the defender picks even a loss that changes nothing.
    const picked = sacrificed.state.activePlayerIds.includes('Rhys')
        ? played(sacrificed, [
              createAction(CampaignDefeatKills, {
                  ...envelope,
                  playerId: 'Rhys',
                  kills: [{ at: { kind: 'site', siteId: PLAINS }, owner: 'Rhys', count: 1 }]
              })
          ])
        : sacrificed
    return played(picked, [
        createAction(CampaignResolveVictory, {
            ...envelope,
            playerId: 'Dana',
            placements: [{ siteId: PLAINS, owner: 'Dana', count: 2 }],
            banishToSiteId: RIVER,
            burnFavor: true
        })
    ])
}
