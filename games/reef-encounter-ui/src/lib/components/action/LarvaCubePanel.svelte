<script lang="ts">
    import { CoralColors } from '@tabletop/reef-encounter'
    import ChoiceButton from './ChoiceButton.svelte'
    import LarvaCube from '$lib/components/table/LarvaCube.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const first = $derived(gameSession.firstLarvaCube)
</script>

<p class="prompt reef-display">
    {first === undefined ? 'Take two larva cubes' : 'Take a second larva cube'}
</p>
<p class="detail">Both may be the same colour. Everyone sees which you take.</p>
<div class="choices">
    {#each CoralColors as color (color)}
        {@const available = gameSession.larvaCubeChoices.includes(color)}
        {#if available}
            <ChoiceButton
                label="Take a {color} larva cube"
                selected={first === color}
                onclick={() => gameSession.chooseLarvaCube(color)}
            >
                <svg width="36" height="38" viewBox="-18 -19 36 38" aria-hidden="true">
                    <LarvaCube center={{ x: 0, y: 0 }} size={32} {color} />
                </svg>
                <span class="supply">{gameSession.gameState.larvaCubeSupply[color]}</span>
            </ChoiceButton>
        {/if}
    {/each}
</div>

<style>
    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
    }

    .supply {
        font-size: 13px;
        color: var(--reef-muted);
        font-variant-numeric: tabular-nums;
    }
</style>
