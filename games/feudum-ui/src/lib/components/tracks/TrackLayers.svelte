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
<WineBarrels {state} {printed} {paintOf} dim={dimmedWithRest(chrome)} />
{#if ring}
    <ScoreRing {state} {paintOf} dim={dimmedWithRest(chrome)} />
{/if}
