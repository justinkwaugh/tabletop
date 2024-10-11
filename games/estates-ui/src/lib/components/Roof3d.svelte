<script lang="ts">
    import { T, type Props } from '@threlte/core'
    import { Text } from '@threlte/extras'
    import RoofModel from '$lib/3d/Roof.svelte'
    import { Group, MeshBasicMaterial, Object3D } from 'three'
    import type { Roof } from '@tabletop/estates'
    const material = new MeshBasicMaterial({ toneMapped: false })
    let group: Group

    let {
        roof,
        onloaded,
        ...others
    }: { roof: Roof; onloaded?: ((ref: Object3D) => void) | undefined } & Props<typeof Group> =
        $props()

    let text = roof.value === -1 ? '?' : (roof.value?.toString() ?? '?')
</script>

<T.Group
    oncreate={(ref) => {
        group = ref
    }}
    name="roof"
    {...others}
>
    <RoofModel
        onloaded={(ref) => {
            console.log('Roof loaded: group=', group)
            onloaded?.(group)
        }}
    />
    <Text
        name="roofText"
        color="#CCCCCC"
        rotation.x={-Math.PI / 2}
        position.y={0.305}
        depthOffset={-1}
        fontSize={0.8}
        fontWeight="bold"
        anchorX="50%"
        anchorY="50%"
        {text}
        characters="123456?"
        {material}
    />
    <Text
        name="roofBackText"
        color={roof.value ? '#CCCCCC' : '#666666'}
        rotation.x={Math.PI / 2}
        rotation.z={Math.PI}
        position.y={-0.305}
        depthOffset={-1}
        fontSize={0.8}
        fontWeight="bold"
        anchorX="50%"
        anchorY="50%"
        {text}
        characters="123456?"
        {material}
    />
</T.Group>
