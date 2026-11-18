import { controllingOwner } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import {
    mergerCanSucceed,
    mergerProposerId,
    mergerTrading,
    pendingSetAside,
    withDecision,
    withSetAside
} from './merger.js'
import type { HydratedState1828, Merger1828 } from './state.js'
import { stockPrice } from './stockMarket.js'

/**
 * The choices the table offers within a merger. The rules allow one that makes the merger fail,
 * and the game accepts it; the table holds it back from those who agreed to go ahead.
 */

/**
 * Whether the player proposed the merger or directs one of its companies. They have chosen to go
 * ahead, so they are not offered what would make it fail; another holder never agreed to it and
 * may decline to trade up even so (§7.5.1, §7.5.2.1, §7.5.2.2).
 */
function mergerInvolves(state: HydratedState1828, merger: Merger1828, playerId: string): boolean {
    return (
        playerId === mergerProposerId(state) ||
        [merger.survivorId, merger.absorbedId].some(
            (companyId) => controllingOwner(state, companyId)?.playerId === playerId
        )
    )
}

/** Whether to offer a choice: one bound to the merger must keep it possible. */
function choiceOpen(
    state: HydratedState1828,
    merger: Merger1828,
    playerId: string,
    after: Merger1828
): boolean {
    return (
        !mergerInvolves(state, merger, playerId) ||
        !mergerCanSucceed(state, merger) ||
        mergerCanSucceed(state, after)
    )
}

/** The shares offered to the choosing player to set aside, dearest first (§7.5.2 step 4). */
export function setAsideChoices(state: HydratedState1828, merger: Merger1828): string[] {
    const playerId = pendingSetAside(state, merger)
    assertExists(playerId, 'A player is choosing a share to set aside')
    return [merger.survivorId, merger.absorbedId]
        .filter((companyId) =>
            choiceOpen(state, merger, playerId, withSetAside(merger, playerId, companyId))
        )
        .toSorted((first, second) => stockPrice(state, second) - stockPrice(state, first))
}

/** What the deciding player is offered for their single share, and whether selling ends it. */
export function singleShareChoices(
    state: HydratedState1828,
    merger: Merger1828
): { tradeUp: boolean; sell: boolean; sellFails: boolean } {
    const { deciderId } = mergerTrading(state, merger)
    assertExists(deciderId, 'A player is deciding on a single share')
    const sold = withDecision(merger, deciderId, false)
    return {
        tradeUp: choiceOpen(state, merger, deciderId, withDecision(merger, deciderId, true)),
        sell: choiceOpen(state, merger, deciderId, sold),
        sellFails: !mergerCanSucceed(state, sold)
    }
}
