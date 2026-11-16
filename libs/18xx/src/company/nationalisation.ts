import * as Type from 'typebox'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy, getCompany } from '../finance/finance.js'
import { shareholderPayout } from '../finance/shareholderPayout.js'
import { replaceStation } from '../map/station.js'
import { companyLoans, repayLoan, type LoanRules, type LoanState } from '../loans/loans.js'
import { StockMarketMove, removeStockMarker, type StockMarketChart } from '../stock/stockMarket.js'
import type { TrainState, TrainDestination } from '../trains/train.js'
import type { StationState } from '../map/station.js'
import { AssetTransfer, transferCompanyAssets } from './companyMerger.js'
import { CompanyClosure, closeShareCompany, type CompanyRestart } from './companyClosure.js'

const Id = Type.String({ minLength: 1 })

/** A station the national company placed in place of the nationalised company's. */
export const NationalisedStation = Type.Object(
    { stationId: Id, nationalStationId: Id },
    { additionalProperties: false }
)
export type NationalisedStation = Type.Static<typeof NationalisedStation>

export const Nationalisation = Type.Object(
    {
        companyId: Id,
        repayments: Type.Array(CashPayment),
        /** The loans still owed after repaying, which the bank writes off. */
        writtenOff: Type.Integer({ minimum: 0 }),
        marketMove: Type.Optional(StockMarketMove),
        /** What the bank pays for each share. */
        price: Type.Integer({ minimum: 0 }),
        payouts: Type.Array(CashPayment),
        assets: Type.Optional(AssetTransfer),
        stations: Type.Array(NationalisedStation),
        closure: CompanyClosure
    },
    { additionalProperties: false }
)
export type Nationalisation = Type.Static<typeof Nationalisation>

type NationalisationState = LoanState & StationState & TrainState

/**
 * How a title's state buys a company out: its shareholders are paid a price that falls for the
 * loans it leaves unpaid, and its assets go to the national company or the bank, as in 1867 and
 * 1861 (§11).
 */
export interface NationalisationRules {
    market: StockMarketChart
    loans: LoanRules
    /** How many spaces the price falls for each loan left after repaying all the company can. */
    stepsPerLoan: number
    /** The market move each of those spaces is; left unless given. */
    direction?: string
    /**
     * What a share pays where the price could not fall all the spaces it should, from the price
     * it reached; the price itself unless given, as 1861's no-price-floor option takes R5 a share
     * off for each space below R35 (GTG §14).
     */
    payoutBelowFloor?(state: NationalisationState, price: number, missedSpaces: number): number
    /** The company that receives the cash, trains and privates; the bank where there is none. */
    nationalId?: string
    /** Where trains go where no national company takes them. */
    trainDestination: TrainDestination
    /** The national stations to place in place of the company's, the station each replaces. */
    nationalStations?(state: NationalisationState, companyId: string): NationalisedStation[]
    /** The company's restart, where it can be started again rather than closing. */
    restart(state: NationalisationState, companyId: string): CompanyRestart | undefined
}

export function nationaliseCompany(
    state: NationalisationState,
    rules: NationalisationRules,
    companyId: string
): Nationalisation {
    const company = { kind: 'company' as const, companyId }
    const repayments: CashPayment[] = []
    while (companyLoans(state, companyId) && finiteCashOwnedBy(state, company) >= rules.loans.value)
        repayments.push(repayLoan(state, rules.loans, companyId).payment)
    const writtenOff = companyLoans(state, companyId)
    delete getCompany(state, companyId).loans
    const direction = rules.direction ?? 'left'
    const spaces = 1 + writtenOff * rules.stepsPerLoan
    let reached = rules.market.companySpace(state.stockMarket, companyId)
    let moved = 0
    while (moved < spaces) {
        const next = rules.market.move(reached.id, direction, 1)
        if (next.id === reached.id) break
        reached = next
        moved++
    }
    const marketMove = rules.market.moveCompanyMarker(
        state.stockMarket,
        companyId,
        direction,
        moved
    )
    const missed = spaces - moved
    const price =
        missed && rules.payoutBelowFloor
            ? rules.payoutBelowFloor(state, reached.price, missed)
            : reached.price
    const { payments: payouts } = shareholderPayout(state, companyId, price)
    settleCashPayments(state, payouts)
    const stations = rules.nationalStations?.(state, companyId) ?? []
    for (const station of stations)
        replaceStation(state, station.stationId, station.nationalStationId)
    const assets = rules.nationalId
        ? transferCompanyAssets(state, companyId, rules.nationalId, { loans: false })
        : undefined
    const closure = closeShareCompany(
        state,
        companyId,
        rules.trainDestination,
        rules.restart(state, companyId)
    )
    removeStockMarker(state.stockMarket, companyId)
    return {
        companyId,
        repayments,
        writtenOff,
        ...(marketMove ? { marketMove } : {}),
        price,
        payouts,
        ...(assets ? { assets } : {}),
        stations,
        closure
    }
}
