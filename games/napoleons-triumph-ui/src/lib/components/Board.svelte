<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/map/boardGeometry.js'
    import { viewSize, viewTransform } from '$lib/utils/boardView.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import boardArt from '$lib/images/board.webp'
    import boardPreview from '$lib/images/board-preview.webp'
    import PiecesLayer from './board/PiecesLayer.svelte'
    import TargetLayer from './board/TargetLayer.svelte'
    import BattleMarker from './board/BattleMarker.svelte'

    const gameSession = getGameSession()

    let artLoaded = $state(false)

    const size = $derived(viewSize(gameSession.boardRotation))

    // The shared wrapper scales this board with a CSS transform on an ancestor and offers no
    // callback for it, so the on-screen zoom is read back from that element.
    const watchZoom: Attachment<HTMLElement> = (node) => {
        const scaled = node.parentElement?.parentElement
        if (!scaled) return
        const read = () => {
            const zoom = node.getBoundingClientRect().width / size.width
            if (zoom > 0 && Math.abs(zoom - gameSession.zoom) > 0.01) {
                gameSession.zoom = zoom
            }
        }
        const observer = new MutationObserver(read)
        observer.observe(scaled, { attributes: true, attributeFilter: ['style'] })
        read()
        return () => observer.disconnect()
    }
</script>

<div
    class="relative select-none"
    style="width: {size.width}px; height: {size.height}px;"
    {@attach watchZoom}
>
    <div
        class="absolute left-0 top-0 origin-top-left"
        style="width: {BOARD_WIDTH}px; height: {BOARD_HEIGHT}px; transform: {viewTransform(
            gameSession.boardRotation
        )};"
    >
        <img
            src={boardPreview}
            alt=""
            class="absolute inset-0 w-full h-full"
            draggable="false"
            class:hidden={artLoaded}
        />
        <img
            src={boardArt}
            alt="The battlefield of Austerlitz"
            class="absolute inset-0 w-full h-full"
            draggable="false"
            onload={() => (artLoaded = true)}
        />
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <svg
            class="absolute inset-0"
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            viewBox="0 0 {BOARD_WIDTH} {BOARD_HEIGHT}"
            font-family="'Libre Baskerville', Georgia, serif"
            onclick={() => gameSession.clearSelection()}
        >
            <defs>
                <filter id="nt-contact-shadow" x="-5%" y="-5%" width="110%" height="110%">
                    <feDropShadow
                        dx="0"
                        dy="2.5"
                        stdDeviation="2.2"
                        flood-color="#1c2a25"
                        flood-opacity="0.38"
                    ></feDropShadow>
                </filter>
            </defs>
            <TargetLayer />
            <PiecesLayer />
            <TargetLayer attacks />
            <BattleMarker />
        </svg>
    </div>
</div>
