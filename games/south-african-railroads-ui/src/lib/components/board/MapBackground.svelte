<script lang="ts">
    import type { Component } from 'svelte'
    import { MapId } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import MapArtwork from './terrain/MapArtwork.svelte'
    import SouthAfricaTerrain from './terrain/SouthAfricaTerrain.svelte'
    import TexasSpecialTerrain from './terrain/TexasSpecialTerrain.svelte'

    // Veld Railroads lies on the South African Railroads board, its sea included. The maps printed
    // on plain paper have none.
    const TERRAIN: Partial<Record<MapId, Component>> = {
        [MapId.SouthAfrica]: SouthAfricaTerrain,
        [MapId.Veld]: SouthAfricaTerrain,
        [MapId.TexasSpecial]: TexasSpecialTerrain
    }

    const gameSession = getGameSession()

    const mapId = $derived(gameSession.gameState.mapId)
    const layout = $derived(boardLayout(mapId))
    const Terrain = $derived(TERRAIN[mapId])
</script>

<defs>
    <radialGradient id="sar-paper" cx="50%" cy="46%" r="75%">
        <stop offset="0%" stop-color="#fbf7ea"></stop>
        <stop offset="70%" stop-color="#f3ead2"></stop>
        <stop offset="100%" stop-color="#e6d8b4"></stop>
    </radialGradient>
    <clipPath id="sar-inner">
        <rect
            x="15"
            y={layout.top + 15}
            width={layout.width - 30}
            height={layout.height - 30}
            rx="10"
        ></rect>
    </clipPath>
</defs>

<rect y={layout.top} width={layout.width} height={layout.height} rx="18" fill="url(#sar-paper)"
></rect>
<g clip-path="url(#sar-inner)">
    {#if Terrain}
        <Terrain />
    {/if}
    <MapArtwork />
</g>
<rect
    x="8"
    y={layout.top + 8}
    width={layout.width - 16}
    height={layout.height - 16}
    rx="14"
    fill="none"
    stroke="#384f6c"
    stroke-width="3"
></rect>
<rect
    x="15"
    y={layout.top + 15}
    width={layout.width - 30}
    height={layout.height - 30}
    rx="10"
    fill="none"
    stroke="#5377a2"
    stroke-width="1"
></rect>

{#each layout.spec.regions as region (region.lines.join(' '))}
    <text
        class="region"
        x={region.x}
        y={region.y}
        transform={region.rotate ? `rotate(${region.rotate} ${region.x} ${region.y})` : undefined}
    >
        {#each region.lines as line, index (line)}
            <tspan x={region.x} dy={index === 0 ? 0 : 19}>{line}</tspan>
        {/each}
    </text>
{/each}

<style>
    .region {
        font-family: 'SAR Baskerville', Georgia, serif;
        font-size: 15px;
        letter-spacing: 0.32em;
        fill: #51739d;
        text-anchor: middle;
        pointer-events: none;
    }
</style>
