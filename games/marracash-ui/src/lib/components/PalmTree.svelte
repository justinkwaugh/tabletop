<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { frondAngles, frondPath, PalmFrondLayers } from '$lib/utils/palmGeometry.js'

    let { center }: { center: Point } = $props()
</script>

<g transform="translate({center.x} {center.y})" aria-hidden="true">
    <circle cx="3" cy="4" r="31" fill="#3a2a10" fill-opacity="0.15"></circle>
    {#each PalmFrondLayers as layer, layerIndex (layerIndex)}
        {@const path = frondPath(layer)}
        {#each frondAngles(layer) as angle (angle)}
            <g transform="rotate({angle})">
                <path
                    d={path}
                    fill={layer.fill}
                    stroke={layer.edge}
                    stroke-width="0.8"
                    stroke-linejoin="round"
                ></path>
                <line y1="-3" y2={3 - layer.length} stroke={layer.rib} stroke-width="1.1"></line>
            </g>
        {/each}
    {/each}
    <circle r="5" fill="#7a5a32" stroke="#4f3a1f" stroke-width="1"></circle>
</g>
