<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import { usaCity, type RailroadId } from '@tabletop/ride-the-rails'
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { buildChoice, linkChoice } from '$lib/utils/pickMarks.js'
    import { popupSide } from '$lib/utils/phoneLayout.svelte.js'
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
        return hexCenter(usaCity(before).hexId).x > hexCenter(usaCity(last).hexId).x
            ? ('left' as const)
            : ('right' as const)
    })

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
     from the action panel. -->
{#if gameSession.canRideJourney && !choice}
    {#key gameSession.journeyPreview?.cityIds.at(-1)}
        <Floater
            reference="#{RIDE_ANCHOR_ID}"
            placement={popupSide(rideSide)}
            offset={6}
            trigger="manual"
        >
            <button
                type="button"
                class="rounded-full border-2 border-rtr-pill bg-rtr-pill px-3.5 py-1 text-sm font-semibold text-rtr-pill-ink shadow-sm hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rtr-accent"
                onclick={() => gameSession.rideJourney()}
                data-map-ride>Ride</button
            >
        </Floater>
    {/key}
{/if}
