<script lang="ts">
    import { T } from '@threlte/core'
    import { Text, RoundedBoxGeometry } from '@threlte/extras'
    import { Cube } from '@tabletop/estates'
    import * as THREE from 'three'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    let { cube, x = 0, y = 0, z = 0 }: { cube: Cube; x?: number; y?: number; z?: number } = $props()

    const material = new THREE.MeshBasicMaterial({ toneMapped: false })
</script>

<T.Group position.y={y} position.x={x} position.z={z}>
    <T.Mesh scale={1} castShadow>
        <RoundedBoxGeometry args={[1, 1, 1]} />
        <T.MeshPhysicalMaterial
            color={gameSession.getUiColor(gameSession.getCompanyColor(cube.company))}
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
