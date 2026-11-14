<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import RailroadCube from './RailroadCube.svelte'

    let {
        railroadId,
        x,
        y,
        width,
        lettered = true
    }: {
        railroadId: RailroadId
        x: number
        y: number
        width: number
        /** The railroad's letter on the piece, where it is large enough to read. */
        lettered?: boolean
    } = $props()
</script>

<!-- A railroad's piece in the style BOARD_LOOK.piece picks, centred on (x, y), `width` across.
     Both styles drawn so far are cubes; another style is drawn here beside them. -->
<RailroadCube {railroadId} {x} {y} {width} {lettered} wood={BOARD_LOOK.piece === 'wood-cube'} />
