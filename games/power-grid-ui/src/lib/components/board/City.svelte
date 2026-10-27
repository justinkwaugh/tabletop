<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { HOUSE_COSTS, houseSlots, type City } from '@tabletop/power-grid'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CITY_RADIUS, slotDividers, slotOffset, slotSector } from '$lib/utils/mapGeometry.js'
    import House from '../House.svelte'
    import { houseKey } from '$lib/animators/housesAnimator.js'

    let { city, point, active }: { city: City; point: Point; active: boolean } = $props()

    const session = getGameSession()

    const occupants = $derived(session.gameState.occupants(city.id))
    const arriving = $derived(session.arrivingHouses.filter((house) => house.cityId === city.id))
    const openSlots = $derived(houseSlots(session.gameState.step))
    const chosen = $derived(session.buildDraft.includes(city.id))
    const addedCost = $derived(session.buildTargets.get(city.id))
    const trustTarget = $derived(session.trustTargets.has(city.id))
    const targetable = $derived(addedCost !== undefined || trustTarget)
    const interactive = $derived(targetable || chosen)
    const myColor = $derived(session.colors.getPlayerUiColor(session.myPlayerId))

    function choose() {
        if (trustTarget) {
            session.placeTrustHouse(city.id)
        } else if (interactive) {
            session.toggleCity(city.id)
        }
    }
</script>

<g
    transform="translate({point.x} {point.y})"
    class:interactive
    opacity={active ? 1 : 0.45}
    role="button"
    aria-disabled={!interactive}
    tabindex={interactive ? 0 : -1}
    aria-label="{trustTarget
        ? 'Place a Trust house in'
        : interactive
          ? 'Build in'
          : 'City of'} {city.name}"
    onclick={choose}
    onkeydown={(event) => (event.key === 'Enter' || event.key === ' ') && choose()}
>
    {#if targetable || chosen}
        <circle
            r={CITY_RADIUS + 6}
            fill={chosen ? '#f3c534' : 'none'}
            stroke="#f3c534"
            stroke-width="3"
            stroke-dasharray={chosen ? undefined : '5 3'}
            class="target-ring"
        ></circle>
    {/if}
    <circle r={CITY_RADIUS + 1.5} fill="#3a3632"></circle>
    {#each [0, 1, 2] as slot (slot)}
        <path d={slotSector(slot)} fill={slot < openSlots ? '#e6e3da' : '#a9a69c'}></path>
    {/each}
    {#each slotDividers() as end, index (index)}
        <line x1="0" y1="0" x2={end.x} y2={end.y} stroke="#3a3632" stroke-width="1.6"></line>
    {/each}
    <circle r="3" fill="#3a3632"></circle>
    {#each [0, 1, 2] as slot (slot)}
        {@const offset = slotOffset(slot)}
        {@const owner = occupants[slot]}
        {@const arrival = arriving.find((house) => house.slot === slot)}
        {#if arrival}
            <g transform="translate({offset.x} {offset.y + 1})">
                <g {@attach session.housesAnimator.attach(houseKey(city.id, slot))}>
                    <House x={0} y={0} color={session.ownerColor(arrival.playerId)} size={1} />
                </g>
            </g>
        {:else if owner}
            <House x={offset.x} y={offset.y + 1} color={session.ownerColor(owner)} size={1} />
        {:else if chosen && slot === occupants.length}
            <House x={offset.x} y={offset.y + 1} color={myColor} size={1} ghost />
        {:else}
            <text
                class="slot-cost"
                x={offset.x}
                y={offset.y}
                text-anchor="middle"
                dominant-baseline="central"
                opacity={slot < openSlots ? 0.75 : 0.4}>{HOUSE_COSTS[slot]}</text
            >
        {/if}
    {/each}
    <text class="name" y={CITY_RADIUS + 12} text-anchor="middle" dominant-baseline="central"
        >{city.name}</text
    >
    {#if addedCost !== undefined && !chosen}
        <g transform="translate({CITY_RADIUS + 2} {-CITY_RADIUS - 2})">
            <rect x="-2" y="-9" width="30" height="16" rx="3" fill="#1f2a22"></rect>
            <text class="price" x="13" y="-1" text-anchor="middle" dominant-baseline="central"
                >+{addedCost}</text
            >
        </g>
    {/if}
</g>

<style>
    .interactive {
        cursor: pointer;
    }
    .interactive:hover .target-ring {
        stroke-dasharray: none;
        stroke-width: 4;
    }
    .slot-cost {
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 700;
        font-size: 8.5px;
        fill: #3a3632;
    }
    .name {
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 700;
        font-size: 12.5px;
        fill: #1d1a17;
        paint-order: stroke;
        stroke: #ece6d4;
        stroke-width: 3px;
        stroke-linejoin: round;
    }
    .price {
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 700;
        font-size: 12px;
        fill: #f3c534;
    }
</style>
