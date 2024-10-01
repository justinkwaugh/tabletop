<script lang="ts">
    import { T } from '@threlte/core'
    import { Company, Piece, Site } from '@tabletop/estates'
    import Cube from './Cube.svelte'
    import { Cube as CubeData } from '@tabletop/estates'
    import Roof from './Roof.svelte'
    import { spring } from 'svelte/motion'

    let { site, x = 0, y = 0, z = 0 }: { site: Site; x?: number; y?: number; z?: number } = $props()
    let scale = spring(0.1)
    let hoverCube: CubeData | undefined = $state()
    function onPointerEnter(event: PointerEvent) {
        hoverCube = { pieceType: Piece.Cube, company: Company.Heather, value: 3 }
        event.stopPropagation()
        scale.set(1)
    }
    function onPointerLeave(event: PointerEvent) {
        hoverCube = undefined
        event.stopPropagation()
        scale.set(0.1)
    }

    let height = $derived(site.cubes.length + (site.roof !== undefined ? 0.5 : 0))
    let dims = $derived(site.cubes.length === 0 ? 1.6 : 1)
</script>

<T.Group position.x={x} position.y={y} position.z={z} scale={1}>
    <T.Mesh
        depthOffset={5}
        position.y={height / 2 - 0.5}
        onpointerenter={onPointerEnter}
        onpointerleave={onPointerLeave}
    >
        <T.BoxGeometry args={[dims, height, dims]} />
        <T.MeshBasicMaterial color={'white'} transparent={true} opacity={0} />
    </T.Mesh>
    {#each site.cubes as cube, i}
        <Cube {cube} x={0} z={0} y={i} />
    {/each}
    {#if hoverCube}
        <Cube opacity={0.6} cube={hoverCube} x={0} z={0} y={site.cubes.length} scale={$scale} />
    {/if}
    {#if site.roof}
        <Roof x={0} z={0} y={site.cubes.length - 0.25} />
    {/if}
</T.Group>
