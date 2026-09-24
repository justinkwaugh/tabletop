<script lang="ts">
    import type { MapDrawing } from './mapDrawing.js'
    import type { TileAppearance } from '../tiles/tileAppearance.js'
    import { mapTrackJoins } from './trackJoins.js'

    let { scene, appearance }: { scene: MapDrawing; appearance: TileAppearance } = $props()
    const maskId = $props.id()
    const joins = $derived(mapTrackJoins(scene))
</script>

{#if joins.length}
    <g data-map-layer="track-joins" pointer-events="none" aria-hidden="true">
        <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" {...scene.bounds}>
                {#each joins as point, index (index)}
                    <rect
                        x="-1"
                        y={-(appearance.trackWidth + appearance.trackBorderWidth) / 2 - 2}
                        width="2"
                        height={appearance.trackWidth + appearance.trackBorderWidth + 4}
                        transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`}
                        fill="white"
                    ></rect>
                {/each}
            </mask>
        </defs>
        <g mask={`url(#${maskId})`} fill="none" stroke-linecap="round">
            {#each [true, false] as border (border)}
                {#each scene.locations as entry (entry.location.id)}
                    <g transform={`translate(${entry.center.x} ${entry.center.y})`}>
                        {#each entry.drawing.paths as path (path.id)}
                            <path
                                d={path.d}
                                stroke={border ? appearance.paper : appearance.ink}
                                stroke-width={appearance.trackWidth +
                                    (border ? appearance.trackBorderWidth : 0)}
                            ></path>
                        {/each}
                    </g>
                {/each}
            {/each}
        </g>
    </g>
{/if}
