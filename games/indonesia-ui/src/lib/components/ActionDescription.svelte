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
        PassReason,
        ResearchArea,
        ActionType,
        CompanyType,
        Good,
        isChooseOperatingCompany,
        isDeliverGood,
        isExpand,
        isGrowCity,
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

    const justifyClass = $derived(justifyClasses[justify] ?? justifyClasses.start)
    const casingClass = $derived(history ? 'normal-case' : 'uppercase')
    const containerClass = $derived(
        fullWidth ? `inline-flex w-full items-center ${justifyClass}` : 'inline'
    )
</script>

<span class={`${containerClass} ${casingClass}`}>
    {#if showActor && action.playerId}
        <span class="whitespace-nowrap"
            ><PlayerName playerId={action.playerId} additionalClasses="px-1.5" /><span
                class="inline-block w-[2px]"
            ></span
        ></span>
    {/if}
    {#if isAggregatedIndonesiaAction(action)}
        {#if action.aggregatedType === ActionType.Expand}
            expanded into {action.count} {action.count === 1 ? 'area' : 'areas'}
        {:else if action.aggregatedType === ActionType.RemoveSiapSajiArea}
            removed {action.count} Siap Saji {action.count === 1 ? 'area' : 'areas'}
        {:else}
            performed {action.aggregatedType}
        {/if}
    {:else if isPlaceCompanyDeeds(action)}
        refreshed company deeds
    {:else if isPlaceCity(action)}
        placed a city at {action.areaId}
    {:else if isPass(action)}
        passed
        {#if action.reason}
            ({passReasonLabels[action.reason] ?? action.reason})
        {/if}
    {:else if isPlaceTurnOrderBid(action)}
        bid {action.amount} for turn order
        {#if action.metadata?.multipliedAmount !== undefined}
            (total {action.metadata.multipliedAmount})
        {/if}
    {:else if isSetTurnOrder(action)}
        <span class="inline-flex flex-col items-start gap-0.5">
            <span>New turn order set:</span>
            {#if action.metadata?.newOrder?.length}
                <span class="inline-flex flex-col items-start gap-0.5 text-[0.78em] leading-tight">
                    {#each action.metadata.newOrder as playerId}
                        <span><PlayerName {playerId} /></span>
                    {/each}
                </span>
            {/if}
        </span>
    {:else if isStartCompany(action)}
        started company from {action.deedId} at {action.areaId}
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
        bid {action.amount} in merger auction
    {:else if isPassMergerBid(action)}
        passed in merger auction
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
        researched {researchAreaLabels[action.researchArea]}
        {#if action.targetPlayerId !== action.playerId}
            for <PlayerName playerId={action.targetPlayerId} />
        {/if}
        {#if action.metadata}
            ({action.metadata.oldLevel} to {action.metadata.newLevel})
        {/if}
    {:else if isDeliverGood(action)}
        delivered {action.metadata?.good ? goodLabels[action.metadata.good] : 'goods'} using {action.seaAreaIds.length}
        {action.seaAreaIds.length === 1 ? 'ship' : 'ships'}
    {:else if isChooseOperatingCompany(action)}
        began operating their
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
        removed unavailable deed {action.deedId}
    {:else if action.type === ActionType.RemoveCompanyDeed}
        removed unavailable deed
    {:else}
        performed {action.type}
    {/if}
</span>
