<script lang="ts">
    import { type GameAction } from '@tabletop/common'
    import {
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
        [PassReason.DoneActions]: 'finished choosing actions',
        [PassReason.CannotExpandLine]: 'could not expand bus line',
        [PassReason.CannotAddBus]: 'could not build any more buses',
        [PassReason.CannotAddPassenger]: 'no passengers to add',
        [PassReason.CannotAddBuildings]: 'no sites to build on',
        [PassReason.DeclinedClock]: 'decided not to stop time',
        [PassReason.CannotVroom]: 'could not deliver any passengers'
    }

    let justifyClass = $derived(justifyClasses[justify] ?? justifyClasses.start)
    let casingClass = $derived(history ? 'normal-case' : 'uppercase')
    let leftGapClass = $derived(action.playerId ? 'ms-1' : '')

    function pluralizePassengers(value: number): string {
        return value === 1 ? 'passenger' : 'passengers'
    }
</script>

<span class={`inline-flex w-full items-center ${justifyClass} ${casingClass} ${leftGapClass}`}>
    {#if isChooseWorkerAction(action)}
        chose the {workerActionLabels[action.actionType]} action
    {:else if isPlaceBuilding(action)}
        placed a {action.buildingType.toLowerCase()}
    {:else if isPlaceBusLine(action)}
        expanded their bus line
    {:else if isAddBus(action)}
        added a bus
        {#if action.metadata?.newBusAmount !== undefined}
            (now {action.metadata.newBusAmount})
        {/if}
    {:else if isAddPassengers(action)}
        added {action.numPassengers}
        {pluralizePassengers(action.numPassengers)} at {action.stationId}
    {:else if isVroom(action)}
        delivered a passenger
    {:else if isSetFirstPlayer(action)}
        became the starting player
    {:else if isStopTime(action)}
        stopped time
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
