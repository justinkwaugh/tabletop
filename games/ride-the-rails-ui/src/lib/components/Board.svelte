<script lang="ts">
    import { usaCity, type HexId } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BOARD_HEIGHT, BOARD_WIDTH, FITTED_DESKTOP_SCALE } from '$lib/utils/boardGeometry.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { BUILD_PICK, litHexViews, type PickContext } from '$lib/utils/pickMarks.js'
    import { EMPTY_STAGED_ROUTE } from '$lib/utils/routePath.js'
    import BonusLayer from './board/BonusLayer.svelte'
    import CityLayer from './board/CityLayer.svelte'
    import CapacityMarks from './board/CapacityMarks.svelte'
    import FlightLayer from './board/FlightLayer.svelte'
    import GroundLayer from './board/GroundLayer.svelte'
    import HitLayer from './board/HitLayer.svelte'
    import LineLayer from './board/LineLayer.svelte'
    import PassengerLayer from './board/PassengerLayer.svelte'
    import PickLayer from './board/PickLayer.svelte'
    import PopupAnchor, { CHOICE_ANCHOR_ID, DETAIL_ANCHOR_ID } from './board/PopupAnchor.svelte'
    import ScrimLayer from './board/ScrimLayer.svelte'
    import StagedRouteLayer from './board/StagedRouteLayer.svelte'
    import StartCueLayer from './board/StartCueLayer.svelte'
    import TrackLayer from './board/TrackLayer.svelte'

    let { viewScale = FITTED_DESKTOP_SCALE }: { viewScale?: number } = $props()

    const gameSession = getGameSession()

    const offer = $derived(gameSession.boardOffer)
    const draft = $derived(gameSession.journeyDraft)

    const context: PickContext = $derived(
        draft
            ? {
                  kind: 'journey-extend',
                  startHexId: usaCity(draft.startCityId).hexId,
                  choosingHexId: gameSession.journeyPopup?.hexId
              }
            : gameSession.journeyLit.length > 0
              ? { kind: 'journey-start' }
              : BUILD_PICK
    )
    const views = $derived(litHexViews(offer, gameSession.gameState.track, context))
    // A hex's lone cube stands aside for a ghost cube drawn beside it (locomotivePieces).
    const standAside: ReadonlySet<HexId> = $derived(
        BOARD_LOOK.litRailroads === 'ghost-cube'
            ? new Set(views.filter((view) => view.ghosts.length > 0).map((view) => view.hexId))
            : new Set()
    )

    const stagedRoute = $derived(draft ?? EMPTY_STAGED_ROUTE)

    // The popups themselves are drawn outside the board's CSS zoom (BoardPopups).
    const choiceHexId = $derived(offer.popup?.hexId ?? gameSession.journeyPopup?.hexId)
    const detailBeside = $derived(
        gameSession.hexDetailInSidePanel ? undefined : gameSession.hexDetailHexId
    )
</script>

<!-- Contract, Render ownership: one SVG, back to front. -->
<svg
    class="block select-none"
    width={BOARD_WIDTH}
    height={BOARD_HEIGHT}
    viewBox="0 0 {BOARD_WIDTH} {BOARD_HEIGHT}"
    role="group"
    aria-label="Map of the USA"
    data-map-board
>
    <GroundLayer />
    <CapacityMarks />
    <CityLayer />
    <StartCueLayer />
    <BonusLayer />
    <PassengerLayer startCityId={stagedRoute.startCityId} />
    <TrackLayer {standAside} />
    <LineLayer lastJourney={gameSession.lastJourney} />
    <ScrimLayer {offer} />
    <StagedRouteLayer route={stagedRoute} track={gameSession.gameState.track} />
    <PickLayer {views} {viewScale} />
    <FlightLayer />
    <HitLayer {views} />
    <PopupAnchor id={CHOICE_ANCHOR_ID} hexId={choiceHexId} />
    <PopupAnchor id={DETAIL_ANCHOR_ID} hexId={detailBeside} />
</svg>
