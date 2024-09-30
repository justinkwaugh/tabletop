<script lang="ts">
    import { getContext, onMount } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Canvas } from '@threlte/core'
    import Scene from './Scene.svelte'
    let gameSession = getContext('gameSession') as EstatesGameSession

    let table: HTMLDivElement
</script>

<div class="relative w-[1280px] h-[1280px]">
    <Canvas>
        <Scene />
    </Canvas>
</div>
