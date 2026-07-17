import type { GameAction } from '@tabletop/common'
import {
    isPlaceBid,
    isPlaceField,
    isPlaceNeutralTile,
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
}

// A description is a sequence of plain-text fragments and player references — callers
// render text fragments as-is and player references as their colored PlayerName chip, so a
// mentioned player (e.g. in a bribe-acceptance payment breakdown) always gets the same
// treatment as the acting player, wherever the description is shown.
export type DescriptionPart = string | { playerId: string }

// Returns the description as separate segments/lines rather than one flattened string —
// callers that show a single inline line (History) join them with a dash separator;
// callers that show them stacked (the banner above the board) render one per line instead,
// per Justin's request not to run multi-part end-of-round summaries together with dashes.
export function getDescriptionSegments(action: GameAction, ctx?: ActionDescriptionContext): DescriptionPart[][] {
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
                return [[isFirst ? 'bid 0 and becomes overseer' : 'bid 0 escudos']]
            }
            return [['bid 0 and becomes overseer']]
        }
        return [[`bid ${amount} escudo${amount !== 1 ? 's' : ''}`]]
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
            if (bid?.amount === 0) return [['planted a field (−1 farmer penalty)']]
        }
        return [['planted a field']]
    }
    if (isPlaceNeutralTile(action)) {
        return [['planted the neutral field']]
    }
    if (isBuildCanal(action)) {
        return [['placed a personal canal']]
    }
    if (isProposeCanal(action)) {
        const a = action as any
        return [[`offered ${a.amount} escudo${a.amount !== 1 ? 's' : ''} for a canal`]]
    }
    if (isOverseerDecision(action)) {
        const a = action as any
        if (a.accepting) {
            if (ctx?.allActions) {
                const proposals = getProposalsForDecision(a, ctx.allActions)
                if (proposals.length > 0) {
                    // One segment per contributing player, rather than a single
                    // comma-joined line — stacked callers (the history-scrubber banner)
                    // then show each player's payment on its own line.
                    const segments: DescriptionPart[][] = [['accepted a canal bribe']]
                    for (const p of proposals) {
                        segments.push([{ playerId: p.playerId! }, ` paid ${p.amount}`])
                    }
                    return segments
                }
            }
            return [['accepted a canal bribe']]
        } else {
            if (ctx?.allActions) {
                const anyProposals = getAllProposalsThisRound(a, ctx.allActions)
                if (anyProposals.length === 0) return [['was offered no bribes and built a canal']]
            }
            return [['rejected all bribes and built a canal']]
        }
    }
    if (isPass(action)) {
        if (ctx?.allActions) {
            const phase = getPassPhase(action, ctx.allActions)
            if (phase === 'extraIrrigation') return [['chose not to place a personal canal']]
            if (phase === 'canalBuilding') return [['chose not to bribe the overseer']]
        }
        return [['passed']]
    }
    if (isEndRoundEvent(action)) {
        const e = action as any
        const segments: DescriptionPart[][] = [[`End of round ${e.round}`]]
        if (e.escudosEarned > 0) {
            segments.push([`everyone collected ${e.escudosEarned} escudos`])
        }
        if (e.driedSquares?.length > 0) {
            const fieldList = e.driedSquares.map((s: any) => s.crop).join(', ')
            segments.push([`drought: ${fieldList} dried out`])
        }
        if (e.farmerLosses?.length > 0) {
            const cropsByPlayer = new Map<string, string[]>()
            for (const loss of e.farmerLosses) {
                if (!cropsByPlayer.has(loss.playerId)) cropsByPlayer.set(loss.playerId, [])
                cropsByPlayer.get(loss.playerId)!.push(loss.crop)
            }
            // One segment per affected player, same as the bribe-acceptance breakdown
            // above — stacked callers then show each player's loss on its own line.
            for (const [playerId, crops] of cropsByPlayer) {
                segments.push([{ playerId }, ` lost a farmer (${crops.join(', ')})`])
            }
        }
        return segments
    }
    return [[action.type]]
}

// Flattened, single-line form — segments joined with a dash separator — for callers that
// render one inline line (History.svelte).
export function getDescriptionForAction(action: GameAction, ctx?: ActionDescriptionContext): DescriptionPart[] {
    const segments = getDescriptionSegments(action, ctx)
    const result: DescriptionPart[] = []
    segments.forEach((seg, i) => {
        if (i > 0) result.push(' — ')
        result.push(...seg)
    })
    return result
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

function getAllProposalsThisRound(decision: any, allActions: GameAction[]): ProposeCanal[] {
    const decisionTime = decision.createdAt?.getTime() ?? 0

    // Only look at proposals from the same canal-building phase (after the last round end)
    const lastRoundEndTime = allActions
        .filter(a => isEndRoundEvent(a))
        .map(a => a.createdAt?.getTime() ?? 0)
        .filter(t => t < decisionTime)
        .reduce((max, t) => Math.max(max, t), 0)

    return allActions.filter(a =>
        isProposeCanal(a) &&
        (a.createdAt?.getTime() ?? 0) > lastRoundEndTime &&
        (a.createdAt?.getTime() ?? 0) < decisionTime
    ) as ProposeCanal[]
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
