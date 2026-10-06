<script lang="ts">
    import type { OffsetCoordinates } from '@tabletop/common'
    import { CastShadowFilterId, cellCenter } from '$lib/utils/boardGeometry.js'
    import { palmFronds } from '$lib/utils/palmGeometry.js'

    const ShadowOffset = { x: 3, y: 4 }

    let { coords }: { coords: OffsetCoordinates } = $props()

    let center = $derived(cellCenter(coords))
    let fronds = $derived(palmFronds(coords))
</script>

<g transform="translate({center.x} {center.y})" aria-hidden="true">
    <g
        transform="translate({ShadowOffset.x} {ShadowOffset.y})"
        fill="#3a2a10"
        opacity="0.22"
        filter="url(#{CastShadowFilterId})"
    >
        {#each fronds as frond, index (index)}
            <path d={frond.path} transform="rotate({frond.angle})"></path>
        {/each}
    </g>
    {#each fronds as frond, index (index)}
        <g transform="rotate({frond.angle})">
            <path
                d={frond.path}
                fill={frond.fill}
                stroke={frond.edge}
                stroke-width="0.8"
                stroke-linejoin="round"
            ></path>
            <path d={frond.rib} fill="none" stroke={frond.ribColor} stroke-width="1.1"></path>
        </g>
    {/each}
    <circle r="5" fill="#7a5a32" stroke="#4f3a1f" stroke-width="1"></circle>
</g>
