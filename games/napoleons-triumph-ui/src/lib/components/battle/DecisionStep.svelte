<script lang="ts">
    import { commanderDefinition } from '@tabletop/napoleons-triumph'
    import {
        StageKind,
        type AdvanceStage,
        type ExcessLossStage,
        type OddLossStage,
        type RegroupStage
    } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Force from './Force.svelte'

    let { stage }: { stage: OddLossStage | ExcessLossStage | RegroupStage | AdvanceStage } =
        $props()

    const gameSession = getGameSession()

    const pick = (id: string) => gameSession.pickBattleUnit(id)
</script>

{#if stage.kind === StageKind.OddLoss}
    <div class="nt-battle-prompt">
        The loss is odd. Choose which enemy leading unit takes the extra step.
    </div>
    <Force units={stage.units} onpick={pick} />
{:else if stage.kind === StageKind.ExcessLosses}
    <div class="nt-battle-prompt">
        Your other units in the fight must lose {stage.amount} step{stage.amount === 1 ? '' : 's'}.
        Tap a unit to add a step.
    </div>
    <Force
        units={stage.units}
        selected={Object.keys(stage.losses)}
        markers={Object.fromEntries(
            Object.entries(stage.losses).map(([id, steps]) => [id, `−${steps}`])
        )}
        onpick={pick}
    />
    <div class="pt-1">
        <button
            type="button"
            class="nt-plain-button"
            disabled={stage.assigned !== stage.amount}
            onclick={() => gameSession.takeExcessLosses()}
            >Take the losses ({stage.assigned} of {stage.amount})</button
        >
    </div>
{:else if stage.kind === StageKind.Regroup}
    <div class="nt-battle-prompt">
        The attack is thrown back. One unit stays with each commander; the rest are detached.
    </div>
    {#each stage.corps as corps (corps.commanderId)}
        <div class="nt-battle-faint">{commanderDefinition(corps.commanderId).name}</div>
        <Force units={corps.units} selected={[corps.keptId]} markers={stage.roles} onpick={pick} />
    {/each}
    <div class="pt-1">
        <button type="button" class="nt-plain-button" onclick={() => gameSession.regroup()}
            >Regroup</button
        >
    </div>
{:else}
    <div class="nt-battle-prompt">
        At least one defending unit steps up to block the approach. Units leaving their commander
        behind are detached.
    </div>
    <Force units={stage.units} selected={stage.advancing} markers={stage.roles} onpick={pick} />
    <div class="flex flex-wrap items-center gap-2 pt-1">
        {#each stage.commanders as commander (commander.commanderId)}
            <button
                type="button"
                class="nt-plain-button nt-battle-small"
                class:nt-chosen={commander.goes}
                aria-pressed={commander.goes}
                disabled={commander.mustGo}
                onclick={() => gameSession.toggleCommanderStays(commander.commanderId)}
                >{commanderDefinition(commander.commanderId).name} goes with them</button
            >
        {/each}
        <button
            type="button"
            class="nt-plain-button"
            disabled={stage.advancing.length === 0}
            onclick={() => gameSession.advance()}>Advance to the approach</button
        >
    </div>
{/if}
