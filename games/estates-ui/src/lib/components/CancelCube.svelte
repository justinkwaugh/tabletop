<script lang="ts">
    import { T, type Props } from '@threlte/core'
    import { Text, RoundedBoxGeometry, Outlines } from '@threlte/extras'
    import { Group, MeshBasicMaterial } from 'three'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'

    let {
        opacity = 1,
        ...others
    }: {
        opacity?: number
        outline?: boolean
    } & Props<typeof Group> = $props()

    const material = new MeshBasicMaterial({ toneMapped: false })
</script>

<T.Group {...others}>
    <T.Mesh name="outlineMesh" castShadow>
        <RoundedBoxGeometry args={[1, 1, 0.3]} />
        <T.MeshPhysicalMaterial
            transparent={opacity !== 1}
            {opacity}
            color={'#888888'}
            clearcoat={1}
            clearcoatRoughness={0.33}
        />
    </T.Mesh>
    <Text
        color="#CCCCCC"
        position.z={0.15}
        depthOffset={-1}
        fontSize={1}
        fontWeight="bold"
        anchorX="50%"
        anchorY="50%"
        text="X"
        characters="123456HELO"
        {material}
    />
</T.Group>
