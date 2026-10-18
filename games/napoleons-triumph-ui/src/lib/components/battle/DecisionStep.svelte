<script lang="ts">
    import { commanderDefinition } from '@tabletop/napoleons-triumph'
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
    import UnitTile from '$lib/components/UnitTile.svelte'
    import Force from './Force.svelte'
    import CommanderChip from './CommanderChip.svelte'

    let {
        stage,
        folded = false
    }: { stage: OddLossStage | ExcessLossStage | RegroupStage | AdvanceStage; folded?: boolean } =
        $props()

    const gameSession = getGameSession()

    const pick = (id: string) => gameSession.pickBattleUnit(id)
</script>

{#if stage.kind === StageKind.OddLoss}
    <div class="nt-battle-prompt">
        {#if folded}
            The loss is odd. Tap the enemy leading unit on the map that takes the extra step.
        {:else}
            The loss is odd. Choose which enemy leading unit takes the extra step.
        {/if}
    </div>
    {#if !folded}
        <Force units={stage.units} onpick={pick} />
    {/if}
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
    <div class="nt-battle-prompt">
        One unit stays with each commander; the rest are detached. Tap the unit he stays with.
    </div>
    {#each stage.corps as corps (corps.commanderId)}
        <div class="flex flex-wrap items-center gap-x-1 gap-y-0.5">
            {#each corps.units as unit (unit.id)}
                <span class="inline-flex items-center">
                    <UnitTile
                        playerId={unit.playerId}
                        {...gameSession.lookOf(unit)}
                        label="Keep this unit with {commanderDefinition(corps.commanderId).name}"
                        onclick={() => pick(unit.id)}
                    />
                    {#if corps.keptId === unit.id}
                        <CommanderChip
                            commanderId={corps.commanderId}
                            playerId={unit.playerId}
                            label="{commanderDefinition(corps.commanderId)
                                .name} stays with this unit"
                        />
                    {/if}
                </span>
            {/each}
        </div>
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
    >
        {#each stage.commanders as commander (commander.commanderId)}
            {@const name = commanderDefinition(commander.commanderId).name}
            <CommanderChip
                commanderId={commander.commanderId}
                playerId={stage.units[0].playerId}
                label={commander.mustGo
                    ? `${name} goes forward with his last unit`
                    : `Send ${name} forward with them`}
                marker={commander.goes ? 'advances' : 'stays'}
                chosen={commander.goes}
                onclick={commander.mustGo
                    ? undefined
                    : () =>
                          gameSession.sendCommanderForward(commander.commanderId, !commander.goes)}
            />
        {/each}
    </Force>
    <div class="pt-2.5">
        <button
            type="button"
            class="nt-plain-button"
            disabled={stage.advancing.length === 0}
            onclick={() => gameSession.advance()}>Advance to the approach</button
        >
    </div>
{/if}
