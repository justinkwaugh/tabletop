<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import SystemTile from './board/SystemTile.svelte'
    import ShipStrip from './board/ShipStrip.svelte'
    import { factionShipGroups, shipPipLayout } from '$lib/utils/shipPipLayout.js'
    import { baseTabLayout, systemTabBases } from '$lib/utils/baseTabLayout.js'

    const gameSession = getGameSession()
    const layout = $derived(
        boardLayout(gameSession.gameState.systems.map((system) => system.systemId))
    )
    const systems = $derived(
        layout.frames.map((frame) => {
            const state = gameSession.gameState
            const bases = baseTabLayout(frame, systemTabBases(state, frame.systemId))
            return {
                frame,
                bases,
                ships: shipPipLayout(
                    frame,
                    factionShipGroups(state, frame.systemId),
                    bases.map((tab) => tab.box)
                )
            }
        })
    )
    const spotlight = $derived(gameSession.focusClosing ? undefined : gameSession.focusedSystemId)
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg
    class="board"
    width={layout.width}
    height={layout.height}
    viewBox="0 0 {layout.width} {layout.height}"
    aria-label="Star map"
    role="img"
    onclick={() => gameSession.closeClump()}
>
    <defs>
        <clipPath id="sh-world-clip" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.473"></circle>
        </clipPath>
        <radialGradient id="sh-space" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stop-color="#16223d"></stop>
            <stop offset="0.7" stop-color="#0e1527"></stop>
            <stop offset="1" stop-color="#070b14"></stop>
        </radialGradient>
        <filter id="sh-piece-shadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.7"
            ></feDropShadow>
        </filter>
    </defs>
    <rect width={layout.width} height={layout.height} fill="url(#sh-space)"></rect>
    {#each systems as system (system.frame.systemId)}
        <SystemTile
            frame={system.frame}
            bases={system.bases}
            ships={system.ships}
            dimmed={spotlight !== undefined && system.frame.systemId !== spotlight}
        />
    {/each}
    {#if !gameSession.focusedSystemId}
        <ShipStrip {layout} {systems} />
    {/if}
</svg>

<style>
    .board {
        display: block;
        user-select: none;
    }
</style>
