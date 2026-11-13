<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { NO_JOURNEY_PROMPT } from '$lib/model/actionArea.js'

    const gameSession = getGameSession()
</script>

<!-- R-3.3.1-H1: with no journey possible, Pass is the only choice. -->
<h2 class="text-base font-bold">{NO_JOURNEY_PROMPT}</h2>
<div class="mt-2 flex flex-wrap gap-2">
    <button
        type="button"
        class="rounded-lg border border-rtr-line bg-rtr-panel-raised px-3 py-1.5 text-sm font-semibold hover:border-rtr-accent focus-visible:outline-2 focus-visible:outline-rtr-accent disabled:opacity-50"
        disabled={!gameSession.canPassJourney}
        onclick={() => gameSession.passJourney()}>Pass</button
    >
</div>
