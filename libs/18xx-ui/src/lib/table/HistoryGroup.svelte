<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import { contrastingTextColor } from '../colors/contrastingTextColor.js'
    import './historyCard.css'
    import HistoryHeaderJump from './HistoryHeaderJump.svelte'
    import './playerTint.css'
    import type { GameAction } from '@tabletop/common'
    import type { Snippet } from 'svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        isStartOperatingRound,
        isSellFundingShares,
        sameOwner,
        isDistributeEarnings,
        isFloatCompany,
        isFinishOperatingTurn
    } from '@tabletop/18xx'
    import type { HistoryGroup } from './historyGroups.js'
    import { afterPlayerName, type HistoryDescription } from './historyDescription.js'
    import ShareCardStrip from './ShareCardStrip.svelte'
    import { shareSign, type ShareCard } from './shareCards.js'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import OperatingOrderHistory from './OperatingOrderHistory.svelte'
    import type { HistoryCash } from './historyCash.js'
    import type { HistoryOperatingOrder } from './historyOperatingOrder.js'
    import type { HistoryBankBreak } from './historyStates.js'
    import { pricedValue } from './lastAction.js'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import { historyPhaseChange, type PhaseChangePalette } from './historyPhaseChange.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import HistoryCallout from './HistoryCallout.svelte'
    import { bankBreakCallout, certificateLimitCallout } from './historyCallouts.js'
    let {
        money,
        group,
        newestFirst = false,
        onJump,
        onReturn,
        jumpDisabled = false,
        onPreviewMap,
        previewsMap,
        previewActionId,
        appearance,
        playerName,
        playerColor,
        currentController,
        describe,
        companyName,
        companyLabels,
        phasePalette,
        trainColors,
        trainName,
        orderChanges,
        stations,
        cash,
        bankBreaks = new Map(),
        shareCards = () => []
    }: {
        money: MoneyFormat
        newestFirst?: boolean
        onPreviewMap: (action: GameAction) => void
        previewsMap: (action: GameAction) => boolean
        previewActionId?: string
        cash: ReadonlyMap<string, HistoryCash>
        bankBreaks?: ReadonlyMap<string, HistoryBankBreak>
        orderChanges: ReadonlyMap<string, HistoryOperatingOrder>
        stations: Readonly<Record<string, StationAppearance>>
        trainColors: Readonly<Record<string, string>>
        trainName: (id: string) => string
        phasePalette: PhaseChangePalette
        /** Published certificate art for the shares an action traded; empty in the generic presentation. */
        shareCards?: (action: GameAction) => readonly ShareCard[]
        onJump: (index: number) => void
        onReturn?: () => void
        jumpDisabled?: boolean
        group: HistoryGroup
        appearance?: StationAppearance
        playerName: (id: string) => string
        playerColor: (id: string) => string
        currentController: (companyId: string) => string | undefined
        describe: (action: GameAction) => HistoryDescription
        companyName: (id: string) => string
        companyLabels: readonly string[]
    } = $props()
    const startingCash = $derived(
        group.kind === 'operation' && group.companyId
            ? cash.get(group.actions[0].id)?.before.get(group.companyId)
            : undefined
    )
    const endingCash = $derived(
        group.kind === 'operation' && group.companyId
            ? cash.get(group.actions.at(-1)!.id)?.after.get(group.companyId)
            : undefined
    )
    const operatingPlayerId = $derived(
        group.kind === 'operation'
            ? (group.actions.findLast(isFinishOperatingTurn)?.playerId ??
                  (group.companyId ? currentController(group.companyId) : undefined))
            : group.playerId
    )
    const operatingCompanyId = $derived(group.kind === 'operation' ? group.companyId : undefined)
    const rows = $derived(
        group.actions.map((action) => {
            const description = describe(action)
            const stockPlayerId = isFloatCompany(action) ? undefined : action.playerId
            const bankBreak = bankBreaks.get(action.id)
            const balance = cash.get(action.id)
            const delta =
                startingCash !== undefined && group.companyId && balance
                    ? (balance.after.get(group.companyId) ?? 0) -
                      (balance.before.get(group.companyId) ?? 0)
                    : 0
            return {
                action,
                ...description,
                // A company's own operation already leads with its token.
                companyToken:
                    description.companyToken === operatingCompanyId
                        ? undefined
                        : description.companyToken,
                stockPlayerId,
                callouts: [
                    ...(description.certificateLimit
                        ? [certificateLimitCallout(description.certificateLimit)]
                        : []),
                    ...(bankBreak ? [bankBreakCallout(bankBreak)] : [])
                ],
                routine: delta || bankBreak ? false : description.routine,
                phase: historyPhaseChange(action, phasePalette),
                order: orderChanges.get(action.id),
                delta,
                ledgerValue:
                    startingCash !== undefined &&
                    description.value &&
                    (!delta || isDistributeEarnings(action))
                        ? pricedValue(action, description)
                        : undefined
            }
        })
    )
    const visible = $derived(
        rows.filter((row) => !row.routine && (row.text || row.detail || row.order))
    )
