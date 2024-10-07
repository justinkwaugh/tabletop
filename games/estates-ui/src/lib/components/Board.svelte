<script lang="ts">
    import { Canvas, useThrelte } from '@threlte/core'
    import Scene from './Scene.svelte'
    import Renderer from './Renderer.svelte'
    import { setContext } from 'svelte'
    import { Effects } from '$lib/model/Effects.svelte'

    setContext('effects', new Effects())
</script>

<div class="relative w-full h-full">
    <Canvas>
        <Renderer />
        <Scene />
    </Canvas>
</div>
