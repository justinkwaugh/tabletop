import { ActionSource, assert, assertExists, type HydratedGameState } from '@tabletop/common'
import * as Type from 'typebox'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import { systemEvent, type SystemEventSchema } from '../actions/titleAction.js'
import { companyShareCount } from '../company/companyCharters.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy, getCompany } from '../finance/finance.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import { SystemActionFirstHandler } from '../game/systemActionFirstHandler.js'
import {
    addCompanyStations,
    type PlacedStation,
    type Station,
    type StationState
} from '../map/station.js'
import type { LocationMarker, LocationMarkerState } from '../map/locationMarkers.js'
import type { StockState } from '../stock/stockState.js'
import { LiquidateCompany } from './liquidation.js'
import type { SizedCompanyMarket } from './sizedCompanyMarket.js'

type State = StockState & StationState & LocationMarkerState

/**
 * Markers a company holds that count toward its station limit, as 18USA's Express Freight
 * marker in a red area (P8), and what giving one up does when a merger takes it over the limit.
 */
export interface StationLimitMarkers {
    held(state: State, companyId: string): readonly LocationMarker[]
    giveUp(state: State, companyId: string, marker: LocationMarker): void
}

/** The stations a company of each size holds, what they cost and how many it may hold. */
export interface SizedCompanyStationRules {
    /** The stations each size needs, its home station among them. */
    bySize: Readonly<Record<number, number>>
    price: number
    /** The most stations a company holds, placed or not. */
    limit: number
    /**
     * What follows once a company holds every station its size needs, as 1817's Train Station
     * then gives one more.
     */
    afterStationsBought?(state: State, companyId: string): void
    /** What a company saves on the stations it buys when it converts, as with 1817's Station Subsidy. */
    conversionDiscount?(state: State, companyId: string): number
    limitMarkers?: StationLimitMarkers
}

export type StationPurchase = { stations: number; cost: number; affordable: boolean }

const BuyOwedStationsFields = {
    companyId: Type.String(),
    metadata: Type.Optional(
        Type.Object(
            { stations: Type.Integer({ minimum: 1 }), payment: CashPayment },
            { additionalProperties: false }
        )
    )
}
const BuyOwedStationsAction = systemEvent('BuyOwedStations', BuyOwedStationsFields)
export const BuyOwedStations: SystemEventSchema<'BuyOwedStations', typeof BuyOwedStationsFields> =
    BuyOwedStationsAction.schema
export type BuyOwedStations = Type.Static<typeof BuyOwedStations>
export const isBuyOwedStations = BuyOwedStationsAction.is

/**
 * A sized company's stations: those its size needs, bought at formation or as soon as it can pay,
 * those a conversion adds, and the limit a merger or an acquisition trims it to.
 */
export class SizedCompanyStations {
    constructor(
        readonly market: SizedCompanyMarket,
        readonly rules: SizedCompanyStationRules
    ) {}

    /** The stations a company holds, placed or not. */
    heldStations(state: StationState, companyId: string): number {
        return state.stations.filter(
            (station) => station.companyId === companyId && station.status !== 'removed'
        ).length
    }

    /** What a company holds towards its limit: its stations and the markers counted with them. */
    limitedStations(state: State, companyId: string): number {
        return this.heldStations(state, companyId) + this.heldLimitMarkers(state, companyId).length
    }

    heldLimitMarkers(state: State, companyId: string): readonly LocationMarker[] {
        return this.rules.limitMarkers?.held(state, companyId) ?? []
    }

    /** The stations a company that has not yet operated still needs to buy for its size. */
    stationsOwed(state: State, companyId: string): number {
        const company = getCompany(state, companyId)
        const shareCount = companyShareCount(state, this.market.rules.charters, companyId)
        if (!company.started || company.operated || !shareCount) return 0
        return Math.max(0, this.rules.bySize[shareCount] - this.heldStations(state, companyId))
    }

    /** Buys every station the company owes when its treasury can pay for all of them. */
    buyOwedStations(state: State, companyId: string): CashPayment | undefined {
        const owed = this.stationsOwed(state, companyId)
        const company = { kind: 'company' as const, companyId }
        const amount = owed * this.rules.price
        if (owed && finiteCashOwnedBy(state, company) < amount) return undefined
        const payment = owed ? { from: company, to: { kind: 'bank' as const }, amount } : undefined
        if (payment) {
            settleCashPayments(state, [payment])
            addCompanyStations(state, companyId, owed)
        }
        this.rules.afterStationsBought?.(state, companyId)
        return payment
    }

    /** A company that owes stations and can now pay for them all. */
    companyAbleToBuyStations(state: State): string | undefined {
        return state.companies.find((company) => {
            const owed = this.stationsOwed(state, company.id)
            return (
                owed > 0 &&
                !this.market.isLiquidated(state.stockMarket, company.id) &&
                finiteCashOwnedBy(state, { kind: 'company', companyId: company.id }) >=
                    owed * this.rules.price
            )
        })?.id
    }

