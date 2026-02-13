<script lang="ts">
    import { ActionType, MachineState, PassReason } from '@tabletop/bus'
    import LastActionDescription from './LastActionDescription.svelte'
    import type { BusGameSession } from '$lib/model/session.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession() as BusGameSession
    const canPass = $derived.by(
        () => gameSession.isMyTurn && gameSession.validActionTypes.includes(ActionType.Pass)
    )
    const showLastActionDescription = $derived.by(
        () => gameSession.isViewingHistory || !gameSession.isMyTurn
    )
    const lastActionFallbackText = $derived.by(() =>
        gameSession.isViewingHistory ? 'Viewing history' : 'Waiting for turn'
    )

    const lineExpansionProgressSuffix = $derived.by(() => {
        const totalActions = Math.max(0, gameSession.gameState.numAllowedActions())
        if (totalActions <= 0) {
            return ''
        }

        const playerSticksAtTurnStart =
            (gameSession.myPlayerState?.sticks ?? 0) + gameSession.gameState.actionsTaken
        const constrainedTotal = Math.min(totalActions, playerSticksAtTurnStart)
        if (constrainedTotal <= 0) {
            return ''
        }

        const actionNumber = Math.min(constrainedTotal, gameSession.gameState.actionsTaken + 1)
        return ` (${actionNumber} of ${constrainedTotal})`
    })

    const buildingProgressSuffix = $derived.by(() => {
        const totalActions = Math.max(0, gameSession.gameState.numAllowedActions())
        if (totalActions <= 0) {
            return ''
        }

        const actionNumber = Math.min(totalActions, gameSession.gameState.actionsTaken + 1)
        return ` (${actionNumber} of ${totalActions})`
    })

    const vroomProgressSuffix = $derived.by(() => {
        const playerId = gameSession.myPlayer?.id
        if (!playerId) {
            return ''
        }

        const baseBusValue = gameSession.myPlayerState?.buses ?? 0
        const playerGetsBusBonus = gameSession.gameState.busAction === playerId
        const totalActions = Math.max(0, baseBusValue + (playerGetsBusBonus ? 1 : 0))
        if (totalActions <= 0) {
            return ''
        }

        const actionNumber = Math.min(totalActions, gameSession.gameState.actionsTaken + 1)
        return ` (${actionNumber} of ${totalActions})`
    })

    const message = $derived.by(() => {
        if (gameSession.gameState.result) {
            return 'Game over'
        }

        if (gameSession.pendingBusLineTargetNodeId) {
            return `Choose an end to extend...${lineExpansionProgressSuffix}`
        }

        if (gameSession.chosenPassengerStationId) {
            return 'Choose the number of passengers...'
        }

        if (gameSession.chosenVroomSourceNodeId) {
            return `Choose the destination...${vroomProgressSuffix}`
        }

        switch (gameSession.gameState.machineState) {
            case MachineState.ChoosingActions:
                return 'Place an action token...'
            case MachineState.InitialBuildingPlacement:
            case MachineState.AddingBuildings:
                return `Place a building...${gameSession.gameState.machineState === MachineState.AddingBuildings ? buildingProgressSuffix : ''}`
            case MachineState.InitialBusLinePlacement:
                return 'Place a bus line segment...'
            case MachineState.LineExpansion:
                return `Extend your bus line...${lineExpansionProgressSuffix}`
            case MachineState.AddingPassengers:
                return 'Choose a train station...'
            case MachineState.TimeMachine:
                return 'Use a time stone'
            case MachineState.Vrooming:
                return `Choose a passenger to deliver...${vroomProgressSuffix}`
            default:
                return 'Unknown state'
        }
    })

    async function pass() {
        let reason
        if (gameSession.gameState.machineState === MachineState.ChoosingActions) {
            reason = PassReason.DoneActions
        } else if (gameSession.gameState.machineState === MachineState.TimeMachine) {
            reason = PassReason.DeclinedClock
        }
        await gameSession.pass(reason)
    }
</script>

<div
    class="flex min-h-[50px] items-center justify-center px-4 py-1 text-center text-[18px] tracking-[0.02em] text-[#333]"
>
    {#if showLastActionDescription}
        <LastActionDescription fallbackText={lastActionFallbackText} />
    {:else}
        <span>{message}</span>
        {#if canPass}
            <span class="text-[#333]">&nbsp;or&nbsp;</span>
            <button
                type="button"
                onclick={pass}
                class="ml-1 rounded-md border border-[#333]/50 px-2 py-1 leading-none text-[#333] hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d6979]/60"
            >
                pass
            </button>
        {/if}
    {/if}
</div>
