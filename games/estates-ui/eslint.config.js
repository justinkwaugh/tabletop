import config from '@tabletop/eslint-config'

export default [
    ...config,
    {
        // Threlte's useGltf/useTexture loaders return stores that are also promises, and the
        // 3D components `{#await}` them on purpose; the rule would rewrite those to `$store`.
        files: [
            'src/lib/3d/BarrierOne.svelte',
            'src/lib/3d/Roof.svelte',
            'src/lib/3d/TopHat.svelte',
            'src/lib/components/Cert3d.svelte',
            'src/lib/components/Map.svelte',
            'src/lib/components/Offer3d.svelte'
        ],
        rules: {
            'svelte/require-store-reactive-access': 'off'
        }
    }
]
