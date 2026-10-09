<script lang="ts">
    import { CITY_COUNT } from '@tabletop/kogge'
    import { REDESIGN_HEIGHT, REDESIGN_WIDTH } from '$lib/board/redesignLayout.js'
    import { REDESIGN_BOARD } from '$lib/utils/redesignArt.js'
    import RedesignCity from './RedesignCity.svelte'
    import RedesignTracks from './RedesignTracks.svelte'
    import SeaLanes from '../board/SeaLanes.svelte'
    import ActiveLanes from '../board/ActiveLanes.svelte'
    import Fleet from '../board/Fleet.svelte'
</script>

<svg
    viewBox="0 0 {REDESIGN_WIDTH} {REDESIGN_HEIGHT}"
    width={REDESIGN_WIDTH}
    height={REDESIGN_HEIGHT}
    class="select-none"
    role="img"
    aria-label="The Baltic Sea"
>
    <image href={REDESIGN_BOARD} width={REDESIGN_WIDTH} height={REDESIGN_HEIGHT}></image>
    <SeaLanes />
    {#each Array.from({ length: CITY_COUNT }, (_, city) => city) as city (city)}
        <RedesignCity {city} />
    {/each}
    <RedesignTracks />
    <ActiveLanes />
    <Fleet />
</svg>
