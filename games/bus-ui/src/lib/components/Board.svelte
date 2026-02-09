<script lang="ts">
    import DebugOverlay from './DebugOverlay.svelte'
    import boardImg from '$lib/images/bus_board.jpg'
</script>

<div class="relative h-[1300px] w-[1839px] bg-black">
    <img src={boardImg} alt="game board" class="absolute inset-0 h-full w-full" />
    <DebugOverlay />
</div>
