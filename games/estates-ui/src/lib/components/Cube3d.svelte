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
        singleNumber = false,
        castShadow = true,
        opacity = 1,
        ...others
    }: {
        cube: Cube
        singleNumber?: boolean
        castShadow?: boolean
        opacity?: number
    } & Props<typeof Group> = $props()

    const material = new MeshBasicMaterial({
        toneMapped: false,
        transparent: opacity !== 1,
        opacity
    })
</script>

<T.Group {...others} name="cube">
    <T.Mesh {castShadow} name="outlineMesh">
        <RoundedBoxGeometry args={[1, 1, 1]} />
        <T.MeshPhysicalMaterial
            color={gameSession.colors.getUiColor(gameSession.getCompanyColor(cube.company))}
            transparent={opacity !== 1}
            {opacity}
            clearcoat={1}
            clearcoatRoughness={0.33}
        />
    </T.Mesh>

    {#if singleNumber}
        <Text
            color="#CCCCCC"
            position.y={0.5}
            rotation.x={-Math.PI / 2}
            depthOffset={-1}
            fontSize={0.8}
            fontWeight="bold"
            anchorX="50%"
            anchorY="50%"
            text={cube.value.toString()}
            characters="123456HELO"
            {material}
        />
    {/if}

    {#if !singleNumber}
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
        <Text
            color="#CCCCCC"
            rotation.y={-Math.PI / 2}
            position.x={-0.5}
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
            rotation.y={Math.PI / 2}
            position.x={0.5}
            depthOffset={-1}
            fontSize={0.8}
            fontWeight="bold"
            anchorX="50%"
            anchorY="50%"
            text={cube.value.toString()}
            characters="123456HELO"
            {material}
        />
    {/if}
</T.Group>
