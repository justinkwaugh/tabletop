<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import boardImg from '$lib/images/board.jpg'
    import boardImg5p from '$lib/images/board5p.jpg'

    let gameSession = getContext('gameSession') as SolGameSession
</script>

<div class="relative w-[1280px] h-[1280px]">
    <div class="absolute top left w-[1280px] h-[1280px]">
        <img src={boardImg} alt="game board" />
    </div>
</div>
