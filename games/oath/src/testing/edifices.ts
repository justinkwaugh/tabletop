import { assert } from '@tabletop/common'
import { Color } from '@tabletop/common'
import type { HydratedOathGameState, OathProjectedState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import { siteHolding } from '../util/access.js'
import { openTurn, testPlayer, testState, testVaultWithRelics } from './fixture.js'

export const SPRAWLING_RAMPART = 'edifice.order.sprawling-rampart'
export const HALL_OF_DEBATE = 'edifice.hearth.hall-of-debate'
export const FOREST_TEMPLE = 'edifice.beast.forest-temple'
export const FESTIVAL_DISTRICT = 'edifice.discord.festival-district'
export const GREAT_SPIRE = 'edifice.arcane.great-spire'
export const ANCIENT_FORGE = 'edifice.nomad.ancient-forge'

export const WOLVES = 'denizen.beast.wolves'

/**
 * R-8.5 — the Dispossessed, filled only by the Chronicle: its cards in the vault, its count public.
 * The vault is shuffled before each draw from it, so the order given here is no promise.
 */
export function fillDispossessed(state: HydratedOathGameState, cardIds: readonly string[]): void {
    state.requireVault().dispossessed = [...cardIds]
    state.dispossessedCount = cardIds.length
}

/** R-2.8.1, R-2.9 — first in the site's row, in a space of its own, one edifice per site. */
export function placeEdifice(
    state: HydratedOathGameState,
    siteId: string,
    cardId: string,
    { ruined = false }: { ruined?: boolean } = {}
): void {
    assert(state.isEdifice(cardId), `${cardId} is not an edifice`)
    assert(siteHolding(state, cardId) === undefined, `${cardId} is already at a site`)
    const here = state.denizensAt(siteId)
    assert(!here.some((id) => state.isEdifice(id)), `${siteId} already holds an edifice`)
    assert(here.length < effectiveSiteCapacity(state, siteId), `${siteId} has no room`)
    state.denizensBySite[siteId] = [cardId, ...here]
    if (ruined) state.setEdificeRuined(cardId, true)
}

export const DANA = 'dana'
export const RHYS = 'rhys'
export const PLAINS_SLOT = 'c1'
export const STONES_SLOT = 'p1'
export const STONES_RELIC = 'relic.book-of-records'

/**
 * Dana (the Chancellor) and Rhys (an Exile) at the Plains, which holds Hall of Debate (or `plains`, on
 * the side `ruined` names) and Wolves with 2 Imperial warbands; Standing Stones holds a ruined Ancient
 * Forge (Broken Forge) and a facedown relic, with no warbands, so the bandits rule it (R-10.21). Dana's
 * turn in the Act Phase.
 */
export function edificeTable(
    over: Record<string, Record<string, unknown>> = {},
    state: Partial<OathProjectedState> = {},
    { plains = HALL_OF_DEBATE, ruined = false }: { plains?: string; ruined?: boolean } = {}
): HydratedOathGameState {
    const relicSlot = `${STONES_SLOT}.relic.0`
    const s = testState(
        [
            testPlayer({
                playerId: DANA,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: PLAINS_SLOT,
                favor: 4,
                secrets: 2,
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 },
                ...over[DANA]
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: PLAINS_SLOT,
                favor: 4,
                secrets: 2,
                ...over[RHYS]
            })
        ],
        {
            chancellorPlayerId: DANA,
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                [STONES_SLOT]: 'site.standing-stones',
                h1: 'site.mountain'
            },
            denizensBySite: { [PLAINS_SLOT]: [WOLVES], [STONES_SLOT]: [] },
            warbandsBySite: { [PLAINS_SLOT]: { [IMPERIAL_WARBANDS]: 2 } },
            relicsBySite: { [STONES_SLOT]: [{ slotId: relicSlot }] },
            vault: testVaultWithRelics({ [relicSlot]: STONES_RELIC }),
            ...state
        }
    )
    placeEdifice(s, PLAINS_SLOT, plains, { ruined })
    placeEdifice(s, STONES_SLOT, ANCIENT_FORGE, { ruined: true })
    openTurn(s, DANA)
    return s
}
