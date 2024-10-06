<script lang="ts">
    import { T, type Props } from '@threlte/core'
    import { Text, RoundedBoxGeometry } from '@threlte/extras'
    import { Cube } from '@tabletop/estates'
    import { Group, MeshBasicMaterial } from 'three'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    let {
        cube,
        transparent = false,
        castShadow = true,
        opacity = 1,
        ...others
    }: {
        cube: Cube
        castShadow?: boolean
        transparent?: boolean
        opacity?: number
    } & Props<typeof Group> = $props()

    const material = new MeshBasicMaterial({ toneMapped: false })
</script>

<T.Group {...others}>
    <T.Mesh {castShadow}>
        <RoundedBoxGeometry args={[1, 1, 1]} />
        <T.MeshPhysicalMaterial
            color={gameSession.getUiColor(gameSession.getCompanyColor(cube.company))}
            {transparent}
            {opacity}
            clearcoat={1}
            clearcoatRoughness={0.33}
        />
    </T.Mesh>
    <Text
        color="#CCCCCC"
        position.z={0.5}
        depthOffset={-1}
        fontSize={0.8}
        fontWeight="bold"
        anchorX="50%"
        anchorY="50%"
        text={cube.value.toString()}
        characters="123456HELO"
        {material}
    />
    <Text
        color="#CCCCCC"
        rotation.y={Math.PI}
        position.z={-0.5}
        depthOffset={-1}
        fontSize={0.8}
        fontWeight="bold"
        anchorX="50%"
        anchorY="50%"
        text={cube.value.toString()}
        characters="123456HELO"
        {material}
    />
</T.Group>
