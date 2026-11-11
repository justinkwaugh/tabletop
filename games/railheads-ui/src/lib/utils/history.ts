import { isCallGameAction, type GameAction } from '@tabletop/common'
import {
    isChooseAction,
    isConsolidate,
    isEndRound,
    isLayTrack,
    isResolveIndustryAuction,
    isScoreGame,
    type ActionSpaceId,
    type CompanyId
} from '@tabletop/railheads'
import {
    actionSale,
    bidReveals,
    describeAction,
    saleDescription,
    trackLines,
    withdrawnBidders,
    type BidReveal,
    type Description
} from './describeAction.js'

export type HistoryTurn = {
    kind: 'turn'
    key: string
    playerId: string
    space: ActionSpaceId | undefined
    actions: GameAction[]
}

export type HistoryOffering = {
    kind: 'offering'
    key: string
    companyId?: CompanyId
    actions: GameAction[]
}

export type HistoryPayout = {
    kind: 'payout'
    key: string
    action: GameAction
}

export type HistoryCall = {
    kind: 'call'
    key: string
    action: GameAction
}

export type HistoryEntry = HistoryTurn | HistoryOffering | HistoryPayout | HistoryCall

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    let open: HistoryTurn | HistoryOffering | undefined
    let turnsStarted = false
    for (const action of actions) {
        if (isEndRound(action) || isScoreGame(action)) {
            entries.push({ kind: 'payout', key: action.id, action })
            open = undefined
            continue
        }
        if (isCallGameAction(action)) {
            entries.push({ kind: 'call', key: action.id, action })
            open = undefined
            continue
        }
        if ((isChooseAction(action) || isConsolidate(action)) && action.playerId) {
            turnsStarted = true
            open = {
                kind: 'turn',
                key: action.id,
                playerId: action.playerId,
                space: isChooseAction(action) ? action.space : undefined,
                actions: [action]
            }
            entries.push(open)
            continue
        }
        if (!open && !turnsStarted) {
            open = { kind: 'offering', key: action.id, actions: [] }
            entries.push(open)
        }
        if (!open) {
            continue
        }
        open.actions.push(action)
        if (open.kind === 'offering') {
            const sale = actionSale(action)
            if (sale) {
                open.companyId = sale.companyId
                open = undefined
            }
        }
    }
    return entries
}

export function entryActions(entry: HistoryEntry): GameAction[] {
    return entry.kind === 'payout' || entry.kind === 'call' ? [entry.action] : entry.actions
}

export type HistoryLineTone = 'plain' | 'result' | 'aside'

export type HistoryLine =
    | {
          kind: 'line'
          key: string
          playerId: string | undefined
          description: Description
          tone: HistoryLineTone
      }
    | { kind: 'bids'; key: string; bids: BidReveal[] }

function entryDetailActions(entry: HistoryTurn | HistoryOffering): GameAction[] {
    return entry.kind === 'turn' ? entry.actions.slice(1) : entry.actions
}

// Newest first, matching the order of the entries themselves.
export function historyLines(entry: HistoryTurn | HistoryOffering): HistoryLine[] {
    return entryDetailActions(entry).toReversed().flatMap(actionLines)
}

function actionLines(action: GameAction): HistoryLine[] {
    const sale = actionSale(action)
    const bids = bidReveals(action).toSorted((a, b) => b.amount - a.amount)
    const lines: HistoryLine[] = []
    if (sale) {
        lines.push(lineFrom(`${action.id}-sale`, undefined, saleDescription(sale), 'result'))
    }
    for (const playerId of withdrawnBidders(action)) {
        lines.push(
            lineFrom(
                `${action.id}-withdrawn-${playerId}`,
                playerId,
                ['cannot afford to bid on'],
                'aside'
            )
        )
    }
    const tone = isResolveIndustryAuction(action) ? 'result' : 'plain'
    actionDescriptions(action).forEach((description, index) => {
        const playerId = index === 0 ? action.playerId : undefined
        lines.push(lineFrom(`${action.id}-${index}`, playerId, description, tone))
    })
    if (bids.length > 0) {
        lines.push({ kind: 'bids', key: `${action.id}-bids`, bids })
    }
    return lines
}

function actionDescriptions(action: GameAction): Description[] {
    const effects = isLayTrack(action) ? (action.metadata?.effects ?? []) : []
    return effects.length > 0 ? trackLines(effects) : [describeAction(action)]
}

function lineFrom(
    key: string,
    playerId: string | undefined,
    description: Description,
    tone: HistoryLineTone
): HistoryLine {
    const [first, ...rest] = description
    if (!playerId && first !== undefined && typeof first !== 'string' && 'playerId' in first) {
        return { kind: 'line', key, playerId: first.playerId, description: rest, tone }
    }
    return { kind: 'line', key, playerId, description, tone }
}
