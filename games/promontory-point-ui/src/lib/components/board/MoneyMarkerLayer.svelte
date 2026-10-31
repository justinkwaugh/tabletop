<script lang="ts">
    import { onMount } from 'svelte'
    import { restMarker } from '$lib/animators/markerMotion.js'
    import { MoneyMarkerAnimator, moneyMarkerSize } from '$lib/animators/moneyMarkerAnimator.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boxCentre } from '$lib/utils/boardGeometry.js'
    import { moneyMarkers } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const animator = new MoneyMarkerAnimator(
        gameSession,
        gameSession.moneyChips,
        undefined,
        gameSession.moneyOverflow
    )
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
            size: moneyMarkerSize(marker),
            overflow: animator.overflowShown.get(marker.playerId) ?? marker.overflow
        }))
    )
</script>

<!-- R-1.3-H1: one marker per seat on the border track, 2×2 in seat order when shared, "+100" past 99
     ("+200" past 199). A marker is told by its colour alone. -->
{#each markers as { playerId, centre, size, overflow } (playerId)}
    <g
        transform="translate({centre.x} {centre.y})"
        data-money-marker={playerId}
        data-plus-100={overflow > 0}
    >
        <g
            class="motion"
            use:restMarker={{
                motion: animator.motion,
                key: playerId,
                rest: { ...centre, size }
            }}
        >
            <!-- Colour only: a seat-colour disc with a charcoal outline and a thin paper ring. -->
            <circle cy={size * 0.06} r={size / 2} fill="var(--pp-halo)" opacity="0.4"></circle>
            <circle
                r={size / 2}
                data-money-disc
                fill={gameSession.colors.getPlayerUiColor(playerId)}
                stroke="var(--pp-charcoal)"
                stroke-width={size * 0.07}
            ></circle>
            <circle
                r={size * 0.31}
                fill="none"
                stroke="var(--pp-paper)"
                stroke-opacity="0.7"
                stroke-width={size * 0.035}
            ></circle>
            {#if overflow > 0}
                <rect
                    x={-size * 0.55}
                    y={-size / 2 - 16}
                    width={size * 1.1}
                    height="30"
                    rx="8"
                    fill="var(--pp-halo)"
                ></rect>
                <text
                    class="pp-board-figure"
                    y={-size / 2 - 1}
                    font-size="24"
                    fill="var(--pp-paper)">+{overflow}</text
                >
            {/if}
        </g>
    </g>
{/each}
