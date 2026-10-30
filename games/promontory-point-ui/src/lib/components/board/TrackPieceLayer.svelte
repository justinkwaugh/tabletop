<script lang="ts">
    import { BOARD_GRID } from '@tabletop/promontory-point'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { spaceCentre } from '$lib/utils/boardLayout.js'
    import TrackPiece from './TrackPiece.svelte'

    const gameSession = getGameSession()

    const pieces = $derived(
        BOARD_GRID.spaces().flatMap((space) =>
            space.spaceId in gameSession.gameState.track
                ? [
                      {
                          spaceId: space.spaceId,
                          railroadId: gameSession.gameState.track[space.spaceId]
                      }
                  ]
                : []
        )
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
