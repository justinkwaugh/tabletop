<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { NO_JOURNEY_PROMPT } from '$lib/model/actionArea.js'

    const gameSession = getGameSession()
</script>

<!-- R-3.3.1: with no journey possible, Pass is the only choice. -->
<h2 class="text-base font-bold">{NO_JOURNEY_PROMPT}</h2>
<div class="mt-2 flex flex-wrap gap-2">
    <button
        type="button"
        class="rounded-full border-2 border-rtr-pill bg-rtr-pill px-3.5 py-1 text-sm font-semibold text-rtr-pill-ink hover:enabled:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rtr-accent disabled:opacity-50"
        disabled={!gameSession.canPassJourney}
        onclick={() => gameSession.passJourney()}>Pass</button
    >
</div>
