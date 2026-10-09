<script lang="ts">
    import { BoardStyle } from '$lib/board/geometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ROUTE_TILES, ROUTE_TILE_BACK } from '$lib/utils/redesignArt.js'
    import RouteShield from '../art/RouteShield.svelte'
    import HiddenShield from '../art/HiddenShield.svelte'

    let { value, size = 30 }: { value?: number; size?: number } = $props()

    const gameSession = getGameSession()
</script>

{#if gameSession.boardStyle === BoardStyle.Redesign}
    <img
        src={value === undefined ? ROUTE_TILE_BACK : ROUTE_TILES[value]}
        alt={value === undefined ? 'A face-down route marker' : `Route marker ${value}`}
        width={size}
        height={size}
        class="inline-block shrink-0 rounded-[3px]"
    />
{:else}
    <svg
        width={size}
        height={size * 1.2}
        viewBox="0 0 40 48"
        class="inline-block shrink-0"
        aria-hidden="true"
    >
        {#if value === undefined}
            <HiddenShield />
        {:else}
            <RouteShield {value} />
        {/if}
    </svg>
{/if}
