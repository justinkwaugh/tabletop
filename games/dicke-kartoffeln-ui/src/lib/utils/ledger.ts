import type { GameAction, Round } from '@tabletop/common'
import {
    MarketId,
    PlanKind,
    isCalculateMarket,
    isHarvest,
    isReadMessage,
    isRevealPlans,
    isSellPotatoes,
    type Variety
} from '@tabletop/dicke-kartoffeln'

export type SheetField = {
    variety?: Variety
    fertilized: boolean
    washedOut: boolean
    sprayed: boolean
    harvest?: { chart: number; adjustment: number; sacks: number }
    sale?: { norm: number; bio: number }
}

export type SheetMarket = { price?: number; sacks: number }

export type SheetYear = {
    year: number
    fields: Record<number, SheetField>
    markets: Record<MarketId, SheetMarket>
    income?: number
    prize: number
}

export const FIELD_IDS = [1, 2, 3, 4, 5] as const

function emptyYear(year: number): SheetYear {
    return {
        year,
        fields: Object.fromEntries(
            FIELD_IDS.map((fieldId) => [
                fieldId,
                { fertilized: false, washedOut: false, sprayed: false }
            ])
        ),
        markets: {
            [MarketId.AmalieNorm]: { sacks: 0 },
            [MarketId.AmalieBio]: { sacks: 0 },
            [MarketId.BiolaNorm]: { sacks: 0 },
            [MarketId.BiolaBio]: { sacks: 0 },
            [MarketId.ChrisNorm]: { sacks: 0 },
            [MarketId.ChrisBio]: { sacks: 0 }
        },
        prize: 0
    }
}

export function yearOf(index: number | undefined, years: readonly Round[]): number | undefined {
    if (index === undefined) return undefined
    return years.find(
        (round) => round.start <= index && (round.end === undefined || index < round.end)
    )?.number
}

// One farmer's "Ertragsformular", written from the public record of each year: what was sown and
// fertilized, the harvest, the offers, the prices and the takings.
export function yieldSheet(
    actions: readonly GameAction[],
    years: readonly Round[],
    playerId: string
): SheetYear[] {
    const sheet = new Map<number, SheetYear>()
    const row = (year: number) => {
        const existing = sheet.get(year)
        if (existing) return existing
        const created = emptyYear(year)
        sheet.set(year, created)
        return created
    }
    for (const action of actions) {
        const year = yearOf(action.index, years)
        if (year === undefined) continue
        if (isRevealPlans(action)) {
            const outcome = action.metadata?.outcomes.find((entry) => entry.playerId === playerId)
            const plan = outcome?.plan
            if (!plan) continue
            const fields = row(year).fields
            switch (plan.kind) {
                case PlanKind.Sow:
                    for (const seed of plan.seeds) fields[seed.fieldId].variety = seed.variety
                    break
                case PlanKind.Fertilize:
                    for (const fieldId of plan.fieldIds) fields[fieldId].fertilized = true
                    break
                case PlanKind.Spray:
                    for (const fieldId of plan.fieldIds) fields[fieldId].sprayed = true
                    break
                case PlanKind.RegisterSales:
                    for (const sale of plan.sales) {
                        fields[sale.fieldId].sale = { norm: sale.norm, bio: sale.bio }
                    }
                    break
            }
        } else if (isReadMessage(action)) {
            const washed = action.metadata?.washedOut.find((entry) => entry.playerId === playerId)
            for (const fieldId of washed?.fieldIds ?? []) row(year).fields[fieldId].washedOut = true
        } else if (isHarvest(action)) {
            const farm = action.metadata?.farms.find((entry) => entry.playerId === playerId)
            for (const harvest of farm?.fields ?? []) {
                row(year).fields[harvest.fieldId].harvest = {
                    chart: harvest.chart,
                    adjustment: harvest.adjustment,
                    sacks: harvest.sacks
                }
            }
        } else if (isCalculateMarket(action)) {
            for (const move of action.metadata?.moves ?? []) {
                row(year).markets[move.marketId].price = move.priceAfter
            }
        } else if (isSellPotatoes(action)) {
            const entry = row(year)
            const farm = action.metadata?.farms.find((candidate) => candidate.playerId === playerId)
            for (const sale of farm?.sales ?? []) entry.markets[sale.marketId].sacks = sale.sacks
            entry.income = farm?.income ?? 0
            entry.prize = (action.metadata?.contests ?? [])
                .filter((contest) => contest.winnerIds.includes(playerId))
                .reduce((sum, contest) => sum + contest.prize, 0)
        }
    }
    return [...sheet.values()].toSorted((a, b) => a.year - b.year)
}

export function marketTotal(market: SheetMarket): number | undefined {
    return market.price !== undefined && market.sacks > 0 ? market.price * market.sacks : undefined
}

export function sownVarieties(entry: SheetYear | undefined): Variety[] {
    return Object.values(entry?.fields ?? {}).flatMap((field) =>
        field.variety ? [field.variety] : []
    )
}
