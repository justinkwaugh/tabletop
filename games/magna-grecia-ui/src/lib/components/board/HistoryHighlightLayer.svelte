<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexRegionOutlines } from '$lib/utils/hexOutline.js'

    const gameSession = getGameSession()

    const outline = $derived(
        hexRegionOutlines(gameSession.historyHighlight)
            .map((loop) => `M ${loop.map(({ x, y }) => `${x} ${y}`).join(' L ')} Z`)
            .join(' ')
    )
</script>

<g class="history-highlight" pointer-events="none">
    {#if outline}
        <path
            d={outline}
            fill="rgba(255, 226, 120, 0.22)"
            fill-rule="evenodd"
            stroke="#2a1606"
            stroke-width="12"
            stroke-linejoin="round"
            stroke-opacity="0.6"
        ></path>
        <path
            class="ring"
            d={outline}
            fill="none"
            stroke="#ffc933"
            stroke-width="7"
            stroke-linejoin="round"
        ></path>
    {/if}
</g>

<style>
    @media (prefers-reduced-motion: no-preference) {
        .ring {
            animation: ring-pulse 1.2s ease-in-out infinite;
        }
    }

    @keyframes ring-pulse {
        50% {
            stroke: #ffe58f;
        }
    }
</style>
