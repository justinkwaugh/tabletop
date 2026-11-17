<script lang="ts">
    import { cityById, type HexId } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
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
    import ImpassableLayer from './board/ImpassableLayer.svelte'
    import LineLayer from './board/LineLayer.svelte'
    import LinkRingLayer from './board/LinkRingLayer.svelte'
    import PassengerLayer from './board/PassengerLayer.svelte'
    import PickLayer from './board/PickLayer.svelte'
    import PopupAnchor, { CHOICE_ANCHOR_ID, RIDE_ANCHOR_ID } from './board/PopupAnchor.svelte'
    import ScrimLayer from './board/ScrimLayer.svelte'
    import StagedRouteLayer from './board/StagedRouteLayer.svelte'
    import StartCueLayer from './board/StartCueLayer.svelte'
    import TrackLayer from './board/TrackLayer.svelte'

    let { viewScale }: { viewScale: number } = $props()

    const gameSession = getGameSession()

    // Displayed Game State: the board of the map the shown state is played on.
    const board = $derived(gameSession.boardFrame)

    const offer = $derived(gameSession.boardOffer)
    const draft = $derived(gameSession.journeyDraft)

    const context: PickContext = $derived(
        draft
            ? {
                  kind: 'journey-extend',
                  startHexId: cityById(draft.startCityId).hexId,
                  choosingHexId: gameSession.journeyPopup?.hexId
              }
            : gameSession.journeyLit.length > 0
              ? { kind: 'journey-start' }
              : BUILD_PICK
    )
    const views = $derived(litHexViews(offer, gameSession.gameState.track, context))
    // The lit hexes, holes in the pick's scrim; none without a scrim.
    const scrimHoles: ReadonlySet<HexId> = $derived(new Set(offer.scrim?.holes ?? []))
    // A hex's lone cube stands aside for a ghost cube drawn beside it (locomotivePieces).
    const standAside: ReadonlySet<HexId> = $derived(
        BOARD_LOOK.litRailroads === 'ghost-cube'
            ? new Set(views.filter((view) => view.ghosts.length > 0).map((view) => view.hexId))
            : new Set()
    )

    const stagedRoute = $derived(draft ?? EMPTY_STAGED_ROUTE)
    // The city the next link leaves from, so each next city's chevron points the way it goes.
    const journeyFrom: HexId | undefined = $derived(
        draft ? cityById(draft.draftLinks.at(-1)?.cityId ?? draft.startCityId).hexId : undefined
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
    width={board.width}
    height={board.height}
    viewBox="0 0 {board.width} {board.height}"
    role="group"
    aria-label={gameSession.mapLayout.boardLabel}
    data-map-board
>
    <GroundLayer />
    <LitWashLayer {views} />
    <CapacityMarks />
    <MapTitle layout={gameSession.mapLayout} />
    <LinkRingLayer />
    <CityLayer />
    <StartCueLayer />
    <BonusLayer />
    <TrackLayer {standAside} />
    <LineLayer lastJourney={gameSession.lastJourney} />
    <ScrimLayer {offer} />
    <!-- Over the scrim, so no band, cube or dark hex hides a side, and the line is never dimmed. -->
    <ImpassableLayer />
    <!-- Over the cubes and the red lines: a passenger stands above its own cubes and its head
         reaches the hex above. An unlit city's passenger lays the scrim's fill over itself. -->
    <PassengerLayer
        startCityId={stagedRoute.startCityId}
        {scrimHoles}
        cities="unlit"
        shaded={offer.scrim !== undefined}
    />
    <!-- A lit city's passenger, whose head stands outside its hex's hole, is never dimmed. -->
    <PassengerLayer startCityId={stagedRoute.startCityId} {scrimHoles} cities="lit" />
    <!-- Above the scrim: the legend is never dimmed. -->
    <StartLegend mapId={gameSession.gameState.mapId} />
    <StagedRouteLayer route={stagedRoute} track={gameSession.gameState.track} />
    <PickLayer {views} {viewScale} {journeyFrom} />
    <FlightLayer />
    <HitLayer {views} />
    <PopupAnchor id={CHOICE_ANCHOR_ID} hexId={choiceHexId} />
    <PopupAnchor id={RIDE_ANCHOR_ID} hexId={rideHexId} />
</svg>
