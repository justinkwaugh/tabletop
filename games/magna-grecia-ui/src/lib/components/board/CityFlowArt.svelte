<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import type { CityFlow } from '$lib/animators/cityFlowAnimator.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { localHexPoints } from '$lib/utils/boardGeometry.js'
    import { cityFlowFrame } from '$lib/utils/cityFlow.js'
    import type { CityHouse } from '$lib/utils/cityLayout.js'
    import { mixColor } from '$lib/utils/colorMix.js'
    import TempleArt from './TempleArt.svelte'

    // Draws a city mid-flow with the same parts as CityArt. The animator moves it by writing
    // attributes straight to these elements, so the markup below is only the opening frame.
    let { flow, color }: { flow: CityFlow; color: string } = $props()

    const gameSession = getGameSession()

    const OUTLINE = '#1d1a17'
    const SHADOW = '#2a1a0a'
    const LIGHT = '#fffaf0'
    const TEMPLE_BASE = 11.5
    const hexShape = localHexPoints()
    const uid = $props.id()
    const clipId = `mg-city-flow-${uid}`

    const band = $derived(mixColor(color, SHADOW, 0.22))
    const houseShadow = $derived(mixColor(color, SHADOW, 0.16))
    const roof = $derived(mixColor(color, LIGHT, 0.16))
    const roofShade = $derived(mixColor(color, LIGHT, 0.07))

    const plan = $derived(flow.plan)
    const opening = $derived(cityFlowFrame(flow.plan, flow.mode, 0))

    const clipRegions: SVGPathElement[] = []
    const fillRegions: SVGPathElement[] = []
    const bandEdges: SVGPathElement[] = []
    const outlineEdges: SVGPathElement[] = []
    const houseNodes: SVGGElement[] = []
    const templeNodes: SVGGElement[] = []
    const templeRises: SVGGElement[] = []

    function houseTransform(house: CityHouse, scale: number): string {
        return `translate(${house.center.x} ${house.center.y}) rotate(${house.rotation}) scale(${scale})`
    }

    function templeRise(rise: number): string {
        return `translate(0 ${TEMPLE_BASE}) scale(${0.6 + 0.4 * rise} ${rise}) translate(0 ${-TEMPLE_BASE})`
    }

    function draw(elapsed: number) {
        const frame = cityFlowFrame(flow.plan, flow.mode, elapsed)
        frame.regionPaths.forEach((d, i) => {
            clipRegions[i]?.setAttribute('d', d)
            fillRegions[i]?.setAttribute('d', d)
        })
        frame.edges.forEach(({ d, opacity }, i) => {
            for (const node of [bandEdges[i], outlineEdges[i]]) {
                node?.setAttribute('d', d)
                node?.setAttribute('opacity', `${opacity}`)
            }
        })
        frame.houses.forEach(({ scale, opacity }, i) => {
            houseNodes[i]?.setAttribute(
                'transform',
                houseTransform(flow.plan.houses[i].house, scale)
            )
            houseNodes[i]?.setAttribute('opacity', `${opacity}`)
        })
        frame.temples.forEach(({ rise, opacity }, i) => {
            templeRises[i]?.setAttribute('transform', templeRise(rise))
            templeNodes[i]?.setAttribute('opacity', `${opacity}`)
        })
    }

    const register: Attachment = () => gameSession.cityFlowAnimator.attach(draw)
</script>

<g {@attach register}>
    <clipPath id={clipId}>
        {#each plan.staticTiles as tile, index (index)}
            <polygon points={hexShape} transform="translate({tile.x} {tile.y})"></polygon>
        {/each}
        {#each opening.regionPaths as d, index (index)}
            <path {d} bind:this={clipRegions[index]}></path>
        {/each}
    </clipPath>
    <g clip-path="url(#{clipId})">
        {#each plan.staticTiles as tile, index (index)}
            <polygon points={hexShape} transform="translate({tile.x} {tile.y})" fill={color}
            ></polygon>
        {/each}
        {#each opening.regionPaths as d, index (index)}
            <path {d} fill={color} bind:this={fillRegions[index]}></path>
        {/each}
        {#each plan.staticEdges as edge, index (index)}
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
        {#each opening.edges as edge, index (index)}
            <path
                d={edge.d}
                opacity={edge.opacity}
                fill="none"
                stroke={band}
                stroke-width="8"
                stroke-linecap="round"
                bind:this={bandEdges[index]}
            ></path>
        {/each}
        {#each plan.houses as { house }, index (index)}
            {@const x = -house.length / 2}
            {@const y = -house.depth / 2}
            <g
                transform={houseTransform(house, opening.houses[index].scale)}
                opacity={opening.houses[index].opacity}
                bind:this={houseNodes[index]}
            >
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
        {#each plan.temples as temple, index (index)}
            <g
                transform="translate({temple.point.x} {temple.point.y})"
                opacity={opening.temples[index].opacity}
                bind:this={templeNodes[index]}
            >
                <g
                    transform={templeRise(opening.temples[index].rise)}
                    bind:this={templeRises[index]}
                >
                    <TempleArt {color} />
                </g>
            </g>
        {/each}
    </g>
    {#each plan.staticEdges as edge, index (index)}
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
    {#each opening.edges as edge, index (index)}
        <path
            d={edge.d}
            opacity={edge.opacity}
            fill="none"
            stroke={OUTLINE}
            stroke-width="1.2"
            stroke-linecap="round"
            bind:this={outlineEdges[index]}
        ></path>
    {/each}
</g>
