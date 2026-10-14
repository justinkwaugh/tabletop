<script lang="ts">
    import type { DefenceStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Force from './Force.svelte'

    let { stage }: { stage: DefenceStage } = $props()

    const gameSession = getGameSession()
</script>

<div class="nt-battle-prompt">
    {#if stage.forced}
        Your pieces on the approach must defend.
    {:else}
        Tap units, here or on the map, to defend with them. Or retreat.
    {/if}
</div>
<Force
    units={stage.candidates}
    selected={stage.defenders}
    roles={stage.roles}
    onpick={stage.forced ? undefined : (id) => gameSession.pickBattleUnit(id)}
/>
{#if stage.problem}
    <div class="nt-battle-warning">{stage.problem}.</div>
{/if}
<div class="flex flex-wrap gap-2 pt-1">
    <button
        type="button"
        class="nt-plain-button"
        disabled={stage.defenders.length === 0 || stage.problem !== undefined}
        onclick={() => gameSession.declareDefense()}
    >
        Defend
    </button>
    {#if !stage.forced}
        <button type="button" class="nt-plain-button" onclick={() => gameSession.planRetreat()}
            >Retreat before combat</button
        >
    {/if}
</div>
