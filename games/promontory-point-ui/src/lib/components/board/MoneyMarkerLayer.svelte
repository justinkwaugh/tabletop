<script lang="ts">
    import { onMount } from 'svelte'
    import { restMarker } from '$lib/animators/markerMotion.js'
    import { MoneyMarkerAnimator, moneyMarkerSize } from '$lib/animators/moneyMarkerAnimator.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boxCentre } from '$lib/utils/boardGeometry.js'
    import { moneyMarkers, seatInitials } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const animator = new MoneyMarkerAnimator(gameSession, gameSession.moneyChips)
    onMount(() => {
        animator.register()
        return () => animator.unregister()
    })

    const markers = $derived(
        moneyMarkers(
            gameSession.gameState.players.map((player) => ({
                playerId: player.playerId,
                money: player.money
            }))
        ).map((marker) => ({
            ...marker,
            centre: boxCentre(marker.box),
            size: moneyMarkerSize(marker)
        }))
    )
</script>

<!-- R-1.3-H1: one marker per seat on the border track, 2×2 when shared, "+100" past 99. -->
{#each markers as { playerId, centre, size, plus100 } (playerId)}
    <g
        transform="translate({centre.x} {centre.y})"
        data-money-marker={playerId}
        data-plus-100={plus100}
    >
        <g
            class="motion"
            use:restMarker={{
                motion: animator.motion,
                key: playerId,
                rest: { ...centre, size }
            }}
        >
            <rect
                x={-size / 2}
                y={-size / 2}
                width={size}
                height={size}
                rx={size * 0.16}
                fill={gameSession.colors.getPlayerUiColor(playerId)}
                stroke="var(--pp-halo)"
                stroke-width="6"
            ></rect>
            <text
                class="pp-board-figure"
                font-size={size * 0.5}
                fill={gameSession.colors.getPlayerTextColorValue(playerId)}
                >{seatInitials(gameSession.getPlayerName(playerId))}</text
            >
            {#if plus100}
                <rect
                    x={-size * 0.55}
                    y={-size / 2 - 16}
                    width={size * 1.1}
                    height="30"
                    rx="8"
                    fill="var(--pp-halo)"
                ></rect>
                <text class="pp-board-figure" y={-size / 2 - 1} font-size="24" fill="var(--pp-text)"
                    >+100</text
                >
            {/if}
        </g>
    </g>
{/each}
