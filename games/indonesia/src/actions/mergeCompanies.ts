import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert, assertExists } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CompanyType } from '../definition/companyType.js'
import { Good } from '../definition/goods.js'
import { type Company } from '../components/company.js'
import { AreaType, isCultivatedArea, isSeaArea } from '../components/area.js'
import {
    activeAuctionParticipantCount,
    highestBidderId,
    validSiapSajiRemovalAreaIds
} from '../operations/mergers.js'
import {
    IndonesiaNeighborDirection,
    isIndonesiaNodeId,
    type IndonesiaNodeId
} from '../utils/indonesiaNodes.js'
import { chooseMergedShippingStyle } from '../utils/shippingStyles.js'

const MergeCompaniesOwnerPayment = Type.Object({
    companyId: Type.String(),
    ownerId: Type.String(),
    unitCount: Type.Number(),
    payout: Type.Number()
})

export type MergeCompaniesMetadata = Type.Static<typeof MergeCompaniesMetadata>
export const MergeCompaniesMetadata = Type.Object({
    proposal: Type.Object({
        announcerId: Type.String(),
        companyAId: Type.String(),
        companyBId: Type.String(),
        companyType: Type.Enum(CompanyType),
        resultingGood: Type.Optional(Type.Enum(Good)),
        isSiapSaji: Type.Boolean(),
        totalUnits: Type.Number()
    }),
    auctionResult: Type.Object({
        winnerId: Type.String(),
        highBid: Type.Number()
    }),
    ownerPayments: Type.Tuple([MergeCompaniesOwnerPayment, MergeCompaniesOwnerPayment])
})

export type MergeCompanies = Type.Static<typeof MergeCompanies>
export const MergeCompanies = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.MergeCompanies),
            metadata: Type.Optional(MergeCompaniesMetadata)
        })
    ])
)

export const MergeCompaniesValidator = Compile(MergeCompanies)

export function isMergeCompanies(action?: GameAction): action is MergeCompanies {
    return action?.type === ActionType.MergeCompanies
}

