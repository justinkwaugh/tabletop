<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { placeSegments } from '$lib/utils/placeSegments.js'

    let { text }: { text: string } = $props()

    const gameSession = getGameSession()

    const segments = $derived(placeSegments(text, gameSession.placeNames))
</script>

{#each segments as segment, index (index)}{#if 'locale' in segment}<button
            type="button"
            class="nt-place"
            title="Show {segment.text} on the map"
            onclick={() => gameSession.locateLocale(segment.locale)}>{segment.text}</button
        >{:else}{segment.text}{/if}{/each}

<style>
    .nt-place {
        display: inline;
        padding: 0;
        font: inherit;
        color: inherit;
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
        text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
        cursor: pointer;
    }

    .nt-place:hover {
        text-decoration-color: currentColor;
    }
</style>
