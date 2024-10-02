<script lang="ts">
    import { getContext, onMount } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Canvas } from '@threlte/core'
    import Scene from './Scene.svelte'
</script>

<div class="relative w-full h-full">
    <Canvas>
        <Scene />
    </Canvas>
</div>
