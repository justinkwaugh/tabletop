<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const canUndo = $derived(!!gameSession.undoableAction)
</script>

{#if canUndo}
    <div class="flex justify-end px-1 pb-1">
        <button
            class="px-3 py-1 rounded-lg bg-black/10 hover:bg-black/20 text-black font-semibold transition-colors"
            onclick={() => gameSession.undo()}
        >
            Undo
        </button>
    </div>
{/if}
