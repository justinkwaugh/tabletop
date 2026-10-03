<script lang="ts">
    import type { CityLayout } from '$lib/utils/cityLayout.js'
    import { mixColor } from '$lib/utils/colorMix.js'
    import { localHexPoints } from '$lib/utils/boardGeometry.js'
    import TempleArt from './TempleArt.svelte'

    let {
        color,
        layout,
        ghost = false
    }: { color: string; layout: CityLayout; ghost?: boolean } = $props()

    const OUTLINE = '#1d1a17'
    const SHADOW = '#2a1a0a'
    const LIGHT = '#fffaf0'
    const hexShape = localHexPoints()
    const uid = $props.id()
    const clipId = `mg-city-${uid}`

    const band = $derived(mixColor(color, SHADOW, 0.22))
    const houseShadow = $derived(mixColor(color, SHADOW, 0.16))
    const roof = $derived(mixColor(color, LIGHT, 0.16))
    const roofShade = $derived(mixColor(color, LIGHT, 0.07))
</script>

<g opacity={ghost ? 0.7 : 1}>
    <clipPath id={clipId}>
        {#each layout.tiles as tile, index (index)}
            <polygon points={hexShape} transform="translate({tile.x} {tile.y})"></polygon>
        {/each}
    </clipPath>
    <g clip-path="url(#{clipId})">
        {#each layout.tiles as tile, index (index)}
            <polygon points={hexShape} transform="translate({tile.x} {tile.y})" fill={color}
            ></polygon>
        {/each}
        {#each layout.edges as edge, index (index)}
            <line
                x1={edge.from.x}
                y1={edge.from.y}
                x2={edge.to.x}
                y2={edge.to.y}
                stroke={band}
                stroke-width="8"
                stroke-linecap="round"
            ></line>
        {/each}
        {#each layout.houses as house, index (index)}
            {@const x = -house.length / 2}
            {@const y = -house.depth / 2}
            <g transform="translate({house.center.x} {house.center.y}) rotate({house.rotation})">
                <rect
                    x={x + 0.9}
                    y={y + 1.1}
                    width={house.length}
                    height={house.depth}
                    rx="0.7"
                    fill={houseShadow}
                ></rect>
                <rect {x} {y} width={house.length} height={house.depth} rx="0.7" fill={roof}></rect>
                <rect {x} y="0" width={house.length} height={house.depth / 2} fill={roofShade}
                ></rect>
            </g>
        {/each}
        {#if layout.temple}
            <g transform="translate({layout.temple.x} {layout.temple.y})">
                <TempleArt {color} />
            </g>
        {/if}
    </g>
    {#each layout.edges as edge, index (index)}
        <line
            x1={edge.from.x}
            y1={edge.from.y}
            x2={edge.to.x}
            y2={edge.to.y}
            stroke={OUTLINE}
            stroke-width="1.2"
            stroke-linecap="round"
        ></line>
    {/each}
</g>
