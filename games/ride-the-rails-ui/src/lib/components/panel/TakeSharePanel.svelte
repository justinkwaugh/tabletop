<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { isInFullScreen } from '$lib/model/fullScreenContext.js'
    import { shareButtons, shownRailroadCards } from '$lib/model/railroadCards.js'
    import { isPhoneWidth } from '$lib/utils/phoneLayout.svelte.js'
    import ShareButton from '../ShareButton.svelte'

    const gameSession = getGameSession()
    const inFullScreen = isInFullScreen()

    const buttons = $derived(shareButtons(shownRailroadCards(gameSession), gameSession))
</script>

<h2 class="text-base font-bold">Select a share below</h2>
<!-- Contract, Take a share: on a phone the share buttons are the desktop cards' (ShareButton), one per
     railroad available this round (R-1.4). On wider screens the railroad cards above the board are the buttons, except
     in full screen, whose dialog leaves the cards out of reach: there these are the buttons at every
     width. The panel shows once a round has stepped, so a railroad that round adds is simply
     among them. -->
{#if isPhoneWidth() || inFullScreen}
    <div class="share-row" role="group" aria-label="Railroads">
        {#each buttons as button (button.railroadId)}
            <div class="slot"><ShareButton {button} /></div>
        {/each}
    </div>
{/if}

<style>
    .share-row {
        display: flex;
        gap: 4px;
        margin-top: 6px;
    }

    /* The desktop cards' width, narrowing when six railroads would not fit a phone's row. */
    .slot {
        flex: 0 1 66px;
        min-width: 0;
        display: flex;
    }
</style>
