import { Color } from '@tabletop/common'
import { IMPERIAL_WARBANDS, MachineState, PlayerStatus, Region, mapSlotsFor } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { tableOf, type PlayedTable } from './sessionHarness.js'

const ENVOY = 'denizen.nomad.special-envoy'
const PLAYMATES = 'denizen.beast.animal-playmates'
const PRESSGANGS = 'denizen.order.pressgangs'
const BLOOD_PACT = 'denizen.arcane.blood-pact'
const SACRED_GROUND = 'denizen.nomad.sacred-ground'
const ORACLE = 'denizen.nomad.oracle'
const WOLVES = 'denizen.beast.wolves'
const KEEP = 'denizen.order.keep'
const ROUND_OF_ALE = 'denizen.hearth.a-round-of-ale'
const BOOK_BINDERS = 'denizen.hearth.book-binders'
const GARRISON = 'denizen.order.garrison'
const WHISTLE = 'relic.whistle'
const GRAND_SCEPTER = 'relic.grand-scepter'

/**
 * The scene each table draws:
 * - 'envoy': Dana's Act Phase at Standing Stones with 5 Supply, Special Envoy and Animal Playmates
 *   among their advisers, Sacred Ground and Blood Pact at the site.
 * - 'scepter': the same board on Rhys's Act Phase; Rhys holds the Grand Scepter from setup and 5
 *   favor, enough to exile a Citizen, and Mara is a Citizen.
 * - 'pair': Dana at Charming Valley with 0 Supply, Animal Playmates and Pressgangs; the Wolves
 *   there hold 1 favor.
 * - 'busy': as 'envoy', with Blood Pact and the Oracle at Standing Stones, 2 secrets and the
 *   Whistle held.
 */
export type UseOnEveryCardScene = 'envoy' | 'scepter' | 'pair' | 'busy'

const faceup = (...cardIds: string[]) => cardIds.map((cardId) => ({ cardId, faceUp: true }))

/**
 * R-6.2, R-7.4 — a "Use" on every card whose power the seat can use now. Dana and Mara are
 * Exiles; Rhys is the Chancellor at the Plains, with A Round of Ale there, Garrison among their
 * advisers and the Grand Scepter held. Mara stands at the Deep Woods.
 */
export function useOnEveryCardTable(scene: UseOnEveryCardScene): PlayedTable {
    const [stones, tribunal] = mapSlotsFor(Region.Cradle)
    const [plains, river, mountain] = mapSlotsFor(Region.Provinces)
    const [valley, woods, slums] = mapSlotsFor(Region.Hinterland)
    const pair = scene === 'pair'
    const busy = scene === 'busy'
    const turn = scene === 'scepter' ? 'Rhys' : 'Dana'
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: pair ? valley : stones,
                supply: pair ? 0 : 5,
                favor: pair ? 2 : 1,
                secrets: pair ? 0 : busy ? 2 : 1,
                warbandsOnBoard: { Dana: pair ? 3 : 7 },
                warbandsInPersonalBank: { Dana: pair ? 10 : 6 },
                advisers: faceup(...(pair ? [PLAYMATES, PRESSGANGS] : [ENVOY, PLAYMATES])),
                relicIds: busy ? [WHISTLE] : []
            }),
            testPlayer({
                playerId: 'Mara',
                color: Color.Yellow,
                status: scene === 'scepter' ? PlayerStatus.Citizen : PlayerStatus.Exile,
                siteId: woods,
                supply: 5,
                favor: 2,
                secrets: 1,
                warbandsOnBoard: { Mara: 3 },
                warbandsInPersonalBank: { Mara: 14 },
                advisers: faceup(BOOK_BINDERS)
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: plains,
                supply: 5,
                favor: scene === 'scepter' ? 5 : 3,
                secrets: 1,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 6 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 11 },
                advisers: faceup(GARRISON),
                relicIds: [GRAND_SCEPTER]
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'Rhys',
            round: 2,
            map: {
                [Region.Cradle]: [stones, tribunal],
                [Region.Provinces]: [plains, river, mountain],
                [Region.Hinterland]: [valley, woods, slums]
            },
            siteCards: {
                [stones]: 'site.standing-stones',
                [tribunal]: 'site.the-tribunal',
                [plains]: 'site.plains',
                [river]: 'site.river',
                [mountain]: 'site.mountain',
                [valley]: 'site.charming-valley',
                [woods]: 'site.deep-woods',
                [slums]: 'site.great-slums'
            },
            denizensBySite: {
                [stones]: busy ? [BLOOD_PACT, ORACLE] : [SACRED_GROUND, BLOOD_PACT],
                [tribunal]: [],
                [plains]: [ROUND_OF_ALE],
                [river]: [],
                [mountain]: pair ? [] : [KEEP],
                [valley]: pair ? [WOLVES] : [],
                [woods]: [pair ? KEEP : WOLVES],
                [slums]: []
            },
            cardTokens: pair ? { [WOLVES]: { favor: 1, secrets: 0 } } : {},
            discardPileCounts: { cradle: 3, provinces: 3, hinterland: 3 }
        }
    )
    openTurn(state, turn)
    state.turnManager.turnOrder = [turn, ...['Dana', 'Mara', 'Rhys'].filter((id) => id !== turn)]
    state.activePlayerIds = [turn]
    return tableOf(state)
}
