<script lang="ts">
    import { T, useThrelte, type Props } from '@threlte/core'
    import { Mesh } from 'three'
    import { PulsingMaterial } from '$lib/utils/pulsingMaterial.js'
    import { getContext } from 'svelte'
    import type { Effects } from '$lib/model/Effects.svelte'

    let { active, ...others }: { active: boolean } & Props<typeof Mesh> = $props()

    const { invalidate } = useThrelte()
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
    <T is={PulsingMaterial} args={[invalidate, 0.15]} {active} />
</T.Mesh>
