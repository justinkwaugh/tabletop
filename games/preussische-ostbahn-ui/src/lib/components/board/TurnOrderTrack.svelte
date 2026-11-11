<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { TURN_ORDER_AREA } from '$lib/utils/boardGeometry.js'

    const gameSession = getGameSession()
    const SLOT = 34
    const GAP = 7
    const round = $derived(gameSession.gameState.rounds.series.length)
</script>

{#if round > 0}
    <g transform={`translate(${TURN_ORDER_AREA.x}, ${TURN_ORDER_AREA.y})`}>
        <text x="0" y="22" class="title">Turn order</text>
        <text x="132" y="22" class="sub">Round {round}</text>
        {#each gameSession.turnSlots as slot, index (index)}
            {@const x = index * (SLOT + GAP)}
            <g transform={`translate(${x}, 34)`} opacity={slot.done ? 0.45 : 1}>
                <rect
                    width={SLOT}
                    height={SLOT}
                    rx="7"
                    fill={gameSession.colors.getPlayerUiColor(slot.playerId)}
                    stroke={slot.current ? '#1f3a5f' : 'rgba(0,0,0,0.35)'}
                    stroke-width={slot.current ? 4 : 1}
                ></rect>
                <text
                    x={SLOT / 2}
                    y={SLOT / 2 + 6.5}
                    text-anchor="middle"
                    class="initial"
                    fill={gameSession.colors.getPlayerTextColorValue(slot.playerId)}
                    >{gameSession.playerInitial(slot.playerId)}</text
                >
            </g>
        {/each}
    </g>
{/if}

<style>
    .title {
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 24px;
        font-weight: 700;
        fill: #1b2b44;
    }

    .sub {
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 14px;
        fill: #4f5a66;
    }

    .initial {
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 19px;
        font-weight: 700;
    }
</style>
