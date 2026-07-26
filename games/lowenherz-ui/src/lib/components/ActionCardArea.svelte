<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MachineState } from '@tabletop/lowenherz'

    const gameSession = getGameSession()
    const actionState = $derived(gameSession.gameState)
</script>

{#if actionState.machineState === MachineState.EndOfGame}
    <div class="text-black text-lg font-semibold mt-4">The King is dead! The game is over.</div>
{/if}
