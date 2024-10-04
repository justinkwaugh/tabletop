<script lang="ts">
    import { T } from '@threlte/core'
    import { Text, RoundedBoxGeometry } from '@threlte/extras'
    import { Cube } from '@tabletop/estates'
    import * as THREE from 'three'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    let { ...others }: {} = $props()

    const material = new THREE.MeshBasicMaterial({ toneMapped: false })
</script>

<T.Group {...others}>
    <T.Mesh rotation.x={Math.PI / 4} position.z={-(2 / Math.sqrt(2)) / 2}>
        <T.PlaneGeometry args={[3, 2]} />
        <T.MeshStandardMaterial color={'#EEEEEE'} side={THREE.DoubleSide} />
    </T.Mesh>
    <T.Group rotation.x={-Math.PI / 4} position.z={2 / Math.sqrt(2) / 2}>
        <T.Mesh>
            <T.PlaneGeometry args={[3, 2]} />
            <T.MeshStandardMaterial color={'#EEEEEE'} side={THREE.DoubleSide} />
        </T.Mesh>
        <Text
            color="#333333"
            position.y={0.6}
            depthOffset={-1}
            fontSize={0.7}
            anchorX="50%"
            anchorY="50%"
            text={'justin'}
            characters="123456HELO"
            {material}
        />
        <Text
            color="#333333"
            position.y={-0.4}
            depthOffset={-1}
            fontSize={0.6}
            anchorX="50%"
            anchorY="50%"
            text={'Bid $4'}
            characters="123456HELO"
            {material}
        />
    </T.Group>
</T.Group>
