<script lang="ts">
    import { getContext } from 'svelte'
    import type { BridgesGameSession } from '$lib/model/BridgesGameSession.svelte'
    import Village from '$lib/components/Village.svelte'
    import boardImg from '$lib/images/board.jpg'
    let gameSession = getContext('gameSession') as BridgesGameSession
</script>

<div class="relative w-[1280px] h-[1322px]">
    <div class="absolute top left w-[1280px] h-[1322px]">
        <img src={boardImg} alt="game board" />
    </div>
    <div class="absolute top-[125px] left-[143px]">
        <Village />
    </div>
    <div class="absolute top-[117px] left-[628px]">
        <Village />
    </div>

    <div class="absolute top-[161px] left-[1009px]">
        <Village />
    </div>
    <div class="absolute top-[566px] left-[234px]">
        <Village />
    </div>
    <div
        class="flex flex-col justify-center items-center border-2 border-gray-400 rounded-full py-2 px-4 bg-gray-700 text-3xl absolute top-[110px] left-[100px] text-gray-200"
    >
        <h1 class="text-4xl">0</h1>
    </div>
</div>
