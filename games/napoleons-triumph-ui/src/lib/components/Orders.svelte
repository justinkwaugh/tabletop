<script lang="ts">
    import { ActionType, CommandKind, commanderDefinition } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RideChoice } from '$lib/model/moveCommands.js'
    import { marksOn } from '$lib/model/targets.js'
    import { WayStepKind } from '$lib/model/ways.js'
    import { commandsLeft } from '$lib/utils/commandsLeft.js'
    import CommandSwitch from './CommandSwitch.svelte'
    import RideSwitch from './RideSwitch.svelte'
    import TargetLegend from './TargetLegend.svelte'
    import UnitTile from './UnitTile.svelte'

    let { drawerHeight = $bindable(0) }: { drawerHeight?: number } = $props()

    const gameSession = getGameSession()

    const group = $derived(gameSession.selectedGroup)
    const picked = $derived(gameSession.pickedUnitIds)
    const options = $derived(gameSession.commandOptions)
    const kind = $derived(gameSession.commandKind)
    const reinforcements = $derived(gameSession.reinforcements)

    const ridingOn = $derived(gameSession.ridingOn)
    const rideChoice = $derived(gameSession.rideChoice)
    const stepsOfTheWay = $derived(gameSession.stepsOfTheWay)
    const together = $derived(gameSession.wholeCorpsChosen)
    const title = $derived.by(() => {
        if (!group) {
            return undefined
        }
        const name = group.commander
            ? `${commanderDefinition(group.commander.id).name}’s corps`
            : 'Detached units'
        return ridingOn ? `${name}, riding on` : name
    })

    const stillToCommand = $derived(
        gameSession.myPlayerId
            ? commandsLeft(gameSession.gameState, gameSession.myPlayerId)
            : undefined
    )

    const problem = $derived.by(() => {
        if (options.length === 0 && !ridingOn) {
            return 'No command can move these units now.'
        }
        return gameSession.targets.length === 0 ? 'These units have nowhere to go.' : undefined
    })

    const wayToChoose = $derived.by(() => {
        if (stepsOfTheWay.length === 0) {
            return undefined
        }
        return stepsOfTheWay.some((step) => step.kind === WayStepKind.Entry)
            ? 'More than one road comes on there. Tap the one to come on by: this turn the pieces go on only by roads that join it.'
            : 'More than one road leads there. Tap the locale to march through: a corps closes the reserves it marches into to other units this turn.'
    })

    const aside = $derived.by(() => {
        if (!group || ridingOn) {
            return undefined
        }
        if (rideChoice === RideChoice.NewCommand) {
            return 'A new command ends the ride, and is the second these pieces may take in their turn of entry.'
        }
        if (together && picked.length > 1) {
            return 'Tap units to send only some.'
        }
        if (kind === CommandKind.Unit && picked.length > 1) {
            return 'The two fire together across their approach, each by its own independent command.'
        }
        return kind === CommandKind.Corps && picked.length < group.units.length
            ? 'The units left out stay behind, detached.'
            : undefined
    })
</script>

