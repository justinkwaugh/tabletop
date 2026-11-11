<!-- A map's faint geography and ink drawings, from its layout's artwork. Rivers and shores given
     beside settlements follow the map's own positions. -->
<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout, type ArtPoint } from '$lib/utils/boardLayout.js'
    import InkDrawing from './InkDrawing.svelte'

    const gameSession = getGameSession()

    const map = $derived(gameSession.gameState.map)
    const artwork = $derived(boardLayout(map.id).spec.artwork)

    function resolve(point: ArtPoint): Point {
        if (!('near' in point)) {
            return point
        }
        const place = map.settlement(point.near)
        return { x: place.x + point.dx, y: place.y + point.dy }
    }

    // A Catmull-Rom curve through the points, as cubic Béziers.
    function smoothPath(artPoints: readonly ArtPoint[], closed: boolean): string {
        const points = artPoints.map(resolve)
        const at = (index: number) =>
            closed
                ? points[(index + points.length) % points.length]
                : points[Math.max(0, Math.min(points.length - 1, index))]
        const segments = closed ? points.length : points.length - 1
        let d = `M ${points[0].x} ${points[0].y}`
        for (let index = 0; index < segments; index++) {
            const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)]
            const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
            const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
            d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x} ${p2.y}`
        }
        return closed ? `${d} Z` : d
    }
</script>

{#if artwork}
    <defs>
        {#each artwork.tints as tint, index (index)}
            <radialGradient id="sar-tint-{index}">
                <stop offset="0%" stop-color={tint.color}></stop>
                <stop offset="55%" stop-color={tint.color} stop-opacity="0.85"></stop>
                <stop offset="100%" stop-color={tint.color} stop-opacity="0"></stop>
            </radialGradient>
        {/each}
    </defs>

    <g class="geography" aria-hidden="true">
        <g opacity="0.5">
            {#each artwork.tints as tint, index (index)}
                <ellipse
                    cx={tint.x}
                    cy={tint.y}
                    rx={tint.rx}
                    ry={tint.ry}
                    fill="url(#sar-tint-{index})"
                ></ellipse>
            {/each}
        </g>
        {#each artwork.waters as outline, index (index)}
            <path d={smoothPath(outline, true)} class="water"></path>
        {/each}
        {#each artwork.rivers as river, index (index)}
            <path d={smoothPath(river.points, false)} class="river" stroke-width={river.width}
            ></path>
        {/each}
        {#each artwork.waterNames as name (name.text)}
            <text
                class="water-name"
                x={name.x}
                y={name.y}
                transform={name.rotate ? `rotate(${name.rotate} ${name.x} ${name.y})` : undefined}
                >{name.text}</text
            >
        {/each}
    </g>

    <g class="drawings" aria-hidden="true">
        {#each artwork.drawings as drawing, index (index)}
            <InkDrawing {drawing} />
        {/each}
    </g>
{/if}

<style>
    /* As faint as Texas Special's, so the art never competes with track. */
    .geography {
        opacity: 0.8;
        pointer-events: none;
    }

    .water {
        fill: #bcd3da;
        fill-opacity: 0.55;
        stroke: #7f9bb0;
        stroke-width: 1.4;
    }

    .river {
        fill: none;
        stroke: #7f9bb0;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0.85;
    }

    .water-name {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        font-style: italic;
        letter-spacing: 0.2em;
        fill: #5d7a8e;
        text-anchor: middle;
    }

    .drawings {
        opacity: 0.55;
        pointer-events: none;
    }
</style>
