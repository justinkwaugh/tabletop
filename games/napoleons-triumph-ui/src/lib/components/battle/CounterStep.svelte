<script lang="ts">
    import type { CounterStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Force from './Force.svelte'
    import ResultRule from './ResultRule.svelte'

    let { stage, folded = false }: { stage: CounterStage; folded?: boolean } = $props()

    const gameSession = getGameSession()
</script>

<div class="nt-battle-prompt">
    {stage.attackWinning ? 'The attack is winning.' : 'The defence is holding.'}
    {#if stage.pickableIds.length === 0}
        None of these units can counter-attack{stage.attackWinning
            ? ''
            : ': infantry may only when the attack is winning'}.
    {:else}
        {#if folded}
            Tap up to two units on the map to counter-attack;
        {:else}
            Up to two units may counter-attack;
        {/if}
        each loses a step first.{stage.attackWinning
            ? ''
            : ' Infantry may only when the attack is winning.'}
    {/if}
</div>
{#if !folded}
    <Force
        units={stage.candidates}
        selected={stage.counterAttackers}
        roles={stage.roles}
        onlyPickableIds={stage.pickableIds}
        onpick={(id) => gameSession.pickBattleUnit(id)}
    />
    {#if !stage.problem}
        <ResultRule finalResult={stage.finalResult} />
    {/if}
{/if}
<div class="flex flex-wrap items-center gap-3 pt-1">
    <button
        type="button"
        class="nt-plain-button"
        disabled={stage.problem !== undefined}
        onclick={() => gameSession.counterAttack()}
    >
        {stage.counterAttackers.length === 0 ? 'No counter-attack' : 'Counter-attack'}
    </button>
    {#if stage.problem}
        <span class="nt-battle-warning">{stage.problem}.</span>
    {/if}
</div>
