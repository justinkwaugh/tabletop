import { Color } from '@tabletop/common'
import {
    HydratedOathGameState,
    MachineState,
    PlayerStatus,
    Region,
    allMapSlots,
    mapSlotsFor
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { tableOf, type PlayedTable } from './sessionHarness.js'

export const DREAM_THIEF = 'denizen.arcane.dream-thief'
export const INQUISITOR = 'denizen.arcane.inquisitor'
export const IVORY_EYE = 'relic.ivory-eye'
export const DANA_OWN = ['denizen.arcane.tutor', 'denizen.hearth.herald'] as const
export const RHYS_PEEKED = 'denizen.order.captains'
export const RHYS_VISION = 'vision.faith'
export const MARA_ONE = 'denizen.beast.wolves'

export type FacedownPower = 'dreamThief' | 'inquisitor' | 'ivoryEye'

/**
 * Dana's Act Phase. Dana (an Exile) rules the power's card faceup beside two facedown advisers
 * (R-2.2.2: up to three); Rhys (the Chancellor) holds two facedown, a denizen Rhys let Dana peek
 * at (R-6.1, R-9.4) and a Vision (R-5.1.4.III: the Chancellor may play one as an adviser; its back
 * is public); Mara (an Exile) holds one. For Inquisitor all three pawns stand at the Plains; for
 * the Ivory Eye Dana holds the relic instead of a faceup power card.
 */
export function facedownPickerState(power: FacedownPower): HydratedOathGameState {
    const [city, plains] = mapSlotsFor(Region.Cradle)
    const [slum, river, mountain] = mapSlotsFor(Region.Provinces)
    const [pass, wastes] = mapSlotsFor(Region.Hinterland)
    const together = power === 'inquisitor'
    const faceup =
        power === 'dreamThief' ? [DREAM_THIEF] : power === 'inquisitor' ? [INQUISITOR] : []
    const dana = testPlayer({
        playerId: 'Dana',
        color: Color.Red,
        status: PlayerStatus.Exile,
        siteId: plains,
        favor: 3,
        secrets: 2,
        warbandsOnBoard: { Dana: 3 },
        warbandsInPersonalBank: { Dana: 11 },
        relicIds: power === 'ivoryEye' ? [IVORY_EYE] : [],
        advisers: [
            ...faceup.map((cardId) => ({ cardId, faceUp: true })),
            ...DANA_OWN.map((cardId) => ({ cardId, faceUp: false }))
        ]
    })
    const rhys = testPlayer({
        playerId: 'Rhys',
        color: Color.Purple,
        status: PlayerStatus.Chancellor,
        siteId: together ? plains : city,
        favor: 2,
        advisers: [
            { cardId: RHYS_PEEKED, faceUp: false },
            { cardId: RHYS_VISION, faceUp: false }
        ]
    })
    const mara = testPlayer({
        playerId: 'Mara',
        color: Color.Blue,
        status: PlayerStatus.Exile,
        siteId: together ? plains : river,
        favor: 1,
        advisers: [{ cardId: MARA_ONE, faceUp: false }]
    })
    const state = testState([dana, rhys, mara], {
        machineState: MachineState.ActPhase,
        chancellorPlayerId: 'Rhys',
        map: allMapSlots(),
        siteCards: {
            [city]: 'site.drowned-city',
            [plains]: 'site.plains',
            [slum]: 'site.great-slums',
            [river]: 'site.river',
            [mountain]: 'site.mountain',
            [pass]: 'site.narrow-pass',
            [wastes]: 'site.wastes'
        },
        denizensBySite: {
            [city]: [],
            [plains]: [],
            [slum]: [],
            [river]: [],
            [mountain]: [],
            [pass]: [],
            [wastes]: []
        }
    })
    // R-9.4 — Rhys let Dana peek at the first: Dana's view names it; the table sees a card was shown.
    state.getPlayerState('Rhys').markShown(RHYS_PEEKED, 'Dana')
    openTurn(state, 'Dana')
    state.activePlayerIds = ['Dana']
    return state
}

export function facedownPickerTable(power: FacedownPower): PlayedTable {
    return tableOf(facedownPickerState(power))
}
