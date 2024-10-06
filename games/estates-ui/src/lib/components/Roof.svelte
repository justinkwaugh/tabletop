<script lang="ts">
    import { T } from '@threlte/core'
    import { Text } from '@threlte/extras'
    import Roof from '$lib/3d/Roof.svelte'
    import * as THREE from 'three'
    const material = new THREE.MeshBasicMaterial({ toneMapped: false })

    let { ...others }: {} = $props()
</script>

<T.Group {...others}>
    <Roof />
    <Text
        color="#CCCCCC"
        rotation.x={-Math.PI / 2}
        position.y={0.305}
        depthOffset={-1}
        fontSize={0.8}
        fontWeight="bold"
        anchorX="50%"
        anchorY="50%"
        text="6"
        characters="123456HELO"
        {material}
    />
</T.Group>
