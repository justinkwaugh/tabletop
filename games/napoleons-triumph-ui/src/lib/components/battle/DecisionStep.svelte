<script lang="ts">
    import { commanderDefinition } from '@tabletop/napoleons-triumph'
    import AdvanceSwitch from './AdvanceSwitch.svelte'
    import { StageKind } from '$lib/model/battleSelection.js'
    import type {
        AdvanceStage,
        ExcessLossStage,
        OddLossStage,
        RegroupStage
    } from '$lib/model/battleStage.js'
    import { lossMark } from '$lib/model/roleMark.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { advancePrompt } from '$lib/utils/advancePrompt.js'
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
        marks={Object.fromEntries(
            Object.entries(stage.losses).map(([id, steps]) => [id, lossMark(steps)])
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
    <div class="nt-battle-prompt">One unit stays with each commander; the rest are detached.</div>
    {#each stage.corps as corps (corps.commanderId)}
        <div class="nt-battle-faint">{commanderDefinition(corps.commanderId).name}</div>
        <Force units={corps.units} selected={[corps.keptId]} roles={stage.roles} onpick={pick} />
    {/each}
    <div class="pt-1">
        <button type="button" class="nt-plain-button" onclick={() => gameSession.regroup()}
            >Regroup</button
        >
    </div>
{:else}
    <div class="nt-battle-prompt">{advancePrompt(stage)}</div>
    <Force
        units={stage.units}
        selected={stage.advancing}
        roles={stage.roles}
        onpick={stage.pickableIds.length > 0 ? pick : undefined}
    />
    {#if stage.commanders.length > 0}
        <div class="flex flex-wrap items-center gap-2 pt-1">
            {#each stage.commanders as commander (commander.commanderId)}
                <AdvanceSwitch
                    commanderId={commander.commanderId}
                    goes={commander.goes}
                    mustGo={commander.mustGo}
                    onchoose={(goes) =>
                        gameSession.sendCommanderForward(commander.commanderId, goes)}
                />
            {/each}
        </div>
    {/if}
    <div class="pt-1">
        <button
            type="button"
            class="nt-plain-button"
            disabled={stage.advancing.length === 0}
            onclick={() => gameSession.advance()}>Advance to the approach</button
        >
    </div>
{/if}
