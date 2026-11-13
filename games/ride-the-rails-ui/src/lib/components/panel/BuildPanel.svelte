<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        buildProgress,
        endBuildingLabel,
        mountainNote,
        placedText
    } from '$lib/model/actionArea.js'
    import MarkPill from '../board/MarkPill.svelte'

    const gameSession = getGameSession()

    // R-3.2.1, R-3.2.3, R-3.2.4
    const progress = $derived(buildProgress(gameSession.gameState))
    const note = $derived(progress && mountainNote(progress))
</script>

{#if progress}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 class="text-base font-bold">Place locomotives</h2>
        <span class="text-sm text-rtr-ink-muted">{placedText(progress)}</span>
        {#if note}
            <span class="flex items-center gap-1.5 text-sm text-rtr-ink-muted">
                <MarkPill tone="cost" text="−1" />
                {note}
            </span>
        {/if}
    </div>
    <div class="mt-2 flex flex-wrap gap-2">
        <button
            type="button"
            class="rounded-lg border border-rtr-line bg-rtr-panel-raised px-3 py-1.5 text-sm font-semibold hover:border-rtr-accent focus-visible:outline-2 focus-visible:outline-rtr-accent disabled:opacity-50"
            disabled={!gameSession.building}
            onclick={() => gameSession.endBuilding()}>{endBuildingLabel(progress)}</button
        >
    </div>
{/if}
