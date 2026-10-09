<script lang="ts">
    import { BONUS_CHITS, CITY_COUNT, GOODS, GUILD_MASTER_LAPS } from '@tabletop/kogge'
    import {
        BONUS_SPOTS,
        DEVELOPMENT_TRACK,
        MARKET_BOXES,
        REDESIGN_LAP_TRACK,
        REDESIGN_WAREHOUSE,
        TURN_ORDER_SPOTS
    } from '$lib/board/redesignLayout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BONUS_TILES } from '$lib/utils/redesignArt.js'
    import RouteTile from './RouteTile.svelte'
    import GoodCube from '../art/GoodCube.svelte'
    import TargetFrame from '../board/TargetFrame.svelte'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const order = $derived(game.startChoices ? [] : game.turnManager.turnOrder)
    const standings = $derived(
        game.players.map((player) => ({
            playerId: player.playerId,
            points: game.developmentPoints(player.playerId)
        }))
    )
    const steps = CITY_COUNT * GUILD_MASTER_LAPS
</script>

{#each MARKET_BOXES as box, index (index)}
    {@const group = game.offer[index]}
    {#if group && group.boughtBy === undefined}
        {#each group.markers as marker, slot (slot)}
            <RouteTile
                value={marker}
                x={box.x + box.width / 2}
                y={box.y + 27 + slot * 50}
                size={46}
            />
        {/each}
    {/if}
    {#if gameSession.marketTargets.includes(index)}
        <TargetFrame
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            radius={6}
            target={{
                label: 'Buy this pair for one good',
                select: () => gameSession.chooseOfferGroup(index)
            }}
        />
    {/if}
{/each}

{#each order as playerId, index (playerId)}
    {@const spot = TURN_ORDER_SPOTS[index]}
    <circle
        cx={spot.x}
        cy={spot.y}
        r="17"
        fill={gameSession.colors.getPlayerUiColor(playerId)}
        stroke="#2a1a0c"
        stroke-width="1.2"
    ></circle>
    <text
        x={spot.x}
        y={spot.y + 6}
        text-anchor="middle"
        font-family="Libre Baskerville"
        font-weight="700"
        font-size="16"
        fill="#2a1a0c"
        opacity="0.55">{index + 1}</text
    >
{/each}

{#each standings as standing, index (standing.playerId)}
    {#if standing.points > 0}
        {@const spot = DEVELOPMENT_TRACK[Math.min(standing.points, DEVELOPMENT_TRACK.length) - 1]}
        {@const sameSpot = standings
            .slice(0, index)
            .filter((other) => other.points === standing.points).length}
        <circle
            cx={spot.x - 8 + sameSpot * 8}
            cy={spot.y - 8 + sameSpot * 8}
            r="11"
            fill={gameSession.colors.getPlayerUiColor(standing.playerId)}
            stroke="#2a1a0c"
            stroke-width="1.2"
        ></circle>
    {/if}
{/each}

{#each BONUS_CHITS as chit, index (chit)}
    {@const spot = BONUS_SPOTS[index]}
    {@const remaining = game.bonusSupply.filter((left) => left === chit).length}
    {#each Array.from({ length: remaining }, (_, copy) => copy) as copy (copy)}
        <image
            href={BONUS_TILES[chit]}
            x={spot.x + 4 + copy * 5}
            y={spot.y + 4 + copy * 5}
            width={spot.width - 12}
            height={spot.height - 12}
            preserveAspectRatio="xMidYMid meet"
        ></image>
    {/each}
{/each}

<g transform="translate({REDESIGN_WAREHOUSE.x} {REDESIGN_WAREHOUSE.y})">
    <rect
        width={REDESIGN_WAREHOUSE.width}
        height={REDESIGN_WAREHOUSE.height}
        rx="8"
        fill="#ead8b3"
        stroke="#5b4027"
        stroke-width="1.5"
    ></rect>
    <text
        x={REDESIGN_WAREHOUSE.width / 2}
        y="26"
        text-anchor="middle"
        font-family="IM Fell English SC"
        font-size="19"
        fill="#3f2a16">Warehouse</text
    >
    {#each GOODS as good, index (good)}
        <g transform="translate({32 + index * 58} 72)">
            <GoodCube {good} size={26} />
            <text
                y="42"
                text-anchor="middle"
                font-family="Libre Baskerville"
                font-weight="700"
                font-size="18"
                fill="#2a1a0c">{game.supply[good]}</text
            >
        </g>
    {/each}
</g>

<g transform="translate({REDESIGN_LAP_TRACK.x} {REDESIGN_LAP_TRACK.y})">
    <rect
        width={REDESIGN_LAP_TRACK.width}
        height={REDESIGN_LAP_TRACK.height}
        rx="8"
        fill="#ead8b3"
        stroke="#5b4027"
        stroke-width="1.5"
    ></rect>
    <text x="12" y="20" font-family="IM Fell English SC" font-size="14" fill="#3f2a16"
        >Guild master's rounds</text
    >
    {#each Array.from({ length: steps }, (_, index) => index) as step (step)}
        <circle
            cx={18 + (step % CITY_COUNT) * 20.5}
            cy={36 + Math.floor(step / CITY_COUNT) * 20}
            r="7"
            fill={step < game.guildMaster.distance ? '#2b211b' : '#f4ead0'}
            stroke="#5b4027"
        ></circle>
    {/each}
</g>
