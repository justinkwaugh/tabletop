<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MachineState } from '@tabletop/lowenherz'

    const gameSession = getGameSession()
    const actionState = $derived(gameSession.gameState)

    const canFastForwardToActionEffect = $derived(
        actionState.machineState !== MachineState.PlacingCastles &&
            actionState.machineState !== MachineState.PlacingWalls &&
            actionState.machineState !== MachineState.PlacingKnights &&
            actionState.machineState !== MachineState.EndOfGame
    )
</script>

<div class="flex flex-col gap-1">
    {#if !gameSession.setupComplete}
        <button
            type="button"
            class="px-2 py-1 rounded border border-dashed border-black/40 text-black/70 text-xs hover:bg-black/10"
            onclick={() => gameSession.autoPlaceAllCastles()}
        >
            Auto-place all castles (testing)
        </button>
    {:else}
        <button
            type="button"
            class="px-2 py-1 rounded border border-dashed border-black/40 text-black/70 text-xs hover:bg-black/10"
            onclick={() => gameSession.seedTestRegions()}
        >
            Seed regions for unclaimed castles (testing)
        </button>
    {/if}

    {#if canFastForwardToActionEffect}
        <button
            type="button"
            class="px-2 py-1 rounded border border-dashed border-black/40 text-black/70 text-xs hover:bg-black/10"
            onclick={() => gameSession.autoAdvanceToActionEffect()}
        >
            Fast-forward to wall/knight placement (testing)
        </button>
    {/if}

    {#if gameSession.setupComplete}
        <button
            type="button"
            class="px-2 py-1 rounded border border-dashed border-black/40 text-black/70 text-xs hover:bg-black/10"
            onclick={() => gameSession.giveTestPoliticsCards()}
        >
            Give Renegade + Alliance cards (testing)
        </button>
    {/if}
</div>
