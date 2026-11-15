<script lang="ts">
    // Everything about the player chosen in the standings, in plain labelled sections.
    import {
        ActionType,
        CASH_PER_INFLUENCE,
        GOOD_CASH,
        MAX_GOODS,
        TECH_FIELDS,
        goodsCount,
        isCampaign,
        anomalyDefinition,
        escalationScore,
        galacticRank,
        shipDefinition,
        DIRECTIVE_REDRAW_COST,
        directiveDefinition,
        directiveGoalProgress,
        DirectiveStatus,
        TurnPhase,
        choosesDirective,
        directiveScore,
        usesDirectives,
        TitleRequestKind,
        canRenounceTitle,
        titleScore,
        usesTitles
    } from '@tabletop/stellar-horizons-2'
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
    import { goodName, holdings } from '$lib/utils/trade.js'
    import AnomalyTile from '../AnomalyTile.svelte'
    import GoodChit from '../GoodChit.svelte'
    import TechMarkerTotal from '../TechMarkerTotal.svelte'
    import EscalationChip from '../escalation/EscalationChip.svelte'
    import DirectiveCard from '../directives/DirectiveCard.svelte'
    import DirectiveChoice from '../directives/DirectiveChoice.svelte'
    import TitleCard from '../titles/TitleCard.svelte'
    import CardLedger from '../cards/CardLedger.svelte'
    import { TITLE_REQUEST_WAITS } from '$lib/utils/titles.js'
    import {
        directiveProgress,
        directiveText,
        goalTypes,
        heldDirectiveIds
    } from '$lib/utils/directives.js'
    import BaseTab from './BaseTab.svelte'
    import ShipTiles from './ShipTiles.svelte'

    const gameSession = getGameSession()
    const playerId = $derived(gameSession.consolePlayerId)
    const view = $derived(playerId ? factionConsole(gameSession.gameState, playerId) : undefined)
    const mine = $derived(playerId !== undefined && playerId === gameSession.myPlayerId)
    const canSpendInfluence = $derived(
        mine && gameSession.validActionTypes.includes(ActionType.SpendInfluence)
    )
    const canDestroyGoods = $derived(
        mine && gameSession.validActionTypes.includes(ActionType.DestroyGoods)
    )
    const canRedrawDirective = $derived(
        mine && gameSession.validActionTypes.includes(ActionType.RedrawDirective)
    )
    const canChooseDirective = $derived(
        mine && gameSession.validActionTypes.includes(ActionType.ChooseDirective)
    )
    const canRenounceTitles = $derived(
        mine && gameSession.validActionTypes.includes(ActionType.RenounceTitle)
    )
    // The directive step offers the choice itself.
    const choosingInStep = $derived(gameSession.actingPhase === TurnPhase.Directives)
    const goods = $derived(playerId ? holdings(gameSession.gameState, playerId) : [])
    let scoreOpen = $state(false)
    // Open to begin with; kept while the console is shown.
    let shipsOpen = $state(true)
    const player = $derived(playerId ? gameSession.gameState.getPlayerState(playerId) : undefined)

    const SCORE_LINES = [
        ['techs', 'Techs not developed'],
        ['settlements', 'Settlements by distance'],
        ['largeBases', 'Large bases'],
        ['largestBase', 'Largest base'],
        ['explorationMarkers', 'Last-survey markers'],
        ['influence', 'IP'],
        ['techPoints', 'Tech points'],
        ['cash', 'Cash'],
        ['cards', 'Cards'],
        ['escalation', 'Escalation markers'],
        ['titles', 'Titles'],
        ['directives', 'Directives'],
        ['directiveGoal', 'Directive goal'],
        ['playerCount', 'Players in the game']
    ] as const

    function signed(value: number): string {
        const rounded = Math.round(value * 10) / 10
        return rounded > 0 ? `+${rounded}` : `${rounded}`
    }
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
            {#if standing.phase}
                <div class="turn">
                    <span
                        >{standing.phase.progress === 'done'
                            ? 'Done'
                            : standing.phase.progress === 'pending'
                              ? 'Waiting'
                              : PHASE_LABELS[standing.phase.phase]}</span
                    >
                </div>
            {/if}
        </div>
        <div class="body">
            <div class="resources">
                <span class="cash" title="Cash">${standing.cash}B</span>
                <span class="markers">
                    {#each TECH_FIELDS as field (field)}
                        <TechMarkerTotal {field} values={view.markers[field]} size={30} />
                    {/each}
                </span>
                {#if standing.campaign}
                    <span class="influence" title="Influence points">
                        {standing.campaign.influence} IP
                    </span>
                    {#if canSpendInfluence}
                        <button
                            type="button"
                            class="spend"
                            title="Spend 1 IP for ${CASH_PER_INFLUENCE}B"
                            onclick={() => gameSession.spendInfluence(1)}
                            >1 IP → ${CASH_PER_INFLUENCE}B</button
                        >
                    {/if}
                {/if}
            </div>

            {#if view.sheet}
                {@const sheet = view.sheet}
                <div class="sheet">
                    <span>Ships <b>{sheet.ships} of {sheet.maxShips}</b></span>
                    <span>Bases <b>{sheet.bases} of {sheet.maxBases}</b></span>
                    <span>Settlements <b>${sheet.settlementCost}B</b></span>
                </div>
            {/if}

            <section>
                <h4>
                    <button
                        type="button"
                        class="fold"
                        aria-expanded={shipsOpen}
                        aria-controls="faction-ships"
                        onclick={() => (shipsOpen = !shipsOpen)}
                    >
                        Ships
                        <span class="total"
                            >{standing.explorers} RE · {standing.crewVehicles} CV
                            <svg
                                class="chevron"
                                class:open={shipsOpen}
                                viewBox="0 0 16 16"
                                aria-hidden="true"><path d="M4 6l4 4 4-4"></path></svg
                            ></span
                        >
                    </button>
                </h4>
                {#if shipsOpen}
                    <div id="faction-ships">
                        {#if view.fleet.length > 0}
                            <ShipTiles ships={view.fleet} />
                        {:else}
                            <div class="note">No ships in play</div>
                        {/if}
                    </div>
                {/if}
            </section>

            {#if player && playerId && usesDirectives(gameSession.gameState)}
                {@const current = heldDirectiveIds(
                    gameSession.gameState,
                    playerId,
                    DirectiveStatus.Current
                )}
                {@const discarded = heldDirectiveIds(
                    gameSession.gameState,
                    playerId,
                    DirectiveStatus.Discarded
                )}
                {@const directiveGoal = directiveGoalProgress(gameSession.gameState, playerId)}
                <section>
                    <h4>
                        Directives <span class="directive-tally">
                            {#if directiveGoal}
                                {@const slots = Math.max(
                                    directiveGoal.goal.count,
                                    directiveGoal.counted
                                )}
                                <span class="goal-type">{goalTypes(directiveGoal.goal.types)}</span>
                                <span
                                    class="goal-dots"
                                    role="img"
                                    aria-label="{directiveGoal.counted} of {directiveGoal.goal
                                        .count} directives toward the goal"
                                >
                                    {#each Array.from({ length: slots }, (_, slot) => slot) as slot (slot)}
                                        <span class="dot" class:done={slot < directiveGoal.counted}
                                        ></span>
                                    {/each}
                                </span>
                                ·
                            {/if}
                            {directiveScore(gameSession.gameState, playerId).points} VP</span
                        >
                    </h4>
                    <div class="directive-row">
                        <div class="current">
                            {#each current as directiveId, index (directiveId ?? index)}
                                <DirectiveCard
                                    {directiveId}
                                    wide
                                    note={directiveId && mine
                                        ? directiveProgress(
                                              gameSession.gameState,
                                              playerId,
                                              directiveId
                                          )
                                        : undefined}
                                />
                            {/each}
                        </div>
                        <div class="directive-side">
                            {#if canRedrawDirective}
                                <button
                                    type="button"
                                    class="spend"
                                    title="Give up this directive for two more to choose from, once a turn"
                                    onclick={() => gameSession.redrawDirective()}
                                    >Redraw · {DIRECTIVE_REDRAW_COST} IP</button
                                >
                            {/if}
                            <span
                                class="completed"
                                title={player.fulfilledDirectives
                                    .map(
                                        (entry) =>
                                            `${directiveText(directiveDefinition(entry.directiveId).condition)} (${entry.year})`
                                    )
                                    .join('\n')}>{player.fulfilledDirectives.length} completed</span
                            >
                        </div>
                    </div>
                    {#if mine && canChooseDirective && !choosingInStep}
                        <div class="note">Keep one of the directives you drew:</div>
                        <DirectiveChoice />
                    {:else if current.length === 0 && discarded.length === 0}
                        <div class="note">
                            {choosesDirective(player)
                                ? 'Choosing a directive'
                                : 'No directive held; two are drawn at the start of the next turn'}
                        </div>
                    {/if}
                    {#if mine && discarded.length > 0 && current.length === 0}
                        <div class="note">
                            Given up; two more are drawn once everyone has finished this phase
                        </div>
                    {/if}
                </section>
            {/if}

            {#if player && playerId && usesTitles(gameSession.gameState)}
                {@const requests = mine ? player.titleRequests : []}
                {@const renouncing = requests
                    .filter((request) => request.kind === TitleRequestKind.Renounce)
                    .map((request) => request.titleId)}
                <section>
                    <h4>
                        Titles <span
                            >{plural(player.titles.length, 'title')} · {titleScore(
                                gameSession.gameState,
                                playerId
                            )} VP</span
                        >
                    </h4>
                    {#if player.titles.length > 0 || requests.length > 0}
                        <div class="titles">
                            {#each player.titles as titleId (titleId)}
                                <TitleCard
                                    {titleId}
                                    note={renouncing.includes(titleId)
                                        ? `Renounced; ${TITLE_REQUEST_WAITS}`
                                        : undefined}
                                    onrenounce={canRenounceTitles &&
                                    canRenounceTitle(gameSession.gameState, playerId, titleId)
                                        ? () => gameSession.renounceTitle(titleId)
                                        : undefined}
                                />
                            {/each}
                            {#each requests.filter((request) => request.kind === TitleRequestKind.Buy) as request (request.titleId)}
                                <TitleCard
                                    titleId={request.titleId}
                                    cost={request.influence}
                                    note="Bought; {TITLE_REQUEST_WAITS}"
                                    renounceLabel="Take back"
                                    onrenounce={() => gameSession.renounceTitle(request.titleId)}
                                />
                            {/each}
                        </div>
                    {:else}
                        <div class="note">No titles owned</div>
                    {/if}
                </section>
            {/if}

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

            {#if playerId && isCampaign(gameSession.gameState)}
                <section>
                    <h4>
                        Goods <span
                            >{goodsCount(gameSession.gameState, playerId)} of {MAX_GOODS}</span
                        >
                    </h4>
                    {#each goods as holding (holding.label)}
                        <div class="holding">
                            <span class="where">{holding.label}</span>
                            <span class="chits">
                                {#each holding.groups as group (group.good)}
                                    <span class="chit">
                                        <GoodChit good={group.good} count={group.count} size={26} />
                                        {#if canDestroyGoods}
                                            <button
                                                type="button"
                                                class="spend"
                                                title="Destroy one {goodName(
                                                    group.good
                                                )} for ${GOOD_CASH}B"
                                                onclick={() =>
                                                    gameSession.destroyGood(
                                                        holding.holder,
                                                        group.good
                                                    )}>1 → ${GOOD_CASH}B</button
                                            >
                                        {/if}
                                    </span>
                                {/each}
                            </span>
                        </div>
                    {:else}
                        <div class="note">No goods</div>
                    {/each}
                </section>
            {/if}

            {#if player && isCampaign(gameSession.gameState)}
                <section>
                    <h4>
                        Cards <span
                            >{plural(player.cards.length, 'card')} · {player.cardPoints()} VP</span
                        >
                    </h4>
                    {#if playerId}
                        <CardLedger {playerId} {mine} />
                    {/if}
                </section>
            {/if}

            {#if player && isCampaign(gameSession.gameState)}
                <section>
                    <h4>
                        Escalation <span
                            >{plural(player.escalation.length, 'marker')} · {escalationScore(
                                player
                            )} VP</span
                        >
                    </h4>
                    {#if player.escalation.length > 0}
                        <div class="escalation">
                            {#each player.escalation as marker, index (index)}
                                <EscalationChip {marker} size={40} />
                            {/each}
                        </div>
                    {:else}
                        <div class="note">No escalation markers</div>
                    {/if}
                    {#if player.attackBanned}
                        <div class="note">
                            Short of IP for escalation markers: no attacks until after the next
                            initiative roll
                        </div>
                    {/if}
                </section>
            {/if}

            {#if standing.campaign}
                {@const score = standing.campaign.score}
                <section>
                    <h4>
                        <button
                            type="button"
                            class="fold"
                            aria-expanded={scoreOpen}
                            aria-controls="faction-score"
                            onclick={() => (scoreOpen = !scoreOpen)}
                        >
                            Score
                            <span class="total"
                                >{score.total} VP · {galacticRank(score.total)}
                                <svg
                                    class="chevron"
                                    class:open={scoreOpen}
                                    viewBox="0 0 16 16"
                                    aria-hidden="true"><path d="M4 6l4 4 4-4"></path></svg
                                ></span
                            >
                        </button>
                    </h4>
                    {#if scoreOpen}
                        <div class="score" id="faction-score">
                            {#each SCORE_LINES as [key, label] (key)}
                                {#if score[key] !== 0}
                                    <span>{label}</span><span class="value"
                                        >{signed(score[key])}</span
                                    >
                                {/if}
                            {/each}
                        </div>
                    {/if}
                </section>
            {/if}

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
    /* Equal rows, so every title is as tall as the tallest. */
    .titles {
        display: grid;
        grid-template-columns: repeat(auto-fill, 136px);
        grid-auto-rows: 1fr;
        gap: 6px;
        margin-top: 4px;
    }

    .directive-tally {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .goal-type {
        color: #c9d6ea;
    }

    /* One circle for each directive the faction's goal asks for, filled as they are fulfilled. */
    .goal-dots {
        display: inline-flex;
        gap: 3px;
    }

    .dot {
        width: 10px;
        height: 10px;
        box-sizing: border-box;
        border: 1.5px solid #f4c430;
        border-radius: 50%;
    }

    .dot.done {
        background: #f4c430;
    }

    .directive-row {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .current {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }

    .directive-side {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        flex-shrink: 0;
    }

    .completed {
        color: #9fb4d0;
        font-size: 13px;
    }

    .escalation {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .holding {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 2px 0;
    }

    .holding .where {
        min-width: 96px;
        font-size: 13px;
    }

    .chits {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
    }

    .chit {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

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

    .influence {
        font-size: 15px;
        font-weight: 800;
        color: #d98cf2;
        white-space: nowrap;
    }

    .spend {
        margin-left: auto;
        padding: 2px 8px;
        border-radius: 6px;
        border: 1px solid #6b4a80;
        font-size: 12px;
        font-weight: 700;
        color: #e9c6f7;
        white-space: nowrap;
    }

    .spend:hover {
        background: #2a1d38;
    }

    .sheet {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 12px;
        font-size: 12px;
        color: #8fa4c2;
    }

    .sheet b {
        color: #dbe7f5;
    }

    .score {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 1px 10px;
        font-size: 12px;
        color: #b7c7de;
    }

    .score .value {
        text-align: right;
        font-weight: 700;
        color: #dbe7f5;
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

    .fold {
        display: flex;
        flex: 1;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin: -3px -6px;
        padding: 3px 6px;
        border: none;
        border-radius: 6px;
        background: none;
        font: inherit;
        color: inherit;
        cursor: pointer;
    }

    .fold:hover {
        background: rgba(127, 211, 255, 0.08);
    }

    .total {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
        color: #8fa4c2;
    }

    .chevron {
        width: 16px;
        height: 16px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        transform: rotate(-90deg);
        transition: transform 150ms ease;
    }

    .chevron.open {
        transform: none;
    }

    h4 > span {
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

    .where {
        padding-top: 2px;
        font-size: 12.5px;
        color: #b7c7de;
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
