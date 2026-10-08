import { Color } from '@tabletop/common'
import {
    IMPERIAL_WARBANDS,
    MachineState,
    OathRevision,
    PlayerStatus,
    Region,
    allMapSlots,
    mapSlotsFor,
    reliquarySlotId,
    type HydratedOathGameState
} from '@tabletop/oath'
import {
    CRADLE,
    HINTERLAND,
    PROVINCES,
    openTurn,
    testPlayer,
    testState
} from '@tabletop/oath/testing'

const WOOD_SITES: Record<Region, string[]> = {
    [Region.Cradle]: ['site.drowned-city', 'site.plains'],
    [Region.Provinces]: ['site.shrouded-wood', 'site.great-slums', 'site.river'],
    [Region.Hinterland]: ['site.mountain', 'site.steppe', 'site.wastes']
}

const FIXTURE_SLOTS: Record<Region, string[]> = {
    [Region.Cradle]: CRADLE,
    [Region.Provinces]: PROVINCES,
    [Region.Hinterland]: HINTERLAND
}

/**
 * R-11.7 — Jacob, the Chancellor with Decadent uncovered (R-6.6.2.a), stands at a Shrouded Wood
 * that Cole, an Exile, rules with one warband: the first Provinces site, or with `inCradle` the
 * first Cradle site, the two swapping cards. `onBoard` deals onto the engine's map slots.
 */
export function shroudedWoodState(
    supply: number,
    {
        inCradle = false,
        onBoard = false,
        oathRevision = OathRevision.UiBatch1
    }: { inCradle?: boolean; onBoard?: boolean; oathRevision?: number } = {}
): HydratedOathGameState {
    const slotsOf = (region: Region) => (onBoard ? mapSlotsFor(region) : FIXTURE_SLOTS[region])
    const siteCards: Record<string, string> = {}
    for (const region of Object.values(Region)) {
        slotsOf(region).forEach((slotId, index) => {
            const card = WOOD_SITES[region][index]
            if (card) siteCards[slotId] = card
        })
    }
    const [cradle] = slotsOf(Region.Cradle)
    const [provinces] = slotsOf(Region.Provinces)
    const wood = inCradle ? cradle : provinces
    if (inCradle) {
        siteCards[cradle] = 'site.shrouded-wood'
        siteCards[provinces] = 'site.drowned-city'
    }
    const state = testState(
        [
            testPlayer({
                playerId: 'Jacob',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: wood,
                supply,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 }
            }),
            testPlayer({
                playerId: 'Cole',
                color: Color.Red,
                siteId: slotsOf(Region.Hinterland)[2],
                supply: 5,
                warbandsOnBoard: { Cole: 3 }
            })
        ],
        {
            oathRevision,
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'Jacob',
            reliquary: [0, 2, 3].map((i) => ({ slotId: reliquarySlotId(i) })),
            ...(onBoard ? { map: allMapSlots() } : {}),
            siteCards,
            warbandsBySite: { [wood]: { Cole: 1 } }
        }
    )
    openTurn(state, 'Jacob')
    state.activePlayerIds = ['Jacob']
    return state
}
