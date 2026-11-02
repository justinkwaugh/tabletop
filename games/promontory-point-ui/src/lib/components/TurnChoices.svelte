<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { TurnPanel } from '$lib/model/turnPanel.js'

    let { panel }: { panel: TurnPanel } = $props()

    const gameSession = getGameSession()
</script>

<!-- The panel's set-aside choice beside the share block; End turn sits above the block, and the
     hand itself is beside the map. -->
{#if panel.setAside}
    <section class="choices shrink-0" data-turn-choices>
        <!-- R-3.3-H1, R-X.2: the scrap draws from the bag, so the button names that it is final. -->
        <div class="flex max-w-80 flex-col gap-1">
            <button type="button" class="pp-button big" onclick={() => gameSession.scrapTrack()}
                >{panel.setAside.label}</button
            >
            {#if panel.setAside.keepNote}
                <p class="text-xs text-pp-ink-sub">{panel.setAside.keepNote}</p>
            {/if}
        </div>
    </section>
{/if}

<style>
    .choices {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 8px;
    }
</style>