</script>

<!-- The button stretches over its whole row, so the row is the click target. -->
{#snippet mapLink(action: GameAction, text: string, summary: Snippet)}
    {#if previewsMap(action)}<button
            class="map-history-link"
            aria-label={`Preview historical map: ${text}`}
            aria-pressed={previewActionId === action.id}
            onclick={() => onPreviewMap(action)}>{@render summary()}</button
        >{:else}{@render summary()}{/if}
{/snippet}

{#snippet leadToken(companyId: string | undefined)}
    {#if companyId && stations[companyId]}<span class="lead-token"
            ><CompanyToken appearance={stations[companyId]} size={23} /></span
        >{/if}
{/snippet}

<article
    hidden={!visible.length}
    class:stock={group.kind === 'turn' || group.kind === 'passes'}
    class:order-start={group.actions.some(isStartOperatingRound)}
    class:operation={group.kind === 'operation'}
    class:history-card={group.kind === 'operation'}
    aria-label={group.companyId
        ? `${group.companyId} operation history`
        : `${playerName(group.playerId ?? '')} turn history`}
>
    {#if group.kind === 'passes'}
        <div class="passes">
            {#each newestFirst ? group.actions.toReversed() : group.actions as action (action.id)}<div
                    class="history-entry stock-action"
                >
                    {#if action.playerId}<PlayerName
                            playerId={action.playerId}
                            backgroundOpacity={0.45}
                            additionalClasses="stock-player-name"
                        />{' '}{/if}passed
                </div>{/each}
        </div>
    {:else if group.kind === 'turn'}
        {#each visible as row (row.action.id)}
            <div class="stock-row">
                <div
                    class="history-entry stock-action"
                    class:previews-map={previewsMap(row.action)}
                    class:phase-change={!!row.phase}
                    class:led={!!row.companyToken}
                    style:--phase-color={row.phase?.color}
                    style:--phase-ink={row.phase
                        ? contrastingTextColor(row.phase.color)
                        : undefined}
                    class:routine={row.routine}
                >
                    {@render leadToken(row.companyToken)}
                    {#if row.stockPlayerId}<PlayerName
                            playerId={row.stockPlayerId}
                            backgroundOpacity={0.45}
                            additionalClasses="stock-player-name"
                        />{' '}{/if}
                    <span
                        >{#snippet stockSummary()}{row.stockPlayerId
                                ? afterPlayerName(row.text, companyLabels)
                                : row.text}{#if row.phase}<span class="phase-colors"
                                    >{row.phase.label}</span
                                >{/if}{#if row.value}{' '}for
                                <span class="stock-value">{row.value}</span
                                >{/if}{/snippet}{@render mapLink(
                            row.action,
                            row.text,
                            stockSummary
                        )}</span
                    >
                    {#if row.detail}<small>{row.detail}</small>{/if}
                    <ShareCardStrip cards={shareCards(row.action)} sign={shareSign(row.action)} />
                    {#if row.order}<OperatingOrderHistory
                            order={row.order}
                            {stations}
                            {companyName}
                        />{/if}
                </div>
            </div>
            {#each row.callouts as callout (callout.kind)}<HistoryCallout {callout} />{/each}
        {/each}
    {:else}
        {#if group.kind !== 'event'}<header
                class:history-card-header={group.kind === 'operation'}
                class:company-header={group.kind === 'operation'}
                class:player-tinted-header={group.kind === 'operation' && !!operatingPlayerId}
                style:--player-color={group.kind === 'operation' && operatingPlayerId
                    ? playerColor(operatingPlayerId)
                    : undefined}
            >
                <div class="history-entry heading">
                    {#if appearance}<CompanyToken {appearance} size={23} />{/if}
                    <span class="company-heading">
                        <span class="company-name">
                            <strong
                                >{(group.companyId ? companyName(group.companyId) : undefined) ??
                                    playerName(operatingPlayerId ?? '')}</strong
                            >
                            {#if group.kind === 'operation' && group.actions.at(-1)?.index !== undefined}
                                <HistoryHeaderJump
                                    {onReturn}
                                    label={`Jump to ${group.companyId ? companyName(group.companyId) : 'company'} operations in history`}
                                    disabled={jumpDisabled}
                                    onclick={() => {
                                        const index = group.actions.at(-1)?.index
                                        if (index !== undefined) onJump(index)
                                    }}
                                />
                            {/if}
                        </span>
                        {#if group.companyId}<span class="actor"
                                >{playerName(operatingPlayerId ?? '')}</span
                            >{/if}
                    </span>
                </div>
                {#if startingCash !== undefined}<span class="cash-balance"
                        ><small>Start cash</small><strong>{money(startingCash)}</strong></span
                    >{/if}
            </header>{/if}

        <div class="events">
            {#each visible as row (row.action.id)}
                {#if row.beforeText && !group.actions
                        .slice(0, group.actions.indexOf(row.action))
                        .some((earlier) => isSellFundingShares(earlier) && isSellFundingShares(row.action) && sameOwner(earlier.seller, row.action.seller))}
                    <div class="funding-obligation">{row.beforeText}</div>
                {/if}
                <div
                    class="history-entry"
                    class:previews-map={previewsMap(row.action)}
                    class:phase-change={!!row.phase}
                    style:--phase-color={row.phase?.color}
                    style:--phase-ink={row.phase
                        ? contrastingTextColor(row.phase.color)
                        : undefined}
                    class:important={row.important}
                    class:routine={row.routine}
                    class:led={!!row.companyToken}
                >
                    {@render leadToken(row.companyToken)}
                    {#if !row.omitActor && row.action.playerId && row.action.playerId !== operatingPlayerId}<small
                            >{playerName(row.action.playerId)}</small
                        >{/if}
                    <span
                        >{#snippet actionSummary()}{startingCash !== undefined
                                ? (row.ledgerText ?? row.text)
                                : row.text}{#if row.trainDefinitionIds?.length}<span
                                    class="run-trains"
                                    >{#each row.trainDefinitionIds as id, index (index)}<TrainBadge
                                            name={trainName(id)}
                                            color={trainColors[id]}
                                        />{/each}</span
                                >{/if}{#if row.phase}<span class="phase-colors"
                                    >{row.phase.label}</span
                                >{/if}{#if row.ledgerValue}<span class="ledger-note"
                                    >{row.ledgerValue}</span
                                >{/if}{/snippet}{@render mapLink(
                            row.action,
                            row.text,
                            actionSummary
                        )}</span
                    ><strong class:debit={row.delta < 0} class:credit={row.delta > 0}
                        >{startingCash !== undefined
                            ? row.delta
                                ? `${row.delta > 0 ? '+' : '−'}${money(Math.abs(row.delta))}`
                                : ''
                            : (row.value ?? '')}</strong
                    >
                    {#if row.detail}<small>{row.detail}</small>{/if}
                    <ShareCardStrip cards={shareCards(row.action)} sign={shareSign(row.action)} />
                    {#if row.order}<OperatingOrderHistory
                            order={row.order}
                            {stations}
                            {companyName}
                        />{/if}
                </div>
                {#each row.callouts as callout (callout.kind)}<HistoryCallout {callout} />{/each}
            {/each}
            {#if !visible.length}<div class="history-entry routine">No further actions</div>{/if}
        </div>
        {#if endingCash !== undefined && rows.some((row) => row.delta !== 0)}
            <footer>
                <span class="end-cash"><strong>{money(endingCash)}</strong></span>
            </footer>
        {/if}
    {/if}
</article>

<style>
    article.stock {
        margin: 0;
        padding: 0;
    }
    .stock-row {
        display: flex;
        align-items: start;
        position: relative;
        margin: 0.167em 0;
    }
    .stock-action {
        display: block;
        min-width: 0;
        overflow-wrap: anywhere;
        width: 100%;
        padding: 0.333em 0.5em;
        line-height: 1.333em;
    }
    .stock-action.led {
        display: grid;
        grid-template-columns: 1.917em minmax(0, 1fr);
        column-gap: 0.5em;
        align-items: center;
    }
    .lead-token {
        grid-row: 1 / span 2;
        display: flex;
        align-items: center;
    }
    /* Everything after a lead token, child components included, keeps to the text's column. */
    .stock-action.led > :global(:not(.lead-token)) {
        grid-column: 2;
    }
    .events .history-entry.led {
        grid-template-columns: 1.917em minmax(0, 1fr) auto;
        align-items: center;
    }
    .events .history-entry.led > :global(:not(.lead-token, span, strong)) {
        grid-column: 2 / -1;
    }
    .events .history-entry.led > span:not(.lead-token) {
        grid-column: 2;
    }
    .stock-value {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .stock-action .phase-colors {
        font-weight: 400;
    }
    .stock-action small {
        display: block;
        color: var(--rail-muted, #817565);
        font-size: 0.833em;
        line-height: 1.3em;
    }

    .passes {
        display: grid;
        gap: 0.167em;
    }
    .passes .history-entry {
        display: block;
    }
    article {
        margin: var(--history-item-gap, 0.417em) 0;
        padding: 0.25em 0.5em 0.417em;
        color: var(--rail-text, #463e35);
        font-size: 1em;
    }
    article:not(.history-card) {
        border-bottom: 1px solid var(--rail-shadow, #b9ac994f);
    }
    article.stock:not(.history-card) {
        border-bottom: 0;
    }
    article.order-start {
        border-bottom: 0;
    }
    .order-start .events .history-entry {
        row-gap: 0.5em;
    }
    header {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.333em;
        min-height: 2em;
    }
    .company-header {
        margin: -0.25em -0.5em 0.417em;
    }
    .history-entry {
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
    }
    .heading {
        display: flex;
        align-items: center;
        gap: 0.5em;
        flex: 1;
        min-width: 0;
        padding: 0;
    }
    .heading > :global(svg),
    .lead-token :global(svg) {
        flex: none;
        width: 1.917em;
        height: 1.917em;
    }
    strong {
        font-weight: 600;
    }
    .company-name {
        display: flex;
        align-items: center;
        gap: 0.167em;
    }
    .company-heading {
        display: flex;
        flex-direction: column;
        gap: 0;
        line-height: 1.167em;
    }
    .actor {
        font-size: 0.833em;
        color: var(--rail-muted, #817565);
    }
    .events {
        margin-top: 0.167em;
    }
    .events .history-entry {
        width: 100%;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        column-gap: 0.5em;
        padding: 0.167em 0;
        line-height: 1.333em;
    }
    .events strong {
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .events small {
        grid-column: 1 / -1;
        color: var(--rail-muted, #817565);
        font-size: 0.833em;
        line-height: 1.4em;
    }
    .history-entry.phase-change {
        --rail-text: light-dark(#302c27, var(--phase-ink));
        --rail-muted: light-dark(#817565, var(--phase-ink));
        margin: 0.25em 0;
        padding: 0.333em 0.5em;
        border-left: 4px solid var(--phase-color);
        border-radius: 3px;
        background: color-mix(
            in srgb,
            var(--phase-color) var(--rail-phase-tint, 32%),
            var(--rail-surface, #f7f5f0)
        );
        color: var(--rail-text, #302c27);
    }
    .phase-colors {
        display: inline-block;
        margin-left: 0.7em;
        font-size: 0.833em;
        font-weight: 500;
        text-transform: none;
    }
    .previews-map {
        position: relative;
        border-radius: 4px;
    }
    .previews-map:has(.map-history-link:hover),
    .previews-map:has(.map-history-link[aria-pressed='true']) {
        background: var(--rail-hover, #ffffff66);
    }
    .previews-map:has(.map-history-link:focus-visible) {
        outline: 2px solid #865320;
        outline-offset: 2px;
    }
    .map-history-link {
        border: 0;
        padding: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .map-history-link::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 4px;
    }
    .map-history-link:focus-visible {
        outline: none;
    }
    .run-trains {
        --train-badge-font: 1em;
        display: inline-flex;
        gap: 0.25em;
        margin-left: 0.417em;
        vertical-align: baseline;
    }
    .funding-obligation {
        padding: 0.167em 0;
        line-height: 1.333em;
        font-weight: 600;
    }
    .cash-balance {
        display: flex;
        flex-direction: column;
        text-align: right;
        line-height: 1.167em;
    }
    .cash-balance small {
        font-size: 0.833em;
        color: var(--rail-muted, #817565);
    }
    .ledger-note {
        margin-left: 0.455em;
        font-size: 0.917em;
    }
    .events strong.debit {
        color: var(--rail-negative, #aa352e);
    }
    .events strong.credit {
        color: var(--rail-text, #181818);
    }
    footer {
        display: flex;
        align-items: center;
        gap: 0.667em;
        margin-top: 0.333em;
    }
    .end-cash {
        display: flex;
        gap: 1em;
        flex: 1;
        justify-content: flex-end;
        padding-top: 0.25em;
    }
    .end-cash strong {
        min-width: 4em;
        text-align: right;
        border-top: 1px solid var(--rail-shadow, #b9ac9970);
        padding-top: 0.25em;
    }
    .cash-balance strong,
    .end-cash strong {
        font-variant-numeric: tabular-nums;
    }
    .routine {
        color: var(--rail-muted, #918575);
        font-size: 0.917em;
    }
    .important > span {
        font-weight: 600;
    }
</style>
