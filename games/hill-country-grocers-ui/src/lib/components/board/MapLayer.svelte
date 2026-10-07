<script lang="ts">
    import {
        CITIES,
        CityTier,
        HILL_COUNTRY_MAP,
        cityAt,
        developmentCapacity,
        hexKey,
        type CompanyId
    } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { HEX_RADIUS, hexCenter, hexPoints } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'
    import { TIER_FILL } from '$lib/utils/mapStyle.js'
    import { hexName } from '$lib/utils/describeAction.js'
    import Store from '../icons/Store.svelte'
    import Development from '../icons/Development.svelte'

    const gameSession = getGameSession()

    const DEVELOPMENT_SIZE = 22
    const DEVELOPMENT_STEP = 24
    const STORE_SIZE = 24
    // Moves a dot and its lone development slot to the hex's centre line.
    const SINGLE_SLOT_SHIFT = 24

    const chosenKeys = $derived(new Set(gameSession.chosenHexes.map(hexKey)))
    const targetKeys = $derived(new Set(gameSession.hexTargets.map(hexKey)))

    const hexes = $derived(
        HILL_COUNTRY_MAP.hexes().map((place) => {
            const key = hexKey(place.coords)
            const center = hexCenter(place.coords)
            const found = cityAt(place.coords)
            const companies = gameSession.gameState.companiesIn(place.coords)
            const pending = chosenKeys.has(key)
            const stores: { companyId: CompanyId; ghost: boolean }[] = [
                ...companies.map((companyId) => ({ companyId, ghost: false })),
                ...(pending && gameSession.buildCompany
                    ? [{ companyId: gameSession.buildCompany, ghost: true }]
                    : [])
            ]
            return {
                key,
                coords: place.coords,
                center,
                city: found,
                stores,
                storeY: center.y + storeRowOffset(found !== undefined, stores.length),
                target: targetKeys.has(key),
                pending
            }
        })
    )

    const cities = $derived(
        CITIES.map((place) => {
            const center = hexCenter(place.coords)
            const capacity = developmentCapacity(place.id)
            return {
                ...place,
                center,
                rowX: center.x + (capacity === 1 ? SINGLE_SLOT_SHIFT : 0),
                markers: gameSession.gameState.markersIn(place.id),
                capacity,
                target: gameSession.cityTargets.includes(place.id),
                chosen: gameSession.developCity === place.id
            }
        })
    )

    // A city's name stays clear unless three or more stores need the hex's wider middle.
    function storeRowOffset(isCity: boolean, count: number): number {
        if (!isCity) {
            return 4
        }
        return count >= 3 ? 8 : 30
    }

    function storeX(index: number, count: number, centerX: number): number {
        return centerX + (index - (count - 1) / 2) * (STORE_SIZE + 4)
    }

    function onKey(event: KeyboardEvent, action: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            action()
        }
    }
</script>

{#each cities as place (place.id)}
    <g class="city">
        <text
            x={place.center.x}
            y={place.center.y - 7}
            class="name"
            class:major={place.tier === CityTier.Black}>{place.name}</text
        >
        <circle
            cx={place.rowX - 35}
            cy={place.center.y - 36}
            r="10"
            fill={TIER_FILL[place.tier]}
            class="dot"
        />
        {#each Array.from({ length: place.capacity }, (_, index) => index) as slot (slot)}
            <Development
                x={place.rowX - 14 + slot * DEVELOPMENT_STEP}
                y={place.center.y - 37}
                size={DEVELOPMENT_SIZE}
                built={slot < place.markers}
            />
        {/each}
    </g>
{/each}

{#each hexes as place (place.key)}
    {#each place.stores as store, index (`${store.companyId}-${store.ghost}`)}
        <Store
            x={storeX(index, place.stores.length, place.center.x)}
            y={place.storeY}
            size={STORE_SIZE}
            fill={COMPANY_STYLE[store.companyId].fill}
            tint={COMPANY_STYLE[store.companyId].tint}
            ghost={store.ghost}
        />
    {/each}
{/each}

{#each hexes as place (place.key)}
    {#if place.target}
        <g
            class="target"
            role="button"
            tabindex="0"
            aria-label="Place a store in {place.city ? place.city.name : `hex ${place.coords.q},${place.coords.r}`}"
            onclick={() => gameSession.clickHex(place.coords)}
            onkeydown={(event) => onKey(event, () => gameSession.clickHex(place.coords))}
        >
            <polygon points={hexPoints(place.center, HEX_RADIUS - 4)} class="ring" />
            <title>{hexName(place.coords)}</title>
        </g>
    {/if}
{/each}

{#each cities as place (place.id)}
    {#if place.target || place.chosen}
        <g
            class="target"
            class:chosen={place.chosen}
            role="button"
            tabindex="0"
            aria-label="Develop {place.name}"
            onclick={() => gameSession.clickCity(place.id)}
            onkeydown={(event) => onKey(event, () => gameSession.clickCity(place.id))}
        >
            <rect
                x={place.rowX - 51}
                y={place.center.y - 54}
                width={place.capacity * DEVELOPMENT_STEP + 46}
                height="32"
                rx="10"
                class="ring"
            />
        </g>
    {/if}
{/each}

<style>





    .name {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        fill: #2b1a10;
        paint-order: stroke;
        stroke: rgba(255, 252, 244, 0.9);
        stroke-width: 3px;
        text-anchor: middle;
        pointer-events: none;
    }

    .name.major {
        font-size: 15px;
        font-weight: 700;
    }

    .dot {
        stroke: #1a1512;
        stroke-width: 2.5;
    }



    .target {
        cursor: pointer;
        outline: none;
    }

    .ring {
        fill: rgba(255, 230, 140, 0.25);
        stroke: #c8961a;
        stroke-width: 4;
        stroke-dasharray: 8 5;
        animation: hcg-ring 1.4s linear infinite;
    }

    .target:hover .ring,
    .target:focus-visible .ring,
    .target.chosen .ring {
        fill: rgba(255, 220, 110, 0.55);
    }

    @keyframes hcg-ring {
        to {
            stroke-dashoffset: -26;
        }
    }
</style>
