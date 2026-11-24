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
    PRINTED_DENIZEN_IDS,
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

/** A discard pile: how many cards, and the places of its Visions from the top (1 is the top card). */
interface PileScene {
    count: number
    places: readonly number[]
}

/** Each region's discard pile, and the region whose site Dana stands at. */
interface DiscardScene {
    piles: Record<Region, PileScene>
    danaIn: Region
}

const scene = (
    danaIn: Region,
    cradle: PileScene,
    provinces: PileScene,
    hinterland: PileScene
): DiscardScene => ({
    danaIn,
    piles: {
        [Region.Cradle]: cradle,
        [Region.Provinces]: provinces,
        [Region.Hinterland]: hinterland
    }
})

/**
 * Base Oath's five Visions at most between the piles (R-8.5). In every scene but the first Dana stands
 * in the Provinces, so a Search lists the Provinces' pile.
 */
export const DISCARD_SCENES = {
    /** The Cradle's 4 denizens; the Provinces' 12 cards with Visions 3rd and 8th; the Hinterland's 7 with a Vision on top. */
    first: scene(
        Region.Cradle,
        { count: 4, places: [] },
        { count: 12, places: [3, 8] },
        { count: 7, places: [1] }
    ),
    /** The Provinces' 16 cards with Visions 3rd, 8th and 11th; the Hinterland's 26 with 6th and 14th. */
    threeAndTwo: scene(
        Region.Provinces,
        { count: 4, places: [] },
        { count: 16, places: [3, 8, 11] },
        { count: 26, places: [6, 14] }
    ),
    /** Every Vision in the Hinterland's 26 cards, two digits each; the Provinces' 12 cards hold none. */
    fiveInOne: scene(
        Region.Provinces,
        { count: 4, places: [] },
        { count: 12, places: [] },
        { count: 26, places: [12, 15, 18, 21, 24] }
    ),
    /** One Vision, 5th of the Provinces' 7 cards; the Hinterland's 9 hold none. */
    one: scene(
        Region.Provinces,
        { count: 4, places: [] },
        { count: 7, places: [5] },
        { count: 9, places: [] }
    )
} as const satisfies Record<string, DiscardScene>

/**
 * R-9.4 — round 3, Dana's Act Phase (an Exile); Rhys is the Chancellor. Every back in a discard pile
 * is public, so each pile shows where its Visions lie from the top. With `older`, a game created
 * before the table kept every back of a pile: its record names none, so each pile shows its count
 * alone, and the Cradle's pile is empty.
 */
export function discardVisionsTable(
    older = false,
    { piles: scenePiles, danaIn }: DiscardScene = DISCARD_SCENES.first
): PlayedTable {
    // The Plains in the Cradle; the Mountain in the Provinces, beside Rhys at the Fertile Valley.
    const danaAt = mapSlotsFor(danaIn)[danaIn === Region.Provinces ? 1 : 0]
    const [valley] = mapSlotsFor(Region.Provinces)
    const visions = [
        'vision.faith',
        'vision.conquest',
        'vision.rebellion',
        'vision.sanctuary',
        'vision.conspiracy'
    ]
    const denizens = [...PRINTED_DENIZEN_IDS]
    const build = ({ count, places }: PileScene) => pile(count, places, visions, denizens)
    const piles: Record<Region, string[]> = {
        [Region.Cradle]: older ? [] : build(scenePiles[Region.Cradle]),
        [Region.Provinces]: build(scenePiles[Region.Provinces]),
        [Region.Hinterland]: build(scenePiles[Region.Hinterland])
    }
    // R-9.4 — the back on top of each pile, public; an empty pile shows none.
    const topBack = (region: Region) => {
        const [top] = piles[region]
        if (top === undefined) return {}
        return { [region]: top.startsWith('vision.') ? CardKind.Vision : CardKind.Denizen }
    }
    const slots = allMapSlots()
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: danaAt,
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
                ...topBack(Region.Cradle),
                ...topBack(Region.Provinces),
                ...topBack(Region.Hinterland)
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
