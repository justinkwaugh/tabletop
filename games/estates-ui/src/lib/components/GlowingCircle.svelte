<script lang="ts">
    import { T } from '@threlte/core'
    import { getContext } from 'svelte'
    import type { Effects } from '$lib/model/Effects.svelte'

    let { ...others }: {} = $props()

    const effects = getContext('effects') as Effects
</script>

<T.Mesh
    oncreate={(ref) => {
        effects.bloom?.selection.add(ref)
        effects.outline?.selection.add(ref)
    }}
    {...others}
>
    <T.CircleGeometry args={[0.65, 20]} />
    <T.MeshStandardMaterial
        color={'#FFFFFF'}
        emissive={'#FFFFFF'}
        emissiveIntensity={0.4}
        transparent={true}
        opacity={0}
    />
</T.Mesh>
