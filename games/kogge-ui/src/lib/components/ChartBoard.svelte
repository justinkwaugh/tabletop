<script lang="ts">
    import { CITY_PLACEMENTS, BOARD_HEIGHT, BOARD_WIDTH } from '$lib/board/layout.js'
    import SeaChart from './board/SeaChart.svelte'
    import SeaLanes from './board/SeaLanes.svelte'
    import ActiveLanes from './board/ActiveLanes.svelte'
    import CityCard from './board/CityCard.svelte'
    import Harbours from './board/Harbours.svelte'
    import Fleet from './board/Fleet.svelte'
    import Market from './board/Market.svelte'
    import Warehouse from './board/Warehouse.svelte'
    import TitleCartouche from './board/TitleCartouche.svelte'
</script>

<svg
    viewBox="0 0 {BOARD_WIDTH} {BOARD_HEIGHT}"
    width={BOARD_WIDTH}
    height={BOARD_HEIGHT}
    class="kogge-board select-none"
    role="img"
    aria-label="The Baltic Sea"
>
    <defs>
        <filter id="kogge-card-shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow
                dx="2"
                dy="3"
                stdDeviation="2.5"
                flood-color="#2a1a0c"
                flood-opacity="0.35"
            ></feDropShadow>
        </filter>
    </defs>
    <SeaChart />
    <SeaLanes />
    <TitleCartouche />
    <Market />
    <Warehouse />
    {#each CITY_PLACEMENTS as placement (placement.number)}
        <CityCard city={placement.number} />
    {/each}
    <Harbours />
    <ActiveLanes />
    <Fleet />
</svg>
