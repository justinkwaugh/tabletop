<script lang="ts">
    import { T } from '@threlte/core'
    import { Site } from '@tabletop/estates'
    import Cube from './Cube.svelte'
    import Roof from './Roof.svelte'

    let { site, x = 0, y = 0, z = 0 }: { site: Site; x?: number; y?: number; z?: number } = $props()
    let scale = $state(1)
    function onPointerEnter(event: PointerEvent) {
        event.stopPropagation()
        scale = 1.3
    }
    function onPointerLeave(event: PointerEvent) {
        event.stopPropagation()
        scale = 1
    }
</script>

<T.Group
    position.x={x}
    position.y={y}
    position.z={z}
    {scale}
    onpointerenter={onPointerEnter}
    onpointerleave={onPointerLeave}
>
    {#each site.cubes as cube, i}
        <Cube {cube} x={0} z={0} y={i} />
    {/each}
    {#if site.roof}
        <Roof x={0} z={0} y={site.cubes.length - 0.25} />
    {/if}
</T.Group>
