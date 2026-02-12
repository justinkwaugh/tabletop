<script lang="ts">
    import { type GameAction } from '@tabletop/common'
    import {
        ActionType,
        PassReason,
        WorkerActionType,
        isAddBus,
        isAddPassengers,
        isChooseWorkerAction,
        isPass,
        isPlaceBuilding,
        isPlaceBusLine,
        isRotateTime,
        isSetFirstPlayer,
        isStopTime,
        isVroom
    } from '@tabletop/bus'
    import { isAggregatedBusAction } from '$lib/aggregates/aggregatedBusAction.js'

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

    const workerActionLabels: Record<WorkerActionType, string> = {
        [WorkerActionType.Expansion]: 'line expansion',
        [WorkerActionType.Buildings]: 'buildings',
        [WorkerActionType.Passengers]: 'passengers',
        [WorkerActionType.Buses]: 'buses',
        [WorkerActionType.Clock]: 'clock',
        [WorkerActionType.Vroom]: 'vroom',
        [WorkerActionType.StartingPlayer]: 'starting player'
    }

    const passReasonLabels: Partial<Record<PassReason, string>> = {
        [PassReason.DoneActions]: 'done choosing actions',
        [PassReason.CannotExpandLine]: 'no valid line expansion',
        [PassReason.CannotAddBus]: 'cannot add buses',
        [PassReason.CannotAddPassenger]: 'cannot add passengers',
        [PassReason.CannotAddBuildings]: 'cannot add buildings',
        [PassReason.DeclinedClock]: 'declined clock',
        [PassReason.CannotVroom]: 'no valid deliveries'
    }

    let justifyClass = $derived(justifyClasses[justify] ?? justifyClasses.start)
    let casingClass = $derived(history ? 'normal-case' : 'uppercase')
    let leftGapClass = $derived(action.playerId ? 'ms-1' : '')

    function pluralizePassengers(value: number): string {
        return value === 1 ? 'passenger' : 'passengers'
    }

    function pluralizeSegments(value: number): string {
        return value === 1 ? 'segment' : 'segments'
    }

    function pluralizeBuildings(value: number): string {
        return value === 1 ? 'building' : 'buildings'
    }

    function formatNode(nodeId: string): string {
        return nodeId.startsWith('N') ? `N${nodeId.slice(1)}` : nodeId
    }
</script>

<span class={`inline-flex w-full items-center ${justifyClass} ${casingClass} ${leftGapClass}`}>
    {#if isAggregatedBusAction(action)}
        {#if action.aggregatedType === ActionType.PlaceBusLine}
            expanded their bus line by {action.count} {pluralizeSegments(action.count)}
        {:else if action.aggregatedType === ActionType.PlaceBuilding}
            placed {action.count} {pluralizeBuildings(action.count)}
        {:else if action.aggregatedType === ActionType.AddPassengers}
            added {action.totalPassengersAdded ?? action.count}
            {pluralizePassengers(action.totalPassengersAdded ?? action.count)}
        {:else if action.aggregatedType === ActionType.Vroom}
            delivered {action.count} {pluralizePassengers(action.count)}
        {:else}
            performed {action.aggregatedType}
        {/if}
    {:else if isChooseWorkerAction(action)}
        chose the {workerActionLabels[action.actionType]} action
    {:else if isPlaceBuilding(action)}
        placed a {action.buildingType.toLowerCase()} at {action.siteId}
    {:else if isPlaceBusLine(action)}
        placed a line segment from {formatNode(action.segment[0])} to {formatNode(action.segment[1])}
    {:else if isAddBus(action)}
        added a bus
        {#if action.metadata?.newBusAmount !== undefined}
            (now {action.metadata.newBusAmount})
        {/if}
    {:else if isAddPassengers(action)}
        added {action.numPassengers}
        {pluralizePassengers(action.numPassengers)} at {action.stationId}
    {:else if isVroom(action)}
        delivered a passenger from {formatNode(action.sourceNode)} to {action.destinationSite}
    {:else if isSetFirstPlayer(action)}
        became the starting player
    {:else if isStopTime(action)}
        took a time stone
    {:else if isRotateTime(action)}
        rotated time to the next location
    {:else if isPass(action)}
        passed
        {#if action.reason}
            ({passReasonLabels[action.reason] ?? action.reason})
        {/if}
    {:else}
        performed {action.type}
    {/if}
</span>
