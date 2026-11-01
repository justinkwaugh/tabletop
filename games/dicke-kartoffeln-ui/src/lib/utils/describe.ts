import type { GameAction } from '@tabletop/common'
import {
    BANK_WORM_PRICE,
    ContestAward,
    LOAN_AMOUNT,
    PlanKind,
    isCalculateMarket,
    isEndYear,
    isGrowSunflowers,
    isHarvest,
    isMoveCompost,
    isReactSoil,
    isReadMessage,
    isScoreGame,
    isSellPotatoes,
    demandRange,
    type LoanSettlement,
    type MarketBoardId,
    type PlanOutcome,
    type SoilChange
} from '@tabletop/dicke-kartoffeln'
import { demandText, fieldList, marketName, marks, plural } from './format.js'
import { MESSAGE_TEXT } from './messageText.js'

export type DescriptionSegment = string | { playerId: string }
export type Description = DescriptionSegment[]

function sum(values: readonly number[]): number {
    return values.reduce((total, value) => total + value, 0)
}

function money(outcome: PlanOutcome): string {
    const parts = []
    if (outcome.cost > 0) parts.push(`paid ${marks(outcome.cost)}`)
    if (outcome.income > 0) parts.push(`received ${marks(outcome.income)}`)
    if (outcome.loansTaken > 0) parts.push(`borrowed ${marks(outcome.loansTaken * LOAN_AMOUNT)}`)
    return parts.length > 0 ? ` (${parts.join(', ')})` : ''
}

function planText(outcome: PlanOutcome): string {
    const plan = outcome.plan
    switch (plan.kind) {
        case PlanKind.TakeCompost:
            return plan.takes.length === 0
                ? 'took no compost'
                : `moved ${plural(sum(plan.takes.map((take) => take.worms)), 'worm')} from ${fieldList(plan.takes.map((take) => take.fieldId))} to compost pile 1`
        case PlanKind.Cultivate:
            return plan.fieldIds.length === 0
                ? 'ploughed nothing'
                : `ploughed ${fieldList(plan.fieldIds)}`
        case PlanKind.Sow:
            return plan.seeds.length === 0
                ? 'sowed nothing'
                : `sowed ${plan.seeds.map((seed) => `${seed.variety} on field ${seed.fieldId}`).join(', ')}`
        case PlanKind.Fertilize:
            return plan.fieldIds.length === 0
                ? 'used no fertilizer'
                : `fertilized ${fieldList(plan.fieldIds)}`
        case PlanKind.Spray:
            return plan.fieldIds.length === 0
                ? 'sprayed nothing'
                : `sprayed poison on ${fieldList(plan.fieldIds)}`
        case PlanKind.RegisterSales: {
            if (plan.sales.length === 0) return 'offered nothing'
            const norm = sum(plan.sales.map((sale) => sale.norm))
            const bio = sum(plan.sales.map((sale) => sale.bio))
            const offered = [norm > 0 ? `${norm} Norm` : '', bio > 0 ? `${bio} Bio` : '']
                .filter((part) => part)
                .join(' and ')
            return `offered ${offered} ${norm + bio === 1 ? 'sack' : 'sacks'} from ${fieldList(plan.sales.map((sale) => sale.fieldId))}`
        }
        case PlanKind.SpreadCompost:
            return compostParts(outcome).join(' and ') || 'used no compost'
    }
}

export function compostParts(outcome: PlanOutcome): string[] {
    const plan = outcome.plan
    if (plan.kind !== PlanKind.SpreadCompost) return []
    const spread = sum(plan.placements.map((placement) => placement.worms))
    return [
        spread > 0
            ? `spread ${plural(spread, 'worm')} on ${fieldList(plan.placements.map((placement) => placement.fieldId))}`
            : '',
        outcome.income > 0
            ? `sold ${plural(outcome.income / BANK_WORM_PRICE, 'worm')} to the bank`
            : ''
    ].filter((part) => part)
}

export function soilParts(changes: readonly SoilChange[]): string[] {
    const lost = sum(changes.map((change) => Math.max(0, change.wormsBefore - change.wormsAfter)))
    const bred = sum(changes.map((change) => Math.max(0, change.wormsAfter - change.wormsBefore)))
    const skulls = changes.filter((change) => change.skullAfter && !change.skullBefore).length
    const healed = changes.filter((change) => change.skullBefore && !change.skullAfter).length
    return [
        lost > 0 ? `lost ${plural(lost, 'worm')}` : '',
        bred > 0 ? `bred ${plural(bred, 'worm')} on fallow land` : '',
        skulls > 0 ? `gained ${plural(skulls, 'skull')}` : '',
        healed > 0 ? `healed ${plural(healed, 'field')}` : ''
    ].filter((part) => part)
}

export function settlementParts(settlement: LoanSettlement): string[] {
    return [
        settlement.repaid > 0 ? `repaid ${marks(settlement.repaid * LOAN_AMOUNT)}` : '',
        settlement.interest > 0 ? `paid ${marks(settlement.interest)} interest` : '',
        settlement.loansTaken > 0
            ? `borrowed ${marks(settlement.loansTaken * LOAN_AMOUNT)} to pay it`
            : ''
    ].filter((part) => part)
}

// A line on the history receipt: what was done, and what it earned (+) or cost (−) on balance.
export type ReceiptLine = { description: Description; amount?: number }

