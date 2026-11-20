import {
    MonkCoffer,
    MonkPullSeals,
    MonkPullThreshold,
    MonkPushTotals,
    MonkTradePrice
} from '../data/guilds.js'
import {
    beadValue,
    chickenBeadSum,
    drawBeadToChicken,
    hiddenBeadCandidates,
    hiddenBeadDraw,
    reasonBeadToChickenClosed,
    rosaryBeadSum
} from '../model/beads.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import { canPayGuild, guildSplit, payGuild } from '../model/payments.js'
import { filledScrollSpaces } from '../model/scrolls.js'
import { flipSeal, moveBead } from '../model/seals.js'
import {
    scoringPreview,
    splitPot,
    type FunctionActor,
    type GuildFunctionName,
    type GuildFunctionRow
} from './guildFunction.js'
import { flipTotals, reasonSealPicksRefused } from './sealFlips.js'

/** R-4.6.3, R-4.6-H2 */
function reasonTradeClosed(
    state: HydratedFeudumGameState,
    { playerId }: FunctionActor
): string | undefined {
    if (!hiddenBeadCandidates(state)) {
        return 'The rosary needs at least 2 beads.'
    }
    return canPayGuild(state, playerId, MonkTradePrice)
        ? undefined
        : `A bead costs ${MonkTradePrice} shillings.`
}

const MonkTrade: GuildFunctionRow = {
    reasonClosed: reasonTradeClosed,

    reasonRefused: reasonTradeClosed,

    /** R-4.6.3, R-4.6-H2 A barrier; drawn first, so a projection defers before any change. */
    perform(state, { playerId }) {
        const { high, low, bead } = hiddenBeadDraw(state)
        moveBead(state, bead, { kind: 'rosary' }, { kind: 'player', playerId })
        return {
            details: { kind: 'monk-trade', high, low, bead, price: MonkTradePrice },
            payment: payGuild(state, playerId, 'monk', MonkTradePrice),
            revealed: true
        }
    },

    /** R-4.6.3, R-4.6-H2 Both candidates and where the shillings would go. */
    preview(state, actor) {
        const candidates = hiddenBeadCandidates(state)
        if (!candidates) {
            return undefined
        }
        return {
            payment: guildSplit(state, 'monk', MonkTradePrice),
            revealed: true,
            beadDraw: { ...candidates, ifLow: scoringPreview(state, actor, 'monk', 'trade', 0) }
        }
    }
}

function reachesPullThreshold(total: number): number {
    return total >= MonkPullThreshold ? 1 : 0
}

/** R-4.6.1, R-4.6-H5 One, if one lies on the scrolls. */
function flipsNow(state: HydratedFeudumGameState): number {
    return Math.min(MonkPullSeals, filledScrollSpaces(state).length)
}

const MonkPull: GuildFunctionRow = {
    /** R-4.6.1 At least one must move. */
    reasonClosed(state) {
        return flipsNow(state) > 0 ? undefined : 'No seal lies on the scrolls.'
    },

    /** R-4.6.4 */
    reasonRefused(state, _actor, { scrollSpaces = [] }) {
        return (
            reasonSealPicksRefused(state, scrollSpaces, 'Flip', MonkPullSeals) ??
            (scrollSpaces.length < flipsNow(state) ? 'Pick a seal on the scrolls.' : undefined)
        )
    },

    /** R-4.6.4, R-X.2 The seal flips onto the rosary, named by this Action: a barrier. */
    perform(state, _actor, { scrollSpaces = [] }) {
        const sealIds = scrollSpaces.map((spaceId) =>
            flipSeal(state, { kind: 'scroll', spaceId }, { kind: 'rosary' })
        )
        const rosaryTotal = rosaryBeadSum(state)
        return {
            details: { kind: 'monk-pull', sealIds, rosaryTotal },
            completions: reachesPullThreshold(rosaryTotal),
            revealed: true
        }
    },

    /** R-4.6.4, R-5-H1 The seal is unseen, so both ends: the highest at the top, and the lowest. */
    preview(state, actor, { scrollSpaces = [] }) {
        const flips = flipsNow(state)
        if (flips === 0 || reasonSealPicksRefused(state, scrollSpaces, 'Flip', MonkPullSeals)) {
            return undefined
        }
        const totals = flipTotals(state, flips)
        return {
            completions: reachesPullThreshold(totals.highestTotal),
            revealed: true,
            sealFlip: {
                ...totals,
                flips,
                ifLowest: scoringPreview(
                    state,
                    actor,
                    'monk',
                    'pull',
                    reachesPullThreshold(totals.lowestTotal)
                )
            }
        }
    },

    /** R-4.6.4 The unseen seals' highest value is the best it can do. */
    bestCompletions(state) {
        return reachesPullThreshold(flipTotals(state, flipsNow(state)).highestTotal)
    }
}

/** R-4.6.5 Each total reached is one level. */
function pushLevel(total: number): number {
    return MonkPushTotals.filter((reached) => total >= reached).length
}

const MonkPush: GuildFunctionRow = {
    reasonClosed: reasonBeadToChickenClosed,

    reasonRefused: reasonBeadToChickenClosed,

    /** R-4.6.5, R-4.6-H2, R-3.16.3 A barrier, whatever it scores. */
    perform(state, actor) {
        const { high, low, bead, chicken, chickenSum } = drawBeadToChicken(state)
        const { monk } = state.guilds
        const split = splitPot(state, MonkCoffer.id, monk.coffer, 'monk', actor)
        monk.coffer = split.stays
        return {
            details: { kind: 'monk-push', high, low, bead, chicken, chickenSum },
            completions: pushLevel(chickenSum),
            split,
            revealed: true
        }
    },

    /** R-4.6.5, R-4.6-H2 The bead is unknown, so both outcomes: the high at the top, and the low. */
    preview(state, actor) {
        const candidates = hiddenBeadCandidates(state)
        if (!candidates || reasonBeadToChickenClosed(state)) {
            return undefined
        }
        const { high, low } = candidates
        const sum = chickenBeadSum(state)
        const ifLow = pushLevel(sum + beadValue(low))
        return {
            completions: pushLevel(sum + beadValue(high)),
            split: splitPot(
                new HydratedFeudumGameState(state.dehydrate()),
                MonkCoffer.id,
                state.guilds.monk.coffer,
                'monk',
                actor
            ),
            revealed: true,
            beadDraw: { high, low, ifLow: scoringPreview(state, actor, 'monk', 'push', ifLow) }
        }
    },

    /** R-4.6.5 The high bead is the best it can do. */
    bestCompletions(state) {
        const candidates = hiddenBeadCandidates(state)
        return candidates ? pushLevel(chickenBeadSum(state) + beadValue(candidates.high)) : 0
    }
}

export const MonkFunctions: Readonly<Record<GuildFunctionName, GuildFunctionRow>> = {
    trade: MonkTrade,
    pull: MonkPull,
    push: MonkPush
}
