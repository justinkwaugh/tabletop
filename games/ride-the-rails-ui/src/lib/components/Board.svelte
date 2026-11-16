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
    import LitWashLayer from './board/LitWashLayer.svelte'
    import MapTitle from './board/MapTitle.svelte'
    import StartLegend from './board/StartLegend.svelte'
    import FlightLayer from './board/FlightLayer.svelte'
    import GroundLayer from './board/GroundLayer.svelte'
    import HitLayer from './board/HitLayer.svelte'
    import LineLayer from './board/LineLayer.svelte'
    import PassengerLayer from './board/PassengerLayer.svelte'
    import PickLayer from './board/PickLayer.svelte'
    import PopupAnchor, { CHOICE_ANCHOR_ID, RIDE_ANCHOR_ID } from './board/PopupAnchor.svelte'
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
    // The city the next link leaves from, so each next city's chevron points the way it goes.
    const journeyFrom: HexId | undefined = $derived(
        draft ? usaCity(draft.draftLinks.at(-1)?.cityId ?? draft.startCityId).hexId : undefined
    )

    // The route's last city, where a Ride button floats once the journey can be made.
    const rideHexId: HexId | undefined = $derived(
        gameSession.canRideJourney && !gameSession.journeyPopup ? journeyFrom : undefined
    )

    // The popups themselves are drawn outside the board's CSS zoom (BoardPopups).
    const choiceHexId = $derived(offer.popup?.hexId ?? gameSession.journeyPopup?.hexId)
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
    <LitWashLayer {views} />
    <CapacityMarks />
    <MapTitle />
    <CityLayer />
    <StartCueLayer />
    <BonusLayer />
    <PassengerLayer startCityId={stagedRoute.startCityId} />
    <TrackLayer {standAside} />
    <LineLayer lastJourney={gameSession.lastJourney} />
    <ScrimLayer {offer} />
    <!-- Above the scrim: the legend is never dimmed. -->
    <StartLegend mapId={gameSession.gameState.mapId} />
    <StagedRouteLayer route={stagedRoute} track={gameSession.gameState.track} />
    <PickLayer {views} {viewScale} {journeyFrom} />
    <FlightLayer />
    <HitLayer {views} />
    <PopupAnchor id={CHOICE_ANCHOR_ID} hexId={choiceHexId} />
    <PopupAnchor id={RIDE_ANCHOR_ID} hexId={rideHexId} />
</svg>
