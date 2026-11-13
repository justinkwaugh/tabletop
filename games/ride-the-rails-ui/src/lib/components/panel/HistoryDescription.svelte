<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/describeAction.js'
    import { historyStep } from '$lib/utils/history.js'
    import Description from '../Description.svelte'

    const gameSession = getGameSession()

    // docs/game-ui-layout.md, History description: the History Step that led to the displayed
    // state, its User Action first and then what its System Actions did (a seat's turn ending by
    // itself, a skipped share, the end of the round and its new turn order).
    const step = $derived(historyStep(gameSession.actions))
</script>

<div class="flex flex-col gap-0.5 py-0.5">
    {#if step.action}
        <p class="text-[15px] font-semibold leading-snug max-sm:text-[13px]">
            <Description description={describeAction(step.action)} />
        </p>
    {:else if step.consequences.length === 0}
        <p class="text-[15px] font-semibold leading-snug max-sm:text-[13px]">The game is set up.</p>
    {/if}
    {#each step.consequences as action (action.id)}
        <p class="text-[13px] leading-snug text-rtr-ink-muted max-sm:text-xs">
            <Description description={describeAction(action)} />
        </p>
    {/each}
</div>
