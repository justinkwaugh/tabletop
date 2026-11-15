<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import RailroadCube from './RailroadCube.svelte'

    let {
        railroadId,
        x,
        y,
        width
    }: { railroadId: RailroadId; x: number; y: number; width: number } = $props()
</script>

<!-- A railroad's piece in the style BOARD_LOOK.piece picks, centred on (x, y), `width` across.
     Another style is drawn here beside it. -->
{#if BOARD_LOOK.piece === 'flat-square'}
    <RailroadCube {railroadId} {x} {y} {width} />
{/if}
