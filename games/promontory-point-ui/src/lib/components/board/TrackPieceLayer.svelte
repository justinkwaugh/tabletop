<script lang="ts">
    import { BOARD_GRID } from '@tabletop/promontory-point'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { spaceCentre } from '$lib/utils/boardLayout.js'
    import TrackPiece from './TrackPiece.svelte'

    const gameSession = getGameSession()

    // A piece that has landed is drawn before the state that holds it is shown (Pattern C).
    const pieces = $derived(
        BOARD_GRID.spaces().flatMap((space) => {
            const railroadId =
                space.spaceId in gameSession.gameState.track
                    ? gameSession.gameState.track[space.spaceId]
                    : gameSession.flights.landedPieces[space.spaceId]
            return railroadId === undefined ? [] : [{ spaceId: space.spaceId, railroadId }]
        })
    )
</script>

<!-- R-3.3, O-5: each placed piece as its token; the outer node places it, the inner one moves. -->
{#each pieces as { spaceId, railroadId } (spaceId)}
    {@const centre = spaceCentre(spaceId)}
    <g
        transform="translate({centre.x} {centre.y})"
        data-track-piece={railroadId}
        data-space-id={spaceId}
    >
        <g class="motion">
            <TrackPiece {railroadId} />
        </g>
    </g>
{/each}
