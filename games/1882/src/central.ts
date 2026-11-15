import { ActionSource, assert, assertExists } from '@tabletop/common'
import {
    StationPosition,
    applyStationPlacement,
    closePrivate,
    finiteCashOwnedBy,
    getCompany,
    homeStationId,
    markTurnPurchase,
    privateOwner,
    recordStockAction,
    recordTurnPurchase,
    sameStationPosition,
    settleCashPayments,
    startCompanyAtPar,
    stepAction,
    titleAction,
    type StepAction
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { ScId, ScrId } from './companies.js'
import { Map1882 } from './map.js'
import { placedNeutralStations } from './neutralStations.js'
import type { HydratedState1882, State1882 } from './state.js'
import { openCityPositions } from './stations.js'
import { CompanyRules1882, StockRules1882 } from './stock.js'
import { Market1882 } from './stockMarket.js'
import { ExtraTrainIds1882, TrainDepot1882, extraTrainId } from './trains.js'

const Id = Type.String({ minLength: 1 })

export const CentralConversion = Type.Object(
    {
        marketSpaceId: Id,
        price: Type.Integer({ minimum: 0 }),
        home: StationPosition,
        /** The neutral station the home replaced, removed from the game (§7.1.2). */
        replacedStationId: Type.Optional(Id),
        /** The extra train added to the bank's supply (§7.1.2). */
        extraTrainId: Type.Optional(Id)
    },
    { additionalProperties: false }
)
export type CentralConversion = Type.Static<typeof CentralConversion>

const ConvertCentralAction = titleAction('ConvertCentral', {
    marketSpaceId: Id,
    home: StationPosition,
    metadata: Type.Optional(CentralConversion)
})
export const ConvertCentral = ConvertCentralAction.schema
export type ConvertCentral = Type.Static<typeof ConvertCentral>
export const isConvertCentral = ConvertCentralAction.is

/** The par spaces the Saskatchewan Central Railway may start at (§7.1.2, §10.4). */
export function centralParSpaces(state: State1882): string[] {
    return CompanyRules1882.startMarketSpaces(state, ScrId)
}

/** Where the SCR's home may go: any open unreserved city, or a neutral station (§7.1.2). */
export function centralHomePositions(state: State1882): StationPosition[] {
    const locationIds = Map1882.definition.locations.map((location) => location.id)
    return [
        ...openCityPositions(state, ScrId, locationIds),
        ...placedNeutralStations(state).map((station) => station.position)
    ]
}

/**
 * The player who may still exchange the Saskatchewan Central: its owner while a player holds it
 * open and the SCR has not started (§7.1.2).
 */
export function centralExchanger(
    state: Pick<State1882, 'companies' | 'certificates'>
): string | undefined {
    const owner = privateOwner(state, ScId)
    return owner?.kind === 'player' &&
        !getCompany(state, ScId).closed &&
        !getCompany(state, ScrId).started
        ? owner.playerId
        : undefined
}

/** Whether the player may exchange the Saskatchewan Central now, as their purchase (§7.1.2). */
export function canConvertCentral(state: State1882, playerId: string): boolean {
    return (
        state.machineState === 'StockRound' &&
        !state.stockRound.completed &&
        !state.pendingPar &&
        state.activePlayerIds.includes(playerId) &&
        centralExchanger(state) === playerId &&
        !state.stockRound.turn.bought
    )
}

export function centralConversionReason(
    state: State1882,
    playerId: string,
    request: Pick<ConvertCentral, 'marketSpaceId' | 'home'>
): string | undefined {
    if (!canConvertCentral(state, playerId))
        return 'The Saskatchewan Central cannot be exchanged now.'
    if (!centralParSpaces(state).includes(request.marketSpaceId))
        return 'Choose a par value for the Saskatchewan Central Railway.'
    const price = Market1882.space(request.marketSpaceId).price
    if ((finiteCashOwnedBy(state, { kind: 'player', playerId }) ?? 0) < price)
        return 'The player cannot pay for a share at this par.'
    if (
        !centralHomePositions(state).some((position) => sameStationPosition(position, request.home))
    )
        return 'The home goes in an open city or on a neutral station.'
    return undefined
}

class HydratedConvertCentral extends ConvertCentralAction.Base {
    declare type: 'ConvertCentral'
    declare playerId: string
    declare marketSpaceId: string
    declare home: StationPosition
    declare metadata?: CentralConversion
    isValid(state: HydratedState1882): boolean {
        return (
            this.source === ActionSource.User &&
            !centralConversionReason(state, this.playerId, this)
        )
    }
    apply(state: HydratedState1882): void {
        const reason = centralConversionReason(state, this.playerId, this)
        assert(this.source === ActionSource.User && !reason, reason ?? 'Invalid conversion')
        const player = { kind: 'player' as const, playerId: this.playerId }
        const price = Market1882.space(this.marketSpaceId).price
        // The private stands for one share of the president's certificate; the player pays
        // for the other at par.
        settleCashPayments(state, [{ from: player, to: { kind: 'bank' }, amount: price }])
        const certificate = state.certificates.find(
            (entry) => entry.kind === 'share' && entry.companyId === ScrId && entry.president
        )
        assertExists(certificate, 'The SCR president’s certificate is in the IPO')
        certificate.owner = player
        delete certificate.poolId
        startCompanyAtPar(state, Market1882, ScrId, this.marketSpaceId, player)
        closePrivate(state, ScId)
        const replaced = placedNeutralStations(state).find((station) =>
            sameStationPosition(station.position, this.home)
        )
        if (replaced)
            state.stations = state.stations.map((station) =>
                station.id === replaced.id
                    ? { id: station.id, companyId: station.companyId, status: 'removed' }
                    : station
            )
        applyStationPlacement(state, {
            companyId: ScrId,
            stationId: homeStationId(ScrId),
            position: { ...this.home },
            cost: 0
        })
        const extra = this.addExtraTrain(state)
        recordStockAction(state, this.playerId, StockRules1882.round)
        markTurnPurchase(state)
        recordTurnPurchase(state, StockRules1882, { kind: 'start', companyId: ScrId })
        this.metadata = {
            marketSpaceId: this.marketSpaceId,
            price,
            home: { ...this.home },
            ...(replaced ? { replacedStationId: replaced.id } : {}),
            ...(extra ? { extraTrainId: extra } : {})
        }
    }

    /** One more of the bank's next train, if it is a 3, 4, 5 or 6 (§7.1.2). */
    private addExtraTrain(state: State1882): string | undefined {
        const next = TrainDepot1882.nextDefinitionId(state.trainInventory)
        if (!next || !ExtraTrainIds1882.some((id) => id === next)) return undefined
        const id = extraTrainId(next)
        state.trainInventory = {
            ...state.trainInventory,
            trains: [...state.trainInventory.trains, { id, definitionId: next, status: 'depot' }]
        }
        return id
    }
}

export const CentralActions1882 = [
    ConvertCentralAction.define((action) => new HydratedConvertCentral(action))
]

const isHydratedConvertCentral = (
    action: Parameters<StepAction<HydratedState1882>['isValid']>[0]
): action is HydratedConvertCentral => action instanceof HydratedConvertCentral

export const ConvertCentralStep: StepAction<HydratedState1882> = stepAction(
    'ConvertCentral',
    isHydratedConvertCentral,
    canConvertCentral
)
