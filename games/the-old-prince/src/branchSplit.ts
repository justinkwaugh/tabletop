import { assert, type GameState } from '@tabletop/common'
import {
    cashOwnedBy,
    getCompany,
    settleCashPayments,
    replaceStation,
    placeStockMarker,
    evaluatePresidency,
    applyPresidencyChange,
    recordStockAction,
    exceedsStockLimits,
    nextCompanyToFloat,
    allPlayersPassed,
    certificatesForShares,
    certificatesOwnedBy,
    sameOwner,
    sharesOwned,
    stockMarketSpace,
    trainsOwnedBy,
    type Owner,
    type Portfolio,
    type Station,
    type FormationState,
    type Train,
    type TrainState
} from '@tabletop/18xx'
import { TheOldPrinceBranches } from './branches.js'
import { availableTheOldPrinceTranche, theOldPrinceStartMarketSpaces } from './companyRules.js'
import { TheOldPrinceMap } from './map.js'
import { TheOldPrinceStockRules } from './stockRules.js'
import { TheOldPrinceCompanyRules } from './companyRules.js'
import { TheOldPrinceTrainRules } from './trains.js'
import type { BranchSplitAllocation, BranchSplitSettlement } from './branchSplitAllocation.js'

export type BranchSplitState = FormationState & TrainState & Pick<GameState, 'machineState'>
export type BranchSplitRequest = {
    playerId: string
    parentId: string
    branchId: string
    marketSpaceId: string
}
export type BranchSplitOwnership = {
    owner: Owner
    reserved: boolean
    beforeShares: number
    exchangedShares: number
    parentShares: number
    childShares: number
}
export type BranchSplitPreview = {
    request: BranchSplitRequest
    trancheId: string
    price: number
    ownership: BranchSplitOwnership[]
    certificateTransfers: BranchSplitSettlement['certificateTransfers']
    childPresidentCertificateId: string
    childBankShares: number
    childFunding: number
    childFloated: boolean
    sharesUntilFlotation: number
    parentCash: number
    parentTrains: Train[]
    hunsletCertificateId?: string
    stations: { station: Extract<Station, { status: 'placed' }>; protectedHome: boolean }[]
}
export type BranchSplitResult =
    | { details: BranchSplitPreview; reason?: never }
    | { details?: never; reason: string }

export class TheOldPrinceBranchSplit {
    constructor(private readonly state: BranchSplitState) {}

