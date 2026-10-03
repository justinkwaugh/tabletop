import { ActionSource, type GameAction } from '@tabletop/common'
import {
    auctioneerOf,
    getShop,
    isCompleteAntiqueSet,
    isMoveVisitors,
    isResolveAuction,
    paidAntiqueCount,
    type AntiqueSetResult,
    type AuctionResult,
    type MarketColor,
    type MoveResult
} from '@tabletop/marracash'

type PaymentBase = { playerId: string; amount: number }

export type Payment =
    | (PaymentBase & { kind: 'winningBid' })
    | (PaymentBase & { kind: 'auctioneerCut' })
    | (PaymentBase & {
          kind: 'customers'
          color: MarketColor
          count: number
          walkedIn?: boolean
      })
    | (PaymentBase & { kind: 'moverCut'; toPlayerId: string })
    | (PaymentBase & { kind: 'antiqueSet'; cardCount: number })

export type MoneyReport =
    | { kind: 'auction'; result: AuctionResult; payments: Payment[] }
    | {
          kind: 'move'
          moverId: string
          result: MoveResult
          payments: Payment[]
      }
    | { kind: 'antiqueSet'; collectorId: string; result: AntiqueSetResult; payments: Payment[] }

export function latestTurnStep(actions: readonly GameAction[]): readonly GameAction[] {
    const start = actions.findLastIndex((action) => action.source === ActionSource.User)
    return start === -1 ? [] : actions.slice(start)
}

export function auctionPayments(result: AuctionResult): Payment[] {
    const winnerId = result.winnerId
    const payments: Payment[] = [{ kind: 'winningBid', playerId: winnerId, amount: -result.price }]
    const color = getShop(result.shopId).color
    const walkIns = pulledInCustomers(result)
    if (walkIns.count > 0) {
        payments.push({
            kind: 'customers',
            playerId: winnerId,
            amount: walkIns.income,
            color,
            count: walkIns.count,
            walkedIn: true
        })
    }
    if (result.auctioneerCut > 0) {
        payments.push({
            kind: 'auctioneerCut',
            playerId: auctioneerOf(result),
            amount: result.auctioneerCut
        })
    }
    return payments
}

export function pulledInCustomers(result: AuctionResult): { count: number; income: number } {
    return result.pullIns.reduce(
        (total, pullIn) => ({
            count: total.count + pullIn.customers,
            income: total.income + pullIn.income
        }),
        { count: 0, income: 0 }
    )
}

export function movedVisitors(result: MoveResult): string {
    const count =
        result.arrivals.length + result.entries.reduce((total, entry) => total + entry.customers, 0)
    return `${count} visitor${count === 1 ? '' : 's'}`
}

export function movePayments(moverId: string, result: MoveResult): Payment[] {
    return result.entries.flatMap((entry): Payment[] => {
        const customers: Payment = {
            kind: 'customers',
            playerId: entry.ownerId,
            amount: entry.income,
            color: getShop(entry.shopId).color,
            count: entry.customers
        }
        return entry.moverCut > 0
            ? [
                  customers,
                  {
                      kind: 'moverCut',
                      playerId: entry.ownerId,
                      amount: -entry.moverCut,
                      toPlayerId: moverId
                  }
              ]
            : [customers]
    })
}

export function antiqueSetPayments(collectorId: string, result: AntiqueSetResult): Payment[] {
    return [
        {
            kind: 'antiqueSet',
            playerId: collectorId,
            amount: result.payout,
            cardCount: paidAntiqueCount(result.rank)
        }
    ]
}

function moneyReport(action: GameAction): MoneyReport | undefined {
    if (isResolveAuction(action) && action.metadata) {
        return {
            kind: 'auction',
            result: action.metadata,
            payments: auctionPayments(action.metadata)
        }
    }
    if (isMoveVisitors(action) && action.metadata) {
        return {
            kind: 'move',
            moverId: action.playerId,
            result: action.metadata,
            payments: movePayments(action.playerId, action.metadata)
        }
    }
    if (isCompleteAntiqueSet(action) && action.metadata) {
        return {
            kind: 'antiqueSet',
            collectorId: action.collectorId,
            result: action.metadata,
            payments: antiqueSetPayments(action.collectorId, action.metadata)
        }
    }
    return undefined
}

export function moneyReports(actions: readonly GameAction[]): MoneyReport[] {
    return actions
        .map(moneyReport)
        .filter(
            (report): report is MoneyReport => report !== undefined && report.payments.length > 0
        )
}
