<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import boardImg from '$lib/images/bus_board.jpg'
    let gameSession = getGameSession()
</script>

<div class="relative w-[1839px] h-[1300px] bg-black">
    <div class="absolute top left w-[1839px] h-[1300px]">
        <img src={boardImg} alt="game board" />
    </div>
</div>
