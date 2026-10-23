<script lang="ts">
    import type { DefenceStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Force from './Force.svelte'

    let { stage, folded = false }: { stage: DefenceStage; folded?: boolean } = $props()

    const gameSession = getGameSession()
</script>

<div class="nt-battle-prompt">
    {#if stage.forced}
        Your pieces on the approach must defend.
    {:else if folded}
        Tap units on the map to defend with them. Or retreat.
    {:else}
        Tap units, here or on the map, to defend with them. Or retreat.
    {/if}
</div>
{#if !folded}
    <Force
        byCorps
        units={stage.candidates}
        selected={stage.defenders}
        roles={stage.roles}
        onpick={stage.forced ? undefined : (id) => gameSession.pickBattleUnit(id)}
    />
{/if}
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
