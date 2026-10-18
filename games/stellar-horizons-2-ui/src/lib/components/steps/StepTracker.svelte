<script lang="ts">
    import {
        TurnPhase,
        isCampaign,
        phaseDefinition,
        scenarioPhases
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        ECONOMIC_TILE_LABELS,
        ECONOMIC_TILE_NOT_YET,
        FACTION_FILL,
        PHASE_DONE_LABELS,
        PHASE_LABELS
    } from '$lib/utils/presentation.js'

    const gameSession = getGameSession()
    const phases = $derived(scenarioPhases(gameSession.gameState))
    const current = $derived(gameSession.currentPhase)
    // The campaign's economic choices are spans of their own, played before the decade's phases.
    const economic = $derived(
        current === TurnPhase.Initiative || current === TurnPhase.BaseProduction
    )
    const tile = $derived(
        isCampaign(gameSession.gameState) &&
            gameSession.gameState.year > gameSession.gameState.scenarioDefinition().startYear
            ? gameSession.gameState.economicTile
            : undefined
    )
    const currentIndex = $derived(economic ? -1 : current ? phases.indexOf(current) : -1)
    const acting = $derived(gameSession.actingPhase)
    const order = $derived(gameSession.phaseOrder)
    // Under a barrier nobody's play lands before anyone else's, so the track has no direction.
    const unordered = $derived(current ? phaseDefinition(current).merge === 'barrier' : false)

    function name(playerId: string): string {
        return playerId === gameSession.myPlayerId ? 'You' : gameSession.getPlayerName(playerId)
    }

    function fill(playerId: string): string {
        const faction = gameSession.gameState.findPlayerState(playerId)?.faction
        return faction ? FACTION_FILL[faction] : '#3d4a63'
    }

    const PROGRESS_TITLES = {
        done: 'has finished',
        playing: 'is playing',
        pending: 'has not started'
    } as const
</script>

