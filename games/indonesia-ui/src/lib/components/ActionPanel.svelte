<script lang="ts">
    import PlayerCompanyCompactCard, {
        type PlayerCompanyCardData
    } from '$lib/components/PlayerCompanyCompactCard.svelte'
    import LastHistoryDescription from '$lib/components/LastHistoryDescription.svelte'
    import ShipMarker from '$lib/components/ShipMarker.svelte'
    import { shadeHexColor } from '$lib/utils/color.js'
    import { SHIPPING_ERA_ORDER, shippingSizeTotalsFromDeeds } from '$lib/utils/deeds.js'
    import { shippingStyleByCompanyId, type ShippingStyle } from '$lib/utils/shippingStyles.js'
    import { Color } from '@tabletop/common'
    import {
        ActionType,
        BID_RESEARCH_MULTIPLIERS,
        CompanyType,
        Era,
        GOOD_REVENUE_BY_GOOD,
        Good,
        HydratedProposeMerger,
        INDONESIA_REGION_BY_AREA_ID,
        isChooseOperatingCompany,
        isDeliverGood,
        isIndonesiaNodeId,
        MachineState,
        PassReason,
        SHIPPING_FEE_PER_SHIP_USE,
        type TurnOrderBid
    } from '@tabletop/indonesia'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { getRegionName } from '$lib/definitions/regions.js'

    const gameSession = getGameSession()
    let bidInput = $state('0')
    let placingTurnOrderBid = $state(false)
    let choosingOperatingCompany = $state(false)
    let finishingOptionalShippingExpansion = $state(false)
    let deliveringGood = $state(false)
    let finishingOptionalProductionExpansion = $state(false)
    let passingAcquisitions = $state(false)
    let proposingMerger = $state(false)
    let passingMergerAnnouncement = $state(false)
    let placingMergerBid = $state(false)
    let passingMergerBid = $state(false)
    let selectedMergerOptionKey = $state('')
    let mergerBidInput = $state('0')

    const showTurnOrderBidFormula = $derived.by(() => {
        return (
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.BiddingForTurnOrder &&
            gameSession.validActionTypes.includes(ActionType.PlaceTurnOrderBid)
        )
    })

    const bidResearchMultiplier = $derived.by(() => {
        const researchLevel = gameSession.myPlayerState?.research.bid ?? 0
        return BID_RESEARCH_MULTIPLIERS[researchLevel] ?? 1
    })

    const bidAmount = $derived.by(() => {
        if (bidInput.length === 0) {
            return 0
        }

        const parsed = Number.parseInt(bidInput, 10)
        if (!Number.isFinite(parsed)) {
            return 0
        }

        return parsed
    })

    const multipliedBidAmount = $derived.by(() => bidAmount * bidResearchMultiplier)
    const availableCash = $derived.by(() => gameSession.myPlayerState?.cash ?? 0)

    const bidInputInvalid = $derived.by(() => {
        if (!showTurnOrderBidFormula) {
            return false
        }
        if (bidInput.length === 0) {
            return true
        }
        return bidAmount > availableCash
    })

    const canSubmitTurnOrderBid = $derived.by(() => {
        return showTurnOrderBidFormula && !placingTurnOrderBid && !bidInputInvalid
    })

    const showTurnOrderBidTracker = $derived.by(() => {
        return (
            gameSession.gameState.machineState === MachineState.BiddingForTurnOrder &&
            !gameSession.gameState.result
        )
    })

    type TurnOrderBidEntry = {
        playerId: string
        turnOrderBid: TurnOrderBid | null
    }

    type GameCompany = (typeof gameSession.gameState.companies)[number]
    type MergerOption = ReturnType<typeof HydratedProposeMerger.listProposableMergers>[number]
    type MergerOptionRow = {
        key: string
        option: MergerOption
        companyACard: PlayerCompanyCardData
        companyBCard: PlayerCompanyCardData
    }

    type PlannedDeliveryRouteOption = {
        key: string
        zoneId: string
        cityId: string
        shippingCompanyId: string
        seaAreaIds: readonly string[]
        cultivatedAreaId?: string
        shipCount: number
        shippingCost: number
    }

    type PlannedDeliveryRow = {
        key: string
        zoneId: string
        cityId: string
        shippingCompanyId: string
        seaAreaIds: readonly string[]
        quantity: number
        shipCount: number
        shippingCost: number
        profit: number
        destinationLabel: string
        required: boolean
        requiredQuantity: number
        shipped: boolean
        routeOptions: PlannedDeliveryRouteOption[]
        selectedRoute: PlannedDeliveryRouteOption
    }

    let selectedPlannedRouteOptionKeyByRowKey = $state<Record<string, string>>({})

    const turnOrderBidEntries: TurnOrderBidEntry[] = $derived.by(() => {
        const bidByPlayerId = gameSession.gameState.turnOrderBids ?? {}

        return gameSession.gameState.turnManager.turnOrder.map((playerId) => ({
            playerId,
            turnOrderBid: bidByPlayerId[playerId] ?? null
        }))
    })

    const submittedTurnOrderBidEntries: TurnOrderBidEntry[] = $derived.by(() =>
        turnOrderBidEntries.filter((entry) => entry.turnOrderBid !== null)
    )

    const showOperatingCompanyPicker = $derived.by(() => {
        return (
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.Operations &&
            gameSession.validActionTypes.includes(ActionType.ChooseOperatingCompany) &&
            !gameSession.gameState.result
        )
    })

    const showProductionOperationsPanel = $derived.by(() => {
        return (
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.ProductionOperations &&
            !gameSession.gameState.result
        )
    })

    const showShippingOperationsPanel = $derived.by(() => {
        return (
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.ShippingOperations &&
            !gameSession.gameState.result
        )
    })

    const showDeliveryShippingChoices = $derived.by(() => {
        return (
            showProductionOperationsPanel &&
            gameSession.deliverySelectionStage === 'shipping' &&
            gameSession.deliveryShippingChoices.length > 0
        )
    })

    const showOptionalProductionExpansionDoneButton = $derived.by(() => {
        return (
            showProductionOperationsPanel &&
            gameSession.validActionTypes.includes(ActionType.Pass)
        )
    })

    const showOptionalShippingExpansionDoneButton = $derived.by(() => {
        return (
            showShippingOperationsPanel &&
            gameSession.validActionTypes.includes(ActionType.Pass)
        )
    })

    const productionOperationCanExpand = $derived.by(
        () =>
            showProductionOperationsPanel &&
            gameSession.validActionTypes.includes(ActionType.Expand)
    )

    const shippingOperationCanExpand = $derived.by(
        () =>
            showShippingOperationsPanel &&
            gameSession.validActionTypes.includes(ActionType.Expand)
    )

    const showAcquisitionsPassButton = $derived.by(() => {
        return (
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.Acquisitions &&
            gameSession.validActionTypes.includes(ActionType.Pass) &&
            !gameSession.gameState.result
        )
    })

    const showMergersPanel = $derived.by(() => {
        return (
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.Mergers &&
            !gameSession.gameState.result
        )
    })

    const canProposeMerger = $derived.by(
        () => showMergersPanel && gameSession.validActionTypes.includes(ActionType.ProposeMerger)
    )

    const canPlaceMergerBid = $derived.by(
        () => showMergersPanel && gameSession.validActionTypes.includes(ActionType.PlaceMergerBid)
    )

    const canPassMergerBid = $derived.by(
        () => showMergersPanel && gameSession.validActionTypes.includes(ActionType.PassMergerBid)
    )

    const isSiapSajiReductionSelection = $derived.by(
        () => showMergersPanel && gameSession.validActionTypes.includes(ActionType.RemoveSiapSajiArea)
    )

    const canPassMergerAnnouncementOnly = $derived.by(
        () =>
            showMergersPanel &&
            gameSession.validActionTypes.includes(ActionType.Pass) &&
            !canProposeMerger &&
            !canPlaceMergerBid &&
            !canPassMergerBid &&
            !isSiapSajiReductionSelection
    )

    const ERA_ORDER_INDEX: Record<Era, number> = {
        [Era.A]: 0,
        [Era.B]: 1,
        [Era.C]: 2
    }

    const GOOD_LABELS: Record<Good, string> = {
        [Good.Rice]: 'rice',
        [Good.Spice]: 'spice',
        [Good.Rubber]: 'rubber',
        [Good.Oil]: 'oil',
        [Good.SiapSaji]: 'siap saji'
    }

    const companyById: Map<string, (typeof gameSession.gameState.companies)[number]> = $derived.by(
        () => new Map(gameSession.gameState.companies.map((company) => [company.id, company]))
    )
    const styleByShippingCompanyId = $derived.by(() => shippingStyleByCompanyId(gameSession.gameState))
    const cityAreaByCityId: Map<string, string> = $derived.by(
        () => new Map(gameSession.gameState.board.cities.map((city) => [city.id, city.area]))
    )

    function cityDestinationLabel(cityId: string): string {
        const cityAreaId = cityAreaByCityId.get(cityId)
        if (!cityAreaId) {
            return cityId
        }
        if (!isIndonesiaNodeId(cityAreaId)) {
            return cityAreaId
        }

        const regionId = INDONESIA_REGION_BY_AREA_ID[cityAreaId]
        return regionId ? getRegionName(regionId) : cityAreaId
    }

    const currentProductionGoodLabel = $derived.by(() => {
        const deliveryPlanGood = gameSession.gameState.operatingCompanyDeliveryPlan?.good
        if (deliveryPlanGood) {
            return GOOD_LABELS[deliveryPlanGood]
        }

        const operatingCompanyId = gameSession.gameState.operatingCompanyId
        if (!operatingCompanyId) {
            return null
        }

        const operatingCompany = companyById.get(operatingCompanyId)
        if (
            operatingCompany &&
            operatingCompany.type === CompanyType.Production &&
            'good' in operatingCompany
        ) {
            return GOOD_LABELS[operatingCompany.good]
        }

        return null
    })

    const mergerOptions = $derived.by(() => {
        if (!canProposeMerger) {
            return []
        }

        const myPlayerId = gameSession.myPlayer?.id
        if (!myPlayerId) {
            return []
        }

        return HydratedProposeMerger.listProposableMergers(gameSession.gameState, myPlayerId)
    })

    const mergerOptionRows: MergerOptionRow[] = $derived.by(() => {
        return mergerOptions
            .map((option) => {
                const companyA = companyById.get(option.companyAId)
                const companyB = companyById.get(option.companyBId)
                if (!companyA || !companyB) {
                    return null
                }

                return {
                    key: mergerOptionKey(option.companyAId, option.companyBId),
                    option,
                    companyACard: companyCardDataFor(companyA),
                    companyBCard: companyCardDataFor(companyB)
                } satisfies MergerOptionRow
            })
            .filter((row): row is MergerOptionRow => row !== null)
    })

    const selectedMergerOptionIndex = $derived.by(() =>
        mergerOptionRows.findIndex((row) => row.key === selectedMergerOptionKey)
    )

    const selectedMergerOptionRow = $derived.by(() => {
        const selectedIndex = selectedMergerOptionIndex
        if (selectedIndex < 0) {
            return null
        }
        return mergerOptionRows[selectedIndex] ?? null
    })

    const selectedMergerOption = $derived.by(() => {
        const selectedRow = selectedMergerOptionRow
        if (!selectedRow) {
            return null
        }
        return selectedRow.option
    })

    function mergerCompanyOwnerId(
        option: {
            companies: {
                companyId: string
                ownerId: string
            }[]
        },
        companyId: string
    ): string | null {
        const companySummary = option.companies.find((company) => company.companyId === companyId)
        return companySummary?.ownerId ?? null
    }

    const activeMergerProposal = $derived.by(() => gameSession.gameState.activeMergerProposal)
    const activeMergerAuction = $derived.by(() => gameSession.gameState.activeMergerAuction)

    const mergerCurrentHighBid: number | null = $derived.by(() => {
        const proposal = activeMergerProposal
        if (!proposal) {
            return null
        }
        return activeMergerAuction?.highBid ?? null
    })

    const mergerCurrentHighBidderId: string | null = $derived.by(() => {
        const auction = activeMergerAuction
        if (!auction) {
            return null
        }

        const highBid = auction.highBid
        if (highBid === undefined) {
            return null
        }

        const participant = auction.participants.find((entry) => entry.bid === highBid)
        return participant?.playerId ?? null
    })

    const activeMergerBidCompanyCards = $derived.by(() => {
        const proposal = activeMergerProposal
        if (!proposal) {
            return null
        }

        const companyA = companyById.get(proposal.companyAId)
        const companyB = companyById.get(proposal.companyBId)
        if (!companyA || !companyB) {
            return null
        }

        return {
            companyAId: proposal.companyAId,
            companyBId: proposal.companyBId,
            companyACard: companyCardDataFor(companyA),
            companyBCard: companyCardDataFor(companyB)
        }
    })

    const activeMergerBidCompanyOwners = $derived.by(() => {
        const proposal = activeMergerProposal
        if (!proposal) {
            return null
        }

        return {
            companyAOwnerId: mergerCompanyOwnerId(proposal, proposal.companyAId),
            companyBOwnerId: mergerCompanyOwnerId(proposal, proposal.companyBId)
        }
    })

    const selectedMergerParticipantIds = $derived.by(() => selectedMergerOption?.eligibleBidderIds ?? [])

    const selectedMergerOtherParticipantIds = $derived.by(() => {
        const myPlayerId = gameSession.myPlayer?.id
        if (!myPlayerId) {
            return selectedMergerParticipantIds
        }

        return selectedMergerParticipantIds.filter((participantId) => participantId !== myPlayerId)
    })

    const activeMergerParticipantIds = $derived.by(() => {
        const auction = activeMergerAuction
        if (!auction) {
            return []
        }

        return auction.participants
            .filter((participant) => !participant.passed)
            .map((participant) => participant.playerId)
    })

    const mergerSpotlightCompanyIds = $derived.by(() => {
        if (!showMergersPanel) {
            return []
        }

        if (canProposeMerger) {
            const selectedRow = selectedMergerOptionRow
            if (!selectedRow) {
                return []
            }
            return [selectedRow.option.companyAId, selectedRow.option.companyBId]
        }

        const bidCompanies = activeMergerBidCompanyCards
        if (!bidCompanies) {
            return []
        }

        return [bidCompanies.companyAId, bidCompanies.companyBId]
    })

    const mergerMinimumNextBid = $derived.by(() => {
        const proposal = activeMergerProposal
        if (!proposal) {
            return 0
        }

        const currentHighBid = mergerCurrentHighBid ?? 0
        let minimumBid = Math.max(currentHighBid + 1, proposal.nominalValue)
        const offset = (minimumBid - proposal.nominalValue) % proposal.bidIncrement
        if (offset !== 0) {
            minimumBid += proposal.bidIncrement - offset
        }
        return minimumBid
    })

    const mergerBidAmount = $derived.by(() => {
        if (mergerBidInput.length === 0) {
            return Number.NaN
        }
        return Number.parseInt(mergerBidInput, 10)
    })

    const mergerActionPending = $derived.by(
        () => proposingMerger || passingMergerAnnouncement || placingMergerBid || passingMergerBid
    )

    const mergerBidInvalid = $derived.by(() => {
        if (!canPlaceMergerBid) {
            return false
        }

        const proposal = activeMergerProposal
        if (!proposal) {
            return true
        }

        const bidAmount = mergerBidAmount
        if (!Number.isFinite(bidAmount)) {
            return true
        }
        if (bidAmount < mergerMinimumNextBid) {
            return true
        }
        if ((bidAmount - proposal.nominalValue) % proposal.bidIncrement !== 0) {
            return true
        }

        return bidAmount > availableCash
    })

    const canSubmitProposeMerger = $derived.by(
        () => canProposeMerger && !mergerActionPending && !!selectedMergerOption
    )

    const canSubmitPassMergerAnnouncement = $derived.by(
        () =>
            showMergersPanel &&
            gameSession.validActionTypes.includes(ActionType.Pass) &&
            !mergerActionPending
    )

    const canSubmitMergerBid = $derived.by(
        () => canPlaceMergerBid && !mergerActionPending && !mergerBidInvalid
    )

    const canSubmitPassMergerBid = $derived.by(
        () => canPassMergerBid && !mergerActionPending
    )

    const mergerBidIncrement = $derived.by(() => activeMergerProposal?.bidIncrement ?? 1)
    const mergerBidNominalValue = $derived.by(() => activeMergerProposal?.nominalValue ?? 0)

    function legalBidFloorAtOrBelow(limit: number, nominalValue: number, increment: number): number | null {
        if (!Number.isFinite(limit) || !Number.isFinite(nominalValue) || !Number.isFinite(increment)) {
            return null
        }
        if (increment <= 0) {
            return null
        }
        if (limit < nominalValue) {
            return null
        }

        const delta = limit - nominalValue
        return nominalValue + Math.floor(delta / increment) * increment
    }

    function legalBidCeilAtOrAbove(value: number, nominalValue: number, increment: number): number {
        const baseValue = Math.max(value, nominalValue)
        const offset = (baseValue - nominalValue) % increment
        if (offset === 0) {
            return baseValue
        }
        return baseValue + (increment - offset)
    }

    const mergerBidMaxAmount = $derived.by(() => {
        if (!canPlaceMergerBid) {
            return null
        }

        const floorAtCash = legalBidFloorAtOrBelow(
            availableCash,
            mergerBidNominalValue,
            mergerBidIncrement
        )
        if (floorAtCash === null || floorAtCash < mergerMinimumNextBid) {
            return null
        }
        return floorAtCash
    })

    const mergerCurrentControlBid = $derived.by(() => {
        if (!canPlaceMergerBid) {
            return mergerMinimumNextBid
        }

        const maxBid = mergerBidMaxAmount
        const rawBidAmount = Number.isFinite(mergerBidAmount) ? mergerBidAmount : mergerMinimumNextBid
        const flooredBid =
            legalBidFloorAtOrBelow(rawBidAmount, mergerBidNominalValue, mergerBidIncrement) ??
            mergerBidNominalValue
        let normalizedBid = flooredBid
        normalizedBid = Math.max(normalizedBid, mergerMinimumNextBid)
        if (maxBid !== null) {
            normalizedBid = Math.min(normalizedBid, maxBid)
        }
        return normalizedBid
    })

    const mergerWinningBidAmount = $derived.by(() => {
        if (!canPlaceMergerBid) {
            return null
        }

        const proposal = activeMergerProposal
        const auction = activeMergerAuction
        if (!proposal || !auction) {
            return null
        }

        const myPlayerId = gameSession.myPlayer?.id
        if (!myPlayerId) {
            return null
        }

        const highestOpponentMaximum = auction.participants
            .filter((participant) => participant.playerId !== myPlayerId && !participant.passed)
            .map((participant) =>
                legalBidFloorAtOrBelow(
                    gameSession.gameState.getPlayerState(participant.playerId).cash,
                    proposal.nominalValue,
                    proposal.bidIncrement
                )
            )
            .reduce<number>((maximum, bid) => {
                if (bid === null) {
                    return maximum
                }
                return Math.max(maximum, bid)
            }, proposal.nominalValue)

        const myMaximumBid = mergerBidMaxAmount
        if (myMaximumBid === null) {
            return null
        }

        const requiredWinningBid = legalBidCeilAtOrAbove(
            Math.max(mergerMinimumNextBid, highestOpponentMaximum),
            proposal.nominalValue,
            proposal.bidIncrement
        )

        if (requiredWinningBid > myMaximumBid) {
            return null
        }

        return requiredWinningBid
    })

    const mergerMaxOrWinLabel = $derived.by(() => (mergerWinningBidAmount === null ? 'Max' : 'Win'))
    const mergerMaxOrWinAmount = $derived.by(() => mergerWinningBidAmount ?? mergerBidMaxAmount)

    const canDecrementMergerBid = $derived.by(
        () =>
            canPlaceMergerBid &&
            !mergerActionPending &&
            mergerCurrentControlBid - mergerBidIncrement >= mergerMinimumNextBid
    )
    const canSetMergerBidToMinimum = $derived.by(
        () =>
            canPlaceMergerBid &&
            !mergerActionPending &&
            mergerCurrentControlBid !== mergerMinimumNextBid
    )
    const canIncrementMergerBid = $derived.by(() => {
        if (!canPlaceMergerBid || mergerActionPending) {
            return false
        }

        const maxBid = mergerBidMaxAmount
        if (maxBid === null) {
            return false
        }

        return mergerCurrentControlBid + mergerBidIncrement <= maxBid
    })
    const canSetMergerBidToMaxOrWin = $derived.by(() => {
        if (!canPlaceMergerBid || mergerActionPending) {
            return false
        }

        const targetBid = mergerMaxOrWinAmount
        if (targetBid === null) {
            return false
        }

        return mergerCurrentControlBid !== targetBid
    })

    $effect(() => {
        if (!showOperatingCompanyPicker) {
            gameSession.setHoveredOperatingCompany(undefined)
        }
    })

    $effect(() => {
        if (mergerSpotlightCompanyIds.length === 0) {
            gameSession.setHoveredCompanySpotlightCompanies(undefined)
            return
        }

        gameSession.setHoveredCompanySpotlightCompanies(mergerSpotlightCompanyIds)
    })

    $effect(() => {
        if (!showDeliveryShippingChoices) {
            gameSession.setHoveredDeliveryRoute(undefined)
        }
    })

    $effect(() => {
        if (!showProductionOperationsPanel) {
            gameSession.setHoveredPlannedDeliveryRoute(undefined)
        }
    })

    $effect(() => {
        if (!canProposeMerger || mergerOptionRows.length === 0) {
            selectedMergerOptionKey = ''
            return
        }

        if (!mergerOptionRows.some((row) => row.key === selectedMergerOptionKey)) {
            selectedMergerOptionKey = mergerOptionRows[0]?.key ?? ''
        }
    })

    $effect(() => {
        if (!canPlaceMergerBid && !canPassMergerBid) {
            mergerBidInput = '0'
            return
        }

        mergerBidInput = String(mergerMinimumNextBid)
    })

    type OwnedOperatingCompanyEntry = {
        company: (typeof gameSession.gameState.companies)[number]
        cardData: PlayerCompanyCardData
    }
    const SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_YELLOW = 0.16
    const SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_BLUE = 0.12

    function shippingMarkerVisualForCompany(shippingCompanyId: string): {
        style: ShippingStyle
        hullFillColor: string
        hullStrokeColor: string
    } {
        const company = companyById.get(shippingCompanyId)
        if (!company) {
            return {
                style: 'a',
                hullFillColor: '#7ea6ad',
                hullStrokeColor: 'none'
            }
        }

        const hullFillColor = gameSession.colors.getPlayerUiColor(company.owner)
        const ownerPlayerColor = gameSession.colors.getPlayerColor(company.owner)
        return {
            style: styleByShippingCompanyId.get(shippingCompanyId) ?? 'a',
            hullFillColor,
            hullStrokeColor:
                ownerPlayerColor === Color.Yellow
                    ? shadeHexColor(hullFillColor, SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_YELLOW)
                    : ownerPlayerColor === Color.Blue
                      ? shadeHexColor(hullFillColor, SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_BLUE)
                    : 'none'
        }
    }

    const ownedOperatingCompanies: OwnedOperatingCompanyEntry[] = $derived.by(() => {
        const myPlayerId = gameSession.myPlayer?.id
        if (!myPlayerId) {
            return []
        }
        const operableCompanyIdSet = new Set(gameSession.operableOwnedCompanyIds)

        return gameSession.gameState.companies
            .filter(
                (company) => company.owner === myPlayerId && operableCompanyIdSet.has(company.id)
            )
            .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }))
            .map((company) => ({
                company,
                cardData: companyCardDataFor(company)
            }))
    })

    function companyCardDataFor(company: GameCompany): PlayerCompanyCardData {
        const currentEra = gameSession.gameState.era
        const currentEraIndex = ERA_ORDER_INDEX[currentEra]

        if (company.type === CompanyType.Production && 'good' in company) {
            let producedGoodsCount = 0
            for (const area of Object.values(gameSession.gameState.board.areas)) {
                if (!('companyId' in area) || area.companyId !== company.id) {
                    continue
                }
                producedGoodsCount += 1
            }

            return {
                id: company.id,
                type: CompanyType.Production,
                good: company.good,
                deedCount: company.deeds.length,
                goodsProduced: producedGoodsCount,
                value: producedGoodsCount * GOOD_REVENUE_BY_GOOD[company.good],
                hatchVariant: null
            } satisfies PlayerCompanyCardData
        }

        const sizeEntries = shippingSizeTotalsFromDeeds(company.deeds)
        const maxByEra = new Map(sizeEntries.map((entry) => [entry.era, entry.size] as const))
        let shipCount = 0
        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('ships' in area) || !Array.isArray(area.ships)) {
                continue
            }
            for (const shipCompanyId of area.ships) {
                if (shipCompanyId === company.id) {
                    shipCount += 1
                }
            }
        }
        const ownerHullSize = (gameSession.gameState.getPlayerState(company.owner).research.hull ?? 0) + 1
        return {
            id: company.id,
            type: CompanyType.Shipping,
            deedCount: company.deeds.length,
            ships: shipCount,
            maxShips: maxByEra.get(currentEra) ?? 0,
            value: shipCount * 10,
            hullSize: ownerHullSize,
            remainingEraMaximums: SHIPPING_ERA_ORDER.filter(
                (era) => ERA_ORDER_INDEX[era] >= currentEraIndex
            ).map((era) => ({
                era,
                max: maxByEra.get(era) ?? 0
            })),
            hatchVariant: null
        } satisfies PlayerCompanyCardData
    }

    const maxGoodsToShipForCurrentProductionOperation = $derived.by(() => {
        return gameSession.gameState.operatingCompanyDeliveryPlan?.totalDelivered ?? 0
    })

    const shippedGoodsCountForCurrentProductionOperation = $derived.by(() => {
        return gameSession.gameState.operatingCompanyShippedGoodsCount ?? 0
    })

    const remainingGoodsToShipForCurrentProductionOperation = $derived.by(() => {
        return Math.max(
            0,
            maxGoodsToShipForCurrentProductionOperation - shippedGoodsCountForCurrentProductionOperation
        )
    })

    const productionDeliveryRequirementMessage = $derived.by(() => {
        if (!showProductionOperationsPanel) {
            return null
        }
        if (
            gameSession.gameState.machineState !== MachineState.ProductionOperations ||
            gameSession.productionOperationStage !== 'delivery'
        ) {
            return null
        }

        const remainingGoodsToShip = remainingGoodsToShipForCurrentProductionOperation
        if (remainingGoodsToShip <= 0) {
            return null
        }

        const goodsLabel = currentProductionGoodLabel ?? 'goods'
        return shippedGoodsCountForCurrentProductionOperation > 0
            ? `You must ship ${remainingGoodsToShip} more ${goodsLabel}.`
            : `You must ship ${remainingGoodsToShip} ${goodsLabel}.`
    })

    function plannedDeliveryRowKey(delivery: {
        zoneId: string
        cityId: string
        shippingCompanyId: string
        seaPathAreaIds: readonly string[]
    }): string {
        return `${delivery.zoneId}|${delivery.cityId}|${delivery.shippingCompanyId}|${delivery.seaPathAreaIds.join('>')}`
    }

    function plannedDeliveryRouteOptionKey(route: {
        shippingCompanyId: string
        seaAreaIds: readonly string[]
    }): string {
        return `${route.shippingCompanyId}|${route.seaAreaIds.join('>')}`
    }

    const plannedDeliveryRows: PlannedDeliveryRow[] = $derived.by(() => {
        if (!showProductionOperationsPanel) {
            return []
        }

        const deliveryPlan = gameSession.gameState.operatingCompanyDeliveryPlan
        const completedRows: PlannedDeliveryRow[] = []
        const operatingCompanyId = gameSession.gameState.operatingCompanyId
        if (operatingCompanyId) {
            let operationStartIndex = -1
            for (let index = gameSession.actions.length - 1; index >= 0; index -= 1) {
                const action = gameSession.actions[index]
                if (!isChooseOperatingCompany(action)) {
                    continue
                }
                if (action.companyId !== operatingCompanyId) {
                    break
                }
                operationStartIndex = index
                break
            }

            if (operationStartIndex >= 0) {
                for (let index = operationStartIndex + 1; index < gameSession.actions.length; index += 1) {
                    const action = gameSession.actions[index]
                    if (isChooseOperatingCompany(action)) {
                        break
                    }
                    if (!isDeliverGood(action)) {
                        continue
                    }

                    completedRows.push({
                        key: `shipped:${index}`,
                        zoneId: '',
                        cityId: action.cityId,
                        shippingCompanyId: action.shippingCompanyId,
                        seaAreaIds: action.seaAreaIds,
                        quantity: 1,
                        shipCount: action.seaAreaIds.length,
                        shippingCost:
                            action.metadata?.shippingCost ??
                            action.seaAreaIds.length * SHIPPING_FEE_PER_SHIP_USE,
                        profit:
                            action.metadata?.netProfit ??
                            (action.metadata
                                ? action.metadata.revenue - action.metadata.shippingCost
                                : 0),
                        destinationLabel: cityDestinationLabel(action.cityId),
                        required: false,
                        requiredQuantity: 0,
                        shipped: true,
                        routeOptions: [
                            {
                                key: plannedDeliveryRouteOptionKey({
                                    shippingCompanyId: action.shippingCompanyId,
                                    seaAreaIds: action.seaAreaIds
                                }),
                                zoneId: '',
                                cityId: action.cityId,
                                shippingCompanyId: action.shippingCompanyId,
                                seaAreaIds: action.seaAreaIds,
                                cultivatedAreaId: action.cultivatedAreaId,
                                shipCount: action.seaAreaIds.length,
                                shippingCost:
                                    action.metadata?.shippingCost ??
                                    action.seaAreaIds.length * SHIPPING_FEE_PER_SHIP_USE
                            }
                        ],
                        selectedRoute: {
                            key: plannedDeliveryRouteOptionKey({
                                shippingCompanyId: action.shippingCompanyId,
                                seaAreaIds: action.seaAreaIds
                            }),
                            zoneId: '',
                            cityId: action.cityId,
                            shippingCompanyId: action.shippingCompanyId,
                            seaAreaIds: action.seaAreaIds,
                            cultivatedAreaId: action.cultivatedAreaId,
                            shipCount: action.seaAreaIds.length,
                            shippingCost:
                                action.metadata?.shippingCost ??
                                action.seaAreaIds.length * SHIPPING_FEE_PER_SHIP_USE
                        }
                    })
                }
            }
        }

        if (!deliveryPlan || deliveryPlan.deliveries.length === 0) {
            return completedRows
        }

        const requiredQuantityByKey = new Map<string, number>()
        for (const criticalDelivery of deliveryPlan.criticalDeliveries ?? []) {
            requiredQuantityByKey.set(
                plannedDeliveryRowKey({
                    zoneId: criticalDelivery.zoneId,
                    cityId: criticalDelivery.cityId,
                    shippingCompanyId: criticalDelivery.shippingCompanyId,
                    seaPathAreaIds: criticalDelivery.seaPathAreaIds
                }),
                criticalDelivery.requiredQuantity
            )
        }

        const remainingRows = deliveryPlan.deliveries
            .map((delivery, index) => {
                const rowKey = plannedDeliveryRowKey({
                    zoneId: delivery.zoneId,
                    cityId: delivery.cityId,
                    shippingCompanyId: delivery.shippingCompanyId,
                    seaPathAreaIds: delivery.seaPathAreaIds
                })
                const requiredQuantity = requiredQuantityByKey.get(rowKey) ?? 0
                const plannedRouteOptionKey = plannedDeliveryRouteOptionKey({
                    shippingCompanyId: delivery.shippingCompanyId,
                    seaAreaIds: delivery.seaPathAreaIds
                })
                const alternativeCandidates = gameSession.safeDeliveryCandidates
                    .filter(
                        (candidate) =>
                            candidate.zoneId === delivery.zoneId &&
                            candidate.cityId === delivery.cityId &&
                            candidate.seaAreaIds.length === delivery.seaPathAreaIds.length
                    )
                    .sort((left, right) => {
                        const leftIsPlanned =
                            left.shippingCompanyId === delivery.shippingCompanyId &&
                            left.seaAreaIds.length === delivery.seaPathAreaIds.length &&
                            left.seaAreaIds.every(
                                (seaAreaId, candidateIndex) =>
                                    seaAreaId === delivery.seaPathAreaIds[candidateIndex]
                            )
                        const rightIsPlanned =
                            right.shippingCompanyId === delivery.shippingCompanyId &&
                            right.seaAreaIds.length === delivery.seaPathAreaIds.length &&
                            right.seaAreaIds.every(
                                (seaAreaId, candidateIndex) =>
                                    seaAreaId === delivery.seaPathAreaIds[candidateIndex]
                            )
                        if (leftIsPlanned !== rightIsPlanned) {
                            return leftIsPlanned ? -1 : 1
                        }
                        if (left.shippingCompanyId !== right.shippingCompanyId) {
                            return left.shippingCompanyId.localeCompare(right.shippingCompanyId)
                        }
                        return left.seaAreaIds.join('>').localeCompare(right.seaAreaIds.join('>'))
                    })

                const routeOptionByShippingCompanyId = new Map<string, PlannedDeliveryRouteOption>()
                for (const candidate of alternativeCandidates) {
                    if (routeOptionByShippingCompanyId.has(candidate.shippingCompanyId)) {
                        continue
                    }
                    routeOptionByShippingCompanyId.set(candidate.shippingCompanyId, {
                        key: plannedDeliveryRouteOptionKey({
                            shippingCompanyId: candidate.shippingCompanyId,
                            seaAreaIds: candidate.seaAreaIds
                        }),
                        zoneId: candidate.zoneId,
                        cityId: candidate.cityId,
                        shippingCompanyId: candidate.shippingCompanyId,
                        seaAreaIds: candidate.seaAreaIds,
                        cultivatedAreaId: candidate.cultivatedAreaId,
                        shipCount: candidate.seaAreaIds.length,
                        shippingCost: candidate.seaAreaIds.length * SHIPPING_FEE_PER_SHIP_USE
                    })
                }

                if (!routeOptionByShippingCompanyId.has(delivery.shippingCompanyId)) {
                    routeOptionByShippingCompanyId.set(delivery.shippingCompanyId, {
                        key: plannedRouteOptionKey,
                        zoneId: delivery.zoneId,
                        cityId: delivery.cityId,
                        shippingCompanyId: delivery.shippingCompanyId,
                        seaAreaIds: delivery.seaPathAreaIds,
                        cultivatedAreaId: undefined,
                        shipCount: delivery.seaPathAreaIds.length,
                        shippingCost:
                            delivery.seaPathAreaIds.length * SHIPPING_FEE_PER_SHIP_USE
                    })
                }

                const routeOptions = [...routeOptionByShippingCompanyId.values()].sort((left, right) => {
                    const leftIsPlanned = left.key === plannedRouteOptionKey
                    const rightIsPlanned = right.key === plannedRouteOptionKey
                    if (leftIsPlanned !== rightIsPlanned) {
                        return leftIsPlanned ? -1 : 1
                    }
                    return left.shippingCompanyId.localeCompare(right.shippingCompanyId)
                })
                const selectedRoute =
                    routeOptions.find(
                        (option) =>
                            option.key === selectedPlannedRouteOptionKeyByRowKey[rowKey]
                    ) ??
                    routeOptions.find((option) => option.key === plannedRouteOptionKey) ??
                    routeOptions[0]

                return {
                    key: rowKey,
                    zoneId: delivery.zoneId,
                    cityId: delivery.cityId,
                    shippingCompanyId: selectedRoute.shippingCompanyId,
                    seaAreaIds: selectedRoute.seaAreaIds,
                    quantity: delivery.quantity,
                    shipCount: selectedRoute.shipCount,
                    shippingCost: selectedRoute.shippingCost,
                    profit:
                        delivery.quantity * GOOD_REVENUE_BY_GOOD[deliveryPlan.good] -
                        selectedRoute.shippingCost,
                    destinationLabel: cityDestinationLabel(delivery.cityId),
                    required: requiredQuantity > 0,
                    requiredQuantity,
                    shipped: false,
                    routeOptions,
                    selectedRoute,
                    index
                }
            })
            .sort((left, right) => {
                if (left.required !== right.required) {
                    return left.required ? -1 : 1
                }
                if (left.shippingCost !== right.shippingCost) {
                    return left.shippingCost - right.shippingCost
                }
                return left.index - right.index
            })
            .map(({ index: _index, ...row }) => row)

        return [...completedRows, ...remainingRows]
    })

    $effect(() => {
        if (!showProductionOperationsPanel) {
            if (Object.keys(selectedPlannedRouteOptionKeyByRowKey).length > 0) {
                selectedPlannedRouteOptionKeyByRowKey = {}
            }
            return
        }

        const nextSelections: Record<string, string> = {}
        let changed = false
        for (const [rowKey, routeKey] of Object.entries(selectedPlannedRouteOptionKeyByRowKey)) {
            const row = plannedDeliveryRows.find((entry) => entry.key === rowKey && !entry.shipped)
            if (!row) {
                changed = true
                continue
            }
            if (!row.routeOptions.some((option) => option.key === routeKey)) {
                changed = true
                continue
            }
            nextSelections[rowKey] = routeKey
        }

        if (changed || Object.keys(nextSelections).length !== Object.keys(selectedPlannedRouteOptionKeyByRowKey).length) {
            selectedPlannedRouteOptionKeyByRowKey = nextSelections
        }
    })

    const remainingProductionExpansionCount = $derived.by(() => {
        if (
            gameSession.productionOperationStage !== 'mandatory-expansion' &&
            gameSession.productionOperationStage !== 'optional-expansion'
        ) {
            return 0
        }

        const expansionLimit = (gameSession.myPlayerState?.research.expansion ?? 0) + 1
        const expansionCount = gameSession.gameState.operatingCompanyExpansionCount ?? 0
        return Math.max(0, expansionLimit - expansionCount)
    })

    const message = $derived.by(() => {
        if (gameSession.isViewingHistory) {
            return 'Viewing history.'
        }

        if (gameSession.gameState.result) {
            return 'Game over.'
        }

        if (!gameSession.isMyTurn) {
            return 'Waiting for your turn.'
        }

        switch (gameSession.gameState.machineState) {
            case MachineState.NewEra: {
                if (gameSession.validActionTypes.includes(ActionType.PlaceCity)) {
                    return 'Select a highlighted area to place a city.'
                }
                if (gameSession.validActionTypes.includes(ActionType.PlaceCompanyDeeds)) {
                    return 'Place company deeds for the new era.'
                }
                if (gameSession.validActionTypes.includes(ActionType.Pass)) {
                    return 'No valid city placement. Passing will continue the round.'
                }
                return 'Complete New Era setup.'
            }
            case MachineState.BiddingForTurnOrder: {
                if (gameSession.validActionTypes.includes(ActionType.PlaceTurnOrderBid)) {
                    return 'Bid for turn order.'
                }
                if (gameSession.validActionTypes.includes(ActionType.SetTurnOrder)) {
                    return 'Set the new turn order.'
                }
                return 'Resolve turn order.'
            }
            case MachineState.Mergers: {
                if (isSiapSajiReductionSelection) {
                    const pendingReduction = gameSession.gameState.pendingSiapSajiReduction
                    const removalsRemaining = pendingReduction?.removalsRemaining ?? 0
                    const areaLabel = removalsRemaining === 1 ? 'area' : 'areas'
                    return `Remove ${removalsRemaining} border ${areaLabel} from the merged company.`
                }
                if (canPlaceMergerBid || canPassMergerBid) {
                    return 'Bid for control of the merged company.'
                }
                if (canProposeMerger) {
                    return 'Propose a merger or pass.'
                }
                if (canPassMergerAnnouncementOnly) {
                    return 'No legal mergers available. Pass to continue.'
                }
                return 'Waiting for merger announcement.'
            }
            case MachineState.Acquisitions:
                if (gameSession.validActionTypes.includes(ActionType.Pass)) {
                    return 'Select a deed, then select a highlighted area to start the company, or pass.'
                }
                return 'Select a deed, then select a highlighted area to start the company.'
            case MachineState.ResearchAndDevelopment:
                return 'Choose an area to research.'
            case MachineState.Operations:
                return 'Choose a company to operate.'
            case MachineState.ShippingOperations:
                if (!shippingOperationCanExpand && gameSession.validActionTypes.includes(ActionType.Pass)) {
                    return 'No legal shipping expansion available. Finish operation.'
                }
                return 'You may expand the shipping company or finish.'
            case MachineState.ProductionOperations: {
                if (gameSession.productionOperationStage === 'mandatory-expansion') {
                    if (
                        !productionOperationCanExpand &&
                        gameSession.validActionTypes.includes(ActionType.Pass)
                    ) {
                        return 'No legal expansion available. Finish operation.'
                    }

                    const remainingExpansions = remainingProductionExpansionCount
                    const areasLabel = remainingExpansions === 1 ? 'area' : 'areas'
                    return `Expand ${remainingExpansions} ${areasLabel} for free.`
                }

                if (gameSession.productionOperationStage === 'optional-expansion') {
                    if (
                        !productionOperationCanExpand &&
                        gameSession.validActionTypes.includes(ActionType.Pass)
                    ) {
                        return 'No legal expansion available. Finish operation.'
                    }

                    const remainingExpansions = remainingProductionExpansionCount
                    const areasLabel = remainingExpansions === 1 ? 'area' : 'areas'
                    return `You may expand up to ${remainingExpansions} ${areasLabel} or finish.`
                }

                if (gameSession.deliverySelectionStage === 'cultivated') {
                    return 'Choose a delivery below or choose a production zone.'
                }
                if (gameSession.deliverySelectionStage === 'city') {
                    return 'Choose a delivery below or choose a destination city.'
                }
                if (gameSession.deliverySelectionStage === 'shipping') {
                    return 'Choose a delivery below or choose shipping.'
                }

                return 'Choose a delivery below.'
            }
            case MachineState.CityGrowth: {
                if (gameSession.validActionTypes.includes(ActionType.GrowCity)) {
                    return 'Choose a highlighted city to grow.'
                }
                return 'Resolving city growth.'
            }
            case MachineState.EndOfGame:
                return 'Game over.'
            default:
                return 'Choose your next action.'
        }
    })

    function handleBidInput(event: Event): void {
        const target = event.currentTarget
        if (!(target instanceof HTMLInputElement)) {
            return
        }
        bidInput = sanitizeNumericInput(target.value)
    }

    function handleBidBeforeInput(event: InputEvent): void {
        if (event.isComposing) {
            return
        }

        if (event.inputType.startsWith('insert') && event.data && /[^0-9]/.test(event.data)) {
            event.preventDefault()
        }
    }

    function mergerOptionKey(companyAId: string, companyBId: string): string {
        return [companyAId, companyBId].sort((left, right) => left.localeCompare(right)).join('|')
    }

    function selectMergerOptionByIndex(index: number): void {
        if (mergerOptionRows.length === 0) {
            return
        }

        const clampedIndex = Math.max(0, Math.min(index, mergerOptionRows.length - 1))
        const selectedRow = mergerOptionRows[clampedIndex]
        if (!selectedRow) {
            return
        }

        if (selectedMergerOptionKey === selectedRow.key) {
            return
        }

        selectedMergerOptionKey = selectedRow.key
    }

    function selectNextMergerOption(): void {
        const currentIndex = selectedMergerOptionIndex
        const baseIndex = currentIndex >= 0 ? currentIndex : 0
        if (baseIndex >= mergerOptionRows.length - 1) {
            return
        }

        selectMergerOptionByIndex(baseIndex + 1)
    }

    function selectPreviousMergerOption(): void {
        const currentIndex = selectedMergerOptionIndex
        const baseIndex = currentIndex >= 0 ? currentIndex : 0
        if (baseIndex <= 0) {
            return
        }

        selectMergerOptionByIndex(baseIndex - 1)
    }

    const mergerCarouselOffsetPx = $derived.by(() => {
        const slideWidth = 376
        const selectedIndex = selectedMergerOptionIndex
        if (selectedIndex < 0) {
            return 0
        }
        return selectedIndex * slideWidth
    })

    function selectMergerOptionFromDot(index: number): void {
        selectMergerOptionByIndex(index)
    }

    function sanitizeNumericInput(value: string): string {
        const digitsOnly = value.replace(/[^0-9]/g, '')
        if (digitsOnly.length === 0) {
            return '0'
        }

        return digitsOnly.slice(0, 5).replace(/^0+(?=\d)/, '')
    }

    function handleMergerBidInput(event: Event): void {
        const target = event.currentTarget
        if (!(target instanceof HTMLInputElement)) {
            return
        }

        mergerBidInput = sanitizeNumericInput(target.value)
    }

    function handleMergerBidBlur(): void {
        if (!canPlaceMergerBid) {
            return
        }
        setMergerBidValue(mergerCurrentControlBid)
    }

    function setMergerBidValue(amount: number): void {
        if (!Number.isFinite(amount) || amount < 0) {
            return
        }
        mergerBidInput = String(Math.floor(amount))
    }

    function decrementMergerBid(): void {
        if (!canDecrementMergerBid) {
            return
        }
        setMergerBidValue(mergerCurrentControlBid - mergerBidIncrement)
    }

    function setMergerBidToMinimum(): void {
        if (!canSetMergerBidToMinimum) {
            return
        }
        setMergerBidValue(mergerMinimumNextBid)
    }

    function incrementMergerBid(): void {
        if (!canIncrementMergerBid) {
            return
        }
        setMergerBidValue(mergerCurrentControlBid + mergerBidIncrement)
    }

    function setMergerBidToMaxOrWin(): void {
        if (!canSetMergerBidToMaxOrWin) {
            return
        }
        const targetBid = mergerMaxOrWinAmount
        if (targetBid === null) {
            return
        }
        setMergerBidValue(targetBid)
    }

    async function submitTurnOrderBid(event: SubmitEvent): Promise<void> {
        event.preventDefault()
        if (!canSubmitTurnOrderBid) {
            return
        }

        placingTurnOrderBid = true
        try {
            await gameSession.placeTurnOrderBid(bidAmount)
            bidInput = '0'
        } finally {
            placingTurnOrderBid = false
        }
    }

    async function submitChooseOperatingCompany(companyId: string): Promise<void> {
        if (!showOperatingCompanyPicker || choosingOperatingCompany) {
            return
        }

        choosingOperatingCompany = true
        try {
            await gameSession.chooseOperatingCompany(companyId)
        } finally {
            choosingOperatingCompany = false
        }
    }

    async function submitDeliveryShippingChoice(routeKey: string): Promise<void> {
        if (!showDeliveryShippingChoices || deliveringGood) {
            return
        }

        deliveringGood = true
        try {
            await gameSession.deliverGoodForRoute(routeKey)
        } finally {
            deliveringGood = false
        }
    }

    async function submitFinishOptionalProductionExpansion(): Promise<void> {
        if (!showOptionalProductionExpansionDoneButton || finishingOptionalProductionExpansion) {
            return
        }

        finishingOptionalProductionExpansion = true
        try {
            if (productionOperationCanExpand) {
                await gameSession.finishOptionalProductionExpansion()
            } else {
                await gameSession.finishProductionOperationWithoutExpansion()
            }
        } finally {
            finishingOptionalProductionExpansion = false
        }
    }

    async function submitFinishOptionalShippingExpansion(): Promise<void> {
        if (!showOptionalShippingExpansionDoneButton || finishingOptionalShippingExpansion) {
            return
        }

        finishingOptionalShippingExpansion = true
        try {
            if (shippingOperationCanExpand) {
                await gameSession.finishOptionalShippingExpansion()
            } else {
                await gameSession.finishShippingOperationWithoutExpansion()
            }
        } finally {
            finishingOptionalShippingExpansion = false
        }
    }

    async function submitAcquisitionsPass(): Promise<void> {
        if (!showAcquisitionsPassButton || passingAcquisitions) {
            return
        }

        passingAcquisitions = true
        try {
            await gameSession.pass(PassReason.DeclineStartCompany)
        } finally {
            passingAcquisitions = false
        }
    }

    async function submitProposeMerger(event: SubmitEvent): Promise<void> {
        event.preventDefault()
        if (!canSubmitProposeMerger) {
            return
        }

        const option = selectedMergerOption
        if (!option) {
            return
        }

        proposingMerger = true
        try {
            await gameSession.proposeMerger(option.companyAId, option.companyBId)
        } finally {
            proposingMerger = false
        }
    }

    async function submitPassMergerAnnouncement(): Promise<void> {
        if (!canSubmitPassMergerAnnouncement) {
            return
        }

        passingMergerAnnouncement = true
        try {
            await gameSession.pass(PassReason.DeclineMergerAnnouncement)
        } finally {
            passingMergerAnnouncement = false
        }
    }

    async function submitPlaceMergerBid(event: SubmitEvent): Promise<void> {
        event.preventDefault()
        if (!canSubmitMergerBid) {
            return
        }

        const bidAmount = mergerBidAmount
        if (!Number.isFinite(bidAmount)) {
            return
        }

        placingMergerBid = true
        try {
            await gameSession.placeMergerBid(bidAmount)
        } finally {
            placingMergerBid = false
        }
    }

    async function submitPassMergerBid(): Promise<void> {
        if (!canSubmitPassMergerBid) {
            return
        }

        passingMergerBid = true
        try {
            await gameSession.passMergerBid()
        } finally {
            passingMergerBid = false
        }
    }

