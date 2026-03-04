<script lang="ts">
    import { type GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
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
        fullWidth = true
    }: {
        action: GameAction
        justify?: 'start' | 'center' | 'end'
        history?: boolean
        cityRegionName?: string
        fullWidth?: boolean
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

    const justifyClass = $derived(justifyClasses[justify] ?? justifyClasses.start)
    const casingClass = $derived(history ? 'normal-case' : 'uppercase')
</script>

<span class={`inline-flex ${fullWidth ? 'w-full' : ''} items-center ${justifyClass} ${casingClass}`}>
    {#if isAggregatedIndonesiaAction(action)}
        {#if action.aggregatedType === ActionType.Expand}
            expanded into {action.count} {action.count === 1 ? 'area' : 'areas'}
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
        <span class="inline-flex flex-wrap items-center gap-1">
            <span>proposed merger between</span>
            {#if action.metadata?.display}
                <PlayerName playerId={action.metadata.display.companyA.ownerId} possessive={true} />
                <span
                    >{companyLabel(
                        action.metadata.display.companyA.companyType,
                        action.metadata.display.companyA.good
                    )}</span
                >
                <span>and</span>
                <PlayerName playerId={action.metadata.display.companyB.ownerId} possessive={true} />
                <span
                    >{companyTypeLabel(
                        action.metadata.display.companyB.companyType,
                        action.metadata.display.companyB.good
                    )} company</span
                >
            {:else}
                <span>{action.companyAId} and {action.companyBId}</span>
            {/if}
        </span>
    {:else if isPlaceMergerBid(action)}
        bid {action.amount} in merger auction
    {:else if isPassMergerBid(action)}
        passed in merger auction
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
