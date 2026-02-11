<script lang="ts">
    import { ActionType, MachineState } from '@tabletop/bus'
    import type { BusGameSession } from '$lib/model/session.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession() as BusGameSession
    const canPass = $derived.by(
        () => gameSession.isMyTurn && gameSession.validActionTypes.includes(ActionType.Pass)
    )

    const message = $derived.by(() => {
        if (gameSession.isViewingHistory) {
            return 'Viewing history'
        }

        if (gameSession.gameState.result) {
            return 'Game over'
        }

        if (!gameSession.isMyTurn) {
            return 'Waiting for turn'
        }

        if (gameSession.pendingBusLineTargetNodeId) {
            return 'Which end to extend?'
        }

        switch (gameSession.gameState.machineState) {
            case MachineState.ChoosingActions:
                return 'Place an action token'
            case MachineState.InitialBuildingPlacement:
                return 'Place a building'
            case MachineState.InitialBusLinePlacement:
                return 'Place a bus line segment'
            case MachineState.LineExpansion:
                return 'Extend your bus line'
            default:
                return 'Place an action token'
        }
    })

    async function pass() {
        await gameSession.pass()
    }
</script>

<div
    class="flex min-h-[50px] items-center justify-center px-4 py-1 text-center text-[18px] tracking-[0.02em] text-[#333]"
>
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
</div>
