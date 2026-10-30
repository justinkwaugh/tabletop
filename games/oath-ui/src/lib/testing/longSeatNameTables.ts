import { Color } from '@tabletop/common'
import {
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    OathType,
    PlayerStatus,
    Region,
    TRIBUNAL_ID,
    allMapSlots,
    mapSlotsFor,
    type OpenDeal
} from '@tabletop/oath'
import { openTurn, testPlayer, testState, testVaultWithRelics } from '@tabletop/oath/testing'
import { tableOf, type PlayedTable } from './sessionHarness.js'

/** A name as long as the platform allows (64), one unbroken word. */
export const NAME_64 = 'Ottolinewinterbournecastellanmacgillivrayfennimoreashcombebrooke'
/** A name as long as the platform allows (64), with spaces. */
export const NAME_64_SPACED = 'Ottoline Winterbourne Castellan Macgillivray Fennimore Ashworthy'
export const NAME_28 = 'Rosalindwhitcombebarrowfield'
/** One-word names that fit whole on a phone's seat heading. */
export const NAME_14 = 'Bartholomewson'
export const NAME_19 = 'Maximilianfairbanks'

/**
 * Three seats in round 3, every pawn at the Tribunal, in the Act Phase of the seat on screen. The
 * Chancellor plays purple; the others are Exiles, but in `citizen`.
 *
 * - `letters`: the 64-letter Chancellor is on screen and shares 2 deals with the 28-letter Exile; Dana has none.
 * - `spaces`: the 64-character Chancellor with spaces has no deal; the 28-letter Exile is on screen and shares
 *   2 deals with Dana.
 * - `typical`: as `letters`, with everyday names: Marguerite the Chancellor on screen, Rhys the Exile.
 * - `citizen`: Marguerite the Chancellor; the 64-letter seat is a Citizen, on screen, and shares 2 deals with
 *   the Chancellor; Dana has none.
 * - `oneWord`: as `letters`, with one-word names: the 14-letter Chancellor on screen, the 19-letter Exile.
 * - `oneWordExile`: as `oneWord`, with the 19-letter Exile on screen.
 */
export type LongSeatNameScene =
    'letters' | 'spaces' | 'typical' | 'citizen' | 'oneWord' | 'oneWordExile'

function deal(id: string, proposer: string, counterparty: string, round: number): OpenDeal {
    return {
        id,
        proposerPlayerId: proposer,
        counterpartyPlayerId: counterparty,
        proposerPromise: 'I will not campaign against you this round.',
        round
    }
}

/**
 * R-7.6.3-H1 — the Tribunal ("negotiate ... binding actions at any future time ... with any player"):
 * two deals made there in rounds 1 and 2, between the same pair, open on the table.
 */
export function longSeatNameTable(scene: LongSeatNameScene): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const oneWord = scene === 'oneWord' || scene === 'oneWordExile'
    const chancellorId =
        scene === 'letters'
            ? NAME_64
            : scene === 'spaces'
              ? NAME_64_SPACED
              : oneWord
                ? NAME_14
                : 'Marguerite'
    const secondId =
        scene === 'typical' ? 'Rhys' : scene === 'citizen' ? NAME_64 : oneWord ? NAME_19 : NAME_28
    const onScreen =
        scene === 'spaces' || scene === 'citizen' || scene === 'oneWordExile'
            ? secondId
            : chancellorId
    const citizen = scene === 'citizen'
    const state = testState(
        [
            testPlayer({
                playerId: chancellorId,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: home,
                favor: 4,
                secrets: 2,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 6 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 16 }
            }),
            testPlayer({
                playerId: secondId,
                color: Color.Red,
                status: citizen ? PlayerStatus.Citizen : PlayerStatus.Exile,
                siteId: home,
                favor: 2,
                secrets: 1,
                warbandsOnBoard: { [citizen ? IMPERIAL_WARBANDS : secondId]: 3 },
                warbandsInPersonalBank: { [secondId]: 11 }
            }),
            testPlayer({
                playerId: 'Dana',
                color: Color.Blue,
                status: PlayerStatus.Exile,
                siteId: home,
                favor: 1,
                secrets: 1,
                warbandsOnBoard: { Dana: 2 },
                warbandsInPersonalBank: { Dana: 12 }
            })
        ],
        {
            machineState: MachineState.ActPhase,
            oathRevision: CURRENT_OATH_REVISION,
            chancellorPlayerId: chancellorId,
            round: 3,
            map: allMapSlots(),
            siteCards: { [home]: TRIBUNAL_ID },
            denizensBySite: { [home]: [] },
            warbandsBySite: { [home]: { [IMPERIAL_WARBANDS]: 2 } },
            openDeals:
                scene === 'spaces'
                    ? [deal('1.4', secondId, 'Dana', 1), deal('2.3', 'Dana', secondId, 2)]
                    : [
                          deal('1.4', chancellorId, secondId, 1),
                          deal('2.3', secondId, chancellorId, 2)
                      ],
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: chancellorId
        }
    )
    openTurn(state, onScreen)
    state.activePlayerIds = [onScreen]
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}
