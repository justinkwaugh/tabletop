<script lang="ts">
    import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/map/boardGeometry.js'
    import { viewSize, viewTransform } from '$lib/utils/boardView.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import boardArt from '$lib/images/board.webp'
    import boardPreview from '$lib/images/board-preview.webp'
    import PiecesLayer from './board/PiecesLayer.svelte'
    import TargetLayer from './board/TargetLayer.svelte'
    import ApproachBars from './board/ApproachBars.svelte'
    import ApproachSymbols from './board/ApproachSymbols.svelte'
    import BattleMarker from './board/BattleMarker.svelte'
    import CommandDiscs from './board/CommandDiscs.svelte'
    import FlagLayer from './board/FlagLayer.svelte'
    import ContactShadow from './board/ContactShadow.svelte'
    import HeldApproaches from './board/HeldApproaches.svelte'
    import SetupLocales from './board/SetupLocales.svelte'

    const gameSession = getGameSession()

    let artLoaded = $state(false)

    const size = $derived(viewSize(gameSession.boardRotation))
</script>

<div class="relative select-none" style="width: {size.width}px; height: {size.height}px;">
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
                <ContactShadow id="nt-contact-shadow" />
            </defs>
            <ApproachBars />
            <CommandDiscs />
            <HeldApproaches approaches={gameSession.heldApproaches} />
            <SetupLocales />
            <TargetLayer />
            <PiecesLayer />
            <ApproachSymbols />
            <FlagLayer />
            <TargetLayer attacks />
            <BattleMarker />
        </svg>
    </div>
</div>
