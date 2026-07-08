import type { GameAction } from '@tabletop/common'
import {
    isPlaceBid,
    isPlaceField,
    isBuildCanal,
    isPass,
    isProposeCanal,
    isOverseerDecision,
    isEndRoundEvent,
    isSameSegment
} from '@tabletop/santiago'
import type { ProposeCanal } from '@tabletop/santiago'

export type ActionDescriptionContext = {
    allActions?: GameAction[]
    playerName?: (id: string) => string
}

export function getDescriptionForAction(action: GameAction, ctx?: ActionDescriptionContext): string {
    if (isPlaceBid(action)) {
        const amount = (action as any).amount ?? 0
        if (amount === 0) {
            if (ctx?.allActions) {
                const actionTime = (action as any).createdAt?.getTime() ?? 0
                const lastRoundEndTime = ctx.allActions
                    .filter(a => isEndRoundEvent(a))
                    .map(a => a.createdAt?.getTime() ?? 0)
                    .filter(t => t < actionTime)
                    .reduce((max, t) => Math.max(max, t), 0)
                const isFirst = !ctx.allActions.some(a =>
                    isPlaceBid(a) &&
                    (a as any).amount === 0 &&
                    (a as any).createdAt?.getTime() > lastRoundEndTime &&
                    (a as any).createdAt?.getTime() < actionTime
                )
                return isFirst ? 'bid 0 and becomes overseer' : 'bid 0 escudos'
            }
            return 'bid 0 and becomes overseer'
        }
        return `bid ${amount} escudo${amount !== 1 ? 's' : ''}`
    }
    if (isPlaceField(action)) {
        if (ctx?.allActions && action.playerId) {
            const placeTime = (action as any).createdAt?.getTime() ?? 0
            const lastRoundEndTime = ctx.allActions
                .filter(a => isEndRoundEvent(a))
                .map(a => a.createdAt?.getTime() ?? 0)
                .filter(t => t < placeTime)
                .reduce((max, t) => Math.max(max, t), 0)
            const bid = ctx.allActions.find(a =>
                isPlaceBid(a) &&
                a.playerId === action.playerId &&
                ((a as any).createdAt?.getTime() ?? 0) > lastRoundEndTime &&
                ((a as any).createdAt?.getTime() ?? 0) < placeTime
            ) as any
            if (bid?.amount === 0) {
                // Only the first zero-bidder in this round is the overseer and gets the penalty
                const bidTime = (bid as any).createdAt?.getTime() ?? 0
                const isOverseer = !ctx.allActions.some(a =>
                    isPlaceBid(a) &&
                    a.playerId !== action.playerId &&
                    (a as any).amount === 0 &&
                    (a as any).createdAt?.getTime() > lastRoundEndTime &&
                    (a as any).createdAt?.getTime() < bidTime
                )
                if (isOverseer) return 'planted a field (−1 farmer penalty)'
            }
        }
        return 'planted a field'
    }
    if (isBuildCanal(action)) {
        return 'placed a personal canal'
    }
    if (isProposeCanal(action)) {
        const a = action as any
        return `offered ${a.amount} escudo${a.amount !== 1 ? 's' : ''} for a canal`
    }
    if (isOverseerDecision(action)) {
        const a = action as any
        if (a.accepting) {
            if (ctx?.allActions && ctx?.playerName) {
                const proposals = getProposalsForDecision(a, ctx.allActions)
                if (proposals.length > 0) {
                    const payments = proposals
                        .map(p => `${ctx.playerName!(p.playerId!)} paid ${p.amount}`)
                        .join(', ')
                    return `accepted a canal bribe — ${payments}`
                }
            }
            return 'accepted a canal bribe'
        } else {
            if (ctx?.allActions) {
                const proposals = getProposalsForDecision(a, ctx.allActions)
                if (proposals.length === 0) return 'was offered no bribes and built a canal'
            }
            return 'rejected all bribes and built a canal'
        }
    }
    if (isPass(action)) {
        if (ctx?.allActions) {
            const phase = getPassPhase(action, ctx.allActions)
            if (phase === 'extraIrrigation') return 'chose not to place a personal canal'
            if (phase === 'canalBuilding') return 'chose not to bribe the overseer'
        }
        return 'passed'
    }
    if (isEndRoundEvent(action)) {
        const e = action as any
        const parts: string[] = [`End of round ${e.round}`]
        if (e.escudosEarned > 0) {
            parts.push(`everyone collected ${e.escudosEarned} escudos`)
        }
        if (e.driedSquares?.length > 0) {
            const fieldList = e.driedSquares.map((s: any) => s.crop).join(', ')
            parts.push(`drought: ${fieldList} dried out`)
        }
        return parts.join(' — ')
    }
    return action.type
}

function getPassPhase(action: GameAction, allActions: GameAction[]): 'canalBuilding' | 'extraIrrigation' {
    const passTime = action.createdAt?.getTime() ?? 0
    const lastRoundEndTime = allActions
        .filter(a => isEndRoundEvent(a))
        .map(a => a.createdAt?.getTime() ?? 0)
        .filter(t => t < passTime)
        .reduce((max, t) => Math.max(max, t), 0)
    const overseerDecidedBeforePass = allActions.some(a =>
        isOverseerDecision(a) &&
        (a.createdAt?.getTime() ?? 0) > lastRoundEndTime &&
        (a.createdAt?.getTime() ?? 0) < passTime
    )
    return overseerDecidedBeforePass ? 'extraIrrigation' : 'canalBuilding'
}

function getProposalsForDecision(decision: any, allActions: GameAction[]): ProposeCanal[] {
    const decisionTime = decision.createdAt?.getTime() ?? 0

    // Only look at proposals from the same canal-building phase (after the last round end)
    const lastRoundEndTime = allActions
        .filter(a => isEndRoundEvent(a))
        .map(a => a.createdAt?.getTime() ?? 0)
        .filter(t => t < decisionTime)
        .reduce((max, t) => Math.max(max, t), 0)

    return allActions.filter(a =>
        isProposeCanal(a) &&
        isSameSegment((a as ProposeCanal).segment, decision.segment) &&
        (a.createdAt?.getTime() ?? 0) > lastRoundEndTime &&
        (a.createdAt?.getTime() ?? 0) < decisionTime
    ) as ProposeCanal[]
}
