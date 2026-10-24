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
        DIRECTIVE_SHORTFALL_PENALTY,
        directiveGoalProgress,
        DirectiveStatus,
        TurnPhase,
        choosesDirective,
        directiveScore,
        usesDirectives
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
    import CardBack from '../cards/CardBack.svelte'
    import CardFace from '../cards/CardFace.svelte'
    import EscalationChip from '../escalation/EscalationChip.svelte'
    import DirectiveCard from '../directives/DirectiveCard.svelte'
    import DirectiveChoice from '../directives/DirectiveChoice.svelte'
    import { directiveProgress, goalTypes, heldDirectiveIds } from '$lib/utils/directives.js'
    import BaseTab from './BaseTab.svelte'
    import ShipIcon from './ShipIcon.svelte'

    const gameSession = getGameSession()
    const playerId = $derived(gameSession.consolePlayerId)
    const view = $derived(playerId ? factionConsole(gameSession.gameState, playerId) : undefined)
    const mine = $derived(playerId !== undefined && playerId === gameSession.myPlayerId)
    const shipCount = $derived(
        view ? view.fleet.reduce((total, group) => total + group.ships.length, 0) : 0
    )
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
    // The directive step offers the choice itself.
    const choosingInStep = $derived(gameSession.actingPhase === TurnPhase.Directives)
    const goods = $derived(playerId ? holdings(gameSession.gameState, playerId) : [])
    let scoreOpen = $state(false)
    // An owned or held card shows its text once tapped.
    let openCardId: string | undefined = $state()
    const player = $derived(playerId ? gameSession.gameState.getPlayerState(playerId) : undefined)

    function toggleCard(cardId: string) {
        openCardId = openCardId === cardId ? undefined : cardId
    }

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
                        Directives <span
                            >{plural(player.fulfilledDirectives.length, 'fulfilled', 'fulfilled')} · {directiveScore(
                                gameSession.gameState,
                                playerId
                            ).points} VP</span
                        >
                    </h4>
                    {#if directiveGoal}
                        <div class="note">
                            Goal: {directiveGoal.counted} of {directiveGoal.goal.count}
                            {goalTypes(directiveGoal.goal.types)}; {DIRECTIVE_SHORTFALL_PENALTY} VP lost
                            for each one short
                        </div>
                    {/if}
                    <div class="directives">
                        {#each current as directiveId, index (directiveId ?? index)}
                            <DirectiveCard
                                {directiveId}
                                note={directiveId && mine
                                    ? directiveProgress(
                                          gameSession.gameState,
                                          playerId,
                                          directiveId
                                      )
                                    : undefined}
                            />
                        {/each}
                        {#if canRedrawDirective}
                            <button
                                type="button"
                                class="spend"
                                title="Give up this directive for two more to choose from, once a turn"
                                onclick={() => gameSession.redrawDirective()}
                                >Redraw · {DIRECTIVE_REDRAW_COST} IP</button
                            >
                        {/if}
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
                    {#if player.fulfilledDirectives.length > 0}
                        <div class="directives">
                            {#each player.fulfilledDirectives as entry (entry.directiveId)}
                                <DirectiveCard
                                    directiveId={entry.directiveId}
                                    size={92}
                                    note="Fulfilled {entry.year}"
                                />
                            {/each}
                        </div>
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
                    {#if player.cards.length > 0}
                        <div class="cards">
                            {#each player.cards as card (card.cardId)}
                                <CardFace
                                    cardId={card.cardId}
                                    compact={openCardId !== card.cardId}
                                    onclick={() => toggleCard(card.cardId)}
                                />
                            {/each}
                        </div>
                    {:else}
                        <div class="note">No cards owned</div>
                    {/if}
                    <div class="hand">
                        <span class="where">Hand</span>
                        <span class="cards">
                            {#each player.hand as card, index (card.cardId ?? index)}
                                {#if mine && card.cardId}
                                    {@const cardId = card.cardId}
                                    <CardFace
                                        {cardId}
                                        compact={openCardId !== cardId}
                                        onclick={() => toggleCard(cardId)}
                                    />
                                {:else}
                                    <CardBack deck={card.deck} level={card.level} />
                                {/if}
                            {:else}
                                <span class="note">Empty</span>
                            {/each}
                        </span>
                    </div>
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
    .directives {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 6px;
        margin-top: 4px;
    }

    .escalation {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .cards {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 6px;
    }

    .hand {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding-top: 6px;
    }

    .hand .where {
        min-width: 44px;
        padding-top: 4px;
        font-size: 13px;
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
