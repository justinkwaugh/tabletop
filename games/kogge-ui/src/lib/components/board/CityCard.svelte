<script lang="ts">
    import { GOODS, MAX_OFFICES_PER_CITY, cityInfo, knownDestination } from '@tabletop/kogge'
    import { CARD_HEIGHT, CARD_WIDTH, cityPlacement } from '$lib/board/layout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { slotKey } from '$lib/model/session.svelte.js'
    import TargetFrame from './TargetFrame.svelte'
    import { GOOD_ART } from '$lib/utils/goodsArt.js'
    import { skylinePath } from '$lib/utils/skyline.js'
    import RouteShield from '../art/RouteShield.svelte'
    import HiddenShield from '../art/HiddenShield.svelte'
    import Kontor from '../art/Kontor.svelte'
    import GoodCube from '../art/GoodCube.svelte'
    import RaidChit from '../art/RaidChit.svelte'

    let { city }: { city: number } = $props()

    const gameSession = getGameSession()
    const info = $derived(cityInfo(city))
    const placement = $derived(cityPlacement(city))
    const cityState = $derived(gameSession.gameState.cities[city])
    const art = $derived(GOOD_ART[info.good])
    const bandInk = $derived(art.ink === '#b3262b' ? '#9e231f' : '#fbf1d0')
    const skyline = $derived(skylinePath(city, CARD_WIDTH - 16, 58))
    const isGameEndCity = $derived(gameSession.gameState.guildMaster.startCity === city)
    const goodsShown = $derived(GOODS.filter((good) => cityState.goods[good] > 0))
    const cityTarget = $derived(gameSession.cityTargets.get(city))
    const officeTargeted = $derived(gameSession.officeTarget === city)
    const SLOT_X = [10, 74]
    const OFFICE_X = [186, 238]
</script>

<g transform="translate({placement.card.x} {placement.card.y})">
    <rect
        x="0"
        y="0"
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        rx="6"
        fill="#f4ead0"
        stroke="#3f2a16"
        stroke-width="2"
        filter="url(#kogge-card-shadow)"
    ></rect>
    <path
        d={skyline}
        transform="translate(8 {CARD_HEIGHT - 64})"
        fill="#d9c79b"
        fill-opacity="0.75"
        stroke="#b39a68"
        stroke-width="0.7"
    ></path>
    <rect
        x="4"
        y="4"
        width={CARD_WIDTH - 8}
        height={CARD_HEIGHT - 8}
        rx="4"
        fill="none"
        stroke="#8a6a3c"
        stroke-width="0.9"
    ></rect>

    <path
        d="M4 10 Q4 4 10 4 H{CARD_WIDTH - 10} Q{CARD_WIDTH - 4} 4 {CARD_WIDTH - 4} 10 V42 H4 Z"
        fill={art.fill}
    ></path>
    <path d="M4 42 H{CARD_WIDTH - 4}" stroke="#3f2a16" stroke-width="1.4"></path>
    <text
        x="64"
        y="32"
        font-family="IM Fell English SC"
        font-size="27"
        letter-spacing="1"
        fill={bandInk}>{info.name}</text
    >
    <RouteShield value={city} x={10} y={-5} size={44} />

    {#each [0, 1] as slot (slot)}
        {@const route = cityState.routes[slot]}
        {@const slotTarget = gameSession.slotTargets.get(slotKey(city, slot))}
        <g transform="translate({SLOT_X[slot]} 50)">
            <rect
                x="0"
                y="0"
                width="58"
                height="62"
                rx="3"
                fill="#e3d1a4"
                stroke="#7a5b33"
                stroke-width="1"
            ></rect>
            {#if route?.value !== undefined}
                <RouteShield value={route.value} x={3} y={3} size={52} />
            {:else if route?.hidden}
                <HiddenShield
                    x={3}
                    y={3}
                    size={52}
                    knownValue={gameSession.gameState.result
                        ? route.hidden.value
                        : gameSession.myPlayerId
                          ? knownDestination(route, gameSession.myPlayerId)
                          : undefined}
                />
            {/if}
            {#if slotTarget}
                <TargetFrame width={58} height={62} target={slotTarget} radius={4} />
            {/if}
        </g>
    {/each}

    {#each Array.from({ length: MAX_OFFICES_PER_CITY }, (_, index) => index) as site (site)}
        {@const office = cityState.offices[site]}
        <g transform="translate({OFFICE_X[site]} 52)">
            {#if office}
                <Kontor color={gameSession.colors.getPlayerUiColor(office.playerId)} size={44} />
                {#if office.goods > 0}
                    <g transform="translate(22 58)">
                        <circle r="11" fill="#f4ead0" stroke="#3f2a16"></circle>
                        <GoodCube good={info.good} x={-3} y={1} size={11} />
                        <text
                            x="5"
                            y="5"
                            font-family="Libre Baskerville"
                            font-weight="700"
                            font-size="12"
                            fill="#2a1a0c">{office.goods}</text
                        >
                    </g>
                {/if}
            {:else}
                <Kontor color="none" size={44} outline />
                {#if officeTargeted && site === cityState.offices.length}
                    <TargetFrame
                        width={50}
                        height={56}
                        x={-3}
                        y={-3}
                        radius={4}
                        target={{
                            label: 'Found an office here',
                            select: () => gameSession.buildOffice()
                        }}
                    />
                {/if}
            {/if}
        </g>
    {/each}

    {#each goodsShown as good, column (good)}
        {@const count = cityState.goods[good]}
        <g transform="translate({30 + column * 46} 146)">
            {#each Array.from({ length: Math.min(count, 3) }, (_, index) => index) as cube (cube)}
                <GoodCube
                    {good}
                    x={cube === 2 ? 0 : cube * 16 - 8}
                    y={cube === 2 ? -15 : 0}
                    size={22}
                />
            {/each}
            <text
                x="0"
                y="34"
                text-anchor="middle"
                font-family="Libre Baskerville"
                font-size="18"
                font-weight="700"
                fill="#2a1a0c"
                stroke="#f4ead0"
                stroke-width="3.5"
                paint-order="stroke">{count}</text
            >
        </g>
    {/each}

    <g transform="translate(196 140)">
        {#each cityState.raiders as raiderId, index (raiderId + index)}
            <RaidChit
                color={gameSession.colors.getPlayerUiColor(raiderId)}
                textColor="#fff"
                x={index * 12}
                y={index * 5}
                size={26}
            />
        {/each}
    </g>
    {#if isGameEndCity}
        <g transform="translate(232 148)">
            <rect x="0" y="0" width="34" height="28" rx="2" fill="#7c1f1a" stroke="#2a1a0c"></rect>
            <text
                x="17"
                y="12"
                text-anchor="middle"
                font-family="IM Fell English SC"
                font-size="10.5"
                fill="#f6e2b0">Spiel</text
            >
            <text
                x="17"
                y="23"
                text-anchor="middle"
                font-family="IM Fell English SC"
                font-size="10.5"
                fill="#f6e2b0">Ende</text
            >
        </g>
    {/if}
    {#if cityTarget}
        <TargetFrame width={CARD_WIDTH} height={CARD_HEIGHT} target={cityTarget} radius={7} />
    {/if}
</g>
