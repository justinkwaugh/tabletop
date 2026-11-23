import { Color } from '@tabletop/common'
import {
    CURRENT_OATH_REVISION,
    CardKind,
    IMPERIAL_WARBANDS,
    MachineState,
    OathRevision,
    OathType,
    PlayerStatus,
    Region,
    allMapSlots,
    mapSlotsFor
} from '@tabletop/oath'
import { openTurn, testPlayer, testState, testVaultWithDiscards } from '@tabletop/oath/testing'
import { tableOf, type PlayedTable } from './sessionHarness.js'

const SITES: Record<Region, string[]> = {
    [Region.Cradle]: ['site.plains', 'site.river'],
    [Region.Provinces]: ['site.fertile-valley', 'site.mountain', 'site.lush-coast'],
    [Region.Hinterland]: ['site.steppe', 'site.deep-woods', 'site.great-slums']
}

const DENIZENS = [
    'denizen.arcane.acting-troupe',
    'denizen.arcane.alchemist',
    'denizen.arcane.augury',
    'denizen.arcane.bewitch',
    'denizen.beast.animal-host',
    'denizen.beast.animal-playmates',
    'denizen.beast.birdsong',
    'denizen.beast.bracken',
    'denizen.discord.a-small-favor',
    'denizen.discord.assassin',
    'denizen.discord.bandit-chief',
    'denizen.discord.beast-tamer',
    'denizen.hearth.a-round-of-ale',
    'denizen.hearth.armed-mob',
    'denizen.hearth.awaited-return',
    'denizen.hearth.ballot-box',
    'denizen.nomad.a-fast-steed',
    'denizen.nomad.ancient-binding',
    'denizen.nomad.ancient-bloodline',
    'denizen.nomad.ancient-pact'
]

/** `count` cards, top first, with a Vision at each of `places` (1 is the top card). */
function pile(count: number, places: readonly number[], visions: string[], denizens: string[]) {
    return Array.from({ length: count }, (_, at) =>
        places.includes(at + 1) ? visions.shift()! : denizens.shift()!
    )
}

/** The table's record of a pile it saw built: every back, bottom first. */
function everyBack(topFirst: readonly string[]) {
    return topFirst.toReversed().map((cardId) => ({
        back: cardId.startsWith('vision.') ? CardKind.Vision : CardKind.Denizen
    }))
}

/**
 * R-9.4 — round 3, Dana's Act Phase (an Exile at the Plains); Rhys is the Chancellor. Every back in a
 * discard pile is public, so each pile's box names where its Visions lie from the top. The Cradle's
 * pile holds 4 denizens; the Provinces' 12 cards with Visions 3rd and 8th; the Hinterland's 7 with a
 * Vision on top. With `older`, a game created before the table kept every back of a pile: its record
 * names none, so each box shows the count alone, and the Cradle's pile is empty.
 */
export function discardVisionsTable(older = false): PlayedTable {
    const [plains] = mapSlotsFor(Region.Cradle)
    const [valley] = mapSlotsFor(Region.Provinces)
    const visions = ['vision.faith', 'vision.conquest', 'vision.rebellion']
    const denizens = [...DENIZENS]
    const piles: Record<Region, string[]> = {
        [Region.Cradle]: older ? [] : pile(4, [], visions, denizens),
        [Region.Provinces]: pile(12, [3, 8], visions, denizens),
        [Region.Hinterland]: pile(7, [1], visions, denizens)
    }
    const slots = allMapSlots()
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: plains,
                favor: 3,
                secrets: 2,
                supply: 6,
                warbandsInPersonalBank: { Dana: 10 }
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: valley,
                favor: 2,
                secrets: 1,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 18 }
            })
        ],
        {
            oathRevision: older ? OathRevision.EngineFixes29 : CURRENT_OATH_REVISION,
            chancellorPlayerId: 'Rhys',
            round: 3,
            machineState: MachineState.ActPhase,
            map: slots,
            siteCards: Object.fromEntries(
                Object.values(Region).flatMap((region) =>
                    mapSlotsFor(region).map((slotId, index) => [slotId, SITES[region][index]])
                )
            ),
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'Rhys',
            discardPileCounts: {
                [Region.Cradle]: piles[Region.Cradle].length,
                [Region.Provinces]: piles[Region.Provinces].length,
                [Region.Hinterland]: piles[Region.Hinterland].length
            },
            discardTopBackType: {
                ...(older ? {} : { [Region.Cradle]: CardKind.Denizen }),
                [Region.Provinces]: CardKind.Denizen,
                [Region.Hinterland]: CardKind.Vision
            },
            seenDiscardPiles: older
                ? { [Region.Cradle]: [], [Region.Provinces]: [], [Region.Hinterland]: [] }
                : {
                      [Region.Cradle]: everyBack(piles[Region.Cradle]),
                      [Region.Provinces]: everyBack(piles[Region.Provinces]),
                      [Region.Hinterland]: everyBack(piles[Region.Hinterland])
                  },
            vault: testVaultWithDiscards(piles)
        }
    )
    openTurn(state, 'Dana')
    return tableOf(state)
}
