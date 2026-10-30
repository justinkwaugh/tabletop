<script lang="ts">
    import type { RailroadId } from '@tabletop/promontory-point'
    import { RAILROAD_TAGS } from '$lib/model/railroadTags.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import TrackPiece from './board/TrackPiece.svelte'

    const gameSession = getGameSession()

    const heading = $derived.by(() => {
        if (gameSession.gameState.result) {
            return 'End of game'
        }
        if (gameSession.decidingPlayerId !== undefined) {
            return 'Your turn'
        }
        const activeId = gameSession.gameState.activePlayerIds.at(0)
        return activeId === undefined ? '' : `${gameSession.getPlayerName(activeId)}'s turn`
    })

    function hover(event: PointerEvent, railroadId: RailroadId | undefined) {
        if (event.pointerType !== 'touch') {
            gameSession.hoverPiece(railroadId)
        }
    }
</script>

<!-- O-2: a press on a hand piece picks it, so its legal hexes light on the board (R-3.3). -->
<div class="flex flex-wrap items-center gap-x-4 gap-y-2 bg-pp-panel px-3 py-2 text-pp-text">
    <h2 class="pp-heading text-lg">{heading}</h2>
    {#if gameSession.handPieces.length > 0}
        <div class="flex gap-2" role="group" aria-label="Turn pieces">
            {#each gameSession.handPieces as railroadId, index (index)}
                {@const pickable = gameSession.pickablePieces.includes(railroadId)}
                {@const picked = gameSession.pickedPiece === railroadId}
                <button
                    type="button"
                    class="flex flex-col items-center rounded-md px-1 text-xs"
                    class:picked
                    disabled={!pickable}
                    aria-pressed={picked}
                    aria-label="{RAILROAD_TAGS[railroadId]} piece"
                    onclick={() => gameSession.pressPiece(railroadId)}
                    onpointerenter={(event) => hover(event, railroadId)}
                    onpointerleave={(event) => hover(event, undefined)}
                    onfocus={() => gameSession.hoverPiece(railroadId)}
                    onblur={() => gameSession.hoverPiece(undefined)}
                >
                    <svg width="34" height="34" viewBox="-30 -30 60 64" aria-hidden="true">
                        <TrackPiece {railroadId} radius={26} />
                    </svg>
                    {RAILROAD_TAGS[railroadId]}
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .pp-heading {
        font-family: Oswald, sans-serif;
        font-weight: 600;
    }

    button.picked {
        box-shadow: 0 0 0 3px var(--pp-accent);
    }

    button:disabled {
        opacity: 0.6;
    }
</style>
