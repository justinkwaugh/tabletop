<script lang="ts">
    import { T, type Props } from '@threlte/core'
    import { Text } from '@threlte/extras'
    import RoofModel from '$lib/3d/Roof.svelte'
    import { Group, MeshBasicMaterial } from 'three'
    import type { Roof } from '@tabletop/estates'
    const material = new MeshBasicMaterial({ toneMapped: false })

    let { roof, ...others }: { roof: Roof } & Props<typeof Group> = $props()
</script>

<T.Group name="roof" {...others}>
    <RoofModel />
    <Text
        color="#CCCCCC"
        rotation.x={-Math.PI / 2}
        position.y={0.305}
        depthOffset={-1}
        fontSize={0.8}
        fontWeight="bold"
        anchorX="50%"
        anchorY="50%"
        text={roof.value?.toString() ?? '-1'}
        characters="123456?"
        {material}
    />
</T.Group>
