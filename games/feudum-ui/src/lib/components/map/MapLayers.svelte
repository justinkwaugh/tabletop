<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { HydratedFeudumGameState } from '@tabletop/feudum'
    import { PlainChrome, dimmedWithRest, type BoardChrome } from '$lib/model/boardChrome.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import MapContents from './MapContents.svelte'
    import MapGround from './MapGround.svelte'
    import MapLocations from './MapLocations.svelte'
    import MapPieces from './MapPieces.svelte'
    import MapRoutes from './MapRoutes.svelte'

    /** The map's layers, back to front, as the contract's render ownership sets them. */
    let {
        state,
        paintOf,
        chrome = PlainChrome,
        underContents
    }: {
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        chrome?: BoardChrome
        underContents?: Snippet
    } = $props()
</script>

<g data-layer="ground" opacity={dimmedWithRest(chrome)}><MapGround /></g>
<g data-layer="routes"><MapRoutes {chrome} /></g>
<g data-layer="locations"><MapLocations {state} {paintOf} {chrome} /></g>
{@render underContents?.()}
<g data-layer="contents"><MapContents {state} {paintOf} {chrome} /></g>
<g data-layer="pieces"><MapPieces {state} {paintOf} {chrome} /></g>
