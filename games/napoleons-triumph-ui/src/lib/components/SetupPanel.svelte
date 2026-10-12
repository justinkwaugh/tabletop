<script lang="ts">
    import {
        MAX_CORPS_UNITS,
        MAX_FRENCH_DETACHMENTS,
        Scenario,
        Side,
        UnitType,
        commanderDefinition,
        type CorpsDeployment
    } from '@tabletop/napoleons-triumph'
    import { setupLocaleOf } from '$lib/model/deploymentEdits.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import UnitTile from './UnitTile.svelte'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const deployment = $derived(gameSession.deployment)
    const side = $derived(gameSession.mySide)
    const picked = $derived(gameSession.setupUnitId)
    const detached = $derived(new Set(deployment?.detachments.map((entry) => entry.unitId) ?? []))
    const chooseAdvanceGuard = $derived(
        side === Side.Allied && game.scenario === Scenario.December1
    )
    const pickedIsArtillery = $derived(
        picked !== undefined && game.unit(picked).face?.type === UnitType.Artillery
    )
    const pickedOnMap = $derived(
        picked !== undefined &&
            deployment?.corps.some((corps) => !corps.offMap && corps.unitIds.includes(picked)) ===
                true
    )

    function standing(corps: CorpsDeployment): string {
        if (corps.offMap) {
            return 'off the map'
        }
        const place = game.map.label(setupLocaleOf(game.map, corps.commanderId).id)
        if (corps.approach === undefined) {
            return `in reserve at ${place}`
        }
        return `at ${place}, facing ${game.map.label(game.map.approach(corps.approach).neighbour)}`
    }

    const batteryAim = $derived.by(() => {
        const battery = deployment?.fixedBattery?.unitId
        const approach = battery
            ? gameSession.setupPreview.state?.unit(battery).position?.approach
            : undefined
        return approach === undefined
            ? undefined
            : game.map.label(game.map.approach(approach).neighbour)
    })

    function marker(unitId: string): string | undefined {
        if (deployment?.fixedBattery?.unitId === unitId) {
            return 'fixed battery'
        }
        return detached.has(unitId) ? 'detached' : undefined
    }
</script>

{#if deployment && side}
    <div class="nt-setup">
        <div class="nt-setup-prompt">
            Organise your army. Tap a unit, then tap the corps it should join{side === Side.French
                ? `, or a place on the map to detach it there (${deployment.detachments.length} of ${MAX_FRENCH_DETACHMENTS} detached)`
                : ''}. To change where a corps stands, tap it on the map and then an approach of its
            locale, or the locale to hold it in reserve.
            {#if side === Side.French && deployment.fixedBattery}
                One battery is your fixed battery: it blocks an approach and never moves again. Pick
                it to aim it at another approach of its locale, or pick other guns to name them
                instead.
            {/if}
        </div>
        <div class="nt-setup-corps">
            {#each deployment.corps as corps (corps.commanderId)}
                {@const definition = commanderDefinition(corps.commanderId)}
                <div
                    class="nt-setup-card"
                    class:nt-setup-short={corps.unitIds.length < definition.minimumUnits}
                >
                    <button
                        type="button"
                        class="nt-setup-name"
                        disabled={picked === undefined || corps.unitIds.includes(picked)}
                        onclick={() => gameSession.assignPickedTo(corps.commanderId)}
                        aria-label="Give the picked unit to {definition.name}"
                    >
                        {definition.name}
                        <span class="nt-setup-count"
                            >{corps.unitIds.length}/{MAX_CORPS_UNITS} · min {definition.minimumUnits}</span
                        >
                    </button>
                    <span
                        class="nt-setup-stance"
                        class:nt-setup-picked={gameSession.setupCorpsId === corps.commanderId}
                        >{standing(corps)}</span
                    >
                    {#if chooseAdvanceGuard}
                        <button
                            type="button"
                            class="nt-setup-stance"
                            onclick={() => gameSession.toggleCorpsOffMap(corps.commanderId)}
                            >{corps.offMap ? 'start on the map' : 'hold off the map'}</button
                        >
                    {/if}
                    <div class="nt-setup-units">
                        {#each corps.unitIds as unitId (unitId)}
                            <UnitTile
                                playerId={game.unit(unitId).playerId}
                                face={game.unit(unitId).face}
                                selected={picked === unitId}
                                marker={marker(unitId)}
                                label="Pick this unit"
                                compact
                                onclick={() => gameSession.pickSetupUnit(unitId)}
                            />
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
        <div class="nt-setup-footer">
            {#if picked !== undefined}
                {#if detached.has(picked)}
                    <button
                        type="button"
                        class="nt-plain-button"
                        onclick={() => gameSession.recallDetachment(picked)}
                        >Return it to its corps</button
                    >
                {/if}
                {#if deployment.fixedBattery?.unitId === picked && batteryAim}
                    <span class="nt-setup-hint"
                        >The fixed battery faces {batteryAim}. Tap another approach of its locale to
                        turn it there.</span
                    >
                {/if}
                {#if pickedIsArtillery && pickedOnMap && side === Side.French && deployment.fixedBattery?.unitId !== picked}
                    <button
                        type="button"
                        class="nt-plain-button"
                        onclick={() => gameSession.nameFixedBattery(picked)}
                        >Make it the fixed battery</button
                    >
                {/if}
            {/if}
            {#if gameSession.setupPreview.problem}
                <span class="nt-setup-problem">{gameSession.setupPreview.problem}</span>
            {:else}
                <button
                    type="button"
                    class="nt-plain-button nt-setup-commit"
                    onclick={() => gameSession.commitSetup()}>Deploy the army</button
                >
            {/if}
        </div>
    </div>
{/if}

<style>
    .nt-setup {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
    }

    .nt-setup-prompt {
        font-size: 15px;
        max-width: 90ch;
        line-height: 1.3;
    }

    .nt-setup-corps {
        display: flex;
        gap: 6px;
        overflow-x: auto;
    }

    .nt-setup-card {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: none;
        width: 108px;
        padding: 5px 6px 4px;
        border-radius: 3px;
        background: color-mix(in srgb, var(--nt-ink) 7%, transparent);
    }

    .nt-setup-short .nt-setup-name {
        color: var(--nt-warn);
    }

    .nt-setup-name {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        font-style: italic;
        font-size: 14px;
        line-height: 1.15;
        text-align: left;
    }

    .nt-setup-name:not([disabled]) {
        text-decoration: underline;
        cursor: pointer;
    }

    .nt-setup-count {
        font-style: normal;
        font-size: 11px;
        opacity: 0.7;
    }

    .nt-setup-stance {
        font-size: 11px;
        line-height: 1.15;
        text-align: left;
    }

    button.nt-setup-stance {
        text-decoration: underline dotted;
    }

    .nt-setup-picked {
        font-weight: 700;
    }

    .nt-setup-units {
        display: flex;
        flex-direction: column;
        margin-top: 2px;
    }

    .nt-setup-footer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
    }

    .nt-setup-problem {
        color: var(--nt-warn);
    }

    .nt-setup-hint {
        opacity: 0.75;
    }
</style>
