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
     * The score ring lies outside that file and is always drawn.
     */
    let {
        state,
        paintOf,
        chrome = PlainChrome
    }: {
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        chrome?: BoardChrome
    } = $props()

    let printed = $derived(assetUrl(MapAsset) !== undefined)
</script>

<g opacity={dimmedWithRest(chrome)}><EpochSky {state} {printed} /></g>
<RegionStacks {state} {printed} {chrome} />
<VoyageService {state} {printed} {paintOf} {chrome} />
<g opacity={dimmedWithRest(chrome)}>
    <WineBarrels {state} {printed} {paintOf} />
    <ScoreRing {state} {paintOf} />
</g>
