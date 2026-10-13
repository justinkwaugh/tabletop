<script lang="ts">
    // Everything about the player chosen in the standings, in plain labelled sections.
    import { TECH_FIELDS, anomalyDefinition, shipDefinition } from '@tabletop/stellar-horizons-2'
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { factionConsole } from '$lib/utils/playerArea.js'
    import {
        FACTION_FILL,
        FIELD_COLORS,
        PHASE_LABELS,
        factionName,
        plural,
        systemName
    } from '$lib/utils/presentation.js'
    import AnomalyTile from '../AnomalyTile.svelte'
    import TechMarkerTotal from '../TechMarkerTotal.svelte'
    import BaseTab from './BaseTab.svelte'
    import ShipIcon from './ShipIcon.svelte'

    const gameSession = getGameSession()
    const playerId = $derived(gameSession.consolePlayerId)
    const view = $derived(playerId ? factionConsole(gameSession.gameState, playerId) : undefined)
    const mine = $derived(playerId !== undefined && playerId === gameSession.myPlayerId)
    const shipCount = $derived(
        view ? view.fleet.reduce((total, group) => total + group.ships.length, 0) : 0
    )
</script>

{#if view}
    {@const standing = view.standing}
    {@const goal = view.settlementGoal}
    {@const faction = standing.faction}
    <div class="console" style:--faction={faction ? FACTION_FILL[faction] : '#3d4a63'}>
        <div class="head">
            {#if faction}
                <img src={FACTION_ART[faction]} alt="" width="30" height="30" />
            {/if}
            <div class="who">
                <span class="faction">{faction ? factionName(faction) : 'Choosing a faction'}</span>
                <span class="player"
                    >{mine ? 'Your faction' : gameSession.getPlayerName(standing.playerId)}</span
                >
            </div>
            <div class="turn">
                <span>Initiative {standing.initiative}</span>
                {#if standing.phase}
                    <span
                        >{standing.phase.progress === 'done'
                            ? 'Done'
                            : standing.phase.progress === 'pending'
                              ? 'Waiting'
                              : PHASE_LABELS[standing.phase.phase]}</span
                    >
                {/if}
            </div>
        </div>
        <div class="body">
            <div class="resources">
                <span class="cash" title="Cash">${standing.cash}B</span>
                <span class="markers">
                    {#each TECH_FIELDS as field (field)}
                        <TechMarkerTotal {field} values={view.markers[field]} size={30} />
                    {/each}
                </span>
            </div>

            {#if standing.anomalies}
                {@const tally = standing.anomalies}
                <section>
                    <h4>
                        Anomalies
                        <span>{view.anomalyIds.length} of {tally.goal.resolved}</span>
                    </h4>
                    {#if view.anomalyIds.length > 0}
                        <div class="anomalies">
                            {#each view.anomalyIds as anomalyId (anomalyId)}
                                <span title={anomalyDefinition(anomalyId).name}>
                                    <AnomalyTile {anomalyId} width={58} />
                                </span>
                            {/each}
                        </div>
                    {/if}
                    <div class="note">
                        {tally.science} science, {tally.combat} combat. {tally.goal.resolved} win, with
                        at least {tally.goal.ofEachChallenge} of each.
                    </div>
                </section>
            {/if}

            <section>
                <h4>
                    Bases
                    {#if view.bases.length > 0}
                        <span>{plural(standing.settlements, 'settlement')}</span>
                    {/if}
                </h4>
                {#each view.bases as base (base.systemId)}
                    <div class="base">
                        {#if faction}
                            <BaseTab {faction} settlements={base.settlements} />
                        {/if}
                        <span class="system">{systemName(base.systemId)}</span>
                        <span
                            class="note"
                            class:met={goal !== undefined &&
                                base.population >= goal.systemPopulation}
                            title={goal
                                ? `A base wins at ${goal.settlements} settlements in a system of ${goal.systemPopulation} population`
                                : undefined}>population {base.population}</span
                        >
                    </div>
                {:else}
                    <div class="note">
                        No bases yet.{#if goal}
                            {goal.settlements} settlements in a system of {goal.systemPopulation}
                            population wins.{/if}
                    </div>
                {/each}
            </section>

            <section>
                <h4>Ships <span>{shipCount}</span></h4>
                {#each view.fleet as group (group.systemId)}
                    <div class="system-ships">
                        <span class="where">{systemName(group.systemId)}</span>
                        <span class="ships">
                            {#each group.ships as ship (ship.shipId)}
                                <span class="ship">
                                    {#if faction}<ShipIcon {ship} {faction} />{/if}
                                    <span class="ship-name"
                                        >{shipDefinition(ship.shipId).name}{ship.transit > 0
                                            ? ` · ${ship.transit}`
                                            : ''}</span
                                    >
                                </span>
                            {/each}
                        </span>
                    </div>
                {:else}
                    <div class="note">No ships in play</div>
                {/each}
            </section>

            <section>
                <h4>Techs</h4>
                <div class="techs">
                    {#each view.techs as progress (progress.field)}
                        <div
                            title="{progress.field}: {progress.developed} of {progress.total} techs developed"
                        >
                            <div class="field" style:color={FIELD_COLORS[progress.field]}>
                                {progress.field}
                            </div>
                            <div class="bar">
                                <span
                                    style:width="{(progress.developed / progress.total) * 100}%"
                                    style:background={FIELD_COLORS[progress.field]}
                                ></span>
                            </div>
                            <div class="count">
                                {progress.developed} of {progress.total}{progress.developedThisTurn
                                    ? ' · new'
                                    : ''}
                            </div>
                        </div>
                    {/each}
                </div>
            </section>
        </div>
    </div>
{/if}

<style>
    .anomalies {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 4px;
    }

    .console {
        border: 1px solid #1e2b44;
        border-radius: 8px;
        overflow: hidden;
        background: #0d1322;
        color: #dbe7f5;
    }

    .head {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 30px;
        padding: 6px 8px;
        background: color-mix(in srgb, var(--faction) 55%, #0d1322);
        color: #ffffff;
    }

    .head img {
        border-radius: 3px;
    }

    .who {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        line-height: 1.15;
    }

    .faction {
        font-size: 15px;
        font-weight: 800;
    }

    .player {
        font-size: 12.5px;
    }

    .turn {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        font-size: 12.5px;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
    }

    .body {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 10px;
    }

    .resources {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .cash {
        font-size: 17px;
        font-weight: 800;
        color: #f2c94c;
    }

    .markers {
        display: inline-flex;
        gap: 3px;
    }

    section {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding-top: 8px;
        border-top: 1px solid #1a2438;
    }

    h4 {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        font-size: 13px;
        font-weight: 800;
        color: #7fd3ff;
    }

    h4 span {
        font-size: 12px;
        font-weight: 500;
        color: #8fa4c2;
        text-align: right;
    }

    .note {
        font-size: 12px;
        color: #8fa4c2;
    }

    .note.met {
        color: #7fe08a;
    }

    .base {
        display: grid;
        grid-template-columns: 44px 1fr auto;
        align-items: center;
        gap: 6px;
    }

    .system {
        font-size: 13px;
        font-weight: 700;
        color: #e8f1ff;
    }

    .system-ships {
        display: grid;
        grid-template-columns: minmax(0, 92px) 1fr;
        align-items: start;
        gap: 6px;
    }

    .where {
        padding-top: 2px;
        font-size: 12.5px;
        color: #b7c7de;
    }

    .ships {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 8px;
    }

    .ship {
        display: inline-flex;
        align-items: center;
        gap: 3px;
    }

    .ship-name {
        font-size: 12.5px;
        color: #dbe7f5;
    }

    .techs {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
    }

    .field {
        font-size: 12.5px;
        font-weight: 700;
    }

    .bar {
        height: 5px;
        margin-top: 3px;
        background: #1c2740;
        border-radius: 2px;
        overflow: hidden;
    }

    .bar span {
        display: block;
        height: 100%;
    }

    .count {
        margin-top: 2px;
        font-size: 12px;
        color: #b7c7de;
    }
</style>
