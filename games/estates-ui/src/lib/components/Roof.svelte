<script lang="ts">
    import { T } from '@threlte/core'
    import { Text } from '@threlte/extras'
    import { useTexture } from '@threlte/extras'
    import * as THREE from 'three'
    let { x = 0, y = 0, z = 0 }: { x?: number; y?: number; z?: number; color?: string } = $props()
    const material = new THREE.MeshBasicMaterial({ toneMapped: false })
</script>

<T.Group position.y={y} position.x={x} position.z={z}>
    <T.Mesh scale={1} castShadow>
        <T.BoxGeometry args={[1, 0.5, 1]} />
        <T.MeshPhysicalMaterial color={'#333333'} clearcoat={1} clearcoatRoughness={0.33} />
    </T.Mesh>
    <Text
        color="#CCCCCC"
        rotation.x={-Math.PI / 2}
        position.y={0.25}
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
