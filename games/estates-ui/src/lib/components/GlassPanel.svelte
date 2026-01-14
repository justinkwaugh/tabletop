<script lang="ts">
    import { T, type Props } from '@threlte/core'
    import { Mesh } from 'three'
    import RoundedRectangleGeometry from './RoundedRectangleGeometry.svelte'

    let { width, height, ...others }: { width: number; height: number } & Props<typeof Mesh> =
        $props()
</script>

<T.Mesh {...others}>
    <RoundedRectangleGeometry {width} {height} />
    <T.MeshPhysicalMaterial
        roughness={0.8}
        transmission={1}
        thickness={0.5}
        color="#cccccc"
        transparent={true}
        opacity={0.3}
        clearcoat={1}
        clearcoatRoughness={0.33}
    />
</T.Mesh>