export function outcomeReceipt(outcome: PlanOutcome): ReceiptLine {
    const loan =
        outcome.loansTaken > 0 ? `, borrowing ${marks(outcome.loansTaken * LOAN_AMOUNT)}` : ''
    const net = outcome.income - outcome.cost
    return {
        description: [{ playerId: outcome.playerId }, `${planText(outcome)}${loan}`],
        amount: net === 0 ? undefined : net
    }
}

export function describeOutcome(outcome: PlanOutcome): Description {
    return [{ playerId: outcome.playerId }, `${planText(outcome)}${money(outcome)}`]
}

export function describeSystemAction(action: GameAction, board: MarketBoardId): Description[] {
    if (isGrowSunflowers(action)) {
        return (action.metadata?.farms ?? []).flatMap((farm) => {
            const grown = sum(
                farm.changes.map((change) => Math.max(0, change.after - change.before))
            )
            const lost = sum(
                farm.changes.map((change) => Math.max(0, change.before - change.after))
            )
            if (grown + lost === 0) return []
            const parts = [
                grown > 0 ? `grew ${plural(grown, 'sunflower')}` : '',
                lost > 0 ? `lost ${plural(lost, 'sunflower')}` : ''
            ].filter((part) => part)
            return [[{ playerId: farm.playerId }, parts.join(' and ')]]
        })
    }
    if (isReadMessage(action)) {
        const metadata = action.metadata
        if (!metadata) return []
        const lines: Description[] = [
            [`The die shows ${metadata.roll}: “${MESSAGE_TEXT[metadata.messageId].headline}”`]
        ]
        for (const setAside of metadata.setAside) {
            lines.push([
                `“${MESSAGE_TEXT[setAside].headline}” cannot be played this year and is set aside`
            ])
        }
        for (const farm of metadata.washedOut) {
            lines.push([
                { playerId: farm.playerId },
                `lost fertilizer on ${fieldList(farm.fieldIds)}`
            ])
        }
        for (const payment of metadata.irrigation) {
            lines.push([
                { playerId: payment.playerId },
                `paid ${marks(payment.paid)} for watering${payment.loansTaken > 0 ? `, borrowing ${marks(payment.loansTaken * LOAN_AMOUNT)}` : ''}`
            ])
        }
        if (metadata.contest) {
            lines.push([
                `The ${metadata.contest.award === ContestAward.MostSacks ? 'agriculture' : 'environment'} prize goes to next year's best ${metadata.contest.award === ContestAward.MostSacks ? '' : 'organic '}seller`
            ])
        }
        return lines
    }
    if (isHarvest(action)) {
        return (action.metadata?.farms ?? [])
            .filter((farm) => farm.fields.length > 0)
            .map((farm) => [
                { playerId: farm.playerId },
                `harvested ${plural(sum(farm.fields.map((field) => field.sacks)), 'sack')}`
            ])
    }
    if (isCalculateMarket(action)) {
        return (action.metadata?.moves ?? [])
            .filter((move) => move.offered > 0 || move.priceBefore !== move.priceAfter)
            .map((move) => [
                `${marketName(move.marketId)}: ${move.offered} offered, demand ${demandText(demandRange(board, move.demandAfter))}, price ${move.priceBefore}${move.priceAfter === move.priceBefore ? ' holds' : ` → ${move.priceAfter}`}`
            ])
    }
    if (isSellPotatoes(action)) {
        const lines: Description[] = (action.metadata?.farms ?? [])
            .filter((farm) => farm.sales.length > 0)
            .map((farm) => [
                { playerId: farm.playerId },
                `sold ${plural(sum(farm.sales.map((sale) => sale.sacks)), 'sack')} for ${marks(farm.income)}`
            ])
        for (const contest of action.metadata?.contests ?? []) {
            const prize = contest.award === ContestAward.MostSacks ? 'agriculture' : 'environment'
            if (contest.winnerIds.length === 0) {
                lines.push([`Nobody wins the ${prize} prize`])
            }
            for (const winnerId of contest.winnerIds) {
                lines.push([
                    { playerId: winnerId },
                    `won ${marks(contest.prize)} from the ${prize} prize`
                ])
            }
        }
        return lines
    }
    if (isReactSoil(action)) {
        return (action.metadata?.farms ?? []).flatMap((farm) => {
            const parts = soilParts(farm.changes)
            return parts.length > 0 ? [[{ playerId: farm.playerId }, parts.join(', ')]] : []
        })
    }
    if (isMoveCompost(action)) {
        return (action.metadata?.moves ?? []).map((move) => [
            { playerId: move.playerId },
            `compost of ${plural(move.worms, 'worm')} doubles to ${move.ripened} on pile 2`
        ])
    }
    if (isEndYear(action)) {
        return (action.metadata?.settlements ?? []).map((settlement) => [
            { playerId: settlement.playerId },
            settlementParts(settlement).join(', ')
        ])
    }
    if (isScoreGame(action)) {
        return (action.metadata?.standings ?? []).map((standing) => [
            { playerId: standing.playerId },
            `economy ${standing.economy} (${standing.economyPoints} pts), ecology ${standing.ecology} (${standing.ecologyPoints} pts): ${plural(standing.points, 'point')}`
        ])
    }
    return []
}
