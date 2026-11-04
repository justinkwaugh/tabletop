import { Color } from '@tabletop/common'
import {
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    OathType,
    PlayerStatus,
    Region,
    allMapSlots,
    mapSlotsFor
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { tableOf, type PlayedTable } from './sessionHarness.js'

const HORNED_MASK = 'relic.horned-mask'
const HOMESTEADERS = 'denizen.hearth.homesteaders'
const LONGBOWS = 'denizen.order.longbows'
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'
const SONGS = 'denizen.hearth.tavern-songs'

/**
 * Round 3, Dana's Act Phase, with a "Use a power" step taller than a desktop's share of the column.
 * Dana (an Exile) stands at the Great Slum (capacity 3), full with the Wolves, the Tents and Tavern
 * Songs, which they rule with one warband; Dana holds Homesteaders and Longbows faceup (2 of 3) and
 * the Horned Mask (R-7.1.1: a relic on their board is theirs to use). Rhys is the Chancellor and
 * Oathkeeper, at the River.
 */
export function greatSlumPowers(): PlayedTable {
    const [slum, river] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: slum,
                favor: 3,
                secrets: 2,
                supply: 6,
                warbandsOnBoard: { Dana: 3 },
                warbandsInPersonalBank: { Dana: 10 },
                relicIds: [HORNED_MASK],
                advisers: [
                    { cardId: HOMESTEADERS, faceUp: true },
                    { cardId: LONGBOWS, faceUp: true }
                ]
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: river,
                favor: 2,
                secrets: 1,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 18 }
            })
        ],
        {
            oathRevision: CURRENT_OATH_REVISION,
            chancellorPlayerId: 'Rhys',
            round: 3,
            machineState: MachineState.ActPhase,
            map: allMapSlots(),
            denizensBySite: { [slum]: [WOLVES, TENTS, SONGS], [river]: [] },
            warbandsBySite: { [slum]: { Dana: 1 }, [river]: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: { [slum]: 'site.great-slums', [river]: 'site.river' },
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'Rhys'
        }
    )
    openTurn(state, 'Dana')
    const vault = state.requireVault()
    const placed = [WOLVES, TENTS, SONGS, HOMESTEADERS, LONGBOWS]
    vault.worldDeck = vault.worldDeck.filter((cardId) => !placed.includes(cardId))
    vault.relicDeck = vault.relicDeck.filter((cardId) => cardId !== HORNED_MASK)
    return tableOf(state)
}