    parentReason(playerId: string, parentId: string): string | undefined {
        const state = this.state
        if (
            state.machineState !== 'StockRound' ||
            state.stockRound.completed ||
            state.activePlayerIds[0] !== playerId ||
            allPlayersPassed(state)
        )
            return 'A split requires your stock turn.'
        if (state.stockRound.turn.bought)
            return 'You have already bought or started a company this turn.'
        if (!availableTheOldPrinceTranche(state)) return 'No company tranche is available.'
        const parent = state.companies.find((company) => company.id === parentId)
        if (
            !parent ||
            parent.kind !== 'major' ||
            parent.shareCount !== 10 ||
            parent.closed ||
            !parent.started ||
            !parent.floated
        )
            return 'The parent must be a floated ten-share company.'
        if (nextCompanyToFloat(state, TheOldPrinceCompanyRules))
            return 'Resolve company flotation before splitting.'
        const owner: Owner = { kind: 'player', playerId }
        if (exceedsStockLimits(state, owner, TheOldPrinceStockRules))
            return 'Sell down to the stock limits before starting a branch.'
        if (!parent.president || !sameOwner(parent.president, owner))
            return 'You must be the parent’s president.'
        if (sharesOwned(state, parentId, owner) < 4)
            return 'You must own at least four parent shares.'
        if (this.stations(parentId).length < 2)
            return 'The parent needs at least two stations on the map.'
        return undefined
    }
    parents(playerId: string) {
        return this.state.companies
            .filter((company) => company.shareCount === 10 && company.started)
            .map((company) => ({ company, reason: this.parentReason(playerId, company.id) }))
    }
    branches() {
        return this.state.companies.filter(
            (company) =>
                !company.started &&
                !company.closed &&
                TheOldPrinceBranches.some((branch) => branch.id === company.id)
        )
    }
    prices() {
        return theOldPrinceStartMarketSpaces(this.state).map((id) =>
            stockMarketSpace(this.state.stockMarket, id)
        )
    }
    evaluate(request: BranchSplitRequest): BranchSplitResult {
        const { parentId, branchId, playerId, marketSpaceId } = request
        const reason = this.parentReason(playerId, parentId)
        if (reason) return { reason }
        if (!this.branches().some((branch) => branch.id === branchId))
            return { reason: 'Choose an unstarted Branch company.' }
        if (!theOldPrinceStartMarketSpaces(this.state).includes(marketSpaceId))
            return { reason: 'Choose an available starting price.' }
        const parentCertificates = this.shares(parentId)
        const childCertificates = this.shares(branchId)
        const childPresident = childCertificates.find((certificate) => certificate.president)
        if (
            childCertificates.reduce((sum, certificate) => sum + certificate.shares, 0) !== 10 ||
            childCertificates.some(
                (certificate) =>
                    certificate.owner.kind !== 'bank' || certificate.poolId !== 'market'
            ) ||
            !childPresident ||
            childPresident.shares !== 2
        )
            return { reason: 'The branch’s complete share set must be available in the Market.' }
        const player: Owner = { kind: 'player', playerId }
        const treasury: Owner = { kind: 'company', companyId: parentId }
        const owners: Owner[] = [
            player,
            ...this.state.players
                .filter((p) => p.playerId !== playerId)
                .map((p) => ({ kind: 'player' as const, playerId: p.playerId })),
            { kind: 'company', companyId: 'UB' },
            { kind: 'bank' },
            treasury
        ]
        const ownership: BranchSplitOwnership[] = []
        const certificateTransfers: BranchSplitPreview['certificateTransfers'] = []
        let availableChild: Portfolio = [...childCertificates]
        for (const owner of owners) {
            const certificates = parentCertificates.filter(
                (certificate) =>
                    sameOwner(certificate.owner, owner) && certificate.poolId !== 'reserved'
            )
            const beforeShares = certificates.reduce(
                (sum, certificate) => sum + certificate.shares,
                0
            )
            const exchangedShares = sameOwner(owner, treasury) ? 0 : Math.floor(beforeShares / 2)
            const childShares = owner.kind === 'bank' ? 0 : exchangedShares
            const surrendered = certificatesForShares(certificates, parentId, exchangedShares)
            if (!surrendered)
                return {
                    reason: 'The parent shares cannot be exchanged while retaining its president’s certificate.'
                }
            for (const certificateId of surrendered)
                certificateTransfers.push({
                    certificateId,
                    owner: treasury,
                    poolId: `treasury:${parentId}`
                })
            const receivesPresident = sameOwner(owner, player)
            const received = certificatesForShares(
                availableChild,
                branchId,
                childShares - (receivesPresident ? 2 : 0)
            )
            if (!received) return { reason: 'The branch cannot provide the required certificates.' }
            if (receivesPresident) received.push(childPresident.id)
            for (const certificateId of received)
                certificateTransfers.push({ certificateId, owner })
            availableChild = availableChild.filter(
                (certificate) => !received.includes(certificate.id)
            )
            ownership.push({
                owner,
                reserved: false,
                beforeShares,
                exchangedShares,
                parentShares: beforeShares - exchangedShares,
                childShares
            })
        }
        const treasuryRow = ownership.find((row) => sameOwner(row.owner, treasury))
        assert(treasuryRow, 'A split requires a parent treasury')
        treasuryRow.parentShares += ownership.reduce((sum, row) => sum + row.exchangedShares, 0)
        const reserved = parentCertificates
            .filter((certificate) => certificate.poolId === 'reserved')
            .reduce((sum, certificate) => sum + certificate.shares, 0)
        if (reserved)
            ownership.push({
                owner: { kind: 'bank' },
                reserved: true,
                beforeShares: reserved,
                exchangedShares: 0,
                parentShares: reserved,
                childShares: 0
            })
        const childBankShares = availableChild.reduce(
            (sum, certificate) => sum + (certificate.kind === 'share' ? certificate.shares : 0),
            0
        )
        const bankRow = ownership.find((row) => row.owner.kind === 'bank' && !row.reserved)
        assert(bankRow, 'A split requires Bank ownership')
        bankRow.childShares = childBankShares
        const tranche = availableTheOldPrinceTranche(this.state)
        assert(tranche, 'A split requires an available tranche')
        const price = stockMarketSpace(this.state.stockMarket, marketSpaceId).price
        const cash = cashOwnedBy(this.state, treasury)
        assert(typeof cash === 'number', 'The parent requires a finite treasury')
        const hunslet = certificatesOwnedBy(this.state, treasury).find(
            (certificate) => certificate.kind === 'private' && certificate.companyId === 'HS'
        )
        return {
            details: {
                request: { ...request },
                trancheId: tranche.id,
                price,
                ownership: ownership.filter(
                    (row) => row.beforeShares || row.parentShares || row.childShares
                ),
                certificateTransfers,
                childPresidentCertificateId: childPresident.id,
                childBankShares,
                childFunding: childBankShares * price,
                childFloated: childBankShares <= 4,
                sharesUntilFlotation: Math.max(0, childBankShares - 4),
                parentCash: cash,
                parentTrains: trainsOwnedBy(this.state, treasury),
                ...(hunslet ? { hunsletCertificateId: hunslet.id } : {}),
                stations: this.stations(parentId)
            }
        }
    }
    allocate(
        request: BranchSplitRequest,
        allocation: BranchSplitAllocation
    ): { details: BranchSplitSettlement; reason?: never } | { details?: never; reason: string } {
        const evaluation = this.evaluate(request)
        if (!evaluation.details) return { reason: evaluation.reason }
        const preview = evaluation.details
        if (
            !allocation.stationIds.length ||
            new Set(allocation.stationIds).size !== allocation.stationIds.length
        )
            return { reason: 'Choose distinct stations for the branch.' }
        if (!allocation.stationIds.includes(allocation.homeStationId))
            return { reason: 'Choose the branch home from its allocated stations.' }
        for (const stationId of allocation.stationIds) {
            const entry = preview.stations.find((entry) => entry.station.id === stationId)
            if (!entry || entry.protectedHome)
                return {
                    reason: 'Only the parent’s placed stations away from its printed home can be exchanged.'
                }
        }
        const childStations = this.state.stations.filter(
            (station) => station.companyId === request.branchId && station.status === 'available'
        )
        const childHome = childStations.find((station) => station.id === `${request.branchId}:home`)
        if (!childHome || childStations.length < allocation.stationIds.length)
            return { reason: 'The branch has too few available station pieces.' }
        if (
            !Number.isSafeInteger(allocation.cash) ||
            allocation.cash < 0 ||
            allocation.cash > preview.parentCash
        )
            return { reason: 'Choose a cash allocation within the parent’s treasury.' }
        if (
            new Set(allocation.trainIds).size !== allocation.trainIds.length ||
            allocation.trainIds.some((id) => !preview.parentTrains.some((train) => train.id === id))
        )
            return { reason: 'Choose distinct trains owned by the parent.' }
        if (allocation.hunslet && !preview.hunsletCertificateId)
            return { reason: 'The parent does not own Hunslet.' }
        if (
            allocation.trainIds.length >
                TheOldPrinceTrainRules.trainLimit(this.state, request.branchId) ||
            preview.parentTrains.length - allocation.trainIds.length >
                TheOldPrinceTrainRules.trainLimit(this.state, request.parentId)
        )
            return { reason: 'Both companies must be within the train limit.' }
        const parent: Owner = { kind: 'company', companyId: request.parentId }
        const child: Owner = { kind: 'company', companyId: request.branchId }
        const remainingChildStations = childStations.filter(
            (station) => station.id !== childHome.id
        )
        const parentStationIds = [
            allocation.homeStationId,
            ...allocation.stationIds.filter((id) => id !== allocation.homeStationId).sort()
        ]
        return {
            details: {
                childFunding: preview.childFunding,
                certificateTransfers: preview.certificateTransfers,
                stationReplacements: parentStationIds.map((parentStationId, index) => ({
                    parentStationId,
                    childStationId:
                        index === 0 ? childHome.id : remainingChildStations[index - 1].id
                })),
                payments: [
                    ...(allocation.cash
                        ? [{ from: parent, to: child, amount: allocation.cash }]
                        : []),
                    ...(preview.childFunding
                        ? [
                              {
                                  from: { kind: 'bank' as const },
                                  to: child,
                                  amount: preview.childFunding
                              }
                          ]
                        : [])
                ]
            }
        }
    }
    apply(request: BranchSplitRequest, allocation: BranchSplitAllocation): BranchSplitSettlement {
        const evaluation = this.allocate(request, allocation)
        assert(evaluation.details, evaluation.reason ?? 'Invalid branch allocation')
        const details = evaluation.details
        const state = this.state
        const parent = getCompany(state, request.parentId)
        const child = getCompany(state, request.branchId)
        const treasury: Owner = { kind: 'company', companyId: parent.id }
        const childOwner: Owner = { kind: 'company', companyId: child.id }
        const tranche = availableTheOldPrinceTranche(state)
        assert(tranche, 'A split requires an available tranche')
        if (!state.certificatePools.some((pool) => pool.id === `treasury:${parent.id}`))
            state.certificatePools.push({
                id: `treasury:${parent.id}`,
                name: 'Treasury shares',
                owner: treasury
            })
        settleCashPayments(state, details.payments)
        for (const transfer of details.certificateTransfers) {
            const certificate = state.certificates.find(
                (certificate) => certificate.id === transfer.certificateId
            )
            assert(
                certificate && !certificate.retired,
                'A split requires its existing certificates'
            )
            certificate.owner = transfer.owner
            delete certificate.poolId
            if (transfer.poolId) certificate.poolId = transfer.poolId
        }
        for (const replacement of details.stationReplacements)
            replaceStation(state, replacement.parentStationId, replacement.childStationId)
        for (const trainId of allocation.trainIds) {
            const train = state.trainInventory.trains.find((train) => train.id === trainId)
            assert(train?.status === 'owned', 'A split requires an owned train')
            train.owner = childOwner
        }
        if (allocation.hunslet) {
            const certificate = certificatesOwnedBy(state, treasury).find(
                (certificate) => certificate.kind === 'private' && certificate.companyId === 'HS'
            )
            assert(certificate, 'A split requires the parent’s Hunslet certificate')
            certificate.owner = childOwner
            delete certificate.poolId
        }
        child.started = true
        child.funded = true
        child.floated = false
        child.operated = false
        child.president = { kind: 'player', playerId: request.playerId }
        child.parPrice = stockMarketSpace(state.stockMarket, request.marketSpaceId).price
        placeStockMarker(state.stockMarket, child.id, request.marketSpaceId)
        tranche.companyIds.push(child.id)
        for (const companyId of [parent.id, child.id]) {
            const result = evaluatePresidency(
                state,
                companyId,
                TheOldPrinceStockRules.presidencyCandidates(state, companyId)
            )
            assert(!result.reason, result.reason ?? 'Invalid presidency after splitting')
            if (result.change) applyPresidencyChange(state, result.change)
        }
        recordStockAction(state, request.playerId, TheOldPrinceStockRules.round)
        state.stockRound.turn.bought = true
        return details
    }
    private shares(companyId: string) {
        return this.state.certificates
            .filter((certificate) => !certificate.retired)
            .filter((certificate) => certificate.kind === 'share')
            .filter((certificate) => certificate.companyId === companyId)
    }
    private stations(parentId: string): BranchSplitPreview['stations'] {
        const geographicId = parentId === 'ML' ? 'C' : parentId
        return this.state.stations
            .filter((station) => station.status === 'placed')
            .filter((station) => station.companyId === parentId)
            .map((station) => ({
                station,
                protectedHome: TheOldPrinceMap.definition.locations.some(
                    (location) =>
                        location.id === station.position.locationId &&
                        location.reservations?.some(
                            (reservation) =>
                                reservation.companyId === geographicId &&
                                reservation.nodeId === station.position.nodeId
                        )
                )
            }))
    }
}
