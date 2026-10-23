<script lang="ts">
    import { ActionType, CommandKind, commanderDefinition } from '@tabletop/napoleons-triumph'
    import { corpsName, standingGroupName } from '$lib/utils/groupNames.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RideChoice } from '$lib/model/moveCommands.js'
    import type { Snippet } from 'svelte'
    import { marksOn, type TargetMark } from '$lib/model/targets.js'
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
    const choices = $derived(gameSession.commandChoices)
    const kind = $derived(gameSession.commandKind)
    const reinforcements = $derived(gameSession.reinforcements)

    const ridingOn = $derived(gameSession.ridingOn)
    const rideChoice = $derived(gameSession.rideChoice)
    const stepsOfTheWay = $derived(gameSession.stepsOfTheWay)
    const together = $derived(gameSession.wholeCorpsChosen)
    const unitAlone = $derived(gameSession.unitAlone)
    const attaching = $derived(gameSession.attaching)
    const aimedLocale = $derived(gameSession.aimedLocale)
    const threatBeingDeclared = $derived(gameSession.threatBeingDeclared)
    const threatSentence = $derived.by(() => {
        if (!threatBeingDeclared) {
            return undefined
        }
        const map = gameSession.gameState.map
        const { locale, approach } = threatBeingDeclared.position
        return `Threaten an attack from ${map.label(locale)} into ${map.label(map.approach(approach).neighbour)}.`
    })

    const title = $derived.by(() => {
        if (aimedLocale !== undefined) {
            return `Attack on ${gameSession.gameState.map.label(aimedLocale)}`
        }
        if (!group) {
            return undefined
        }
        const name = group.commander ? corpsName(group.commander.id) : 'Detached units'
        return ridingOn ? `${name}, riding on` : name
    })

    const stillToCommand = $derived(
        gameSession.myPlayerId
            ? commandsLeft(gameSession.gameState, gameSession.myPlayerId)
            : undefined
    )

    const problem = $derived.by(() => {
        if (attaching) {
            return undefined
        }
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

{#snippet drawer(sheet: Snippet, note: Snippet, marks: TargetMark[] | undefined)}
    <div class="nt-orders-anchor">
        <div class="nt-orders-drawer" bind:clientHeight={drawerHeight}>
            <div class="nt-orders-sheet">
                {@render sheet()}
                <div class="nt-orders-note">
                    {@render note()}
                    <span class="nt-orders-faint">{stillToCommand}</span>
                </div>
            </div>
            {#if marks}
                <div class="nt-orders-key">
                    <TargetLegend {marks} />
                </div>
            {/if}
        </div>
    </div>
{/snippet}

{#snippet guardSheet()}
    <span>{threatSentence}</span>
    <span>To announce a Guard Attack, choose the Guard unit to show:</span>
    <div class="nt-orders-row">
        <div class="nt-orders-actions nt-orders-guards">
            {#each gameSession.guardUnitsToShow as unitId (unitId)}
                {@const unit = gameSession.gameState.unit(unitId)}
                {@const standsWith = standingGroupName(gameSession.gameState.map, unit)}
                <div class="nt-orders-unit">
                    <UnitTile
                        playerId={unit.playerId}
                        {...gameSession.lookOf(unit)}
                        selected={gameSession.guardUnitChosen === unitId}
                        label="Show this Guard unit: {standsWith}"
                        onclick={() => gameSession.toggleGuardUnit(unitId)}
                    />
                    <span class="nt-orders-small-text">{standsWith}</span>
                </div>
            {/each}
        </div>
    </div>
    <button type="button" class="nt-plain-button" onclick={() => gameSession.declareThreat()}
        >{gameSession.guardUnitChosen
            ? 'Announce a Guard Attack'
            : 'Threaten an attack without the Guard'}</button
    >
{/snippet}

{#snippet guardNote()}
    {#if gameSession.guardUnitChosen}
        <span class="nt-orders-warning"
            >A Guard Attack cannot be taken back: the Guard unit is turned face-up to the enemy.</span
        >
    {/if}
{/snippet}

{#snippet aimSheet()}
    <div class="nt-orders-row">
        <div class="nt-orders-turn">
            {@render turnActions(false)}
        </div>
    </div>
{/snippet}

{#snippet aimNote()}
    <span
        >Tap an arrow to threaten an attack across that approach. {group
            ? 'The pieces in hand are named to start with when the attack goes on.'
            : 'The attacking pieces are named next.'}</span
    >
{/snippet}

{#snippet groupSheet()}
    {#if group}
        <div
            class="nt-orders-units"
            class:nt-orders-together={together}
            role="group"
            aria-label={together ? 'The whole corps goes together' : 'Units'}
        >
            {#each group.units as unit (unit.id)}
                {@const moved = gameSession.movedInUnitStrip(unit)}
                <div class="nt-orders-unit">
                    <UnitTile
                        playerId={unit.playerId}
                        {...gameSession.lookOf(unit)}
                        selected={!together && picked.includes(unit.id)}
                        dimmed={moved}
                        marker={unit.fixed ? 'fixed battery' : moved ? 'moved' : undefined}
                        label="Include this unit in the command"
                        onclick={gameSession.mayChooseUnit(unit)
                            ? () => gameSession.togglePickedUnit(unit.id)
                            : undefined}
                    />
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
                {#if choices.length > 0}
                    <span class="nt-orders-faint">Command</span>
                {/if}
                <CommandSwitch
                    options={choices}
                    chosen={gameSession.commandInForce}
                    onchoose={(choice) => gameSession.chooseCommand(choice)}
                />
                {#if attaching && unitAlone}
                    {#each gameSession.attachTo as commander (commander.id)}
                        {@const name = commanderDefinition(commander.id).name}
                        <button
                            type="button"
                            class="nt-plain-button"
                            aria-label="Attach to {name}"
                            onclick={() => gameSession.attach(commander.id, unitAlone.id)}
                            >to {name}</button
                        >
                    {/each}
                {/if}
            </div>
            <div class="nt-orders-turn">
                {@render turnActions(false)}
            </div>
        </div>
    {/if}
{/snippet}

{#snippet groupNote()}
    {#if wayToChoose}
        <span>{wayToChoose}</span>
    {:else if problem}
        <span>{problem}</span>
    {:else if ridingOn}
        <span
            >The cavalry may ride on along its road, or threaten again. Any other command ends this
            move.</span
        >
    {:else if aside}
        <span>{aside}</span>
    {/if}
{/snippet}

<div class="nt-orders" role={title ? 'group' : undefined} aria-label={title}>
    <div class="nt-orders-lead">
        {#if title}
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
    {#if threatBeingDeclared}
        {@render drawer(guardSheet, guardNote, undefined)}
    {:else if aimedLocale !== undefined}
        {@render drawer(aimSheet, aimNote, marksOn(gameSession.targets))}
    {:else if group}
        {@render drawer(
            groupSheet,
            groupNote,
            problem ? undefined : marksOn(gameSession.targets, gameSession.closedReserves)
        )}
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

    .nt-orders-guards {
        gap: 8px 18px;
    }

    .nt-orders-small-text {
        font-size: 13px;
    }

    .nt-orders-warning {
        padding-bottom: 4px;
        color: var(--nt-warn);
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
