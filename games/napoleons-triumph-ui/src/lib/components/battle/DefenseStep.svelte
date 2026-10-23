<script lang="ts">
    import { commanderDefinition } from '@tabletop/napoleons-triumph'
    import {
        CommanderStatus,
        isChoosable,
        type DefenceStage,
        type DefendingCommander
    } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { corpsName } from '$lib/utils/groupNames.js'
    import CommanderChip from './CommanderChip.svelte'
    import type { CorpsFlag } from './corpsFlag.js'
    import Force from './Force.svelte'

    let { stage, folded = false }: { stage: DefenceStage; folded?: boolean } = $props()

    const gameSession = getGameSession()

    function flagOf({ commanderId, status }: DefendingCommander): CorpsFlag {
        const name = commanderDefinition(commanderId).name
        const toggle = (named: boolean) => () =>
            gameSession.nameDefendingCommander(commanderId, named)
        switch (status) {
            case CommanderStatus.NoUnitPicked:
                return { label: corpsName(commanderId) }
            case CommanderStatus.Named:
                return {
                    label: `Leave ${name} out of the defence`,
                    marker: 'defends',
                    chosen: true,
                    onclick: toggle(false)
                }
            case CommanderStatus.LeftOut:
                return {
                    label: `Name ${name} to defend with his units`,
                    marker: 'stays out',
                    onclick: toggle(true)
                }
            case CommanderStatus.MustDefend:
                return { label: `${name} defends with his corps`, marker: 'defends', chosen: true }
            case CommanderStatus.NamedElsewhere:
                return {
                    label: `${name} is already defending another approach this turn, so he cannot defend here`,
                    marker: 'defending elsewhere',
                    dimmed: true
                }
        }
    }

    const flags = $derived(
        Object.fromEntries(
            stage.commanders.map((commander) => [commander.commanderId, flagOf(commander)])
        )
    )
    const choosable = $derived(stage.commanders.filter(({ status }) => isChoosable(status)))
</script>

<div class="nt-battle-prompt">
    {#if stage.forced}
        Your pieces on the approach must defend.
    {:else if folded}
        Tap units on the map to defend with them. Or retreat.
    {:else}
        Tap units, here or on the map, to defend with them. Or retreat.
    {/if}
    {#if choosable.length > 0}
        Tap a commander’s flag to leave him out of the defence, or to name him again.
    {/if}
</div>
{#if !folded}
    <Force
        byCorps
        {flags}
        units={stage.candidates}
        selected={stage.defenders}
        roles={stage.roles}
        onpick={stage.forced ? undefined : (id) => gameSession.pickBattleUnit(id)}
    />
{/if}
{#if stage.problem}
    <div class="nt-battle-warning">{stage.problem}.</div>
{/if}
<div class="flex flex-wrap items-end gap-2 pt-1">
    {#if folded}
        {#each choosable as { commanderId } (commanderId)}
            <CommanderChip
                {commanderId}
                playerId={stage.candidates[0].playerId}
                {...flags[commanderId]}
            />
        {/each}
    {/if}
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
