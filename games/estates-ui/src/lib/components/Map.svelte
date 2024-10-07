<script lang="ts">
    import { T } from '@threlte/core'
    import { useTexture } from '@threlte/extras'
    import boardImg from '$lib/images/board.jpg'

    const map = useTexture(boardImg)
    const height = 10
    const width = height * 2.75
</script>

{#await map then mapValue}
    <T.Mesh position.y={-0.6} rotation.x={-Math.PI / 2} rotation.z={Math.PI} receiveShadow>
        <T.BoxGeometry args={[width, height, 0.2]} />
        {#each { length: 4 } as _}
            <T.MeshStandardMaterial
                color="#444444"
                attach={({ parent, ref }) => {
                    const anyParent = parent as any
                    if (Array.isArray(anyParent.material))
                        anyParent.material = [...anyParent.material, ref]
                    else anyParent.material = [ref]
                }}
            />
        {/each}
        <T.MeshStandardMaterial
            map={mapValue}
            attach={({ parent, ref }) => {
                const anyParent = parent as any
                if (Array.isArray(anyParent.material))
                    anyParent.material = [...anyParent.material, ref]
                else anyParent.material = [ref]
            }}
        />
        <T.MeshStandardMaterial
            color="#222222"
            attach={({ parent, ref }) => {
                const anyParent = parent as any
                if (Array.isArray(anyParent.material))
                    anyParent.material = [...anyParent.material, ref]
                else anyParent.material = [ref]
            }}
        />
    </T.Mesh>
{/await}
