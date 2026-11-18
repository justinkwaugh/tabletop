<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import { cityById, type CityId, type RailroadId } from '@tabletop/ride-the-rails'
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { buildChoice, linkChoice } from '$lib/utils/pickMarks.js'
    import { isPhoneWidth, popupSide } from '$lib/utils/phoneLayout.svelte.js'
    import { clearOfPicks, placesFrom, rideSides } from '$lib/utils/popupPlacement.js'
    import { CHOICE_ANCHOR_ID, RIDE_ANCHOR_ID } from './PopupAnchor.svelte'
    import RailroadChoicePopup from './RailroadChoicePopup.svelte'

    const gameSession = getGameSession()

    const offer = $derived(gameSession.boardOffer)

    // The Ride button floats on the side of the last city the route did not come in from.
    const rideSide = $derived.by(() => {
        const draft = gameSession.journeyDraft
        const last = draft?.draftLinks.at(-1)?.cityId
        if (!draft || !last) return 'right' as const
        const before = draft.draftLinks.at(-2)?.cityId ?? draft.startCityId
        return hexCenter(cityById(before).hexId).x > hexCenter(cityById(last).hexId).x
            ? ('left' as const)
            : ('right' as const)
    })

    // Contract, Pick conventions: no control floats over a pick target. The Ride button tries that
    // side first (below on a phone), then the others, then the corners, and stands at the first
    // place clear of every lit hex, its marks and chevrons, the route's cities and its link count.
    const ridePlaces = $derived(placesFrom(rideSides(rideSide, isPhoneWidth())))
    const RIDE_GAP = 6
    const rideCity = $derived(gameSession.journeyPreview?.cityIds.at(-1))
    // The last city whose Ride button last found a clear place; it shows only there, so it is
    // hidden until its first placement and while no place beside the city is clear.
    let clearBeside: CityId | undefined = $state()

    function placedBeside(cityId: CityId | undefined) {
        return (clear: boolean) => {
            clearBeside = clear ? cityId : undefined
        }
    }

    const choice = $derived(
        offer.popup
            ? buildChoice(gameSession.gameState.track, offer.popup)
            : gameSession.journeyPopup
              ? linkChoice(gameSession.journeyPopup)
              : undefined
    )

    function choose(railroadId: RailroadId) {
        if (offer.popup) {
            void gameSession.chooseRailroad(railroadId)
        } else {
            gameSession.chooseLinkRailroad(railroadId)
        }
    }
</script>

<!-- HTML popups against the board's anchors, kept outside its CSS zoom so text stays crisp. -->
{#if choice}
    {#key choice.hexId}
        <RailroadChoicePopup {choice} reference="#{CHOICE_ANCHOR_ID}" onChoose={choose} />
    {/key}
{/if}

<!-- R-3.3: the journey can be sent from the map, beside the city the route has reached, as well as
     from the action panel. Where no place beside the city is clear, only the panel's Ride shows. -->
{#if gameSession.canRideJourney && !choice}
    {#key rideCity}
        <Floater
            reference="#{RIDE_ANCHOR_ID}"
            placement={popupSide(rideSide)}
            offset={0}
            middlewares={[clearOfPicks(ridePlaces, RIDE_GAP, placedBeside(rideCity))]}
            trigger="manual"
        >
            <!-- Hidden, not removed, so the Floater still measures it for the next placement; while
                 no place is clear, clearOfPicks keeps it out of the window, over no press target. -->
            <button
                type="button"
                class="rounded-full border-2 border-rtr-pill bg-rtr-pill px-3.5 py-1 text-sm font-semibold text-rtr-pill-ink shadow-sm hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rtr-accent"
                class:invisible={rideCity === undefined || clearBeside !== rideCity}
                onclick={() => gameSession.rideJourney()}
                data-map-ride>Ride</button
            >
        </Floater>
    {/key}
{/if}
