<script lang="ts">
    import type { CounterStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Force from './Force.svelte'

    let { stage }: { stage: CounterStage } = $props()

    const gameSession = getGameSession()
</script>

<div class="nt-battle-prompt">
    {stage.attackWinning ? 'The attack is winning.' : 'The defence is holding.'} Up to two units may counter-attack;
    each loses a step first. Infantry may only when the attack is winning.
</div>
<Force
    units={stage.candidates}
    selected={stage.counterAttackers}
    markers={stage.roles}
    onpick={(id) => gameSession.pickBattleUnit(id)}
/>
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
    {:else}
        <span class="nt-battle-result"
            >Final result {stage.finalResult > 0 ? '+' : ''}{stage.finalResult}</span
        >
    {/if}
</div>
