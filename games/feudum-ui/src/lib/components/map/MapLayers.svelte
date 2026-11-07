<script lang="ts">
    import type { HydratedFeudumGameState } from '@tabletop/feudum'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import MapContents from './MapContents.svelte'
    import MapGround from './MapGround.svelte'
    import MapLocations from './MapLocations.svelte'
    import MapPieces from './MapPieces.svelte'
    import MapRoutes from './MapRoutes.svelte'

    /** The map's layers, back to front, as the contract's render ownership sets them. */
    let {
        state,
        paintOf
    }: { state: HydratedFeudumGameState; paintOf: (playerId: string) => SeatPaint } = $props()
</script>

<g data-layer="ground"><MapGround /></g>
<g data-layer="routes"><MapRoutes /></g>
<g data-layer="locations"><MapLocations {state} /></g>
<g data-layer="contents"><MapContents {state} {paintOf} /></g>
<g data-layer="pieces"><MapPieces {state} {paintOf} /></g>
