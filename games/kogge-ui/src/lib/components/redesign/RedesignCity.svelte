<script lang="ts">
    import { GOODS, cityGood, knownDestination } from '@tabletop/kogge'
    import {
        PANEL_HEIGHT,
        PANEL_SPOTS,
        PANEL_WIDTH,
        ROUTE_SQUARE_SIZE,
        panelSpot,
        redesignPanel
    } from '$lib/board/redesignLayout.js'
    import { slotKey } from '$lib/model/session.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { raidChit } from '$lib/utils/redesignArt.js'
    import RouteTile from './RouteTile.svelte'
    import Kontor from '../art/Kontor.svelte'
    import GoodCube from '../art/GoodCube.svelte'
    import RaidChit from '../art/RaidChit.svelte'
    import TargetFrame from '../board/TargetFrame.svelte'

    let { city }: { city: number } = $props()

    const gameSession = getGameSession()
    const panel = $derived(redesignPanel(city))
    const cityState = $derived(gameSession.gameState.cities[city])
    const sideways = $derived(panel.rotation === 90 || panel.rotation === 270)
    const panelBox = $derived({
        width: sideways ? PANEL_HEIGHT : PANEL_WIDTH,
        height: sideways ? PANEL_WIDTH : PANEL_HEIGHT
    })
    const goodsCentre = $derived(panelSpot(city, PANEL_SPOTS.goods))
    const officeCentres = $derived(PANEL_SPOTS.offices.map((spot) => panelSpot(city, spot)))
    const goodsShown = $derived(GOODS.filter((good) => cityState.goods[good] > 0))
    const cityTarget = $derived(gameSession.cityTargets.get(city))
    const officeTargeted = $derived(gameSession.officeTarget === city)
    const isGameEndCity = $derived(gameSession.gameState.guildMaster.startCity === city)
    const PILE_SPACING = 40
</script>

{#each panel.routeSquares as square, slot (slot)}
    {@const route = cityState.routes[slot]}
    {@const slotTarget = gameSession.slotTargets.get(slotKey(city, slot))}
    {#if route?.value !== undefined || route?.hidden}
        <RouteTile
            value={route.value}
            knownValue={route.hidden
                ? gameSession.gameState.result
                    ? route.hidden.value
                    : gameSession.myPlayerId
                      ? knownDestination(route, gameSession.myPlayerId)
                      : undefined
                : undefined}
            x={square.x}
            y={square.y}
            size={ROUTE_SQUARE_SIZE - 4}
        />
    {/if}
    {#if slotTarget}
        <TargetFrame
            x={square.x - ROUTE_SQUARE_SIZE / 2}
            y={square.y - ROUTE_SQUARE_SIZE / 2}
            width={ROUTE_SQUARE_SIZE}
            height={ROUTE_SQUARE_SIZE}
            radius={6}
            target={slotTarget}
        />
    {/if}
{/each}

{#each officeCentres as centre, site (site)}
    {@const office = cityState.offices[site]}
    {#if office}
        <Kontor
            color={gameSession.colors.getPlayerUiColor(office.playerId)}
            x={centre.x - 20}
            y={centre.y - 26}
            size={40}
        />
        {#if office.goods > 0}
            <g transform="translate({centre.x + 14} {centre.y + 22})">
                <circle r="12" fill="#f4ead0" stroke="#3f2a16"></circle>
                <GoodCube good={cityGood(city)} x={-4} y={1} size={11} />
                <text
                    x="4"
                    y="5"
                    font-family="Libre Baskerville"
                    font-weight="700"
                    font-size="12"
                    fill="#2a1a0c">{office.goods}</text
                >
            </g>
        {/if}
    {:else if officeTargeted && site === cityState.offices.length}
        <TargetFrame
            x={centre.x - (sideways ? 52 : 27)}
            y={centre.y - (sideways ? 27 : 52)}
            width={sideways ? 104 : 54}
            height={sideways ? 54 : 104}
            radius={6}
            target={{ label: 'Found an office here', select: () => gameSession.buildOffice() }}
        />
    {/if}
{/each}

{#each goodsShown as good, index (good)}
    {@const offset = (index - (goodsShown.length - 1) / 2) * PILE_SPACING}
    {@const x = goodsCentre.x + (sideways ? 0 : offset)}
    {@const y = goodsCentre.y + (sideways ? offset : 0) + 8}
    {@const count = cityState.goods[good]}
    <g transform="translate({x} {y})">
        {#each Array.from({ length: Math.min(count, 3) }, (_, cube) => cube) as cube (cube)}
            <GoodCube
                {good}
                x={cube === 2 ? 0 : cube * 15 - 7.5}
                y={cube === 2 ? -14 : 0}
                size={20}
            />
        {/each}
        <text
            x="0"
            y="30"
            text-anchor="middle"
            font-family="Libre Baskerville"
            font-size="16"
            font-weight="700"
            fill="#2a1a0c"
            stroke="#f4ead0"
            stroke-width="3.5"
            paint-order="stroke">{count}</text
        >
    </g>
{/each}

{#each cityState.raiders as raiderId, index (raiderId + index)}
    {@const chit = raidChit(gameSession.colors.getPlayerColor(raiderId))}
    {#if chit}
        <image
            href={chit}
            x={goodsCentre.x - 70 + index * 14}
            y={goodsCentre.y - 48 + index * 6}
            width="34"
            height="36"
        ></image>
    {:else}
        <RaidChit
            color={gameSession.colors.getPlayerUiColor(raiderId)}
            textColor="#fff"
            x={goodsCentre.x - 70 + index * 14}
            y={goodsCentre.y - 48 + index * 6}
            size={32}
        />
    {/if}
{/each}

{#if isGameEndCity}
    {@const spot = panelSpot(city, { x: 52, y: -64 })}
    <g transform="translate({spot.x - 22} {spot.y - 14})">
        <rect width="44" height="28" rx="2" fill="#7c1f1a" stroke="#2a1a0c"></rect>
        <text
            x="22"
            y="12"
            text-anchor="middle"
            font-family="IM Fell English SC"
            font-size="10.5"
            fill="#f6e2b0">Spiel</text
        >
        <text
            x="22"
            y="23"
            text-anchor="middle"
            font-family="IM Fell English SC"
            font-size="10.5"
            fill="#f6e2b0">Ende</text
        >
    </g>
{/if}

{#if cityTarget}
    <TargetFrame
        x={panel.centre.x - panelBox.width / 2}
        y={panel.centre.y - panelBox.height / 2}
        width={panelBox.width}
        height={panelBox.height}
        radius={8}
        target={cityTarget}
    />
{/if}
