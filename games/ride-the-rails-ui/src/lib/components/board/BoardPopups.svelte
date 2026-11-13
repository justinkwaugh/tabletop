<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { buildChoice, linkChoice } from '$lib/utils/pickMarks.js'
    import { popupSide } from '$lib/utils/phoneLayout.svelte.js'
    import HexDetailCard from './HexDetailCard.svelte'
    import { CHOICE_ANCHOR_ID, DETAIL_ANCHOR_ID } from './PopupAnchor.svelte'
    import RailroadChoicePopup from './RailroadChoicePopup.svelte'

    const gameSession = getGameSession()

    const offer = $derived(gameSession.boardOffer)

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

    // Contract, Coexistence and precedence: during a map pick the hex detail is in the side panel.
    const detailBeside = $derived(
        gameSession.hexDetailInSidePanel ? undefined : gameSession.hexDetailHexId
    )
</script>

<!-- HTML popups against the board's anchors, kept outside its CSS zoom so text stays crisp. -->
{#if choice}
    {#key choice.hexId}
        <RailroadChoicePopup {choice} reference="#{CHOICE_ANCHOR_ID}" onChoose={choose} />
    {/key}
{/if}

{#if detailBeside}
    {#key detailBeside}
        <Floater
            reference="#{DETAIL_ANCHOR_ID}"
            placement={popupSide('left')}
            offset={8}
            trigger="manual"
        >
            <HexDetailCard hexId={detailBeside} />
        </Floater>
    {/key}
{/if}
