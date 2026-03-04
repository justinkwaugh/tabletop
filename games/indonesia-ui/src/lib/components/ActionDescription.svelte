<script lang="ts">
    import { type GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        PassReason,
        ResearchArea,
        ActionType,
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

    let {
        action,
        justify = 'start',
        history = true
    }: { action: GameAction; justify?: 'start' | 'center' | 'end'; history?: boolean } = $props()

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

    const justifyClass = $derived(justifyClasses[justify] ?? justifyClasses.start)
    const casingClass = $derived(history ? 'normal-case' : 'uppercase')
</script>

<span class={`inline-flex w-full items-center ${justifyClass} ${casingClass}`}>
    {#if isPlaceCompanyDeeds(action)}
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
        set turn order
    {:else if isStartCompany(action)}
        started company from {action.deedId} at {action.areaId}
    {:else if isProposeMerger(action)}
        proposed merger {action.companyAId} + {action.companyBId}
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
        delivered from {action.cultivatedAreaId} to city {action.cityId} via {action.shippingCompanyId}
    {:else if isChooseOperatingCompany(action)}
        chose company {action.companyId} to operate
    {:else if isExpand(action)}
        expanded to {action.areaId}
        {#if action.metadata?.cost !== undefined && action.metadata.cost > 0}
            (cost {action.metadata.cost})
        {/if}
    {:else if isGrowCity(action)}
        grew city {action.cityId}
        {#if action.metadata}
            ({action.metadata.oldSize} to {action.metadata.newSize})
        {/if}
    {:else if isRemoveCompanyDeed(action)}
        removed unavailable deed {action.deedId}
    {:else if action.type === ActionType.RemoveCompanyDeed}
        removed unavailable deed
    {:else}
        performed {action.type}
    {/if}
</span>
