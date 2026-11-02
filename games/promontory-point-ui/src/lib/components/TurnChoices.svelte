<script lang="ts">
    import type { RailroadId } from '@tabletop/promontory-point'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { TurnPanel } from '$lib/model/turnPanel.js'
    import TrackPiece from './board/TrackPiece.svelte'

    let { panel }: { panel: TurnPanel } = $props()

    const gameSession = getGameSession()
</script>

{#snippet piece(railroadId: RailroadId, radius: number)}
    <svg
        width={radius * 2 + 6}
        height={radius * 2 + 9}
        viewBox="{-radius - 3} {-radius - 3} {radius * 2 + 6} {radius * 2 + 9}"
        aria-hidden="true"
    >
        <TrackPiece {railroadId} {radius} />
    </svg>
{/snippet}

<!-- The panel's turn choices without a place on the board; the hand itself is beside the map. -->
{#if panel.setAside || panel.endTurn.length > 0}
    <section class="choices shrink-0" data-turn-choices>
        {#if panel.setAside}
            <!-- R-3.3-H1, R-X.2: the scrap draws from the bag, so the button names that it is final. -->
            <div class="flex max-w-80 flex-col gap-1">
                <button type="button" class="pp-button big" onclick={() => gameSession.scrapTrack()}
                    >{panel.setAside.label}</button
                >
                {#if panel.setAside.keepNote}
                    <p class="text-xs text-pp-ink-sub">{panel.setAside.keepNote}</p>
                {/if}
            </div>
        {/if}

        {#if panel.endTurn.length > 0}
            <!-- R-2.2 step 4, R-6.3: End turn draws the next hand; the variant keeps or returns. -->
            <div class="flex flex-wrap gap-2">
                {#each panel.endTurn as choice, index (choice.label)}
                    <button
                        type="button"
                        class="pp-button big"
                        class:primary={index === 0}
                        onclick={() => gameSession.endTurn(choice.returnKeptPiece)}
                    >
                        {#if choice.keptPiece}
                            {@render piece(choice.keptPiece, 8)}
                        {/if}
                        {choice.label}
                    </button>
                {/each}
            </div>
        {/if}
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
