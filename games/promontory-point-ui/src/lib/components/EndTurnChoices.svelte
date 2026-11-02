<script lang="ts">
    import type { RailroadId } from '@tabletop/promontory-point'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { EndTurnChoice } from '$lib/model/turnPanel.js'
    import TrackPiece from './board/TrackPiece.svelte'

    let { choices }: { choices: EndTurnChoice[] } = $props()

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

<!-- R-2.2 step 4, R-6.3: End turn draws the next hand; the variant keeps or returns. Centred above
     the share block, at every width. -->
<div class="flex flex-wrap justify-center gap-2" data-end-turn>
    {#each choices as choice, index (choice.label)}
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
