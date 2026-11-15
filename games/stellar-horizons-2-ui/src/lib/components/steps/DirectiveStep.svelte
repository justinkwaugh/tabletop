<script lang="ts">
    import {
        DIRECTIVE_INFLUENCE,
        DIRECTIVE_SHORTFALL_PENALTY,
        directiveGoalProgress
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { goalTypes } from '$lib/utils/directives.js'
    import DirectiveChoice from '../directives/DirectiveChoice.svelte'

    const gameSession = getGameSession()
    const goal = $derived(
        gameSession.myPlayerId
            ? directiveGoalProgress(gameSession.gameState, gameSession.myPlayerId)
            : undefined
    )
    // "4 anomaly or survey directives", or "5 directives of any type".
    const goalText = $derived(
        goal === undefined
            ? ''
            : goal.goal.types.length > 0
              ? `${goal.goal.count} ${goalTypes(goal.goal.types)} directives`
              : `${goal.goal.count} directives of any type`
    )
</script>

<div class="sh-step">
    <p class="hint">
        Keep one of these orders from your government. It stays secret until you fulfil it, for its
        points and {DIRECTIVE_INFLUENCE} IP; the others go back.
    </p>
    {#if goal}
        <p class="hint">
            Your goal: {goalText}, or {DIRECTIVE_SHORTFALL_PENALTY}
            VP lost for each one short. You have {goal.counted}.
        </p>
    {/if}
    <DirectiveChoice />
</div>
