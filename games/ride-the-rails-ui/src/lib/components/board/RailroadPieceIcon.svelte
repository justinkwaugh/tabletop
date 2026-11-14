<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { CUBE_ICON_VIEW_BOX, CUBE_UNITS, provideCubeShading } from '$lib/utils/cubeShape.js'
    import CubeShading from './CubeShading.svelte'
    import RailroadPiece from './RailroadPiece.svelte'

    let { railroadId, size = 20 }: { railroadId: RailroadId; size?: number } = $props()

    // Each icon is its own SVG, so it carries its own gradients under an id of its own.
    const uid = $props.id()
    const prefix = `rtr-cube-${uid}`
    provideCubeShading(prefix)
</script>

<svg
    class="inline-block shrink-0 align-middle"
    width={size}
    height={size}
    viewBox={CUBE_ICON_VIEW_BOX}
    aria-hidden="true"
>
    <CubeShading {prefix} />
    <RailroadPiece {railroadId} x={0} y={0} width={CUBE_UNITS.width} />
</svg>
