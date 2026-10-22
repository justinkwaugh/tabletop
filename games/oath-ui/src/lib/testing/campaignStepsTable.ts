import { Color } from '@tabletop/common'
import {
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    PlayerStatus,
    Region,
    allMapSlots,
    mapSlotsFor
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { tableOf, type PlayedTable } from './sessionHarness.js'

export const OUTRIDERS = 'denizen.order.outriders'
export const SCOUTS = 'denizen.order.scouts'

const [PLAINS, RIVER] = mapSlotsFor(Region.Provinces)
const [FERTILE_VALLEY, LUSH_COAST] = mapSlotsFor(Region.Cradle)
const [MOUNTAIN, MINE] = mapSlotsFor(Region.Hinterland)

export interface CampaignStepsScene {
    /** Dana's advisers, whose battle plans the third step lists. */
    advisers?: string[]
}

/**
 * R-5.5.1 to R-5.5.3 — Dana (an Exile, four warbands on their board) campaigns from the Plains
 * against Ann (the Chancellor), who stands there too and rules six sites with the Empire's
 * warbands: two at the Plains, one at each other site, three on Ann's board. Ann holds the Cup of
 * Plenty and the Dragonskin Drum. Dana rules Outriders and Scouts, two battle plans.
 */
export function campaignSteps({
    advisers = [OUTRIDERS, SCOUTS]
}: CampaignStepsScene = {}): PlayedTable {
    const empire = (count: number) => ({ [IMPERIAL_WARBANDS]: count })
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
                warbandsOnBoard: { Dana: 4 },
                warbandsInPersonalBank: { Dana: 6 },
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({
                playerId: 'Ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: PLAINS,
                favor: 3,
                secrets: 1,
                warbandsOnBoard: empire(3),
                warbandsInPersonalBank: empire(6),
                relicIds: ['relic.cup-of-plenty', 'relic.dragonskin-drum']
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'Ann',
            oathRevision: CURRENT_OATH_REVISION,
            map: allMapSlots(),
            siteCards: {
                [PLAINS]: 'site.plains',
                [RIVER]: 'site.river',
                [FERTILE_VALLEY]: 'site.fertile-valley',
                [LUSH_COAST]: 'site.lush-coast',
                [MOUNTAIN]: 'site.mountain',
                [MINE]: 'site.mine'
            },
            denizensBySite: Object.fromEntries(
                [PLAINS, RIVER, FERTILE_VALLEY, LUSH_COAST, MOUNTAIN, MINE].map((siteId) => [
                    siteId,
                    []
                ])
            ),
            warbandsBySite: {
                [PLAINS]: empire(2),
                [RIVER]: empire(1),
                [FERTILE_VALLEY]: empire(1),
                [LUSH_COAST]: empire(1),
                [MOUNTAIN]: empire(1),
                [MINE]: empire(1)
            }
        }
    )
    openTurn(state, 'Dana')
    state.activePlayerIds = ['Dana']
    return tableOf(state)
}