</script>

<div
    class="action-panel flex min-h-[50px] items-center justify-center px-0 py-2 text-center text-[18px] tracking-[0.02em] text-[#333]"
>
    {#if gameSession.isViewingHistory}
        <LastHistoryDescription />
    {:else if showTurnOrderBidTracker}
        <div class="bid-tracker-panel">
            <span class="bid-tracker-message">{message}</span>
            <div class="bid-tracker-content">
                {#if showTurnOrderBidFormula}
                    <form class="bid-formula" onsubmit={submitTurnOrderBid}>
                        <label class="sr-only" for="turn-order-bid-input">Turn order bid amount</label>
                        <span class="formula-equation">
                            <span class={`bid-slot ${bidInputInvalid ? 'is-invalid' : ''}`}>
                                <input
                                    id="turn-order-bid-input"
                                    class="bid-value-input indonesia-font"
                                    type="text"
                                    inputmode="numeric"
                                    pattern="[0-9]*"
                                    maxlength="4"
                                    autocomplete="off"
                                    spellcheck={false}
                                    value={bidInput}
                                    onbeforeinput={handleBidBeforeInput}
                                    oninput={handleBidInput}
                                />
                            </span>
                            <span class="formula-token">x</span>
                            <span class="formula-number">{bidResearchMultiplier}</span>
                            <span class="formula-token">=</span>
                            <span class="formula-total">{multipliedBidAmount}</span>
                        </span>
                        <button type="submit" class="commit-bid" disabled={!canSubmitTurnOrderBid}>
                            {#if placingTurnOrderBid}
                                placing...
                            {:else}
                                place bid
                            {/if}
                        </button>
                    </form>
                {/if}
                {#if submittedTurnOrderBidEntries.length > 0}
                    <div class="bid-tracker-columns" aria-label="Turn order bids">
                        {#each submittedTurnOrderBidEntries as entry (entry.playerId)}
                            <div class="bid-player-cell">
                                <PlayerName
                                    playerId={entry.playerId}
                                    capitalization="none"
                                    additionalClasses="text-[11px] leading-none tracking-[0.02em]"
                                />
                            </div>
                            <div class="bid-value-cell">
                                <span class="bid-value-text">
                                    <span class="bid-eq-number">{entry.turnOrderBid?.bid}</span>
                                    <span class="bid-eq-token">x</span>
                                    <span class="bid-eq-number">{entry.turnOrderBid?.multiplier}</span>
                                    <span class="bid-eq-token">=</span>
                                    <span class="bid-eq-total">{entry.turnOrderBid?.total}</span>
                                </span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    {:else if showOperatingCompanyPicker}
        <div class="operating-company-panel">
            <span class="operating-company-message">{message}</span>
            <div class="operating-company-cards" aria-label="Operating companies">
                {#each ownedOperatingCompanies as companyEntry (companyEntry.company.id)}
                    <button
                        type="button"
                        class="operating-company-button"
                        disabled={choosingOperatingCompany}
                        onmouseenter={() => {
                            gameSession.setHoveredOperatingCompany(companyEntry.company.id)
                        }}
                        onmouseleave={() => {
                            gameSession.setHoveredOperatingCompany(undefined)
                        }}
                        onfocus={() => {
                            gameSession.setHoveredOperatingCompany(companyEntry.company.id)
                        }}
                        onblur={() => {
                            gameSession.setHoveredOperatingCompany(undefined)
                        }}
                        onclick={() => {
                            submitChooseOperatingCompany(companyEntry.company.id)
                        }}
                    >
                        <span class="operating-company-mini-card-wrap" aria-hidden="true">
                            <PlayerCompanyCompactCard card={companyEntry.cardData} />
                        </span>
                    </button>
                {/each}
            </div>
        </div>
    {:else if showShippingOperationsPanel}
        <div class="production-delivery-panel">
            <span class="operating-company-message">{message}</span>
            {#if showOptionalShippingExpansionDoneButton}
                <button
                    type="button"
                    class="finish-production-expansion"
                    disabled={finishingOptionalShippingExpansion}
                    onclick={submitFinishOptionalShippingExpansion}
                >
                    {#if finishingOptionalShippingExpansion}
                        finishing...
                    {:else}
                        {shippingOperationCanExpand ? 'done expanding' : 'finish operation'}
                    {/if}
                </button>
            {/if}
        </div>
    {:else if showProductionOperationsPanel}
        <div class="production-delivery-panel">
            <span class="operating-company-message">{message}</span>
            {#if plannedDeliveryRows.length > 0}
                <div class="planned-delivery-panel" aria-label="Operating company delivery plan">
                    <div class="planned-delivery-header" aria-hidden="true">
                        <span class="planned-delivery-header-spacer"></span>
                        <span class="planned-delivery-title">Delivery Plan</span>
                        <span class="planned-delivery-header-spacer"></span>
                        <span class="planned-delivery-header-spacer"></span>
                        <span class="planned-delivery-column-title planned-delivery-column-title-profit">
                            Profit
                        </span>
                    </div>
                    <div class="planned-delivery-table">
                        {#each plannedDeliveryRows as row (row.key)}
                            <div
                                class={`planned-delivery-row ${row.required ? 'is-required' : ''} ${row.shipped ? 'is-shipped' : ''}`}
                                onmouseenter={() => {
                                    gameSession.setHoveredPlannedDeliveryRoute({
                                        zoneId: row.zoneId,
                                        cityId: row.cityId,
                                        shippingCompanyId: row.shippingCompanyId,
                                        seaAreaIds: row.seaAreaIds,
                                        cultivatedAreaId: row.selectedRoute.cultivatedAreaId
                                    })
                                }}
                                onmouseleave={() => {
                                    gameSession.setHoveredPlannedDeliveryRoute(undefined)
                                }}
                                onfocus={() => {
                                    gameSession.setHoveredPlannedDeliveryRoute({
                                        zoneId: row.zoneId,
                                        cityId: row.cityId,
                                        shippingCompanyId: row.shippingCompanyId,
                                        seaAreaIds: row.seaAreaIds,
                                        cultivatedAreaId: row.selectedRoute.cultivatedAreaId
                                    })
                                }}
                                onblur={() => {
                                    gameSession.setHoveredPlannedDeliveryRoute(undefined)
                                }}
                            >
                                {#if row.shipped}
                                    <span class="planned-delivery-shipped-label">shipped</span>
                                {:else}
                                    <button
                                        type="button"
                                        class="planned-delivery-ship-button"
                                        disabled={deliveringGood}
                                        aria-label={`Ship recommended delivery to ${row.destinationLabel}`}
                                        onmouseenter={() => {
                                            gameSession.setHoveredPlannedDeliveryRoute({
                                                zoneId: row.zoneId,
                                                cityId: row.cityId,
                                                shippingCompanyId: row.shippingCompanyId,
                                                seaAreaIds: row.seaAreaIds
                                            })
                                        }}
                                        onfocus={() => {
                                            gameSession.setHoveredPlannedDeliveryRoute({
                                                zoneId: row.zoneId,
                                                cityId: row.cityId,
                                                shippingCompanyId: row.shippingCompanyId,
                                                seaAreaIds: row.seaAreaIds
                                            })
                                        }}
                                        onclick={async () => {
                                            if (deliveringGood) {
                                                return
                                            }
                                            deliveringGood = true
                                            try {
                                                await gameSession.deliverGoodForPlannedRoute({
                                                    zoneId: row.zoneId,
                                                    cityId: row.cityId,
                                                    shippingCompanyId: row.shippingCompanyId,
                                                    seaAreaIds: row.seaAreaIds
                                                })
                                            } finally {
                                                deliveringGood = false
                                            }
                                        }}
                                    >
                                        {deliveringGood ? '...' : 'Ship'}
                                    </button>
                                {/if}
                                <span class="planned-delivery-city">
                                    <span class="planned-delivery-city-name">{row.destinationLabel}</span>
                                    {#if row.required && !row.shipped}
                                        <span class="planned-delivery-city-required">required</span>
                                    {/if}
                                </span>
                                {#if row.quantity > 1}
                                    <span class="planned-delivery-quantity">
                                        {row.quantity} {currentProductionGoodLabel ?? 'goods'}
                                    </span>
                                {:else}
                                    <span></span>
                                {/if}
                                <span class="planned-delivery-ships">
                                    <span class="planned-delivery-ships-count">{row.shipCount}x</span>
                                    <span class="planned-delivery-ship-options">
                                        {#each row.routeOptions as routeOption, routeOptionIndex (routeOption.key)}
                                            {@const routeMarkerVisual = shippingMarkerVisualForCompany(
                                                routeOption.shippingCompanyId
                                            )}
                                            {@const isSelectedRouteOption = routeOption.key === row.selectedRoute.key}
                                            {#if row.shipped}
                                                <span
                                                    class="planned-delivery-ship-option is-static"
                                                    aria-hidden="true"
                                                >
                                                    <span class="planned-delivery-ship-icon-wrap">
                                                        <svg
                                                            class="planned-delivery-ship-icon-svg"
                                                            viewBox="0 0 60 42"
                                                            width="50"
                                                            height="36"
                                                        >
                                                            <ShipMarker
                                                                x={30}
                                                                y={21}
                                                                style={routeMarkerVisual.style}
                                                                height={32}
                                                                outline={false}
                                                                hullFillColor={routeMarkerVisual.hullFillColor}
                                                                hullStrokeColor={routeMarkerVisual.hullStrokeColor}
                                                                hullStrokeWidth={8}
                                                            />
                                                        </svg>
                                                    </span>
                                                </span>
                                            {:else}
                                                <button
                                                    type="button"
                                                    class={`planned-delivery-ship-option ${isSelectedRouteOption ? 'is-selected' : ''}`}
                                                    aria-label={`Use ${companyById.get(routeOption.shippingCompanyId)?.owner ?? 'alternate'} shipping for ${row.destinationLabel}`}
                                                    onmouseenter={() => {
                                                        gameSession.setHoveredPlannedDeliveryRoute({
                                                            zoneId: routeOption.zoneId,
                                                            cityId: routeOption.cityId,
                                                            shippingCompanyId: routeOption.shippingCompanyId,
                                                            seaAreaIds: routeOption.seaAreaIds,
                                                            cultivatedAreaId: routeOption.cultivatedAreaId
                                                        })
                                                    }}
                                                    onmouseleave={() => {
                                                        gameSession.setHoveredPlannedDeliveryRoute({
                                                            zoneId: row.selectedRoute.zoneId,
                                                            cityId: row.selectedRoute.cityId,
                                                            shippingCompanyId: row.selectedRoute.shippingCompanyId,
                                                            seaAreaIds: row.selectedRoute.seaAreaIds,
                                                            cultivatedAreaId: row.selectedRoute.cultivatedAreaId
                                                        })
                                                    }}
                                                    onfocus={() => {
                                                        gameSession.setHoveredPlannedDeliveryRoute({
                                                            zoneId: routeOption.zoneId,
                                                            cityId: routeOption.cityId,
                                                            shippingCompanyId: routeOption.shippingCompanyId,
                                                            seaAreaIds: routeOption.seaAreaIds,
                                                            cultivatedAreaId: routeOption.cultivatedAreaId
                                                        })
                                                    }}
                                                    onblur={() => {
                                                        gameSession.setHoveredPlannedDeliveryRoute({
                                                            zoneId: row.selectedRoute.zoneId,
                                                            cityId: row.selectedRoute.cityId,
                                                            shippingCompanyId: row.selectedRoute.shippingCompanyId,
                                                            seaAreaIds: row.selectedRoute.seaAreaIds,
                                                            cultivatedAreaId: row.selectedRoute.cultivatedAreaId
                                                        })
                                                    }}
                                                    onclick={() => {
                                                        selectedPlannedRouteOptionKeyByRowKey = {
                                                            ...selectedPlannedRouteOptionKeyByRowKey,
                                                            [row.key]: routeOption.key
                                                        }
                                                        gameSession.setHoveredPlannedDeliveryRoute({
                                                            zoneId: routeOption.zoneId,
                                                            cityId: routeOption.cityId,
                                                            shippingCompanyId: routeOption.shippingCompanyId,
                                                            seaAreaIds: routeOption.seaAreaIds,
                                                            cultivatedAreaId: routeOption.cultivatedAreaId
                                                        })
                                                    }}
                                                >
                                                    <span class={`planned-delivery-ship-icon-wrap ${isSelectedRouteOption ? 'is-selected' : ''}`} aria-hidden="true">
                                                        <svg
                                                            class={`planned-delivery-ship-icon-svg ${isSelectedRouteOption ? 'is-selected' : ''}`}
                                                            viewBox="0 0 60 42"
                                                            width={isSelectedRouteOption ? 54 : 50}
                                                            height={isSelectedRouteOption ? 38 : 36}
                                                        >
                                                            <ShipMarker
                                                                x={30}
                                                                y={21}
                                                                style={routeMarkerVisual.style}
                                                                height={isSelectedRouteOption ? 34 : 32}
                                                                outline={false}
                                                                hullFillColor={routeMarkerVisual.hullFillColor}
                                                                hullStrokeColor={routeMarkerVisual.hullStrokeColor}
                                                                hullStrokeWidth={isSelectedRouteOption ? 10 : 8}
                                                            />
                                                        </svg>
                                                    </span>
                                                </button>
                                            {/if}
                                            {#if routeOptionIndex < row.routeOptions.length - 1}
                                                <span class="planned-delivery-ship-option-separator">/</span>
                                            {/if}
                                        {/each}
                                    </span>
                                </span>
                                <span class="planned-delivery-profit">{row.profit}</span>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
            {#if productionDeliveryRequirementMessage}
                <span class="production-delivery-requirement">
                    {productionDeliveryRequirementMessage}
                </span>
            {/if}
            {#if showDeliveryShippingChoices}
                <div class="delivery-shipping-choices" aria-label="Delivery shipping choices">
                    {#each gameSession.deliveryShippingChoices as choice (choice.routeKey)}
                        {@const markerVisual = shippingMarkerVisualForCompany(
                            choice.candidate.shippingCompanyId
                        )}
                        {@const shipUseCount = choice.candidate.seaAreaIds.length}
                        {@const shipUseLabel = shipUseCount === 1 ? 'ship' : 'ships'}
                        <div
                            class={`delivery-shipping-choice ${deliveringGood ? 'is-disabled' : ''}`}
                            role="button"
                            tabindex={deliveringGood ? -1 : 0}
                            aria-disabled={deliveringGood}
                            aria-label={`Deliver via shipping company ${choice.candidate.shippingCompanyId} using ${shipUseCount} ${shipUseLabel}`}
                            onmouseenter={() => {
                                gameSession.setHoveredDeliveryRoute(choice.routeKey)
                            }}
                            onmouseleave={() => {
                                gameSession.setHoveredDeliveryRoute(undefined)
                            }}
                            onfocus={() => {
                                gameSession.setHoveredDeliveryRoute(choice.routeKey)
                            }}
                            onblur={() => {
                                gameSession.setHoveredDeliveryRoute(undefined)
                            }}
                            onclick={() => {
                                submitDeliveryShippingChoice(choice.routeKey)
                            }}
                            onkeydown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') {
                                    return
                                }
                                event.preventDefault()
                                submitDeliveryShippingChoice(choice.routeKey)
                            }}
                        >
                            <span class="delivery-route-count">
                                {shipUseCount}
                                <span class="delivery-route-times">x</span>
                            </span>
                            <span class="delivery-route-icon-wrap" aria-hidden="true">
                                <svg
                                    class="delivery-route-icon-svg"
                                    viewBox="0 0 60 42"
                                    width="60"
                                    height="42"
                                >
                                    <ShipMarker
                                        x={30}
                                        y={21}
                                        style={markerVisual.style}
                                        height={38}
                                        outline={false}
                                        hullFillColor={markerVisual.hullFillColor}
                                        hullStrokeColor={markerVisual.hullStrokeColor}
                                        hullStrokeWidth={11}
                                    />
                                </svg>
                            </span>
                        </div>
                    {/each}
                </div>
            {/if}
            {#if showOptionalProductionExpansionDoneButton}
                <button
                    type="button"
                    class="finish-production-expansion"
                    disabled={finishingOptionalProductionExpansion}
                    onclick={submitFinishOptionalProductionExpansion}
                >
                    {#if finishingOptionalProductionExpansion}
                        finishing...
                    {:else}
                        {productionOperationCanExpand ? 'done expanding' : 'finish operation'}
                    {/if}
                </button>
            {/if}
        </div>
    {:else if showMergersPanel}
        <div class="production-delivery-panel">
            <span class="operating-company-message merger-panel-message">{message}</span>

            {#if canProposeMerger}
                <form class="merger-formula" onsubmit={submitProposeMerger}>
                    <div class="merger-carousel" aria-label="Available mergers">
                        <button
                            type="button"
                            class="merger-carousel-nav merger-carousel-nav-left"
                            disabled={mergerActionPending || mergerOptionRows.length <= 1 || selectedMergerOptionIndex <= 0}
                            aria-label="Previous merger"
                            onclick={selectPreviousMergerOption}
                        >
                            <svg
                                aria-hidden="true"
                                class="merger-carousel-nav-icon"
                                viewBox="0 0 18 18"
                            >
                                <polyline points="11,3.5 6,9 11,14.5"></polyline>
                            </svg>
                        </button>
                        <div class="merger-carousel-viewport">
                            <div
                                class="merger-carousel-track"
                                style={`transform: translateX(-${mergerCarouselOffsetPx}px);`}
                            >
                                {#each mergerOptionRows as row (row.key)}
                                    {@const companyAOwnerId = mergerCompanyOwnerId(
                                        row.option,
                                        row.option.companyAId
                                    )}
                                    {@const companyBOwnerId = mergerCompanyOwnerId(
                                        row.option,
                                        row.option.companyBId
                                    )}
                                    <div class="merger-carousel-slide">
                                        <span class="merger-option-company-stack">
                                            {#if companyAOwnerId}
                                                <PlayerName
                                                    playerId={companyAOwnerId}
                                                    capitalization="none"
                                                    additionalClasses="text-[11px] leading-[1.1] py-[1px] tracking-[0.02em]"
                                                />
                                            {/if}
                                            <span class="merger-option-mini-card-wrap" aria-hidden="true">
                                                <PlayerCompanyCompactCard card={row.companyACard} />
                                            </span>
                                        </span>
                                        <span class="merger-option-plus merger-option-plus-proposal" aria-hidden="true">+</span>
                                        <span class="merger-option-company-stack">
                                            {#if companyBOwnerId}
                                                <PlayerName
                                                    playerId={companyBOwnerId}
                                                    capitalization="none"
                                                    additionalClasses="text-[11px] leading-[1.1] py-[1px] tracking-[0.02em]"
                                                />
                                            {/if}
                                            <span class="merger-option-mini-card-wrap" aria-hidden="true">
                                                <PlayerCompanyCompactCard card={row.companyBCard} />
                                            </span>
                                        </span>
                                    </div>
                                {/each}
                            </div>
                        </div>
                        <button
                            type="button"
                            class="merger-carousel-nav merger-carousel-nav-right"
                            disabled={mergerActionPending || mergerOptionRows.length <= 1 || selectedMergerOptionIndex >= mergerOptionRows.length - 1}
                            aria-label="Next merger"
                            onclick={selectNextMergerOption}
                        >
                            <svg
                                aria-hidden="true"
                                class="merger-carousel-nav-icon"
                                viewBox="0 0 18 18"
                            >
                                <polyline points="7,3.5 12,9 7,14.5"></polyline>
                            </svg>
                        </button>
                    </div>
                    {#if selectedMergerOtherParticipantIds.length > 0}
                        <div class="merger-participants">
                            <span>Other participants:</span>
                            <div class="merger-participant-list">
                                {#each selectedMergerOtherParticipantIds as participantId (participantId)}
                                    <PlayerName
                                        playerId={participantId}
                                        capitalization="none"
                                        additionalClasses="text-[12px] leading-[1.15] py-[2px] tracking-[0.02em]"
                                    />
                                {/each}
                            </div>
                        </div>
                    {/if}
                    {#if mergerOptionRows.length > 1}
                        <div class="merger-carousel-dots" aria-label="Merger choices">
                            {#each mergerOptionRows as row, index (row.key)}
                                {@const isSelected = index === selectedMergerOptionIndex}
                                <button
                                    type="button"
                                    class={`merger-carousel-dot ${isSelected ? 'is-active' : ''}`}
                                    disabled={mergerActionPending}
                                    aria-label={`Merger option ${index + 1} of ${mergerOptionRows.length}`}
                                    aria-pressed={isSelected}
                                    onclick={() => {
                                        selectMergerOptionFromDot(index)
                                    }}
                                >
                                </button>
                            {/each}
                        </div>
                    {/if}

                    {#if selectedMergerOption}
                        <div class="merger-proposal-controls">
                            <button
                                type="submit"
                                class="commit-bid"
                                disabled={!canSubmitProposeMerger}
                            >
                                {#if proposingMerger}
                                    proposing...
                                {:else}
                                    propose
                                {/if}
                            </button>
                            <button
                                type="button"
                                class="finish-production-expansion"
                                disabled={!canSubmitPassMergerAnnouncement}
                                onclick={submitPassMergerAnnouncement}
                            >
                                {#if passingMergerAnnouncement}
                                    passing...
                                {:else}
                                    pass
                                {/if}
                            </button>
                        </div>
                    {:else}
                        <div class="merger-proposal-controls">
                            <span class="merger-opening-prompt">Choose a merger to continue</span>
                            <button
                                type="button"
                                class="finish-production-expansion"
                                disabled={!canSubmitPassMergerAnnouncement}
                                onclick={submitPassMergerAnnouncement}
                            >
                                {#if passingMergerAnnouncement}
                                    passing...
                                {:else}
                                    pass
                                {/if}
                            </button>
                        </div>
                    {/if}
                </form>
            {:else if canPlaceMergerBid || canPassMergerBid}
                {#if activeMergerBidCompanyCards}
                    <div class="merger-bid-companies">
                        <span class="merger-option-company-stack">
                            {#if activeMergerBidCompanyOwners?.companyAOwnerId}
                                <PlayerName
                                    playerId={activeMergerBidCompanyOwners.companyAOwnerId}
                                    capitalization="none"
                                    additionalClasses="text-[11px] leading-[1.1] py-[1px] tracking-[0.02em]"
                                />
                            {/if}
                            <span class="merger-option-mini-card-wrap">
                                <PlayerCompanyCompactCard card={activeMergerBidCompanyCards.companyACard} />
                            </span>
                        </span>
                        <span class="merger-option-plus merger-option-plus-bid">+</span>
                        <span class="merger-option-company-stack">
                            {#if activeMergerBidCompanyOwners?.companyBOwnerId}
                                <PlayerName
                                    playerId={activeMergerBidCompanyOwners.companyBOwnerId}
                                    capitalization="none"
                                    additionalClasses="text-[11px] leading-[1.1] py-[1px] tracking-[0.02em]"
                                />
                            {/if}
                            <span class="merger-option-mini-card-wrap">
                                <PlayerCompanyCompactCard card={activeMergerBidCompanyCards.companyBCard} />
                            </span>
                        </span>
                    </div>
                {/if}
                {#if activeMergerParticipantIds.length > 0}
                    <div class="merger-participants">
                        <span>Participants:</span>
                        <div class="merger-participant-list">
                            {#each activeMergerParticipantIds as participantId (participantId)}
                                <PlayerName
                                    playerId={participantId}
                                    capitalization="none"
                                    additionalClasses="text-[12px] leading-[1.15] py-[2px] tracking-[0.02em]"
                                />
                            {/each}
                        </div>
                    </div>
                {/if}
                <form class="merger-formula merger-bid-form" onsubmit={submitPlaceMergerBid}>
                    <div class="merger-bid-controls">
                        <button
                            type="button"
                            class="merger-bid-stepper"
                            disabled={!canSetMergerBidToMinimum}
                            onclick={setMergerBidToMinimum}
                        >
                            Min
                        </button>
                        <button
                            type="button"
                            class="merger-bid-stepper"
                            disabled={!canDecrementMergerBid}
                            onclick={decrementMergerBid}
                        >
                            -
                        </button>
                        <label class="sr-only" for="merger-bid-input">Merger bid amount</label>
                        <span class={`merger-bid-input-slot ${mergerBidInvalid ? 'is-invalid' : ''}`}>
                            <input
                                id="merger-bid-input"
                                class="merger-bid-input indonesia-font"
                                type="text"
                                inputmode="numeric"
                                pattern="[0-9]*"
                                maxlength="5"
                                autocomplete="off"
                                spellcheck={false}
                                disabled={!canPlaceMergerBid || mergerActionPending}
                                value={mergerBidInput}
                                onbeforeinput={handleBidBeforeInput}
                                oninput={handleMergerBidInput}
                                onblur={handleMergerBidBlur}
                            />
                        </span>
                        <button
                            type="button"
                            class="merger-bid-stepper"
                            disabled={!canIncrementMergerBid}
                            onclick={incrementMergerBid}
                        >
                            +
                        </button>
                        <button
                            type="button"
                            class="merger-bid-stepper"
                            disabled={!canSetMergerBidToMaxOrWin}
                            onclick={setMergerBidToMaxOrWin}
                        >
                            {mergerMaxOrWinLabel}
                        </button>
                    </div>
                    {#if mergerCurrentHighBidderId}
                        <div class="merger-bid-summary">
                            <span>High bidder:</span>
                            <PlayerName
                                playerId={mergerCurrentHighBidderId}
                                capitalization="none"
                                additionalClasses="text-[12px] leading-[1.15] py-[2px] tracking-[0.02em]"
                            />
                            {#if mergerCurrentHighBid !== null}
                                <span class="merger-bid-summary-at">at</span>
                                <span class="merger-bid-summary-value">{mergerCurrentHighBid}</span>
                            {/if}
                        </div>
                    {/if}
                    <div class="merger-bid-action-buttons">
                        {#if canPlaceMergerBid}
                            <button type="submit" class="commit-bid" disabled={!canSubmitMergerBid}>
                                {#if placingMergerBid}
                                    bidding...
                                {:else}
                                    bid
                                {/if}
                            </button>
                        {/if}
                        {#if canPassMergerBid}
                            <button
                                type="button"
                                class="finish-production-expansion"
                                disabled={!canSubmitPassMergerBid}
                                onclick={submitPassMergerBid}
                            >
                                {#if passingMergerBid}
                                    passing...
                                {:else}
                                    pass
                                {/if}
                            </button>
                        {/if}
                    </div>
                </form>
            {:else if canPassMergerAnnouncementOnly}
                <button
                    type="button"
                    class="finish-production-expansion"
                    disabled={!canSubmitPassMergerAnnouncement}
                    onclick={submitPassMergerAnnouncement}
                >
                    {#if passingMergerAnnouncement}
                        passing...
                    {:else}
                        pass
                    {/if}
                </button>
            {/if}
        </div>
    {:else if gameSession.isMyTurn && gameSession.gameState.machineState === MachineState.Acquisitions}
        <div class="production-delivery-panel">
            <span class="operating-company-message">{message}</span>
            {#if showAcquisitionsPassButton}
                <button
                    type="button"
                    class="finish-production-expansion"
                    disabled={passingAcquisitions}
                    onclick={submitAcquisitionsPass}
                >
                    {#if passingAcquisitions}
                        passing...
                    {:else}
                        pass
                    {/if}
                </button>
            {/if}
        </div>
    {:else}
        <span>{message}</span>
    {/if}
</div>

<style>
    .action-panel {
        background: #f7f3ef;
        border-top: none;
        border-left: none;
        border-right: none;
        border-bottom: 1px solid rgba(93, 68, 40, 0.58);
        border-radius: 0;
        margin: 0 0 7px;
        padding-top: 12px;
        box-shadow: none;
    }

    .bid-tracker-panel {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px 30px;
        padding: 0;
    }

    .operating-company-panel {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    .production-delivery-panel {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    .planned-delivery-panel {
        --planned-delivery-leading-column-width: 46px;
        --planned-delivery-profit-column-width: 52px;

        width: min(100%, 520px);
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
        padding: 6px 0 0;
    }

    .planned-delivery-title {
        justify-self: start;
        font-size: 11px;
        line-height: 1;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: rgba(94, 63, 39, 0.74);
    }

    .planned-delivery-header {
        display: grid;
        grid-template-columns:
            var(--planned-delivery-leading-column-width)
            minmax(0, 1fr)
            auto
            auto
            var(--planned-delivery-profit-column-width);
        align-items: end;
        column-gap: 7px;
        row-gap: 0;
        width: 100%;
        padding: 0 10px 2px;
    }

    .planned-delivery-header-spacer {
        display: block;
        width: var(--planned-delivery-leading-column-width);
    }

    .planned-delivery-column-title {
        font-size: 11px;
        line-height: 1;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: rgba(94, 63, 39, 0.74);
        text-align: center;
    }

    .planned-delivery-column-title-profit {
        justify-self: center;
        text-align: center;
    }

    .planned-delivery-table {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
    }

    .planned-delivery-row {
        display: grid;
        grid-template-columns:
            auto
            minmax(0, 1fr)
            auto
            auto
            var(--planned-delivery-profit-column-width);
        align-items: center;
        column-gap: 7px;
        row-gap: 0;
        width: 100%;
        border: 1px solid rgba(93, 68, 40, 0.14);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.38);
        padding: 2px 10px;
        overflow: hidden;
        text-align: left;
        color: inherit;
        transition:
            background-color 120ms ease,
            border-color 120ms ease,
            transform 120ms ease;
    }

    .planned-delivery-row:hover,
    .planned-delivery-row:focus-visible {
        background: rgba(255, 255, 255, 0.62);
        border-color: rgba(93, 68, 40, 0.26);
        outline: none;
    }

    .planned-delivery-row.is-required {
        border-color: rgba(116, 78, 44, 0.26);
        background: rgba(255, 250, 240, 0.62);
    }

    .planned-delivery-row.is-shipped {
        border-color: transparent;
        border-radius: 0;
        background: transparent;
        padding-top: 0;
        padding-bottom: 0;
    }

    .planned-delivery-row.is-shipped:hover,
    .planned-delivery-row.is-shipped:focus-visible {
        background: transparent;
        border-color: transparent;
        transform: none;
    }

    .planned-delivery-ship-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 46px;
        align-self: stretch;
        margin: -2px 0 -2px -10px;
        padding: 0 12px;
        border: 0;
        border-right: 1px solid rgba(94, 63, 39, 0.18);
        border-radius: 10px 0 0 10px;
        background: rgba(255, 255, 255, 0.72);
        color: rgba(71, 53, 33, 0.92);
        font-size: 12px;
        line-height: 1;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        transition:
            background-color 120ms ease,
            border-color 120ms ease;
    }

    .planned-delivery-ship-button:hover:enabled,
    .planned-delivery-ship-button:focus-visible {
        background: rgba(255, 255, 255, 0.9);
        border-color: rgba(94, 63, 39, 0.34);
        outline: none;
    }

    .planned-delivery-ship-button:disabled {
        opacity: 0.55;
        cursor: default;
    }

    .planned-delivery-shipped-label {
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        min-width: 46px;
        margin-left: -10px;
        padding-left: 12px;
        font-size: 10px;
        line-height: 1;
        letter-spacing: 0.02em;
        text-transform: lowercase;
        color: rgba(94, 63, 39, 0.62);
        white-space: nowrap;
    }

    .planned-delivery-ships {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0;
        min-width: 92px;
        height: 40px;
        color: rgba(71, 53, 33, 0.9);
        padding: 0 0 0 8px;
        font-size: 13px;
        line-height: 1;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .planned-delivery-row.is-shipped .planned-delivery-ships {
        height: 28px;
    }

    .planned-delivery-ships-count {
        letter-spacing: 0.01em;
    }

    .planned-delivery-ship-options {
        display: inline-flex;
        align-items: center;
        gap: 3px;
    }

    .planned-delivery-ship-option {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        opacity: 0.42;
        transition:
            opacity 120ms ease,
            transform 120ms ease;
    }

    .planned-delivery-ship-option:hover,
    .planned-delivery-ship-option:focus-visible {
        opacity: 0.82;
        outline: none;
    }

    .planned-delivery-ship-option.is-selected {
        opacity: 1;
    }

    .planned-delivery-ship-option.is-static {
        background: transparent;
        transform: none;
    }

    .planned-delivery-ship-option-separator {
        font-size: 11px;
        line-height: 1;
        color: rgba(94, 63, 39, 0.48);
    }

    .planned-delivery-ship-icon-wrap {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 50px;
        height: 36px;
        flex: 0 0 auto;
    }

    .planned-delivery-ship-icon-wrap.is-selected {
        transform: scale(1.06);
        transform-origin: center;
    }

    .planned-delivery-row.is-shipped .planned-delivery-ship-icon-wrap {
        height: 28px;
    }

    .planned-delivery-ship-icon-svg {
        display: block;
        overflow: visible;
    }

    .planned-delivery-city {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 1px;
        min-width: 0;
    }

    .planned-delivery-city-name {
        font-size: 15px;
        line-height: 1.1;
        font-weight: 500;
        letter-spacing: 0.01em;
        color: rgba(51, 35, 20, 0.94);
    }

    .planned-delivery-city-required {
        font-size: 10px;
        line-height: 1;
        letter-spacing: 0.02em;
        text-transform: lowercase;
        color: rgba(110, 63, 20, 0.78);
    }

    .planned-delivery-quantity {
        font-size: 11px;
        line-height: 1;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: rgba(94, 63, 39, 0.66);
        white-space: nowrap;
        text-align: center;
    }

    .planned-delivery-profit {
        justify-self: center;
        font-size: 14px;
        line-height: 1;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: rgba(71, 53, 33, 0.88);
        white-space: nowrap;
        text-align: center;
    }

    .production-delivery-requirement {
        font-size: 14px;
        line-height: 1.15;
        letter-spacing: 0.01em;
        color: rgba(71, 53, 33, 0.88);
    }

    .operating-company-message {
        font-size: 16px;
        line-height: 1.15;
        letter-spacing: 0.02em;
    }

    .merger-panel-message {
        margin-bottom: 4px;
    }

    .operating-company-cards {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
    }

    .operating-company-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 1px solid rgba(93, 83, 72, 0.22);
        border-radius: 9px;
        background: rgba(255, 255, 255, 0.16);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.46);
        transition:
            opacity 140ms ease,
            transform 120ms ease;
    }

    .operating-company-button:hover:enabled {
        opacity: 0.95;
        transform: translateY(-1px);
    }

    .operating-company-button:disabled {
        opacity: 0.58;
        cursor: default;
    }

    .operating-company-mini-card-wrap {
        display: block;
        width: 164px;
    }

    .delivery-shipping-choices {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
    }

    .delivery-shipping-choice {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        max-width: 100%;
        border: none;
        border-radius: 8px;
        background: transparent;
        padding: 4px 8px;
        transition: opacity 120ms ease;
        cursor: pointer;
    }

    .delivery-shipping-choice:hover,
    .delivery-shipping-choice:focus-visible {
        opacity: 0.9;
        outline: none;
    }

    .delivery-shipping-choice.is-disabled {
        opacity: 0.45;
        cursor: default;
    }

    .delivery-route-icon-wrap {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 60px;
        height: 42px;
        flex: 0 0 auto;
    }

    .delivery-route-icon-svg {
        display: block;
    }

    .delivery-route-count {
        display: inline-flex;
        align-items: baseline;
        justify-content: center;
        gap: 3px;
        color: rgba(63, 46, 28, 0.92);
        font-size: 18px;
        line-height: 1;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    .delivery-route-times {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.01em;
    }

    .bid-formula {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        justify-content: center;
        gap: 12px;
        white-space: nowrap;
    }

    .merger-formula {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
    }

    .merger-bid-form {
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }

    .merger-bid-action-buttons {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        flex-wrap: wrap;
    }

    .merger-carousel {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 8px;
        width: auto;
        max-width: 100%;
    }

    .merger-carousel-viewport {
        overflow: hidden;
        width: 376px;
        max-width: 100%;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        min-height: 54px;
    }

    .merger-carousel-track {
        display: flex;
        align-items: center;
        transition: transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1);
        will-change: transform;
    }

    .merger-carousel-slide {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 376px;
        min-width: 376px;
        max-width: 376px;
    }

    .merger-carousel-nav {
        border: none;
        border-radius: 999px;
        background: transparent;
        color: rgba(63, 46, 28, 0.74);
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        font-size: 28px;
        line-height: 1;
        margin-top: 9px;
        transition:
            color 120ms ease,
            background 120ms ease,
            opacity 120ms ease;
    }

    .merger-carousel-nav-icon {
        width: 22px;
        height: 22px;
        display: block;
        stroke: currentColor;
        stroke-width: 2.15;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .merger-carousel-nav:hover:enabled {
        color: rgba(63, 46, 28, 0.96);
        background: rgba(95, 74, 50, 0.08);
    }

    .merger-carousel-nav:focus-visible {
        outline: 1px solid rgba(110, 83, 52, 0.42);
        outline-offset: 1px;
    }

    .merger-carousel-nav:disabled {
        opacity: 0.33;
        cursor: default;
    }

    .merger-carousel-dots {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        width: 100%;
        margin-bottom: 4px;
    }

    .merger-carousel-dot {
        border: none;
        border-radius: 999px;
        width: 7px;
        height: 7px;
        padding: 0;
        background: rgba(79, 58, 36, 0.24);
        transition:
            background 120ms ease,
            transform 120ms ease,
            opacity 120ms ease;
    }

    .merger-carousel-dot:hover:enabled {
        background: rgba(79, 58, 36, 0.42);
    }

    .merger-carousel-dot:focus-visible {
        outline: 1px solid rgba(110, 83, 52, 0.38);
        outline-offset: 2px;
    }

    .merger-carousel-dot.is-active {
        background: rgba(79, 58, 36, 0.78);
        transform: scale(1.14);
    }

    .merger-carousel-dot:disabled {
        opacity: 0.5;
        cursor: default;
    }

    .merger-option-mini-card-wrap {
        display: block;
        width: 164px;
        min-width: 164px;
    }

    .merger-option-company-stack {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        gap: 0;
    }

    .merger-option-plus {
        font-size: 20px;
        font-weight: 700;
        line-height: 1;
        color: rgba(67, 48, 27, 0.9);
        padding: 0 4px;
        user-select: none;
    }

    .merger-option-plus-proposal {
        transform: translateY(6px);
    }

    .merger-option-plus-bid {
        transform: translateY(6px);
    }

    .merger-proposal-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
    }

    .merger-opening-prompt {
        font-size: 12px;
        color: rgba(63, 46, 28, 0.9);
        letter-spacing: 0.02em;
    }

    .merger-bid-summary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin-bottom: 4px;
        font-size: 12px;
        color: rgba(63, 46, 28, 0.92);
        letter-spacing: 0.02em;
    }

    .merger-bid-companies {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: auto;
        max-width: 100%;
    }

    .merger-participants {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        max-width: 100%;
        flex-wrap: wrap;
        font-size: 12px;
        color: rgba(63, 46, 28, 0.9);
    }

    .merger-participant-list {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        flex-wrap: wrap;
    }

    .merger-bid-summary-value {
        font-variant-numeric: tabular-nums;
        color: rgba(51, 36, 19, 0.96);
        font-weight: 600;
    }

    .merger-bid-summary-at {
        margin-right: -2px;
    }

    .merger-bid-controls {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        flex-wrap: wrap;
        margin-top: 4px;
        margin-bottom: 6px;
    }

    .merger-bid-stepper {
        border: 1px solid rgba(96, 71, 43, 0.34);
        border-radius: 999px;
        background: rgba(241, 228, 207, 0.58);
        color: #3d2d1d;
        letter-spacing: 0.03em;
        font-size: 11px;
        min-width: 38px;
        height: 28px;
        padding: 0 10px;
        transition: background 140ms ease, opacity 140ms ease;
    }

    .merger-bid-stepper:hover:enabled {
        background: rgba(247, 234, 213, 0.82);
    }

    .merger-bid-stepper:disabled {
        opacity: 0.45;
        cursor: default;
    }

    .merger-bid-input-slot {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 5ch;
        padding: 0 0.24em 0.02em;
    }

    .merger-bid-input-slot::after {
        content: '';
        position: absolute;
        left: 0.24em;
        right: 0.24em;
        bottom: -0.03em;
        border-bottom: 2px solid rgba(93, 68, 40, 0.72);
    }

    .merger-bid-input-slot.is-invalid::after {
        border-bottom-color: rgba(151, 50, 37, 0.9);
    }

    .merger-bid-input {
        width: 5ch;
        margin: 0;
        padding: 0.04em 0.12em 0;
        border: none;
        background: transparent;
        text-align: center;
        line-height: 0.86;
        height: 1.05em;
        color: #352312;
        font-size: 24px;
        letter-spacing: 0.01em;
        font-variant-numeric: tabular-nums;
    }

    .merger-bid-input:disabled {
        opacity: 0.56;
    }

    .merger-bid-input:focus,
    .merger-bid-input:focus-visible {
        outline: none;
        box-shadow: none;
    }

    .bid-tracker-message {
        width: 100%;
        font-size: 16px;
        letter-spacing: 0.02em;
    }

    .bid-tracker-content {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px 30px;
        width: 100%;
    }

    .bid-tracker-columns {
        display: grid;
        grid-template-columns: max-content max-content;
        column-gap: 10px;
        row-gap: 2px;
        width: max-content;
        max-width: 100%;
    }

    .bid-player-cell {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        min-width: 0;
        text-align: right;
        padding-right: 0;
        white-space: nowrap;
    }

    .bid-player-cell :global(span) {
        display: inline-flex;
        align-items: center;
        line-height: 1;
        padding-top: 0.1rem;
        padding-bottom: 0.1rem;
        padding-left: 0.3rem;
        padding-right: 0.3rem;
    }

    .bid-value-cell {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        min-width: 0;
        text-align: right;
        font-size: 12px;
        line-height: 1;
        color: rgba(63, 46, 28, 0.9);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .bid-value-text {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 2px;
        min-width: 0;
        line-height: 1;
    }

    .bid-eq-number,
    .bid-eq-total {
        min-width: 1ch;
        text-align: right;
    }

    .bid-eq-number {
        color: rgba(63, 46, 28, 0.6);
        font-weight: 400;
    }

    .bid-eq-token {
        color: rgba(63, 46, 28, 0.56);
        opacity: 0.9;
        font-size: 11px;
        font-weight: 400;
    }

    .bid-eq-total {
        font-weight: 600;
        color: rgba(63, 46, 28, 0.96);
    }

    .formula-equation {
        display: inline-flex;
        align-items: flex-end;
        gap: 12px;
        color: #3f2e1c;
        font-family: 'scriptina-pro', cursive;
        font-size: clamp(36px, 2.3vw + 22px, 56px);
        line-height: 0.8;
    }

    .bid-slot {
        position: relative;
        display: inline-flex;
        min-width: 4.4ch;
        padding: 0 0.24em 0.02em;
    }

    .bid-slot::after {
        content: '';
        position: absolute;
        left: 0.24em;
        right: 0.24em;
        bottom: 0.03em;
        border-bottom: 2.5px solid rgba(93, 68, 40, 0.78);
    }

    .bid-slot.is-invalid::after {
        border-bottom-color: rgba(151, 50, 37, 0.9);
    }

    .bid-value-input {
        width: 4.4ch;
        margin: 0;
        padding: 0.02em 0.1em 0;
        border: none;
        background: transparent;
        appearance: none;
        -webkit-appearance: none;
        border-radius: 0;
        box-sizing: content-box;
        overflow: visible;
        text-align: center;
        line-height: 0.7;
        height: 0.82em;
        color: #352312;
        font-size: 0.74em;
        letter-spacing: 0.02em;
        font-variant-numeric: tabular-nums;
    }

    .bid-value-input:focus {
        outline: none;
        box-shadow: none;
    }

    .bid-value-input:focus-visible {
        outline: none;
        box-shadow: none;
    }

    .formula-token {
        padding-bottom: 0.08em;
        opacity: 0.8;
        font-size: 0.68em;
    }

    .formula-number,
    .formula-total {
        min-width: 1.7ch;
        font-size: 0.74em;
        text-align: center;
        font-variant-numeric: tabular-nums;
    }

    .formula-total {
        min-width: 2.6ch;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0.86;
        padding: 0.25em 0.45em 0.04em 0.34em;
        border-radius: 999px;
        background: rgba(114, 84, 47, 0.14);
    }

    .commit-bid {
        border: 1px solid rgba(96, 71, 43, 0.44);
        border-radius: 999px;
        background: linear-gradient(
            180deg,
            rgba(250, 241, 220, 0.86),
            rgba(219, 198, 163, 0.78)
        );
        color: #3d2d1d;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 12px;
        padding: 7px 12px 6px;
        transition: background 140ms ease, opacity 140ms ease;
    }

    .commit-bid:hover:enabled {
        background: linear-gradient(
            180deg,
            rgba(255, 246, 226, 0.92),
            rgba(228, 208, 174, 0.82)
        );
    }

    .commit-bid:disabled {
        opacity: 0.45;
        cursor: default;
    }

    .finish-production-expansion {
        border: 1px solid rgba(96, 71, 43, 0.44);
        border-radius: 999px;
        background: linear-gradient(
            180deg,
            rgba(250, 241, 220, 0.86),
            rgba(219, 198, 163, 0.78)
        );
        color: #3d2d1d;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 12px;
        padding: 7px 12px 6px;
        transition: background 140ms ease, opacity 140ms ease;
    }

    .finish-production-expansion:hover:enabled {
        background: linear-gradient(
            180deg,
            rgba(255, 246, 226, 0.92),
            rgba(228, 208, 174, 0.82)
        );
    }

    .finish-production-expansion:disabled {
        opacity: 0.45;
        cursor: default;
    }

    @media (max-width: 980px) {
        .bid-formula {
            gap: 12px;
        }

        .formula-equation {
            font-size: clamp(30px, 2vw + 18px, 48px);
        }
    }
</style>
