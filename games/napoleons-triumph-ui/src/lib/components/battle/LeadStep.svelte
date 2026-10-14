<script lang="ts">
    import type { DefenceLeadersStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Force from './Force.svelte'

    let { stage }: { stage: DefenceLeadersStage } = $props()

    const gameSession = getGameSession()
</script>

<div class="nt-battle-prompt">
    The attack is pressed. Tap {stage.leaderLimit === 1 ? 'a unit' : 'up to two units'}, here or on
    the map, to lead the defence. Leading units are shown to the enemy as you name them.
</div>
<Force
    units={stage.defenders}
    selected={stage.leaders}
    roles={stage.roles}
    onpick={(id) => gameSession.pickBattleUnit(id)}
/>
{#if stage.problem}
    <div class="nt-battle-warning">{stage.problem}.</div>
{/if}
<div class="pt-1">
    <button
        type="button"
        class="nt-plain-button"
        disabled={stage.problem !== undefined}
        onclick={() => gameSession.leadDefense()}
    >
        {stage.leaders.length === 0
            ? 'Defend with no leading unit'
            : `Lead with ${stage.leaders.length === 1 ? 'this unit' : 'these units'}`}
    </button>
</div>
