<script lang="ts">
    import type { ChronicleSeat } from '@tabletop/oath'
    import { chipCased } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // A seat as the record keeps it: the name and the colour played that game, not a seat now at
    // the table (player ids change between games).
    let { seat }: { seat: ChronicleSeat } = $props()

    let gameSession = getGameSession()
</script>

<span
    class="rounded px-2 font-medium"
    style:background-color={gameSession.colors.getBgColorValue(seat.color)}
    style:color={gameSession.colors.getTextColorValue(seat.color)}
    data-record-chip={seat.color}>{chipCased(seat.name)}</span
>
