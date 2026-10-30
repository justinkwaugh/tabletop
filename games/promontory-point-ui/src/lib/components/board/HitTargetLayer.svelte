<script lang="ts">
    import { BOARD_GRID, TOWN_TILE_KINDS, type SpaceId } from '@tabletop/promontory-point'
    import { PreviewKind } from '$lib/model/cardPreview.svelte.js'
    import { HexPick, hexOffer } from '$lib/model/boardOffer.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexOutline } from '$lib/utils/boardGeometry.js'
    import { pointsAttribute } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()
    const spaces = BOARD_GRID.spaces().map((space) => ({
        spaceId: space.spaceId,
        points: pointsAttribute(hexOutline(space.coords))
    }))

    const isLit = (spaceId: SpaceId) =>
        hexOffer(gameSession.boardOffer, spaceId).pick === HexPick.Lit

    // R-3.3: a lit hex places the picked piece; any other hex places nothing and enlarges its
    // town tile, if it has one (contract, "The principle").
    function press(spaceId: SpaceId) {
        if (isLit(spaceId)) {
            void gameSession.placeTrack(spaceId)
        } else if (spaceId in gameSession.gameState.towns) {
            gameSession.cardPreview.show({ kind: PreviewKind.TownTile, spaceId })
        }
    }

    function label(spaceId: SpaceId): string {
        const towns = gameSession.gameState.towns
        const place = spaceId in towns ? `${TOWN_TILE_KINDS[towns[spaceId]].name} town` : 'Space'
        return isLit(spaceId) ? `Place here: ${place}` : place
    }

    function pressKey(event: KeyboardEvent, spaceId: SpaceId) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            press(spaceId)
        }
    }
</script>

{#each spaces as { spaceId, points } (spaceId)}
    {@const lit = isLit(spaceId)}
    <polygon
        {points}
        role="button"
        tabindex={lit ? 0 : -1}
        aria-label={label(spaceId)}
        data-space-id={spaceId}
        class="hit-target"
        class:lit
        fill="transparent"
        onclick={() => press(spaceId)}
        onkeydown={(event) => pressKey(event, spaceId)}
    ></polygon>
{/each}

<style>
    .hit-target {
        outline: none;
    }

    .hit-target.lit {
        cursor: pointer;
    }

    .hit-target:focus-visible {
        stroke: var(--pp-accent);
        stroke-width: 6;
    }
</style>
