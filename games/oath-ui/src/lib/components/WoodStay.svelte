<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import AnswerButton from '$lib/components/AnswerButton.svelte'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-11.7-H2 — the ruler keeps the traveller at the Wood, offered only when the engine accepts
    // it: the traveller can pay for no site without the cards they declared (Forest Paths' Q&A).
    let {
        travelerId,
        spacing
    }: {
        travelerId: string
        /** Its margin from the line above or the regions below. */
        spacing: 'mt-2.5' | 'mb-2.5'
    } = $props()

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    const width = new ChoiceWidth()
</script>

{#if draft.woodStayOffered}
    <!-- Under the line, as wide as its label; 44 px tall on a phone. -->
    <div class="flex {spacing}">
        <AnswerButton {width} disabled={busy} onclick={() => draft.keepTravelerInPlace()}>
            <PlayerName playerId={travelerId} /> stays
        </AnswerButton>
    </div>
{/if}
