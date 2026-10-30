<script lang="ts">
    import { RAILROADS, TOWN_TILE_KINDS } from '@tabletop/promontory-point'
    import { shareFaceImage } from '$lib/images/cardImages.js'
    import { townTileImage } from '$lib/images/tileImages.js'
    import { PreviewKind } from '$lib/model/cardPreview.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { townTileRotation } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()
    const preview = gameSession.cardPreview

    // What the press shows, read from the displayed state.
    const shown = $derived.by(() => {
        const target = preview.shown
        if (target === undefined) {
            return undefined
        }
        switch (target.kind) {
            case PreviewKind.TownTile: {
                const kindId = gameSession.gameState.towns[target.spaceId]
                return kindId === undefined
                    ? undefined
                    : { kind: target.kind, kindId, name: TOWN_TILE_KINDS[kindId].name }
            }
            case PreviewKind.Share:
                return {
                    kind: target.kind,
                    railroadId: target.railroadId,
                    name: RAILROADS[target.railroadId].name
                }
            case PreviewKind.Bag: {
                const remaining = gameSession.gameState.bag.remaining
                return { kind: target.kind, remaining }
            }
        }
    })

    // Escape closes the enlarged view first, before the open seat or the full-screen dialog sees it.
    function closeOnEscape(event: KeyboardEvent) {
        if (event.key === 'Escape' && preview.shown !== undefined) {
            event.preventDefault()
            event.stopPropagation()
            preview.close()
        }
    }
</script>

<svelte:window onkeydowncapture={closeOnEscape} />

<!-- Contract, "The principle": the enlarged view sits over everything until the next press, which
     does nothing else. -->
{#if shown !== undefined}
    <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-pp-veil"
        role="presentation"
        data-enlarged-view={shown.kind}
        onclick={() => preview.close()}
    >
        {#if shown.kind === PreviewKind.TownTile}
            <figure class="flex flex-col items-center gap-2">
                <div class="tile">
                    <img
                        src={townTileImage(shown.kindId).src}
                        alt="{shown.name} town tile"
                        width="160"
                        height="160"
                        style:transform="rotate({townTileRotation(shown.kindId)}deg)"
                    />
                </div>
                <figcaption class="text-sm text-pp-text">{shown.name} town tile</figcaption>
            </figure>
        {:else if shown.kind === PreviewKind.Share}
            {@const face = shareFaceImage(shown.railroadId)}
            <figure class="flex flex-col items-center gap-2">
                <img
                    class="share"
                    src={face.src}
                    alt="{shown.name} share"
                    width={face.width}
                    height={face.height}
                />
                <figcaption class="text-sm text-pp-text">{shown.name} share</figcaption>
            </figure>
        {:else}
            <!-- R-5: the bag's count only, never which pieces. -->
            <p class="bag" data-bag-count={shown.remaining}>
                {shown.remaining}
                {shown.remaining === 1 ? 'piece' : 'pieces'} in the bag
            </p>
        {/if}
        <button type="button" class="rounded bg-pp-paper px-3 py-1 text-sm text-pp-ink"
            >Close</button
        >
    </div>
{/if}

<style>
    .tile {
        width: 160px;
        height: 160px;
        clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
    }

    .share {
        width: min(260px, 70vw);
        height: auto;
        max-height: 70dvh;
        object-fit: contain;
        border-radius: 10px;
        box-shadow: 0 6px 24px var(--pp-halo);
    }

    .bag {
        background: var(--pp-paper);
        color: var(--pp-ink);
        font-family: Oswald, sans-serif;
        font-weight: 600;
        font-size: 22px;
        padding: 14px 22px;
        border-radius: 8px;
        border: 2px solid var(--pp-paper-line);
    }
</style>
