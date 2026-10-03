<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
</script>

{#if gameSession.canUndoAction}
    <button
        class="rounded-md border border-[#8a6a46] px-3 py-1 text-sm"
        disabled={gameSession.busy}
        onclick={() => gameSession.undo()}>Undo</button
    >
{/if}
