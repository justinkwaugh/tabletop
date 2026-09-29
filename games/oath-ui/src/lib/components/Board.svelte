<script lang="ts">
    import boardImage from '$lib/images/board/map.jpg'
    import BoardCardStripLayer from '$lib/components/BoardCardStripLayer.svelte'
    import BoardPiecesLayer from '$lib/components/BoardPiecesLayer.svelte'
    import BoardRail from '$lib/components/BoardRail.svelte'
    import BoardSitesLayer from '$lib/components/BoardSitesLayer.svelte'
    import BoardTracksLayer from '$lib/components/BoardTracksLayer.svelte'
    import {
        BOARD_HEIGHT,
        BOARD_WIDTH,
        RAIL_HEIGHT,
        SURFACE_HEIGHT
    } from '$lib/definitions/boardGeometry.js'

    // Layers paint in table order and each owns its highlights (`docs/ui-interaction-visual-contract.md`).

    // The surface is scaled by a CSS transform, so a pickable card's hit area is
    // widened by `--hit-pad`: the surface pixels that make twelve screen pixels.
    function hitPad(node: HTMLElement) {
        const update = () => {
            const scale = node.getBoundingClientRect().width / node.offsetWidth
            if (scale > 0) node.style.setProperty('--hit-pad', `${12 / scale}px`)
        }
        // `ScalingWrapper` scales by writing an ancestor's inline transform, which no
        // resize event reports; a board in a hidden tab has no scale to read.
        const observer = new MutationObserver(update)
        for (let el = node.parentElement; el; el = el.parentElement) {
            observer.observe(el, { attributes: true, attributeFilter: ['style'] })
        }
        update()
        return {
            destroy() {
                observer.disconnect()
            }
        }
    }
</script>

<div class="board-surface" use:hitPad style="width:{BOARD_WIDTH}px; height:{SURFACE_HEIGHT}px;">
    <div class="board-map" style="width:{BOARD_WIDTH}px; height:{BOARD_HEIGHT}px;">
        <img
            src={boardImage}
            alt="The Oath map — the Cradle, the Provinces and the Hinterland"
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            class="board-map__art"
        />

        <BoardTracksLayer />
        <BoardSitesLayer />
        <BoardCardStripLayer />
        <BoardPiecesLayer />
    </div>

    <div class="board-rail" style="height:{RAIL_HEIGHT}px;">
        <BoardRail />
    </div>
</div>

<style>
    .board-surface {
        position: relative;
        display: flex;
        flex-direction: column;
        border-radius: 14px;
        overflow: hidden;
        background: #0c0a09;
        box-shadow:
            0 0 0 4px rgba(122, 93, 63, 0.35),
            0 12px 28px rgba(0, 0, 0, 0.45);
    }

    .board-map {
        position: relative;
        flex: none;
    }

    .board-map__art {
        display: block;
        width: 100%;
        height: 100%;
    }

    .board-rail {
        flex: none;
    }
</style>
