<script lang="ts">
    import type { HydratedFeudumGameState } from '@tabletop/feudum'
    import { MapAsset, assetUrl } from '$lib/art/assetMap.js'
    import { PlainChrome, dimmedWithRest, type BoardChrome } from '$lib/model/boardChrome.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import EpochSky from './EpochSky.svelte'
    import RegionStacks from './RegionStacks.svelte'
    import ScoreRing from './ScoreRing.svelte'
    import VoyageService from './VoyageService.svelte'
    import WineBarrels from './WineBarrels.svelte'

    /**
     * The tracks round and under the map. The map's file prints their spaces, stacks, chart and
     * barrels, so over it they draw only what state changes; with no file they draw their own too.
     * The score ring lies outside that file and is drawn wherever the board is whole; a desk draws
     * no ring (`ring` off), its scores standing in the seat panels and the zoom row.
     */
    let {
        state,
        paintOf,
        chrome = PlainChrome,
        ring = true
    }: {
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        chrome?: BoardChrome
        ring?: boolean
    } = $props()

    let printed = $derived(assetUrl(MapAsset) !== undefined)
</script>

<EpochSky {state} {printed} dim={dimmedWithRest(chrome)} />
<RegionStacks {state} {printed} {chrome} />
<VoyageService {state} {printed} {paintOf} {chrome} />
<!-- Each barrel and disc dims as itself: the ring round the board never fades as one group. -->
<WineBarrels {state} {printed} {paintOf} dim={dimmedWithRest(chrome)} />
{#if ring}
    <ScoreRing {state} {paintOf} dim={dimmedWithRest(chrome)} />
{/if}
