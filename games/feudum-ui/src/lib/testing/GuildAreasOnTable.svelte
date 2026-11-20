<script lang="ts">
    import type { Color } from '@tabletop/common'
    import type { HydratedFeudumGameState } from '@tabletop/feudum'
    import GuildAreas from '$lib/components/guilds/GuildAreas.svelte'
    import { setTableLayers } from '$lib/components/table/tableLayersContext.js'
    import { PlainChrome, type BoardChrome } from '$lib/model/boardChrome.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { TableLayers } from '$lib/model/tableLayers.svelte.js'

    let {
        state,
        paintOf,
        colourPaintOf,
        chrome = PlainChrome,
        layers = new TableLayers()
    }: {
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
        chrome?: BoardChrome
        layers?: TableLayers
    } = $props()

    // svelte-ignore state_referenced_locally
    setTableLayers(layers)
</script>

<svg viewBox="0 0 2500 1103">
    <GuildAreas {state} {paintOf} {colourPaintOf} {chrome} />
</svg>
