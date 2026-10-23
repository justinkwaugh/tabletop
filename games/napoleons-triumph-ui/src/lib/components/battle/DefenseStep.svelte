<script lang="ts">
    import { commanderDefinition } from '@tabletop/napoleons-triumph'
    import type { DefenceStage, DefendingCommander } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { CorpsHead } from './corpsHead.js'
    import Force from './Force.svelte'

    let { stage, folded = false }: { stage: DefenceStage; folded?: boolean } = $props()

    const gameSession = getGameSession()

    function headOf(commander: DefendingCommander): CorpsHead {
        const name = commanderDefinition(commander.commanderId).name
        if (commander.namedElsewhere) {
            return {
                label: `${name} was named against another approach this turn, so he cannot defend here`,
                marker: 'named already',
                dimmed: true
            }
        }
        return {
            label: commander.choosable
                ? commander.named
                    ? `Leave ${name} out of the defence`
                    : `Name ${name} to defend with his units`
                : `${name} defends with his unit`,
            marker: commander.named ? 'defends' : 'stays out',
            chosen: commander.named,
            onclick: commander.choosable
                ? () => gameSession.nameDefendingCommander(commander.commanderId, !commander.named)
                : undefined
        }
    }

    const heads = $derived(
        Object.fromEntries(
            stage.commanders.map((commander) => [commander.commanderId, headOf(commander)])
        )
    )
</script>

<div class="nt-battle-prompt">
    {#if stage.forced}
        Your pieces on the approach must defend.
    {:else if folded}
        Tap units on the map to defend with them. Or retreat.
    {:else}
        Tap units, here or on the map, to defend with them. Or retreat.
        {#if stage.commanders.some((commander) => commander.choosable)}
            Tap a commander’s flag to leave him out of the defence, or to name him again.
        {/if}
    {/if}
</div>
{#if !folded}
    <Force
        byCorps
        {heads}
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
