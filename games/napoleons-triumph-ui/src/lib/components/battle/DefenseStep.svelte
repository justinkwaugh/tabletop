<script lang="ts">
    import type { DefenceStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Force from './Force.svelte'

    let { stage }: { stage: DefenceStage } = $props()

    const gameSession = getGameSession()
</script>

<div class="nt-battle-prompt">
    {#if stage.forced}
        Your pieces on the approach must defend. Tap a unit, here or on the map, to lead with it.
    {:else}
        Tap units, here or on the map, to defend with them; tap again to lead. Or give ground.
    {/if}
    Leading units stay hidden unless the attack is pressed.
</div>
<Force
    units={stage.candidates}
    selected={stage.defenders}
    markers={stage.roles}
    onpick={(id) => gameSession.pickBattleUnit(id)}
/>
{#if stage.bystanders.length > 0}
    <div class="nt-battle-faint">Elsewhere in the locale</div>
    <Force units={stage.bystanders} />
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
        Defend{stage.leaders.length === 0 ? ' with no leading unit' : ''}
    </button>
    {#if !stage.forced}
        <button type="button" class="nt-plain-button" onclick={() => gameSession.planRetreat()}
            >Retreat before combat</button
        >
    {/if}
</div>
