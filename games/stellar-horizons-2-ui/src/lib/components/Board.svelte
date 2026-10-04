<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import SystemTile from './board/SystemTile.svelte'
    import PrototypeOverlay from './board/prototype/PrototypeOverlay.svelte'
    import { shipPrototype } from './board/prototype/prototypeState.svelte.js'

    const gameSession = getGameSession()
    const layout = $derived(
        boardLayout(gameSession.gameState.systems.map((system) => system.systemId))
    )
</script>

<svg
    class="board"
    width={layout.width}
    height={layout.height}
    viewBox="0 0 {layout.width} {layout.height}"
    aria-label="Star map"
>
    <defs>
        <filter id="sh-disc-soften" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5"></feGaussianBlur>
        </filter>
        <clipPath id="sh-world-clip" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.473"></circle>
        </clipPath>
        <radialGradient id="sh-space" cx="0.5" cy="0.5" r="0.75">
            <stop offset="0" stop-color="#16223d"></stop>
            <stop offset="1" stop-color="#05070d"></stop>
        </radialGradient>
        <filter id="sh-piece-shadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.7"
            ></feDropShadow>
        </filter>
    </defs>
    <rect width={layout.width} height={layout.height} rx="24" fill="url(#sh-space)"></rect>
    {#each layout.frames as frame (frame.systemId)}
        <SystemTile {frame} />
    {/each}
    {#if shipPrototype.variant}
        <PrototypeOverlay {layout} />
    {/if}
</svg>

<style>
    .board {
        display: block;
        user-select: none;
    }
</style>
