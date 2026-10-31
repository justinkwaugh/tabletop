<script lang="ts">
    import {
        BOARD_GRID,
        RAILROAD_IDS,
        RAILROADS,
        TOWN_TILE_KINDS,
        type RailroadId,
        type SpaceId
    } from '@tabletop/promontory-point'
    import { PreviewKind } from '$lib/model/cardPreview.svelte.js'
    import { HexPick, hexOffer } from '$lib/model/boardOffer.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { SEA_SLOTS, hexOutline } from '$lib/utils/boardGeometry.js'
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

    // Contract, "The principle": a press on a share deck enlarges its share; a press on the bag
    // shows its count only (R-5). Neither acts.
    function enlargeShare(railroadId: RailroadId) {
        gameSession.cardPreview.show({ kind: PreviewKind.Share, railroadId })
    }

    function showBag() {
        gameSession.cardPreview.show({ kind: PreviewKind.Bag })
    }

    function onKey(event: KeyboardEvent, act: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            act()
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
        onkeydown={(event) => onKey(event, () => press(spaceId))}
    ></polygon>
{/each}

{#each RAILROAD_IDS as railroadId (railroadId)}
    {@const box = SEA_SLOTS.decks[railroadId]}
    <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        role="button"
        tabindex="0"
        aria-label="{RAILROADS[railroadId].name} share deck: enlarge the share"
        data-deck-target={railroadId}
        class="hit-target sea"
        fill="transparent"
        onclick={() => enlargeShare(railroadId)}
        onkeydown={(event) => onKey(event, () => enlargeShare(railroadId))}
    ></rect>
{/each}
<rect
    x={SEA_SLOTS.bag.x}
    y={SEA_SLOTS.bag.y}
    width={SEA_SLOTS.bag.width}
    height={SEA_SLOTS.bag.height}
    role="button"
    tabindex="0"
    aria-label="The bag: show how many pieces are left"
    data-bag-target
    class="hit-target sea"
    fill="transparent"
    onclick={showBag}
    onkeydown={(event) => onKey(event, showBag)}
></rect>

<style>
    .hit-target {
        outline: none;
    }

    .hit-target.lit {
        cursor: pointer;
    }

    .hit-target.sea {
        cursor: zoom-in;
    }

    .hit-target:focus-visible {
        stroke: var(--pp-accent);
        stroke-width: 6;
    }
</style>