<div class="tracker">
    <div class="tracks">
        <ol class="track phases" aria-label="Phases of the decade">
            {#if tile}
                <li
                    class:current={economic}
                    class:past={!economic}
                    aria-current={economic ? 'step' : undefined}
                    title="Economic phase: {ECONOMIC_TILE_LABELS[tile]}"
                >
                    <span class="number">E</span>
                    <span class="label">{ECONOMIC_TILE_LABELS[tile]}</span>
                </li>
            {/if}
            {#each phases as phase, index (phase)}
                <li
                    class:current={phase === current}
                    class:past={index < currentIndex}
                    aria-current={phase === current ? 'step' : undefined}
                    title={PHASE_LABELS[phase]}
                >
                    <span class="number">{index + 1}</span>
                    <span class="label">{PHASE_LABELS[phase]}</span>
                </li>
            {/each}
        </ol>
        {#if order.length > 1}
            <ol
                class="track players"
                class:unordered
                aria-label={unordered ? 'Players in this phase' : 'Order of play this phase'}
            >
                {#each order as entry (entry.playerId)}
                    <li
                        data-progress={entry.progress}
                        style:--faction={fill(entry.playerId)}
                        title="{name(entry.playerId)} {PROGRESS_TITLES[entry.progress]}"
                    >
                        <span class="name">{name(entry.playerId)}</span>
                        {#if entry.progress === 'done'}
                            <svg
                                class="mark"
                                viewBox="0 0 12 12"
                                width="12"
                                height="12"
                                role="img"
                                aria-label="finished"
                            >
                                <path
                                    d="M1.5 6.5 4.75 9.75 10.5 2.5"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="3"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                ></path>
                            </svg>
                        {/if}
                    </li>
                {/each}
            </ol>
        {/if}
        {#if tile && ECONOMIC_TILE_NOT_YET[tile]}
            <p class="not-yet">{ECONOMIC_TILE_NOT_YET[tile]}</p>
        {/if}
    </div>
    {#if acting && !economic}
        <button type="button" class="done" onclick={() => gameSession.endPhase()}>
            {PHASE_DONE_LABELS[acting]}
        </button>
    {/if}
</div>

<style>
    .tracker {
        container-type: inline-size;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px 12px;
        flex-wrap: wrap;
    }

    .tracks {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
    }

    /* One track of arrow segments, each pointing into the next. The phases of the decade are
       one track; the players of the phase in play, in the order their play lands, are a second
       track attached beneath it. */
    .track {
        --point: 9px;
        display: flex;
        min-width: 0;
    }

    .track li {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-left: calc(3px - var(--point));
        padding: 4px 14px 4px calc(var(--point) + 10px);
        font-size: 13px;
        white-space: nowrap;
        clip-path: polygon(
            0 0,
            calc(100% - var(--point)) 0,
            100% 50%,
            calc(100% - var(--point)) 100%,
            0 100%,
            var(--point) 50%
        );
    }

    .track li:first-child {
        margin-left: 0;
        padding-left: 12px;
        clip-path: polygon(
            0 0,
            calc(100% - var(--point)) 0,
            100% 50%,
            calc(100% - var(--point)) 100%,
            0 100%
        );
    }

    .phases li {
        color: #7f93b3;
        background: #131d31;
    }

    .phases li.past {
        color: #86a6c9;
        background: #1c3553;
    }

    .phases li.current {
        color: #05070d;
        background: #7fd3ff;
        font-weight: 700;
    }

    .number {
        display: none;
    }

    /* Each player's segment is outlined in their faction colour: the colour fills the clipped
       shape and the panel's dark is painted back over it, inset by the stroke. */
    .players li {
        --stroke: 1.5px;
        position: relative;
        min-height: 22px;
        padding-top: 2px;
        padding-bottom: 2px;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #dbe7f5;
        background: var(--faction);
    }

    .players li::before {
        content: '';
        position: absolute;
        inset: var(--stroke) calc(var(--stroke) + 1px);
        background: #0d1322;
        clip-path: polygon(
            0 0,
            calc(100% - var(--point)) 0,
            100% 50%,
            calc(100% - var(--point)) 100%,
            0 100%,
            var(--point) 50%
        );
    }

    .players li:first-child::before {
        inset: var(--stroke) calc(var(--stroke) + 1px) var(--stroke) var(--stroke);
        clip-path: polygon(
            0 0,
            calc(100% - var(--point)) 0,
            100% 50%,
            calc(100% - var(--point)) 100%,
            0 100%
        );
    }

    .players li > * {
        position: relative;
    }

    .players li[data-progress='playing'] {
        font-weight: 700;
    }

    .players li[data-progress='done'],
    .players li[data-progress='pending'] {
        color: #8fa4c2;
        background: color-mix(in srgb, var(--faction) 55%, #0d1322);
    }

    .mark {
        flex: none;
        color: #ffffff;
    }

    /* A barrier phase has no order of play, so its players are plain blocks, not arrows. */
    .players.unordered li {
        margin-left: 3px;
        padding-right: 11px;
        padding-left: 11px;
        border-radius: 4px;
        clip-path: none;
    }

    .players.unordered li::before,
    .players.unordered li:first-child::before {
        inset: var(--stroke);
        border-radius: 3px;
        clip-path: none;
    }

    .players.unordered li:first-child {
        margin-left: 0;
    }

    /* Collapse to numbers and colours by the panel's own width, since the sidebar narrows it. */
    @container (max-width: 620px) {
        .phases li:not(.current) .label {
            display: none;
        }

        .phases li:not(.current) .number {
            display: inline;
        }

        .players li .name {
            display: none;
        }

        .players li {
            min-width: 34px;
            box-sizing: border-box;
            padding-right: 10px;
            padding-left: calc(var(--point) + 6px);
        }

        .players li:first-child {
            padding-left: 8px;
        }

        .players.unordered li {
            min-width: 28px;
            padding-right: 8px;
            padding-left: 8px;
        }
    }

    .not-yet {
        font-size: 12px;
        color: #8fa4c2;
    }

    .done {
        margin-left: auto;
        white-space: nowrap;
        padding: 4px 14px;
        border-radius: 8px;
        background: #f2c94c;
        color: #1d1a14;
        font-weight: 700;
    }

    .done:hover {
        background: #ffd968;
    }
</style>
