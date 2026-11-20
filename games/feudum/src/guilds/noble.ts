import { shillings } from '../model/collections.js'
import {
    NoblePullMarkers,
    NoblePushSeals,
    NoblePushTotals,
    NobleTradePrice,
    NobleTradeSeals,
    type ScrollSpaceId
} from '../data/guilds.js'
import { rosaryBeadSum } from '../model/beads.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { canPayGuild, guildSplit, payGuild } from '../model/payments.js'
import { filledScrollSpaces } from '../model/scrolls.js'
import { flipSeal, moveConcealedSeal } from '../model/seals.js'
import { scoringPreview, type GuildFunctionName, type GuildFunctionRow } from './guildFunction.js'
import { rowsToScrollsRow } from './rowsToScrolls.js'
import { flipTotals, reasonSealPicksRefused } from './sealFlips.js'

export interface NobleTradeOffer {
    readonly price: number
    /** R-4.6-H1 The scroll spaces holding a seal to buy. */
    readonly scrollSpaces: readonly ScrollSpaceId[]
    readonly most: number
}

/** R-4.6-H1 Each seal on the scrolls, and the most one trade buys. */
export function nobleTradeOffer(state: HydratedFeudumGameState): NobleTradeOffer {
    const scrollSpaces = filledScrollSpaces(state)
    return {
        price: NobleTradePrice,
        scrollSpaces,
        most: Math.min(NobleTradeSeals, scrollSpaces.length)
    }
}

const NobleTrade: GuildFunctionRow = {
    /** R-4.6-H1, R-4.6.2 With no seal on the scrolls there is nothing to buy. */
    reasonClosed(state, { playerId }) {
        if (filledScrollSpaces(state).length === 0) {
            return 'No seal lies on the scrolls.'
        }
        return canPayGuild(state, playerId, NobleTradePrice)
            ? undefined
            : `A seal costs ${shillings(NobleTradePrice)}.`
    },

    /** R-4.6-H1, R-4.6.2 */
    reasonRefused(state, { playerId }, { scrollSpaces = [] }) {
        const refused = reasonSealPicksRefused(state, scrollSpaces, 'Buy', NobleTradeSeals)
        if (refused) {
            return refused
        }
        if (scrollSpaces.length === 0) {
            return `Pick up to ${NobleTradeSeals} seals on the scrolls.`
        }
        const price = scrollSpaces.length * NobleTradePrice
        return canPayGuild(state, playerId, price)
            ? undefined
            : `Those seals cost ${shillings(price)}.`
    },

    /** R-4.6-H1, R-4.6.2, R-5-H1 Unseen: no barrier. Moved first, so a projection defers. */
    perform(state, { playerId }, { scrollSpaces = [] }) {
        for (const spaceId of scrollSpaces) {
            moveConcealedSeal(state, { kind: 'scroll', spaceId }, { kind: 'held', playerId })
        }
        const price = scrollSpaces.length * NobleTradePrice
        return {
            details: { kind: 'noble-trade', price },
            payment: payGuild(state, playerId, 'noble', price)
        }
    },

    /** R-4.6-H1 What the picks would cost and where the shillings would go. */
    preview(state, _actor, { scrollSpaces = [] }) {
        if (reasonSealPicksRefused(state, scrollSpaces, 'Buy', NobleTradeSeals)) {
            return undefined
        }
        const price = scrollSpaces.length * NobleTradePrice
        return {
            details: { kind: 'noble-trade', price },
            payment: guildSplit(state, 'noble', price)
        }
    }
}

/** R-4.6.5 Each total reached is one level. */
function pushLevel(total: number): number {
    return NoblePushTotals.filter((reached) => total >= reached).length
}

/** R-4.6.1, R-4.6-H5 As many as lie on the scrolls, up to the stated number. */
function flipsNow(state: HydratedFeudumGameState): number {
    return Math.min(NoblePushSeals, filledScrollSpaces(state).length)
}

const NoblePush: GuildFunctionRow = {
    /** R-4.6.1 At least one must move. */
    reasonClosed(state) {
        return flipsNow(state) > 0 ? undefined : 'No seal lies on the scrolls.'
    },

    /** R-4.6.1, R-4.6-H5 */
    reasonRefused(state, _actor, { scrollSpaces = [] }) {
        const flips = flipsNow(state)
        return (
            reasonSealPicksRefused(state, scrollSpaces, 'Flip', NoblePushSeals) ??
            (scrollSpaces.length < flips ? `${flips} seals can flip: pick them all.` : undefined)
        )
    },

    /** R-4.6.5, R-X.2 Each seal flips onto the rosary, named by this Action: a barrier. */
    perform(state, _actor, { scrollSpaces = [] }) {
        const sealIds = scrollSpaces.map((spaceId) =>
            flipSeal(state, { kind: 'scroll', spaceId }, { kind: 'rosary' })
        )
        const rosaryTotal = rosaryBeadSum(state)
        return {
            details: { kind: 'noble-push', sealIds, rosaryTotal },
            completions: pushLevel(rosaryTotal),
            revealed: true
        }
    },

    /** R-4.6.5, R-5-H1 The seals are unseen, so the range their values allow. */
    preview(state, actor, { scrollSpaces = [] }) {
        const flips = flipsNow(state)
        if (flips === 0 || reasonSealPicksRefused(state, scrollSpaces, 'Flip', NoblePushSeals)) {
            return undefined
        }
        const totals = flipTotals(state, flips)
        return {
            completions: pushLevel(totals.highestTotal),
            revealed: true,
            sealFlip: {
                ...totals,
                flips,
                ifLowest: scoringPreview(
                    state,
                    actor,
                    'noble',
                    'push',
                    pushLevel(totals.lowestTotal)
                )
            }
        }
    },

    /** R-4.6.5 The unseen seals' highest values are the best it can do. */
    bestCompletions(state) {
        return pushLevel(flipTotals(state, flipsNow(state)).highestTotal)
    }
}

export const NobleFunctions: Readonly<Record<GuildFunctionName, GuildFunctionRow>> = {
    trade: NobleTrade,
    /** R-4.6.4 Any row or column reaches the threshold, once. */
    pull: rowsToScrollsRow({
        cap: NoblePullMarkers,
        moveAll: true,
        outcome({ markers, rows, columns }) {
            return {
                details: { kind: 'noble-pull', markers, rows, columns },
                completions: Math.min(rows + columns, 1)
            }
        },
        reached: (lines) => Math.min(lines, 1)
    }),
    push: NoblePush
}
