<script lang="ts">
    import { TOWN_TILE_KINDS } from '@tabletop/promontory-point'
    import { townTileImage } from '$lib/images/tileImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { townTileRotation } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()
    const preview = gameSession.cardPreview

    const kindId = $derived(
        preview.shown === undefined ? undefined : gameSession.gameState.towns[preview.shown.spaceId]
    )

    // Escape closes the enlarged view first, before the full-screen dialog sees it.
    function closeOnEscape(event: KeyboardEvent) {
        if (event.key === 'Escape' && preview.shown !== undefined) {
            event.preventDefault()
            event.stopPropagation()
            preview.close()
        }
    }
</script>

<svelte:window onkeydowncapture={closeOnEscape} />

<!-- Contract, "The principle": the enlarged view sits over everything until the next press. -->
{#if kindId !== undefined}
    <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-pp-veil"
        role="presentation"
        data-enlarged-view
        onclick={() => preview.close()}
    >
        <figure class="flex flex-col items-center gap-2">
            <div class="tile">
                <img
                    src={townTileImage(kindId).src}
                    alt="{TOWN_TILE_KINDS[kindId].name} town tile"
                    width="160"
                    height="160"
                    style:transform="rotate({townTileRotation(kindId)}deg)"
                />
            </div>
            <figcaption class="text-sm text-pp-text">
                {TOWN_TILE_KINDS[kindId].name} town tile
            </figcaption>
        </figure>
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
</style>
