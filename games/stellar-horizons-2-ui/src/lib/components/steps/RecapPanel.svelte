<script lang="ts">
    import SystemLink from '../systems/SystemLink.svelte'
    import type { GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        TECH_FIELDS,
        anomalyDefinition,
        eventDefinition,
        isDrawEconomicTile,
        isDrawEvent,
        isResolveSurvey,
        isSettleExplorations,
        shipDefinition
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ECONOMIC_TILE_LABELS, systemName } from '$lib/utils/presentation.js'
    import ActionDescription from '../ActionDescription.svelte'
    import AnomalyTile from '../AnomalyTile.svelte'
    import EventTile from '../EventTile.svelte'
    import TechMarker from '../TechMarker.svelte'
    import WorldImage from '../WorldImage.svelte'

    // What happened since the viewer last acted, read before their step: the turn's draws and
    // rolls, the results recorded for them and other players' actions that name them. The
    // production, markers, events and surveys that matter most are shown as pieces; the rest as
    // the history tells them. Continue hides it on this device; Undo brings it back.
    let { actions, oncontinue }: { actions: readonly GameAction[]; oncontinue: () => void } =
        $props()

    const gameSession = getGameSession()
    const me = $derived(gameSession.myPlayerId ?? '')
    const MARKER_SIZE = 34
</script>

<section class="recap sh-step" aria-label="Since your last turn">
    <div class="head">
        <span class="title">Since your last turn</span>
        <button type="button" class="primary" onclick={oncontinue}>Continue</button>
    </div>
    <div class="items">
        {#each actions as action (action.id)}
            {#if isDrawEconomicTile(action) && action.metadata}
                {@const mine = action.metadata.earthProduction.find(
                    (entry) => entry.playerId === me
                )}
                <div class="item">
                    <span class="label"
                        >Economic phase: {ECONOMIC_TILE_LABELS[action.metadata.tile]}</span
                    >
                    {#if mine}
                        <div class="pieces">
                            <span class="cash">+${mine.cash + mine.emptyPoolCash}B</span>
                            {#each TECH_FIELDS as field (field)}
                                {#each mine.markers[field] as value, index (index)}
                                    <TechMarker {field} {value} size={MARKER_SIZE} />
                                {/each}
                            {/each}
                        </div>
                    {/if}
                </div>
            {:else if isSettleExplorations(action) && action.metadata}
                <div class="item">
                    <span class="label">Markers drawn</span>
                    {#each action.metadata.settled as entry, index (index)}
                        <div class="pieces">
                            <span class="what"
                                >{shipDefinition(entry.shipId).name} · <SystemLink
                                    systemId={entry.systemId}
                                /></span
                            >
                            {#each entry.markers as value, marker (marker)}
                                <TechMarker field={entry.field} {value} size={MARKER_SIZE} />
                            {:else}
                                {#if !entry.cash}<span class="none">none</span>{/if}
                            {/each}
                            {#if entry.cash}<span class="cash">+${entry.cash}B</span>{/if}
                            {#if entry.survey}<span class="note">enough for a survey</span>{/if}
                        </div>
                    {:else}
                        <span class="none">No markers</span>
                    {/each}
                </div>
            {:else if isDrawEvent(action) && action.metadata?.eventId}
                {@const eventId = action.metadata.eventId}
                <div class="item">
                    <span class="label">Event: {eventDefinition(eventId).name}</span>
                    <div class="pieces">
                        <EventTile {eventId} width={64} />
                        <span class="line"><ActionDescription {action} /></span>
                    </div>
                </div>
            {:else if isResolveSurvey(action) && action.metadata}
                {@const survey = action.metadata}
                <div class="item">
                    <span class="label"
                        >{survey.completed ? 'Survey completed' : 'Survey missed'}: <SystemLink
                            systemId={survey.systemId}
                        /></span
                    >
                    <div class="pieces">
                        {#if survey.playerId !== me}<PlayerName playerId={survey.playerId} />{/if}
                        {#if survey.drawnTileId && survey.placedSlot !== undefined}
                            <WorldImage tileId={survey.drawnTileId} size={48} />
                            <span class="what">a new world</span>
                        {/if}
                        {#if survey.anomaly?.anomalyId}
                            <AnomalyTile anomalyId={survey.anomaly.anomalyId} width={56} />
                            <span class="what"
                                >anomaly found: {anomalyDefinition(survey.anomaly.anomalyId)
                                    .name}</span
                            >
                        {/if}
                        {#if survey.completed && !survey.anomaly?.anomalyId && survey.placedSlot === undefined}
                            <span class="none">nothing new found</span>
                        {/if}
                    </div>
                </div>
            {:else}
                <p class="line">
                    {#if action.playerId}<PlayerName playerId={action.playerId} />{/if}
                    <ActionDescription {action} />
                </p>
            {/if}
        {/each}
    </div>
</section>

<style>
    .recap {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 14px;
        border: 1px solid #22314d;
        border-radius: 8px;
        background: #070a12;
    }

    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #7fd3ff;
    }

    .items {
        display: flex;
        flex-direction: column;
    }

    .item,
    .line {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 0;
        padding: 7px 0;
        border-top: 1px solid #1a2438;
        font-size: 13.5px;
        color: #c9d6ea;
    }

    .line {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
    }

    .items > :first-child {
        border-top: none;
    }

    .label {
        font-size: 12px;
        font-weight: 700;
        color: #e8f1ff;
    }

    .pieces {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
    }

    .pieces .line {
        padding: 0;
        border: none;
    }

    .cash {
        font-size: 17px;
        font-weight: 800;
        color: #f4c430;
    }

    .what {
        font-size: 13px;
        color: #c9d6ea;
    }

    .none,
    .note {
        font-size: 12px;
        color: #8fa4c2;
    }
</style>
