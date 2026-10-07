<script lang="ts">
    import StepDescription from '$lib/components/StepDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { viewedHistoryStep } from '$lib/utils/moneyReport.js'

    const gameSession = getGameSession()

    let step = $derived(viewedHistoryStep(gameSession.actions))
</script>

<p class="marracash-prompt">
    {#if step.length > 0}
        <StepDescription actions={step} />
    {:else}
        The market opens.
    {/if}
</p>
