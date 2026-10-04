<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        MachineState,
        TECH_FIELDS,
        TurnStep,
        systemPopulation,
        type HydratedStellarHorizonsPlayerState
    } from '@tabletop/stellar-horizons-2'
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        FACTION_FILL,
        STEP_LABELS,
        factionName,
        plural,
        systemName
    } from '$lib/utils/presentation.js'
    import TechMarkerTotal from './TechMarkerTotal.svelte'

    let {
        playerState,
        initiative
    }: { playerState: HydratedStellarHorizonsPlayerState; initiative: number } = $props()

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const bases = $derived(gameState.basesOf(playerState.playerId))
    const ships = $derived(gameState.shipsOf(playerState.playerId))
    const inTransit = $derived(ships.filter((ship) => ship.transit > 0).length)
    const step = $derived(
        gameState.machineState === MachineState.PlayingTurn ? playerState.step : undefined
    )
</script>

<div
    class="player"
    style:--faction={playerState.faction ? FACTION_FILL[playerState.faction] : '#3d4a63'}
>
    <div class="top">
        {#if playerState.faction}
            <img src={FACTION_ART[playerState.faction]} alt="" width="40" height="40" />
        {/if}
        <div class="who">
            <PlayerName playerId={playerState.playerId} />
            <span class="faction"
                >{playerState.faction
                    ? factionName(playerState.faction)
                    : 'Choosing a faction'}</span
            >
        </div>
        <div class="right">
            <span class="cash">${playerState.cash}B</span>
            <span class="initiative" title="Initiative order">#{initiative}</span>
        </div>
    </div>
    {#if step}
        <div class="step" class:done={step === TurnStep.Done}>
            {step === TurnStep.Done ? 'Finished the turn' : STEP_LABELS[step]}
        </div>
    {/if}
    <div class="markers">
        {#each TECH_FIELDS as field (field)}
            <TechMarkerTotal {field} values={playerState.techMarkers[field]} />
        {/each}
    </div>
    <div class="line">
        {plural(playerState.techs.length, 'tech')} · {plural(ships.length, 'ship')}{inTransit > 0
            ? ` (${inTransit} in transit)`
            : ''}
    </div>
    {#each bases as base (base.systemId)}
        <div class="line">
            Base at {systemName(base.systemId)}: {plural(base.settlements, 'settlement')}
            <span class="muted">(population {systemPopulation(gameState, base.systemId)})</span>
        </div>
    {/each}
</div>

<style>
    .player {
        border: 1px solid #22314d;
        border-left: 6px solid var(--faction);
        border-radius: 10px;
        background: #0f1626;
        padding: 8px;
        color: #dbe7f5;
        font-size: 13px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .top {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .who {
        display: flex;
        flex-direction: column;
        flex: 1;
    }

    .faction {
        font-size: 12px;
        color: #8fa4c2;
    }

    .right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }

    .cash {
        color: #f2c94c;
        font-weight: 700;
        font-size: 15px;
    }

    .initiative {
        font-size: 11px;
        color: #8fa4c2;
    }

    .step {
        font-size: 12px;
        color: #7fd3ff;
    }

    .step.done {
        color: #7fe08a;
    }

    .markers {
        display: flex;
        gap: 6px;
    }

    .muted {
        color: #6f84a3;
    }
</style>