{#snippet turnActions(inSentence: boolean)}
    {#if !inSentence && reinforcements.length > 0}
        <span class="nt-orders-faint">Off the map:</span>
    {/if}
    {#each reinforcements as reinforcement (reinforcement.key)}
        <button
            type="button"
            class="nt-plain-button"
            aria-label="Bring on {reinforcement.name}"
            aria-pressed={gameSession.selectedGroupKey === reinforcement.key}
            onclick={() => gameSession.selectReinforcement(reinforcement)}
            >{reinforcement.name}</button
        >
    {/each}
    {#if gameSession.validActionTypes.includes(ActionType.EndTurn)}
        {#if inSentence}
            <span>or</span>
        {/if}
        <button type="button" class="nt-plain-button" onclick={() => gameSession.endTurn()}
            >End turn</button
        >
    {/if}
{/snippet}

<div class="nt-orders" role={title ? 'group' : undefined} aria-label={title}>
    <div class="nt-orders-lead">
        {#if group}
            <span class="nt-orders-name">{title}</span>
        {:else}
            <span
                >Choose a corps or unit on the map{reinforcements.length > 0
                    ? ', bring on'
                    : ''}</span
            >
            {@render turnActions(true)}
        {/if}
    </div>
    {#if group}
        <div class="nt-orders-anchor">
            <div class="nt-orders-drawer" bind:clientHeight={drawerHeight}>
                <div class="nt-orders-sheet">
                    <div
                        class="nt-orders-units"
                        class:nt-orders-together={together}
                        role="group"
                        aria-label={together ? 'The whole corps goes together' : 'Units'}
                    >
                        {#each group.units as unit (unit.id)}
                            {@const attachTo = gameSession.attachOptions(unit)}
                            {@const moved = gameSession.movedInUnitStrip(unit)}
                            <div class="nt-orders-unit">
                                <UnitTile
                                    playerId={unit.playerId}
                                    {...gameSession.lookOf(unit)}
                                    selected={!together && picked.includes(unit.id)}
                                    dimmed={moved}
                                    marker={unit.fixed
                                        ? 'fixed battery'
                                        : moved
                                          ? 'moved'
                                          : undefined}
                                    label="Include this unit in the command"
                                    onclick={gameSession.mayChooseUnit(unit)
                                        ? () => gameSession.togglePickedUnit(unit.id)
                                        : undefined}
                                />
                                {#each attachTo as commander (commander.id)}
                                    <button
                                        type="button"
                                        class="nt-plain-button nt-orders-small"
                                        onclick={() => gameSession.attach(commander.id, unit.id)}
                                        >Attach to {commanderDefinition(commander.id).name}</button
                                    >
                                {/each}
                            </div>
                        {/each}
                    </div>
                    <div class="nt-orders-row">
                        <div class="nt-orders-actions">
                            {#if rideChoice}
                                <RideSwitch
                                    chosen={rideChoice}
                                    onchoose={(ride) => gameSession.chooseRide(ride)}
                                />
                            {/if}
                            {#if options.length > 0}
                                <span class="nt-orders-faint">Command</span>
                            {/if}
                            <CommandSwitch
                                {options}
                                chosen={gameSession.order?.kind}
                                onchoose={(command) => gameSession.chooseCommand(command)}
                            />
                            {#if gameSession.guardUnitId}
                                <button
                                    type="button"
                                    class="nt-plain-button nt-orders-small"
                                    aria-pressed={gameSession.guardAttack}
                                    onclick={() => gameSession.toggleGuardAttack()}
                                    >Announce a Guard Attack</button
                                >
                            {/if}
                        </div>
                        <div class="nt-orders-turn">
                            {@render turnActions(false)}
                        </div>
                    </div>
                    <div class="nt-orders-note">
                        {#if wayToChoose}
                            <span>{wayToChoose}</span>
                        {:else if problem}
                            <span>{problem}</span>
                        {:else if ridingOn}
                            <span
                                >The cavalry may ride on along its road, or threaten again. Any
                                other command ends this move.</span
                            >
                        {:else if aside}
                            <span>{aside}</span>
                        {/if}
                        <span class="nt-orders-faint">{stillToCommand}</span>
                    </div>
                </div>
                {#if !problem}
                    <div class="nt-orders-key">
                        <TargetLegend
                            marks={marksOn(gameSession.targets, gameSession.closedReserves)}
                        />
                    </div>
                {/if}
            </div>
        </div>
    {:else}
        <div class="nt-orders-note nt-orders-rest">
            <span class="nt-orders-faint">{stillToCommand}</span>
        </div>
    {/if}
</div>

<style>
    .nt-orders {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .nt-orders-lead {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 0.45em;
        min-height: 32px;
        font-size: 16px;
    }

    .nt-orders-name {
        font-size: 18px;
        font-style: italic;
    }

    .nt-orders-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 5px 14px;
        align-self: stretch;
    }

    .nt-orders-turn {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.45em;
        margin-left: auto;
        font-size: 14px;
    }

    /* Holds the idle line's height while the sheet hangs over the board, so choosing never resizes the board. */
    .nt-orders-rest,
    .nt-orders-anchor {
        min-height: 18px;
    }

    .nt-orders-anchor {
        position: relative;
        height: 18px;
    }

    .nt-orders-drawer {
        position: absolute;
        z-index: 20;
        top: 0;
        right: calc(-1 * var(--nt-body-inline));
        left: calc(-1 * var(--nt-body-inline));
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        pointer-events: none;
    }

    .nt-orders-sheet {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        align-self: stretch;
        gap: 6px;
        padding: 0 var(--nt-body-inline) 9px;
        border-bottom: 1px solid color-mix(in srgb, var(--nt-ink) 35%, transparent);
        background: var(--nt-ground);
        pointer-events: auto;
    }

    .nt-orders-key {
        display: flex;
        align-items: center;
        margin: 5px 0 0 5px;
        padding: 5px 11px 5px 6px;
        border-radius: 7px;
        background: var(--nt-ground);
        font-size: 13px;
        line-height: 16px;
    }

    .nt-orders-units {
        display: flex;
        flex-wrap: wrap;
        gap: 1px 3px;
        padding: 1px 2px;
        border-radius: 5px;
    }

    .nt-orders-together {
        box-shadow: 0 0 0 2px var(--nt-ink);
    }

    .nt-orders-unit {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .nt-orders-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        font-size: 14px;
    }

    .nt-orders :global(.nt-orders-small) {
        font-size: 13px;
        padding: 1px 7px;
    }

    .nt-orders-note {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        font-size: 13px;
        line-height: 1.3;
    }

    .nt-orders-faint {
        opacity: 0.66;
    }

    @media (max-width: 639px) {
        .nt-orders-lead {
            min-height: 26px;
            font-size: 13px;
        }

        .nt-orders-name {
            font-size: 15px;
        }

        .nt-orders-note {
            font-size: 12px;
        }
    }
</style>
