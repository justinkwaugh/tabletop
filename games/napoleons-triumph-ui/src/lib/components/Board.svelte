<script lang="ts">
    import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/map/boardGeometry.js'
    import { viewSize, viewTransform } from '$lib/utils/boardView.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import boardArt from '$lib/images/board.webp'
    import boardPreview from '$lib/images/board-preview.webp'
    import setupMarks from '$lib/images/setup-marks.webp'
    import MovementTrails from './board/MovementTrails.svelte'
    import PiecesLayer from './board/PiecesLayer.svelte'
    import TargetLayer from './board/TargetLayer.svelte'
    import ApproachPlates from './board/ApproachPlates.svelte'
    import ApproachBars from './board/ApproachBars.svelte'
    import LocaleNumbers from './board/LocaleNumbers.svelte'
    import LocatedLocale from './board/LocatedLocale.svelte'
    import ApproachSymbols from './board/ApproachSymbols.svelte'
    import CapacityTags from './board/CapacityTags.svelte'
    import StarTags from './board/StarTags.svelte'
    import GunTags from './board/GunTags.svelte'
    import BattleMarker from './board/BattleMarker.svelte'
    import TrackMarkers from './board/TrackMarkers.svelte'
    import FlagLayer from './board/FlagLayer.svelte'
    import AimLocales from './board/AimLocales.svelte'
    import ClosedReserves from './board/ClosedReserves.svelte'
    import ContactShadow from './board/ContactShadow.svelte'
    import HeldApproaches from './board/HeldApproaches.svelte'
    import SetupLocales from './board/SetupLocales.svelte'
    import ArmyDisplays from './board/ArmyDisplays.svelte'

    const gameSession = getGameSession()

    let artLoaded = $state(false)

    const size = $derived(viewSize(gameSession.boardRotation))

    const unitsVisibility = $derived(gameSession.unitsHidden ? 'hidden' : undefined)
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
        {#if gameSession.settingUp}
            <img
                src={setupMarks}
                alt=""
                class="absolute inset-0 w-full h-full"
                draggable="false"
                data-setup-marks
            />
        {/if}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <svg
            class="absolute inset-0"
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            viewBox="0 0 {BOARD_WIDTH} {BOARD_HEIGHT}"
            font-family="'Libre Baskerville', Georgia, serif"
            data-board
            onclick={() => gameSession.clearSelection()}
        >
            <defs>
                <ContactShadow id="nt-contact-shadow" />
            </defs>
            <g data-in-picture><ArmyDisplays /></g>
            <ApproachBars />
            <LocaleNumbers />
            <g data-in-picture><TrackMarkers /></g>
            <g visibility={unitsVisibility}>
                <g data-in-picture>
                    <HeldApproaches approaches={gameSession.heldApproaches} />
                </g>
            </g>
            <SetupLocales />
            <ClosedReserves />
            <AimLocales />
            <TargetLayer />
            <!-- Deliberate: hiding the units wraps the pictured layers, so a saved picture still shows them. -->
            <g visibility={unitsVisibility}>
                <g data-in-picture><PiecesLayer /></g>
                <g data-in-picture><ApproachPlates /></g>
                <g data-in-picture><GunTags /></g>
            </g>
            <LocatedLocale />
            <MovementTrails />
            <ApproachSymbols />
            <CapacityTags />
            <StarTags />
            <g visibility={unitsVisibility}><g data-in-picture><FlagLayer /></g></g>
            <TargetLayer overThePieces />
            <BattleMarker />
        </svg>
    </div>
</div>
