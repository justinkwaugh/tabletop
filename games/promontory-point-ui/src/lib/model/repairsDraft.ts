import {
    RAILROAD_IDS,
    SHARES_PER_RAILROAD,
    distressSaleProceeds,
    raisedBy,
    saleListRefusal,
    settleRepairs,
    sharePriceAt,
    soldCount,
    type PromontoryPointProjectedPlayerState,
    type PromontoryPointProjectedState,
    type RailroadId
} from '@tabletop/promontory-point'
import {
    getStagedSelectionEntry,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionSource,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import { RAILROAD_TAGS } from './railroadTags.js'

// A tap list: one stage per staged sale, in the order pressed.
type SaleStage = `sale.${number}`

export type RepairsDraftValues = Record<SaleStage, RailroadId>

export type RepairsDraft = StagedSelectionState<RepairsDraftValues>

const MOST_SHARES_HELD = RAILROAD_IDS.length * SHARES_PER_RAILROAD

const STAGE_ORDER: readonly SaleStage[] = Array.from({ length: MOST_SHARES_HELD }, (_, index) =>
    saleStage(index)
)

function saleStage(index: number): SaleStage {
    return `sale.${index}`
}

export function emptyRepairsDraft(): RepairsDraft {
    return {}
}

export function stagedSales(draft: RepairsDraft): RailroadId[] {
    const sales: RailroadId[] = []
    for (const stage of STAGE_ORDER) {
        const entry = getStagedSelectionEntry<RepairsDraftValues, SaleStage>(draft, stage)
        if (entry === undefined) {
            break
        }
        sales.push(entry.value)
    }
    return sales
}

// R-4.3, R-4.3-H2: a Sell one press stages one more share after those already staged.
export function stageSale(draft: RepairsDraft, railroadId: RailroadId): RepairsDraft {
    return setSale(draft, stagedSales(draft).length, railroadId, 'manual')
}

// R-4.3-H3: one press stages every share; Undo pops the press as one stage.
export function stageEverySale(sales: readonly RailroadId[]): RepairsDraft {
    return sales.reduce<RepairsDraft>(
        (draft, railroadId, index) =>
            setSale(draft, index, railroadId, index === 0 ? 'manual' : 'auto'),
        emptyRepairsDraft()
    )
}

export function hasManualRepairsDraft(draft: RepairsDraft): boolean {
    return hasManualStagedSelection<RepairsDraftValues>(draft, STAGE_ORDER)
}

export function popRepairsDraft(draft: RepairsDraft): RepairsDraft {
    return popHighestManualStagedSelection<RepairsDraftValues>(draft, STAGE_ORDER).nextState
}

function setSale(
    draft: RepairsDraft,
    index: number,
    railroadId: RailroadId,
    source: StagedSelectionSource
): RepairsDraft {
    return setStagedSelectionValue<RepairsDraftValues, SaleStage>(
        draft,
        STAGE_ORDER,
        saleStage(index),
        railroadId,
        source
    )
}

export type RepairsSaleEntry = {
    railroadId: RailroadId
    held: number
    staged: number
    price: number
    proceedsEach: number
    locked: boolean
}

export type RepairsSend = {
    sales: RailroadId[]
    paid: number
    forgiven: number
    ready: boolean
    label: string
}

export type RepairsDraftView = {
    railroadId: RailroadId
    owed: number
    money: number
    holdsBilledRailroad: boolean
    shortAfterEverySale: boolean
    entries: RepairsSaleEntry[]
    runningLine: string
    send: RepairsSend
}

export type RepairsDecision = {
    railroadId: RailroadId
    owed: number
    holdings: Pick<PromontoryPointProjectedPlayerState, 'money' | 'shares'>
    priceIndex: PromontoryPointProjectedState['priceIndex']
}

// R-4.3, R-4.3-H1 to H3: the deciding debtor's panel model, from the staged sales and the state.
export function repairsDraftView(
    decision: RepairsDecision,
    staged: RailroadId[]
): RepairsDraftView {
    const { railroadId, owed, holdings, priceIndex } = decision
    const everySale = everyShareHeld(holdings.shares)
    const shortAfterEverySale = holdings.money + raisedBy(everySale, priceIndex) < owed
    const { raised, paid, forgiven } = settleRepairs(holdings, owed, priceIndex, staged)
    const enough = holdings.money + raised >= owed
    const entries = RAILROAD_IDS.filter((held) => holdings.shares[held] > 0).map((held) => {
        const stagedCount = soldCount(staged, held)
        return {
            railroadId: held,
            held: holdings.shares[held],
            staged: stagedCount,
            price: sharePriceAt(priceIndex[held]),
            proceedsEach: distressSaleProceeds(priceIndex, held),
            locked: enough || stagedCount >= holdings.shares[held]
        }
    })
    const ready = saleListRefusal(holdings, owed, priceIndex, staged) === undefined
    return {
        railroadId,
        owed,
        money: holdings.money,
        holdsBilledRailroad: holdings.shares[railroadId] > 0,
        shortAfterEverySale,
        entries,
        runningLine: runningLine(holdings.money, staged.length, raised, owed, forgiven, ready),
        send: {
            sales: staged,
            paid,
            forgiven,
            ready,
            label: ready ? sendLabel(staged, paid, forgiven) : `Pay $${owed}`
        }
    }
}

// R-4.3-H3: every share held, the pressed railroad first.
export function everySaleStartingWith(
    shares: PromontoryPointProjectedPlayerState['shares'],
    first: RailroadId
): RailroadId[] {
    return [first, ...RAILROAD_IDS.filter((railroadId) => railroadId !== first)].flatMap(
        (railroadId) => Array.from({ length: shares[railroadId] }, () => railroadId)
    )
}

function everyShareHeld(shares: PromontoryPointProjectedPlayerState['shares']): RailroadId[] {
    return everySaleStartingWith(shares, RAILROAD_IDS[0])
}

function runningLine(
    money: number,
    saleCount: number,
    raised: number,
    owed: number,
    forgiven: number,
    ready: boolean
): string {
    const have =
        saleCount === 0
            ? `Have $${money}`
            : `Have $${money} + ${saleCount === 1 ? 'sale' : 'sales'} $${raised} = $${money + raised}`
    const outcome =
        forgiven === 0 ? 'enough' : ready ? `$${forgiven} forgiven` : `short $${forgiven}`
    return `${have} of $${owed} · ${outcome}`
}

function sendLabel(sales: RailroadId[], paid: number, forgiven: number): string {
    if (forgiven > 0) {
        return sales.length === 0
            ? `Pay $${paid} · $${forgiven} forgiven`
            : `Sell all ${sales.length} · pay $${paid} · $${forgiven} forgiven`
    }
    const railroads = new Set(sales)
    const [only] = railroads
    const shares = sales.length === 1 ? 'share' : 'shares'
    const what =
        railroads.size === 1 && only !== undefined ? `${RAILROAD_TAGS[only]} ${shares}` : shares
    return `Sell ${sales.length} ${what} · pay $${paid}`
}
