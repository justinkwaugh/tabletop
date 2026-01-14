<script lang="ts">
    import { T, type Props } from '@threlte/core'
    import { Mesh } from 'three'
    import { getContext } from 'svelte'
    import type { Effects } from '$lib/model/Effects.svelte'

    let { opacity = 0, ...others }: { opacity: number } & Props<typeof Mesh> = $props()

    const effects = getContext('effects') as Effects
</script>

<T.Mesh
    oncreate={(ref) => {
        effects.bloom?.selection.add(ref)
        return () => {
            effects.bloom?.selection.delete(ref)
        }
    }}
    {...others}
>
    <T.CircleGeometry args={[0.65, 20]} />
    <T.MeshBasicMaterial color="white" transparent={true} {opacity} />
</T.Mesh>