    /** The stations growing from one size to the next adds, towards the limit. */
    stationsForGrowth(state: State, companyId: string, from: number, to: number): number {
        const added = this.rules.bySize[to] - this.rules.bySize[from]
        return Math.min(
            Math.max(this.rules.limit - this.limitedStations(state, companyId), 0),
            added
        )
    }

    stationPurchase(state: State, companyId: string, stations: number): StationPurchase {
        const discount = stations ? (this.rules.conversionDiscount?.(state, companyId) ?? 0) : 0
        const cost = stations * this.rules.price - discount
        return {
            stations,
            cost,
            affordable: finiteCashOwnedBy(state, { kind: 'company', companyId }) >= cost
        }
    }

    /** Unplaced stations past the limit leave first; placed ones past it await the president. */
    trimStations(state: State, companyId: string): void {
        let excess = this.limitedStations(state, companyId) - this.rules.limit
        state.stations = state.stations.map((station): Station => {
            if (excess <= 0 || station.companyId !== companyId || station.status !== 'available')
                return station
            excess--
            return { id: station.id, companyId, status: 'removed' }
        })
    }

    stationsOverLimit(state: State, companyId: string): number {
        return Math.max(0, this.limitedStations(state, companyId) - this.rules.limit)
    }

    /** The counted markers the president may give up instead of a station, over the limit. */
    removableMarkers(state: State, companyId: string): readonly LocationMarker[] {
        return this.stationsOverLimit(state, companyId) &&
            !this.duplicateStations(state, companyId).length
            ? this.heldLimitMarkers(state, companyId)
            : []
    }

    /** Stations sharing a hex go first; then, over the limit, any placed station. */
    removableStations(state: State, companyId: string): PlacedStation[] {
        const duplicates = this.duplicateStations(state, companyId)
        return duplicates.length
            ? duplicates
            : this.stationsOverLimit(state, companyId)
              ? this.placedStations(state, companyId)
              : []
    }

    private placedStations(state: StationState, companyId: string): PlacedStation[] {
        return state.stations.filter(
            (station): station is PlacedStation =>
                station.companyId === companyId && station.status === 'placed'
        )
    }

    private duplicateStations(state: StationState, companyId: string): PlacedStation[] {
        const placed = this.placedStations(state, companyId)
        return placed.filter((station) =>
            placed.some(
                (other) =>
                    other.id !== station.id &&
                    other.position.locationId === station.position.locationId
            )
        )
    }

    actions(): ActionDefinition[] {
        return SizedCompanyStations.actionsOf(this)
    }

    private static actionsOf(stations: SizedCompanyStations): ActionDefinition[] {
        class HydratedBuyOwedStations
            extends BuyOwedStationsAction.Base
            implements BuyOwedStations
        {
            declare type: 'BuyOwedStations'
            declare companyId: string
            declare metadata?: BuyOwedStations['metadata']
            apply(state: HydratedGameState & State): void {
                assert(
                    this.source === ActionSource.System &&
                        stations.companyAbleToBuyStations(state) === this.companyId,
                    'The system buys stations a company can now pay for'
                )
                const owed = stations.stationsOwed(state, this.companyId)
                const payment = stations.buyOwedStations(state, this.companyId)
                assertExists(payment, 'The company can pay for its stations')
                this.metadata = { stations: owed, payment }
            }
        }
        return [BuyOwedStationsAction.define((action) => new HydratedBuyOwedStations(action))]
    }

    /** Buys owed stations as soon as a company's treasury can pay for them. */
    buysOwedStations<S extends HydratedEighteenXXState>(
        handler: EighteenXXStateHandler<S>
    ): EighteenXXStateHandler<S> {
        return new SystemActionFirstHandler(handler, BuyOwedStations, (state) => {
            const companyId = this.companyAbleToBuyStations(state)
            return companyId ? { companyId } : undefined
        })
    }

    /** A company that still owes stations when the stock round ends is liquidated. */
    liquidatesUnpaidStations<S extends HydratedEighteenXXState>(
        handler: EighteenXXStateHandler<S>
    ): EighteenXXStateHandler<S> {
        return new SystemActionFirstHandler(
            handler,
            LiquidateCompany,
            (state): Partial<LiquidateCompany> | undefined => {
                const companyId = state.companies.find(
                    (company) =>
                        this.stationsOwed(state, company.id) > 0 &&
                        !this.market.isLiquidated(state.stockMarket, company.id)
                )?.id
                return companyId ? { companyId, reason: 'unpaid-stations' } : undefined
            }
        )
    }
}