export class HydratedMergeCompanies
    extends HydratableAction<typeof MergeCompanies>
    implements MergeCompanies
{
    declare type: ActionType.MergeCompanies
    declare playerId?: string
    declare metadata?: MergeCompaniesMetadata

    constructor(data: MergeCompanies) {
        super(data, MergeCompaniesValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidMergeCompanies(state)) {
            throw Error('Invalid MergeCompanies action')
        }

        const proposal = state.activeMergerProposal
        const auction = state.activeMergerAuction
        assertExists(proposal, 'Merger proposal should exist while merging companies')
        assertExists(auction, 'Merger auction should exist while merging companies')

        const winnerId = highestBidderId(auction)
        assertExists(winnerId, 'Merger winner should resolve before merging companies')
        const winningBid = auction.highBid
        assertExists(winningBid, 'Winning bid should resolve before merging companies')

        const companyA = state.companies.find((company) => company.id === proposal.companyAId)
        const companyB = state.companies.find((company) => company.id === proposal.companyBId)
        assertExists(companyA, `Company ${proposal.companyAId} should exist while resolving merger`)
        assertExists(companyB, `Company ${proposal.companyBId} should exist while resolving merger`)

        const totalUnits = proposal.totalUnits
        assert(
            proposal.companies.length === 2,
            'Merger proposal must always include exactly two company summaries'
        )

        const ownerPayments = proposal.companies.map((companySummary) => ({
            companyId: companySummary.companyId,
            ownerId: companySummary.ownerId,
            unitCount: companySummary.unitCount,
            payout:
                totalUnits <= 0
                    ? 0
                    : Math.floor((winningBid * companySummary.unitCount) / totalUnits)
        })) as MergeCompaniesMetadata['ownerPayments']

        const winnerState = state.getPlayerState(winnerId)
        winnerState.cash -= winningBid

        for (const ownerPayment of ownerPayments) {
            state.getPlayerState(ownerPayment.ownerId).cash += ownerPayment.payout
        }

        const mergedCompanyId = state.getPrng().randId()
        const mergedDeeds = [...companyA.deeds, ...companyB.deeds]

        const resultingGood = proposal.resultingGood
        if (proposal.companyType === CompanyType.Production) {
            assertExists(resultingGood, 'Production merger proposal must include resulting good')
        }

        const mergedProductionGood =
            proposal.companyType === CompanyType.Production
                ? proposal.isSiapSaji
                    ? Good.SiapSaji
                    : resultingGood
                : undefined
        const oldCompanyIds = new Set([companyA.id, companyB.id])

        let autoRemovedTouchingSiapSajiCount = 0
        let mergedCompany: Company
        if (proposal.companyType === CompanyType.Shipping) {
            mergedCompany = {
                id: mergedCompanyId,
                type: CompanyType.Shipping,
                deeds: mergedDeeds,
                owner: winnerId,
                shipStyle: chooseMergedShippingStyle(state, winnerId, [companyA.id, companyB.id])
            }
        } else {
            assertExists(
                mergedProductionGood,
                'Production mergers must resolve a resulting good before company creation'
            )
            mergedCompany = {
                id: mergedCompanyId,
                type: CompanyType.Production,
                good: mergedProductionGood,
                deeds: mergedDeeds,
                owner: winnerId
            }
        }

        state.companies = state.companies.filter((company) => !oldCompanyIds.has(company.id))
        state.companies.push(mergedCompany)

        for (const playerState of state.players) {
            playerState.ownedCompanies = playerState.ownedCompanies.filter(
                (companyId) => !oldCompanyIds.has(companyId)
            )
        }
        state.getPlayerState(winnerId).ownedCompanies.push(mergedCompanyId)

        if (proposal.companyType === CompanyType.Shipping) {
            for (const area of Object.values(state.board.areas)) {
                if (!isSeaArea(area) || area.ships.length === 0) {
                    continue
                }
                area.ships = area.ships.map((companyId) =>
                    oldCompanyIds.has(companyId) ? mergedCompanyId : companyId
                )
            }
        } else {
            const mergedCultivatedAreaIds: IndonesiaNodeId[] = []
            for (const area of Object.values(state.board.areas)) {
                if (!isCultivatedArea(area) || !oldCompanyIds.has(area.companyId)) {
                    continue
                }
                if (!isIndonesiaNodeId(area.id)) {
                    continue
                }
                area.companyId = mergedCompanyId
                mergedCultivatedAreaIds.push(area.id)
                if (mergedProductionGood) {
                    area.good = mergedProductionGood
                }
            }
            if (proposal.isSiapSaji) {
                autoRemovedTouchingSiapSajiCount = this.autoRemoveMergedAreasTouchingExistingSiapSaji(
                    state,
                    mergedCompanyId,
                    mergedCultivatedAreaIds
                )
            }
        }

        for (const deed of mergedDeeds) {
            if (!state.mergedDeedIdsThisYear.includes(deed.id)) {
                state.mergedDeedIdsThisYear.push(deed.id)
            }
        }

        state.activeMergerProposal = undefined
        state.activeMergerAuction = undefined
        state.mergerBidOrder = undefined
        state.mergerCurrentBidderId = undefined

        if (proposal.isSiapSaji) {
            const removalsRequired = Math.ceil(totalUnits / 2)
            const removalsRemaining = Math.max(
                0,
                removalsRequired - autoRemovedTouchingSiapSajiCount
            )
            if (removalsRemaining > 0) {
                state.pendingSiapSajiReduction = {
                    companyId: mergedCompanyId,
                    winnerId,
                    removalsRemaining,
                    totalRemovals: removalsRequired
                }
                const validAreaIds = validSiapSajiRemovalAreaIds(state, mergedCompanyId)
                assert(
                    validAreaIds.length > 0,
                    'Merged siap saji company must always have at least one removable border area'
                )
            } else {
                this.finalizeSiapSajiReduction(state, mergedCompanyId)
            }
        }

        this.metadata = {
            proposal: {
                announcerId: proposal.announcerId,
                companyAId: proposal.companyAId,
                companyBId: proposal.companyBId,
                companyType: proposal.companyType,
                resultingGood: proposal.resultingGood,
                isSiapSaji: proposal.isSiapSaji,
                totalUnits: proposal.totalUnits
            },
            auctionResult: {
                winnerId,
                highBid: winningBid
            },
            ownerPayments
        }
    }

    isValidMergeCompanies(state: HydratedIndonesiaGameState): boolean {
        if (!HydratedMergeCompanies.canMergeCompanies(state)) {
            return false
        }

        return this.playerId === undefined
    }

    static canMergeCompanies(state: HydratedIndonesiaGameState): boolean {
        const proposal = state.activeMergerProposal
        const auction = state.activeMergerAuction
        if (!proposal || !auction) {
            return false
        }

        if (activeAuctionParticipantCount(auction) > 1) {
            return false
        }

        return auction.highBid !== undefined && highestBidderId(auction) !== null
    }

    private autoRemoveMergedAreasTouchingExistingSiapSaji(
        state: HydratedIndonesiaGameState,
        mergedCompanyId: string,
        mergedCultivatedAreaIds: readonly IndonesiaNodeId[]
    ): number {
        const existingSiapSajiCompanyIdSet = new Set(
            state.companies
                .filter(
                    (company) =>
                        company.id !== mergedCompanyId &&
                        company.type === CompanyType.Production &&
                        company.good === Good.SiapSaji
                )
                .map((company) => company.id)
        )
        if (existingSiapSajiCompanyIdSet.size <= 0) {
            return 0
        }

        const areaIdsToAutoRemove = new Set<IndonesiaNodeId>()
        for (const areaId of mergedCultivatedAreaIds) {
            const area = state.board.areas[areaId]
            if (!area || !isCultivatedArea(area) || area.companyId !== mergedCompanyId) {
                continue
            }

            const node = state.board.graph.nodeById(areaId)
            if (!node) {
                continue
            }

            const touchesExistingSiapSajiCompany = node.neighbors[
                IndonesiaNeighborDirection.Land
            ].some((neighborAreaId) => {
                const neighborArea = state.board.areas[neighborAreaId]
                return (
                    !!neighborArea &&
                    isCultivatedArea(neighborArea) &&
                    existingSiapSajiCompanyIdSet.has(neighborArea.companyId)
                )
            })
            if (touchesExistingSiapSajiCompany) {
                areaIdsToAutoRemove.add(areaId)
            }
        }

        for (const areaId of areaIdsToAutoRemove) {
            state.board.areas[areaId] = {
                id: areaId,
                type: AreaType.EmptyLand
            }
        }

        return areaIdsToAutoRemove.size
    }

    private finalizeSiapSajiReduction(state: HydratedIndonesiaGameState, companyId: string): void {
        const company = state.companies.find((candidate) => candidate.id === companyId)
        if (company && company.type === CompanyType.Production) {
            company.good = Good.SiapSaji
        }

        for (const area of Object.values(state.board.areas)) {
            if (!isCultivatedArea(area) || area.companyId !== companyId) {
                continue
            }
            area.good = Good.SiapSaji
        }
        state.pendingSiapSajiReduction = undefined
    }
}
