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
</script>

<div class="sh-step">
    <p class="hint">
        Keep one of these orders from your government. It stays secret until you fulfil it, for its
        points and {DIRECTIVE_INFLUENCE} IP; the others go back.
    </p>
    {#if goal}
        <p class="hint">
            Your goal: {goal.goal.count} directives {goalTypes(goal.goal.types)}, or {DIRECTIVE_SHORTFALL_PENALTY}
            VP lost for each one short. You have {goal.counted}.
        </p>
    {/if}
    <DirectiveChoice />
</div>
