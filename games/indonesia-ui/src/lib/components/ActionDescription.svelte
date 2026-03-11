<script lang="ts">
    import { type GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import simpleOilImg from '$lib/images/simple-oil.svg'
    import simpleRiceImg from '$lib/images/simple-rice.svg'
    import simpleRubberImg from '$lib/images/simple-rubber.svg'
    import simpleShipImg from '$lib/images/simple-ship.svg'
    import simpleSiapSajiImg from '$lib/images/simple-siapsaji.svg'
    import simpleSpiceImg from '$lib/images/simple-spice.svg'
    import {
        BID_RESEARCH_MULTIPLIERS,
        PassReason,
        ResearchArea,
        ActionType,
        CompanyType,
        GOOD_REVENUE_BY_GOOD,
        Good,
        INDONESIA_REGION_BY_AREA_ID,
        isChooseOperatingCompany,
        isDeliverGood,
        isExpand,
        isGrowCity,
        isIndonesiaNodeId,
        isMergeCompanies,
        isPass,
        isPassMergerBid,
        isPlaceCity,
        isPlaceCompanyDeeds,
        isPlaceMergerBid,
        isPlaceTurnOrderBid,
        isProposeMerger,
        isRemoveCompanyDeed,
        isRemoveSiapSajiArea,
        isResearch,
        isSetTurnOrder,
        isStartCompany
    } from '@tabletop/indonesia'
    import { isAggregatedIndonesiaAction } from '$lib/utils/actionAggregator.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { getRegionName } from '$lib/definitions/regions.js'

    let {
        action,
        justify = 'start',
        history = true,
        cityRegionName,
        fullWidth = true,
        showActor = false
    }: {
        action: GameAction
        justify?: 'start' | 'center' | 'end'
        history?: boolean
        cityRegionName?: string
        fullWidth?: boolean
        showActor?: boolean
    } = $props()

    let gameSession = getGameSession()

    const justifyClasses: Record<'start' | 'center' | 'end', string> = {
        start: 'justify-start',
        center: 'justify-center',
        end: 'justify-end'
    }

    const researchAreaLabels: Record<ResearchArea, string> = {
        [ResearchArea.bid]: 'bid',
        [ResearchArea.slots]: 'slots',
        [ResearchArea.mergers]: 'mergers',
        [ResearchArea.expansion]: 'expansion',
        [ResearchArea.hull]: 'hull'
    }

    const passReasonLabels: Partial<Record<PassReason, string>> = {
        [PassReason.CannotPlaceCity]: 'cannot place city',
        [PassReason.DeclineStartCompany]: 'declined company start',
        [PassReason.DeclineMergerAnnouncement]: 'declined merger announcement',
        [PassReason.FinishOptionalShippingExpansion]: 'finished shipping operation',
        [PassReason.SkipShippingExpansion]: 'skipped shipping expansion',
        [PassReason.FinishOptionalProductionExpansion]: 'finished optional expansion',
        [PassReason.SkipProductionExpansion]: 'skipped production expansion'
    }

    const goodLabels: Record<Good, string> = {
        [Good.Rice]: 'rice',
        [Good.Spice]: 'spice',
        [Good.Rubber]: 'rubber',
        [Good.Oil]: 'oil',
        [Good.SiapSaji]: 'siap saji'
    }

    type ShippingPaymentSummary = {
        ownerPlayerId: string
        amount: number
    }

    type ChooseOperatingCompanyHistoryAction = GameAction & {
        companyId: string
        metadata?: {
            companyType?: CompanyType
            good?: Good
        }
    }

    type DeliverGoodHistoryAction = GameAction & {
        seaAreaIds: string[]
        metadata?: {
            good?: Good
            shippingCost?: number
            shippingPayments?: ShippingPaymentSummary[]
        }
    }

    type ExpandHistoryAction = GameAction & {
        areaId: string
        metadata?: {
            cost?: number
        }
    }

    type PassHistoryAction = GameAction & {
        reason?: PassReason
    }

    type StartCompanyHistoryAction = GameAction & {
        areaId: string
        metadata?: {
            company?: {
                type: CompanyType
                good?: Good
                deeds?: Array<{
                    region?: string
                }>
            }
        }
    }

    function removedDeedLabel(action: GameAction): string {
        if (!isRemoveCompanyDeed(action)) {
            return 'company'
        }

        const deed = action.metadata?.deed
        if (!deed) {
            return 'company'
        }

        if (deed.type === CompanyType.Shipping) {
            return 'shipping'
        }

        return deed.good ? goodLabels[deed.good] : 'company'
    }

    function removedDeedRegionName(action: GameAction): string {
        if (!isRemoveCompanyDeed(action)) {
            return 'unknown region'
        }

        const regionId = action.metadata?.deed?.region
        return regionId ? getRegionName(regionId) : 'unknown region'
    }

    function companyLabel(companyType?: CompanyType, good?: Good): string {
        if (companyType === CompanyType.Production) {
            return `${good ? `${goodLabels[good]} ` : ''}company`
        }
        if (companyType === CompanyType.Shipping) {
            return 'shipping company'
        }
        return 'company'
    }

    function companyTypeLabel(companyType?: CompanyType, good?: Good): string {
        if (companyType === CompanyType.Production) {
            return good ? goodLabels[good] : 'production'
        }
        if (companyType === CompanyType.Shipping) {
            return 'shipping'
        }
        return ''
    }

    function mergeUnitIconSrc(action: GameAction): string | null {
        if (!isMergeCompanies(action)) {
            return null
        }

        if (action.metadata?.proposal.companyType === CompanyType.Shipping) {
            return simpleShipImg
        }

        switch (action.metadata?.proposal.resultingGood) {
            case Good.Rice:
                return simpleRiceImg
            case Good.Spice:
                return simpleSpiceImg
            case Good.Rubber:
                return simpleRubberImg
            case Good.Oil:
                return simpleOilImg
            case Good.SiapSaji:
                return simpleSiapSajiImg
            default:
                return action.metadata?.proposal.isSiapSaji ? simpleSiapSajiImg : null
        }
    }

    function simpleGoodIconSrc(good?: Good): string | null {
        switch (good) {
            case Good.Rice:
                return simpleRiceImg
            case Good.Spice:
                return simpleSpiceImg
            case Good.Rubber:
                return simpleRubberImg
            case Good.Oil:
                return simpleOilImg
            case Good.SiapSaji:
                return simpleSiapSajiImg
            default:
                return null
        }
    }

    function mergeUnitLabel(action: GameAction): string {
        if (!isMergeCompanies(action)) {
            return 'units'
        }

        return action.metadata?.proposal.companyType === CompanyType.Shipping ? 'ships' : 'goods'
    }

    function mergeProposalLabel(action: GameAction): string {
        if (!isMergeCompanies(action)) {
            return 'company'
        }

        if (action.metadata?.proposal.companyType === CompanyType.Shipping) {
            return 'shipping'
        }

        const resultingGood = action.metadata?.proposal.resultingGood
        if (resultingGood) {
            return goodLabels[resultingGood]
        }

        return action.metadata?.proposal.isSiapSaji ? goodLabels[Good.SiapSaji] : 'company'
    }

    function startCompanyTypeLabel(action: GameAction): string {
        if (!isStartCompany(action)) {
            return 'company'
        }

        const company = (action as StartCompanyHistoryAction).metadata?.company
        if (company?.type === CompanyType.Production) {
            return `${company.good ? goodLabels[company.good] : 'production'} company`
        }

        if (company?.type === CompanyType.Shipping) {
            return 'shipping company'
        }

        return 'company'
    }

    function startCompanyRegionName(action: GameAction): string {
        if (!isStartCompany(action)) {
            return 'unknown region'
        }

        const startCompanyAction = action as StartCompanyHistoryAction
        const deedRegion = startCompanyAction.metadata?.company?.deeds?.[0]?.region
        if (deedRegion) {
            return getRegionName(deedRegion)
        }

        if (!isIndonesiaNodeId(startCompanyAction.areaId)) {
            return startCompanyAction.areaId ?? 'unknown region'
        }

        const regionId = INDONESIA_REGION_BY_AREA_ID[startCompanyAction.areaId]
        return regionId ? getRegionName(regionId) : startCompanyAction.areaId
    }

    function startCompanyLocationLabel(action: GameAction): string {
        if (!isStartCompany(action)) {
            return 'in unknown region'
        }

        const company = (action as StartCompanyHistoryAction).metadata?.company
        const regionName = startCompanyRegionName(action)
        if (company?.type === CompanyType.Shipping) {
            return `in the seas surrounding ${regionName}`
        }

        return `in ${regionName}`
    }

    function cityPlacementRegionName(action: GameAction): string {
        if (!isPlaceCity(action) || !isIndonesiaNodeId(action.areaId)) {
            return isPlaceCity(action) ? action.areaId : 'unknown region'
        }

        const regionId = INDONESIA_REGION_BY_AREA_ID[action.areaId]
        return regionId ? getRegionName(regionId) : action.areaId
    }

    function turnOrderBidDisplay(action: GameAction): {
        total: number
        base: number
        multiplier: number
    } | null {
        if (!isPlaceTurnOrderBid(action)) {
            return null
        }

        const base = action.amount
        const total = action.metadata?.multipliedAmount ?? base
        const multiplier = base > 0 ? Math.round(total / base) : 1

        return {
            total,
            base,
            multiplier: Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1
        }
    }

    function turnOrderBidDescription(action: GameAction): string {
        const bidDisplay = turnOrderBidDisplay(action)
        if (!bidDisplay) {
            return 'bid ?'
        }

        return bidDisplay.multiplier > 1
            ? `bid ${bidDisplay.total} (${bidDisplay.base} x ${bidDisplay.multiplier})`
            : `bid ${bidDisplay.total}`
    }

    function researchLevelDisplay(researchArea: ResearchArea, level?: number): string {
        if (level === undefined) {
            return '?'
        }

        if (researchArea === ResearchArea.bid) {
            return `x${BID_RESEARCH_MULTIPLIERS[level] ?? 1}`
        }

        return String(level + 1)
    }

    function aggregatedCompanyOperationActions(action: GameAction): GameAction[] {
        if (
            !isAggregatedIndonesiaAction(action) ||
            action.aggregatedType !== ActionType.ChooseOperatingCompany
        ) {
            return []
        }

        if (typeof action.index !== 'number' || !action.playerId) {
            return []
        }

        const lastActionPosition = gameSession.actions.findLastIndex(
            (candidate) =>
                candidate.index === action.index &&
                candidate.playerId === action.playerId &&
                (isChooseOperatingCompany(candidate) ||
                    isDeliverGood(candidate) ||
                    isExpand(candidate) ||
                    isPass(candidate))
        )
        if (lastActionPosition === -1) {
            return []
        }

        const operationActions: GameAction[] = []
        for (let position = lastActionPosition; position >= 0; position -= 1) {
            const candidate = gameSession.actions[position]
            if (
                candidate.playerId !== action.playerId ||
                (!isDeliverGood(candidate) &&
                    !isChooseOperatingCompany(candidate) &&
                    !isExpand(candidate) &&
                    !isPass(candidate))
            ) {
                break
            }

            operationActions.unshift(candidate)
            if (isChooseOperatingCompany(candidate)) {
                break
            }
        }

        return operationActions
    }

    function aggregatedDeliverGoodActions(action: GameAction): DeliverGoodHistoryAction[] {
        return aggregatedCompanyOperationActions(action).filter((candidate) =>
            isDeliverGood(candidate)
        ) as DeliverGoodHistoryAction[]
    }

    function aggregatedExpandActions(action: GameAction): ExpandHistoryAction[] {
        return aggregatedCompanyOperationActions(action).filter((candidate) =>
            isExpand(candidate)
        ) as ExpandHistoryAction[]
    }

    function aggregatedPassActions(action: GameAction): PassHistoryAction[] {
        return aggregatedCompanyOperationActions(action).filter((candidate) =>
            isPass(candidate)
        ) as PassHistoryAction[]
    }

    function aggregatedChooseOperatingCompanyAction(
        action: GameAction
    ): ChooseOperatingCompanyHistoryAction | null {
        return (
            (aggregatedCompanyOperationActions(action).find((candidate) =>
                isChooseOperatingCompany(candidate)
            ) as ChooseOperatingCompanyHistoryAction | undefined) ?? null
        )
    }

    function aggregatedShippingPayouts(action: GameAction): {
        ownerPlayerId: string
        shipCount: number
        amount: number
    }[] {
        const payoutsByOwnerPlayerId = new Map<
            string,
            {
                ownerPlayerId: string
                shipCount: number
                amount: number
            }
        >()

        for (const delivery of aggregatedDeliverGoodActions(action)) {
            const ownerPlayerId = delivery.metadata?.shippingPayments?.[0]?.ownerPlayerId
            if (!ownerPlayerId) {
                continue
            }

            const current = payoutsByOwnerPlayerId.get(ownerPlayerId) ?? {
                ownerPlayerId,
                shipCount: 0,
                amount: 0
            }
            current.shipCount += delivery.seaAreaIds.length
            current.amount +=
                delivery.metadata?.shippingCost ??
                delivery.metadata?.shippingPayments?.reduce((sum, payment) => sum + payment.amount, 0) ??
                0
            payoutsByOwnerPlayerId.set(ownerPlayerId, current)
        }

        return [...payoutsByOwnerPlayerId.values()]
    }

    function aggregatedShippingTotals(
        payouts: {
            ownerPlayerId: string
            shipCount: number
            amount: number
        }[]
    ): { shipCount: number; amount: number } {
        return payouts.reduce(
            (totals, payout) => ({
                shipCount: totals.shipCount + payout.shipCount,
                amount: totals.amount + payout.amount
            }),
            { shipCount: 0, amount: 0 }
        )
    }

    function aggregatedDeliveryProfitSummary(
        action: GameAction,
        shippingCostTotal: number
    ): {
        good?: Good
        unitPrice: number | null
        revenue: number | null
        shippingCost: number
        profit: number | null
    } {
        if (
            !isAggregatedIndonesiaAction(action) ||
            action.aggregatedType !== ActionType.ChooseOperatingCompany
        ) {
            return {
                unitPrice: null,
                revenue: null,
                shippingCost: shippingCostTotal,
                profit: null
            }
        }

        const deliveries = aggregatedDeliverGoodActions(action)
        const chooseAction = aggregatedChooseOperatingCompanyAction(action)
        const firstDelivery = deliveries[0]

        let resolvedGood: Good | undefined = firstDelivery?.metadata?.good ?? chooseAction?.metadata?.good
        if (!resolvedGood && firstDelivery) {
            const firstDeliveryPosition = gameSession.actions.findIndex(
                (candidate) => candidate.id === firstDelivery.id
            )
            for (let position = firstDeliveryPosition - 1; position >= 0; position -= 1) {
                const candidate = gameSession.actions[position]
                if (isChooseOperatingCompany(candidate) && candidate.playerId === action.playerId) {
                    const chooseAction = candidate as ChooseOperatingCompanyHistoryAction
                    if (chooseAction.metadata?.companyType === CompanyType.Production) {
                        resolvedGood = chooseAction.metadata?.good
                    }
                    if (!resolvedGood && typeof chooseAction.companyId === 'string') {
                        const company = gameSession.gameState.companies.find(
                            (entry) => entry.id === chooseAction.companyId
                        )
                        if (company?.type === CompanyType.Production) {
                            resolvedGood = company.good
                        }
                    }
                    break
                }
            }
        }

        if (!resolvedGood) {
            const operatingCompanyId = gameSession.gameState.operatingCompanyId
            const company = operatingCompanyId
                ? gameSession.gameState.companies.find((entry) => entry.id === operatingCompanyId)
                : undefined
            if (company?.type === CompanyType.Production) {
                resolvedGood = company.good
            }
        }

        const unitPrice = resolvedGood ? GOOD_REVENUE_BY_GOOD[resolvedGood] : null
        const revenue = unitPrice === null ? null : action.count * unitPrice
        const shippingCost = shippingCostTotal
        const profit = revenue === null ? null : revenue - shippingCost

        return {
            good: resolvedGood,
            unitPrice,
            revenue,
            shippingCost,
            profit
        }
    }

    function aggregatedProducedGoodsCount(action: GameAction): number | null {
        if (
            !isAggregatedIndonesiaAction(action) ||
            action.aggregatedType !== ActionType.ChooseOperatingCompany
        ) {
            return null
        }

        const chooseAction = aggregatedChooseOperatingCompanyAction(action)
        if (!chooseAction?.companyId) {
            return null
        }

        const company = gameSession.gameState.companies.find(
            (entry) => entry.id === chooseAction.companyId
        )
        if (company?.type !== CompanyType.Production) {
            return null
        }

        const currentCultivatedCount = Object.values(gameSession.gameState.board.areas).filter(
            (area) => area.type === 'Cultivated' && 'companyId' in area && area.companyId === company.id
        ).length

        if (currentCultivatedCount === 0) {
            return null
        }

        return Math.max(action.count, currentCultivatedCount - aggregatedExpandActions(action).length)
    }

    function aggregatedSoldAllGoods(action: GameAction): boolean {
        if (
            !isAggregatedIndonesiaAction(action) ||
            action.aggregatedType !== ActionType.ChooseOperatingCompany ||
            action.count === 0
        ) {
            return false
        }

        const expandActions = aggregatedExpandActions(action)
        if (expandActions.length > 0) {
            return expandActions.every((expandAction) => (expandAction.metadata?.cost ?? 0) === 0)
        }

        const producedGoodsCount = aggregatedProducedGoodsCount(action)
        return producedGoodsCount !== null && action.count >= producedGoodsCount
    }

    function aggregatedExpansionSummary(action: GameAction): {
        count: number
        isFree: boolean
        totalCost: number
    } | null {
        const expandActions = aggregatedExpandActions(action)
        if (expandActions.length === 0) {
            return null
        }

        return {
            count: expandActions.length,
            isFree: expandActions.every((expandAction) => (expandAction.metadata?.cost ?? 0) === 0),
            totalCost: expandActions.reduce(
                (sum, expandAction) => sum + (expandAction.metadata?.cost ?? 0),
                0
            )
        }
    }

    function operationSummaryIsInProgress(action: GameAction): boolean {
        const operationActions = aggregatedCompanyOperationActions(action)
        const lastOperationAction = operationActions.at(-1)
        const chooseAction = aggregatedChooseOperatingCompanyAction(action)
        if (!lastOperationAction || !chooseAction?.companyId) {
            return false
        }

        return (
            gameSession.actions.at(-1)?.id === lastOperationAction.id &&
            gameSession.gameState.operatingCompanyId === chooseAction.companyId
        )
    }

    function operationSummaryHasSkipExpandPass(action: GameAction): boolean {
        return aggregatedPassActions(action).some(
            (passAction) =>
                passAction.reason === PassReason.SkipShippingExpansion ||
                passAction.reason === PassReason.FinishOptionalShippingExpansion ||
                passAction.reason === PassReason.SkipProductionExpansion ||
                passAction.reason === PassReason.FinishOptionalProductionExpansion
        )
    }

    function shippingOperationCouldNotExpand(action: GameAction): boolean {
        return aggregatedPassActions(action).some(
            (passAction) => passAction.reason === PassReason.SkipShippingExpansion
        )
    }

    function shippingOperationChoseNotToExpand(action: GameAction): boolean {
        return aggregatedPassActions(action).some(
            (passAction) => passAction.reason === PassReason.FinishOptionalShippingExpansion
        )
    }

    function productionOperationSkippedExpansion(action: GameAction): boolean {
        return aggregatedPassActions(action).some(
            (passAction) => passAction.reason === PassReason.FinishOptionalProductionExpansion
        )
    }

    function productionOperationHadNoEffect(action: GameAction): boolean {
        return aggregatedPassActions(action).some(
            (passAction) => passAction.reason === PassReason.SkipProductionExpansion
        )
    }

    function aggregatedMergerPassPlayerIds(action: GameAction): string[] {
        if (
            !isAggregatedIndonesiaAction(action) ||
            (action.aggregatedType !== ActionType.PassMergerBid &&
                action.aggregatedType !== ActionType.Pass &&
                action.aggregatedType !== ActionType.PlaceTurnOrderBid)
        ) {
            return []
        }

        return action.playerIds ?? []
    }

    function aggregatedTurnOrderBidActions(
        action: GameAction
    ): Array<{ id: string; playerId: string; description: string }> {
        if (
            !isAggregatedIndonesiaAction(action) ||
            action.aggregatedType !== ActionType.PlaceTurnOrderBid ||
            typeof action.index !== 'number'
        ) {
            return []
        }

        const lastActionPosition = gameSession.actions.findLastIndex(
            (candidate) => candidate.index === action.index && isPlaceTurnOrderBid(candidate)
        )
        if (lastActionPosition === -1) {
            return []
        }

        const bidActions: Array<{ id: string; playerId: string; description: string }> = []
        for (let position = lastActionPosition; position >= 0; position -= 1) {
            const candidate = gameSession.actions[position]
            if (!isPlaceTurnOrderBid(candidate)) {
                break
            }
            bidActions.unshift({
                id: candidate.id,
                playerId: candidate.playerId,
                description: turnOrderBidDescription(candidate)
            })
        }

        return bidActions
    }

    function rendersPlayerList(action: GameAction): boolean {
        return (
            isAggregatedIndonesiaAction(action) &&
            (action.aggregatedType === ActionType.ChooseOperatingCompany ||
                action.aggregatedType === ActionType.Pass ||
                action.aggregatedType === ActionType.PlaceTurnOrderBid ||
                action.aggregatedType === ActionType.PassMergerBid)
        )
    }

    function rendersOwnActor(action: GameAction): boolean {
        return rendersPlayerList(action)
    }

    const justifyClass = $derived(justifyClasses[justify] ?? justifyClasses.start)
    const casingClass = $derived(history ? 'normal-case' : 'uppercase')
    const containerClass = $derived(
        fullWidth ? `inline-flex w-full items-center ${justifyClass}` : 'inline'
    )
    const operationSummaryAlignClass = $derived(justify === 'center' ? 'items-center' : 'items-start')
    const operationSummaryCardAlignClass = $derived(justify === 'center' ? 'self-center' : 'self-start')
</script>

<span class={`${containerClass} ${casingClass}`}>
    {#if showActor && action.playerId && !rendersOwnActor(action)}
        <span class="whitespace-nowrap"
            ><PlayerName playerId={action.playerId} additionalClasses="px-1.5" /><span
                class="inline-block w-[2px]"
            ></span
        ></span>
    {/if}
    {#if isAggregatedIndonesiaAction(action)}
        {#if action.aggregatedType === ActionType.ChooseOperatingCompany}
            {@const shippingPayouts = aggregatedShippingPayouts(action)}
            {@const shippingTotals = aggregatedShippingTotals(shippingPayouts)}
            {@const profitSummary = aggregatedDeliveryProfitSummary(action, shippingTotals.amount)}
            {@const expansionSummary = aggregatedExpansionSummary(action)}
            {@const chooseAction = aggregatedChooseOperatingCompanyAction(action)}
            {@const operationInProgress = operationSummaryIsInProgress(action)}
            {@const skippedExpansion = operationSummaryHasSkipExpandPass(action)}
            {@const shippingCouldNotExpand = shippingOperationCouldNotExpand(action)}
            {@const shippingChoseNotToExpand = shippingOperationChoseNotToExpand(action)}
            <span class={`inline-flex flex-col gap-1 text-left align-top ${operationSummaryAlignClass}`}>
                {#if chooseAction?.metadata?.companyType === CompanyType.Shipping}
                    <span>
                        {#if showActor && action.playerId}
                            <PlayerName playerId={action.playerId} possessive={true} additionalClasses="px-1.5" />
                        {/if}
                        shipping company
                        {#if action.count > 0}
                            expanded into {action.count} {action.count === 1 ? 'area' : 'areas'}
                        {:else if shippingCouldNotExpand}
                            could not expand
                        {:else if shippingChoseNotToExpand || !operationInProgress}
                            chose not to expand
                        {:else}
                            began operating
                        {/if}
                    </span>
                {:else if action.count === 0}
                    <span>
                        {#if showActor && action.playerId}
                            <PlayerName playerId={action.playerId} possessive={true} additionalClasses="px-1.5" />
                        {/if}
                        {profitSummary.good ? `${goodLabels[profitSummary.good]} ` : ''}company
                        {#if operationInProgress}
                            began operating
                        {:else}
                            operated
                            {#if expansionSummary}
                                and expanded into {expansionSummary.count} {expansionSummary.count === 1 ? 'area' : 'areas'}
                                {expansionSummary.isFree ? 'for free' : `for ${expansionSummary.totalCost}`}
                            {:else if productionOperationSkippedExpansion(action)}
                                but chose not to expand
                            {:else if productionOperationHadNoEffect(action)}
                                to no effect
                            {/if}
                        {/if}
                    </span>
                {:else}
                    <span>
                        {#if showActor && action.playerId}
                            <PlayerName playerId={action.playerId} possessive={true} additionalClasses="px-1.5" />
                        {/if}
                        {profitSummary.good ? `${goodLabels[profitSummary.good]} ` : ''}company
                        {#if aggregatedSoldAllGoods(action)}
                            sold all {action.count}
                        {:else}
                            sold {action.count}
                        {/if}
                        {action.count === 1 ? ' good ' : ' goods '}for {profitSummary.profit ?? '?'} profit
                        {#if expansionSummary}
                            and expanded into {expansionSummary.count} {expansionSummary.count === 1 ? 'area' : 'areas'}
                            {expansionSummary.isFree ? 'for free' : `for ${expansionSummary.totalCost}`}
                        {:else if skippedExpansion || !operationInProgress}
                            but did not expand
                        {/if}
                    </span>
                {/if}
                {#if chooseAction?.metadata?.companyType === CompanyType.Production && action.count > 0 && shippingPayouts.length > 0}
                    <span
                        class={`mt-2.5 flex w-full max-w-[25rem] flex-col items-start gap-1 rounded-xl border border-[#ad9c80]/40 bg-[#ede2dc] px-3 py-2 text-[0.88em] leading-tight text-[#5e3f27] ${operationSummaryCardAlignClass}`}
                    >
                        <span class="mt-1 mb-[0.1875rem] text-[0.76em] uppercase tracking-[0.08em] text-[#7a5d3f]">Sale Details</span>
                        <span class="grid w-full grid-cols-[minmax(0,1fr)_40px_40px] items-center gap-x-3 gap-y-0.5">
                            <span class="grid min-w-0 grid-cols-[40px_40px_56px] items-center gap-x-3 justify-items-center">
                                <span class="flex items-center justify-center">
                                    {#if simpleGoodIconSrc(profitSummary.good)}
                                        <img
                                            src={simpleGoodIconSrc(profitSummary.good) ?? undefined}
                                            alt={profitSummary.good ? goodLabels[profitSummary.good] : 'goods'}
                                            class="h-[16px] w-[16px] object-contain"
                                        />
                                    {/if}
                                </span>
                                <span class="text-center text-[0.82em] uppercase tracking-[0.08em] text-[#7a5d3f]">Price</span>
                                <span class="text-center text-[0.82em] uppercase tracking-[0.08em] text-[#7a5d3f]">Income</span>
                            </span>
                            <span class="flex items-center justify-center">
                                <img
                                    src={simpleShipImg}
                                    alt="shipping"
                                    class="h-[16px] w-[16px] object-contain"
                                />
                            </span>
                            <span class="justify-self-end text-right text-[0.82em] uppercase tracking-[0.08em] text-[#7a5d3f]">Profit</span>
                            <span class="grid min-w-0 grid-cols-[40px_40px_56px] items-center gap-x-3">
                                <span class="text-center tabular-nums text-[#5e3f27]">{action.count}</span>
                                <span class="text-center tabular-nums text-[#5e3f27]">
                                    {profitSummary.unitPrice ?? '?'}
                                </span>
                                <span class="text-center tabular-nums text-[#5e3f27]">
                                    {profitSummary.revenue ?? '?'}
                                </span>
                            </span>
                            <span class="text-center tabular-nums text-[#5e3f27]">
                                -{profitSummary.shippingCost}
                            </span>
                            <span class="text-right tabular-nums text-[#5e3f27]">
                                {profitSummary.profit ?? '?'}
                            </span>
                        </span>
                        {#if shippingPayouts.length > 0}
                            <span class="mt-3 mb-[-0.125rem] text-[0.76em] uppercase tracking-[0.08em] text-[#7a5d3f]">Shipping Details</span>
                            <span class="grid w-full grid-cols-[minmax(0,1fr)_40px_40px] items-center gap-x-3 gap-y-0.5">
                                <span></span>
                                <span class="flex items-center justify-center">
                                    <img
                                        src={simpleShipImg}
                                        alt="ships"
                                        class="h-[16px] w-[16px] object-contain"
                                    />
                                </span>
                                <span class="justify-self-end text-right text-[0.82em] uppercase tracking-[0.08em] text-[#7a5d3f]">Cost</span>
                                {#each shippingPayouts as payout}
                                    <span class="min-w-0 flex items-center">
                                        <PlayerName playerId={payout.ownerPlayerId} />
                                    </span>
                                    <span class="text-center tabular-nums text-[#5e3f27]">{payout.shipCount}</span>
                                    <span class="text-right tabular-nums text-[#5e3f27]">{payout.amount}</span>
                                {/each}
                                <span class="col-span-3 mt-0.5 h-px bg-[#ad9c80]/40"></span>
                                <span></span>
                                <span class="text-center tabular-nums text-[#5e3f27]">
                                    {shippingTotals.shipCount}
                                </span>
                                <span class="text-right tabular-nums text-[#5e3f27]">
                                    {shippingTotals.amount}
                                </span>
                            </span>
                        {/if}
                    </span>
                {/if}
            </span>
        {:else if action.aggregatedType === ActionType.Expand}
            expanded into {action.count} {action.count === 1 ? 'area' : 'areas'}
        {:else if action.aggregatedType === ActionType.PassMergerBid}
            {@const playerIds = aggregatedMergerPassPlayerIds(action)}
            {#each playerIds as playerId, index (playerId)}
                {#if index > 0}
                    {index === playerIds.length - 1 ? ' and ' : ', '}
                {/if}
                <PlayerName {playerId} additionalClasses="px-1.5" />
            {/each}
            {' passed'}
        {:else if action.aggregatedType === ActionType.Pass}
            {@const playerIds = aggregatedMergerPassPlayerIds(action)}
            {#each playerIds as playerId, index (playerId)}
                {#if index > 0}
                    {index === playerIds.length - 1 ? ' and ' : ', '}
                {/if}
                <PlayerName {playerId} additionalClasses="px-1.5" />
            {/each}
            {' declined to propose a merger'}
        {:else if action.aggregatedType === ActionType.PlaceTurnOrderBid}
            <span class="inline-flex flex-col items-start gap-0.5">
                {#each aggregatedTurnOrderBidActions(action) as bidAction (bidAction.id)}
                    <span>
                        <PlayerName playerId={bidAction.playerId} additionalClasses="px-1.5" />
                        <span class="inline-block w-[2px]"></span>
                        {bidAction.description}
                    </span>
                {/each}
            </span>
        {:else if action.aggregatedType === ActionType.RemoveSiapSajiArea}
            removed {action.count} Siap Saji {action.count === 1 ? 'area' : 'areas'}
        {:else}
            performed {action.aggregatedType}
        {/if}
    {:else if isPlaceCompanyDeeds(action)}
        Added new company deeds to the board
    {:else if isPlaceCity(action)}
        placed a city in {cityPlacementRegionName(action)}
    {:else if isPass(action)}
        passed
        {#if action.reason}
            ({passReasonLabels[action.reason] ?? action.reason})
        {/if}
    {:else if isPlaceTurnOrderBid(action)}
        {@const bidDisplay = turnOrderBidDisplay(action)}
        bid {bidDisplay?.total ?? action.amount}
        {#if bidDisplay && bidDisplay.multiplier > 1}
            ({bidDisplay.base} x {bidDisplay.multiplier})
        {/if}
    {:else if isSetTurnOrder(action)}
        <span class="inline-flex flex-col items-start gap-0.5">
            <span>New turn order</span>
        {#if action.metadata?.newOrder?.length}
                <span class="mt-1 inline-flex flex-col items-start gap-0.5 leading-tight">
                    {#each action.metadata.newOrder as playerId}
                        <span><PlayerName {playerId} /></span>
                    {/each}
                </span>
            {/if}
        </span>
    {:else if isStartCompany(action)}
        started the {startCompanyTypeLabel(action)} {startCompanyLocationLabel(action)}
    {:else if isProposeMerger(action)}
        <span>
            proposed a merger between
            {#if action.metadata?.display}
                <PlayerName playerId={action.metadata.display.companyA.ownerId} possessive={true} />
                {companyLabel(
                    action.metadata.display.companyA.companyType,
                    action.metadata.display.companyA.good
                )}
                and
                <PlayerName playerId={action.metadata.display.companyB.ownerId} possessive={true} />
                {companyTypeLabel(
                    action.metadata.display.companyB.companyType,
                    action.metadata.display.companyB.good
                )} company
            {:else}
                {action.companyAId} and {action.companyBId}
            {/if}
        </span>
    {:else if isPlaceMergerBid(action)}
        bid {action.amount}
    {:else if isPassMergerBid(action)}
        passed
    {:else if isMergeCompanies(action)}
        {@const unitIconSrc = mergeUnitIconSrc(action)}
        <span class="inline-flex flex-col items-start gap-1">
            <span>
                {#if action.metadata?.auctionResult.winnerId}
                    <PlayerName playerId={action.metadata.auctionResult.winnerId} /> won the {mergeProposalLabel(action)} merger
                {:else}
                    <span>Unknown player won the {mergeProposalLabel(action)} merger</span>
                {/if}
                with a bid of {action.metadata?.auctionResult.highBid ?? '?'}
            </span>
            {#if action.metadata?.ownerPayments}
                <span class="inline-grid w-fit grid-cols-[max-content_24px_max-content] items-center gap-x-3 gap-y-0.5 rounded-xl border border-[#ad9c80]/40 bg-[#ede2dc] px-3 py-2 text-[0.88em] leading-tight text-[#5e3f27]">
                    <span></span>
                    <span class="flex items-center justify-center">
                        {#if unitIconSrc}
                            <img
                                src={unitIconSrc}
                                alt={mergeUnitLabel(action)}
                                class="h-[16px] w-[16px] object-contain"
                            />
                        {/if}
                    </span>
                    <span class="text-[0.82em] uppercase tracking-[0.08em] text-[#7a5d3f]">Payout</span>
                    {#each action.metadata.ownerPayments as payout}
                        <span class="flex items-center">
                            <PlayerName playerId={payout.ownerId} />
                        </span>
                        <span class="text-center tabular-nums text-[#5e3f27]">{payout.unitCount}</span>
                        <span class="text-right tabular-nums text-[#5e3f27]">{payout.payout}</span>
                    {/each}
                </span>
            {/if}
        </span>
    {:else if isRemoveSiapSajiArea(action)}
        removed Siap Saji area {action.areaId}
    {:else if isResearch(action)}
        increased {researchAreaLabels[action.researchArea]} to {researchLevelDisplay(
            action.researchArea,
            action.metadata?.newLevel
        )}
        {#if action.targetPlayerId !== action.playerId}
            for <PlayerName playerId={action.targetPlayerId} />
        {/if}
    {:else if isDeliverGood(action)}
        delivered {action.metadata?.good ? goodLabels[action.metadata.good] : 'goods'} using {action.seaAreaIds.length}
        {action.seaAreaIds.length === 1 ? 'ship' : 'ships'}
    {:else if isChooseOperatingCompany(action)}
        operated a
        {#if action.metadata?.companyType === CompanyType.Production}
            {action.metadata?.good ? `${goodLabels[action.metadata.good]} ` : ''}company
        {:else if action.metadata?.companyType === CompanyType.Shipping}
            shipping company
        {:else}
            company
        {/if}
    {:else if isExpand(action)}
        expanded to {action.areaId}
        {#if action.metadata?.cost !== undefined && action.metadata.cost > 0}
            (cost {action.metadata.cost})
        {/if}
    {:else if isGrowCity(action)}
        The city in {cityRegionName ?? 'unknown region'} grew to size {action.metadata?.newSize ?? '?'}
    {:else if isRemoveCompanyDeed(action)}
        Removed {removedDeedLabel(action)} deed from {removedDeedRegionName(action)}
    {:else if action.type === ActionType.RemoveCompanyDeed}
        Removed company deed
    {:else}
        performed {action.type}
    {/if}
</span>
