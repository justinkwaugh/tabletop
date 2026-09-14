<script lang="ts">
    import './historyCard.css'
    import { assertExists, type GameAction } from '@tabletop/common'
    import { isAdvancePhase, isStartOperatingRound, isSellFundingShares, sameOwner, isDistributeEarnings } from '@tabletop/18xx'
    import { TileColors } from '../tiles/tilePresentation.js'
    import type { HistoryGroup } from './historyGroups.js'
    import type { HistoryDescription } from './historyDescription.js'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import OperatingOrderHistory from './OperatingOrderHistory.svelte'
    import type { HistoryCash } from './historyCash.js'
    import type { HistoryOperatingOrder } from './historyOperatingOrder.js'
    import { isMapHistoryAction } from '../maps/historicalMap.js'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    let {
        group,
        onPreviewMap,
        previewActionId,
        appearance,
        playerName,
        describe,
        companyName,
        phaseColors,
        phaseTileColors,
        trainColors,
        trainName,
        orderChanges,
        stations,
        cash
    }: {
        onPreviewMap: (action: GameAction) => void
        previewActionId?: string
        cash: ReadonlyMap<string, HistoryCash>
        orderChanges: ReadonlyMap<string, HistoryOperatingOrder>
        stations: Readonly<Record<string, StationAppearance>>
        trainColors: Readonly<Record<string, string>>
        trainName: (id: string) => string
        phaseColors: Readonly<Record<string, string>>
        phaseTileColors: Readonly<Record<string, readonly string[]>>
        group: HistoryGroup
        appearance?: StationAppearance
        playerName: (id: string) => string
        describe: (action: GameAction) => HistoryDescription
        companyName: (id: string) => string
    } = $props()
    function phaseChange(action: GameAction) {
        if (!isAdvancePhase(action)) return undefined
        assertExists(action.metadata, 'Recorded phase change requires its event')
        const { fromPhaseId, toPhaseId } = action.metadata.event
        const previous = phaseColors[fromPhaseId]
        const next = phaseColors[toPhaseId]
        const previousTiles = phaseTileColors[fromPhaseId]
        const nextTiles = phaseTileColors[toPhaseId]
        assertExists(previousTiles, `Unknown tile phase: ${fromPhaseId}`)
        assertExists(nextTiles, `Unknown tile phase: ${toPhaseId}`)
        const unlocked = nextTiles.filter((color) => !previousTiles.includes(color))
        if (previous === next && !unlocked.length) return undefined
        const unlockedColor = unlocked.at(-1)
        const color = unlockedColor ? TileColors[unlockedColor] : next
        assertExists(color, `Unknown history phase color: ${toPhaseId}`)
        return { color, label: unlocked.length ? `${unlocked.join(' and ')} tiles now available` : undefined }
    }
    const startingCash = $derived(group.kind === 'operation' && group.companyId
        ? cash.get(group.actions[0].id)?.before.get(group.companyId) : undefined)
    const endingCash = $derived(group.kind === 'operation' && group.companyId
        ? cash.get(group.actions.at(-1)!.id)?.after.get(group.companyId) : undefined)
    function money(amount: number) { return `$${amount.toLocaleString('en-US')}` }
    const rows = $derived(group.actions.map((action) => {
        const description = describe(action)
        const balance = cash.get(action.id)
        const delta = startingCash !== undefined && group.companyId && balance
            ? (balance.after.get(group.companyId) ?? 0) - (balance.before.get(group.companyId) ?? 0)
            : 0
        return { action, ...description, routine: delta ? false : description.routine,
            phase: phaseChange(action), order: orderChanges.get(action.id), delta,
            ledgerValue: startingCash !== undefined && description.value && (!delta || isDistributeEarnings(action)) ? description.value : undefined }
    }))
    const visible = $derived(rows.filter((row) => !row.routine))
</script>

<article
    hidden={!visible.length}
    class:stock={group.kind === 'turn'}
    class:order-start={group.actions.some(isStartOperatingRound)}
    class:operation={group.kind === 'operation'}
    class:history-card={group.kind === 'operation'}
    aria-label={group.companyId
        ? `${group.companyId} operation history`
        : `${playerName(group.playerId ?? '')} turn history`}
>
    {#if group.kind === 'passes'}
        <div class="passes">
            {#each group.actions as action (action.id)}<div class="history-entry"
                    >{playerName(action.playerId ?? '')} <span>passed</span></div
                >{/each}
        </div>
    {:else if group.kind === 'turn'}
        {#each visible as row, index (row.action.id)}
            <div class="stock-row">
                <div
                    class="history-entry stock-action"
                    class:phase-change={!!row.phase}
                    style:--phase-color={row.phase?.color}
                    class:important={row.important}
                    class:routine={row.routine}
                >
                    {#if index === 0}<span class="stock-player">{playerName(group.playerId ?? '')}:</span>{' '}{/if}
                    <span
                        >{row.text}{#if row.phase}<span class="phase-colors">{row.phase.label}</span>{/if}{#if row.value}
                            for <strong>{row.value}</strong>{/if}</span
                    >
                    {#if row.detail}<small>{row.detail}</small>{/if}
                    {#if row.order}<OperatingOrderHistory order={row.order} {stations} {companyName} />{/if}
                </div>
            </div>
        {/each}
    {:else}
        {#if group.kind !== 'event'}<header class:history-card-header={group.kind === 'operation'} class:company-header={group.kind === 'operation'}>
            <div
                class="history-entry heading"
            >
                {#if appearance}<CompanyToken {appearance} size={23} />{/if}
                <span class="company-heading">
                <strong
                    >{(group.companyId ? companyName(group.companyId) : undefined) ??
                        playerName(group.playerId ?? '')}</strong
                >
                {#if group.companyId}<span class="actor">{playerName(group.playerId ?? '')}</span
                    >{/if}
                </span>
            </div>
            {#if startingCash !== undefined}<span class="cash-balance"><small>Start cash</small><strong>{money(startingCash)}</strong></span>{/if}
        </header>{/if}

        <div class="events">
            {#each visible as row (row.action.id)}
                {#if row.beforeText && !group.actions.slice(0, group.actions.indexOf(row.action)).some((earlier) => isSellFundingShares(earlier) && isSellFundingShares(row.action) && sameOwner(earlier.seller, row.action.seller))}
                    <div class="funding-obligation">{row.beforeText}</div>
                {/if}
                <div class="history-entry"
                    class:phase-change={!!row.phase}
                    style:--phase-color={row.phase?.color}
                    class:important={row.important}
                    class:routine={row.routine}
                >
                    {#if !row.omitActor && row.action.playerId && row.action.playerId !== group.playerId}<small
                            >{playerName(row.action.playerId)}</small
                        >{/if}
                    <span>{#snippet actionSummary()}{startingCash !== undefined ? row.ledgerText ?? row.text : row.text}{#if row.trainDefinitionIds?.length}<span class="run-trains">{#each row.trainDefinitionIds as id}<TrainBadge name={trainName(id)} color={trainColors[id]} />{/each}</span>{/if}{/snippet}
                    {#if isMapHistoryAction(row.action)}<button
                        class="map-history-link"
                        aria-label={`Preview historical map: ${row.text}`}
                        aria-pressed={previewActionId === row.action.id}
                        onclick={() => onPreviewMap(row.action)}
                    >{@render actionSummary()}</button>{:else}{@render actionSummary()}{/if}{#if row.phase}<span class="phase-colors">{row.phase.label}</span>{/if}{#if row.ledgerValue}<span class="ledger-note">{row.ledgerValue}</span>{/if}</span><strong class:debit={row.delta < 0} class:credit={row.delta > 0}>{startingCash !== undefined ? row.delta ? `${row.delta > 0 ? '+' : '−'}${money(Math.abs(row.delta))}` : '' : row.value ?? ''}</strong>
                    {#if row.detail}<small>{row.detail}</small>{/if}
                    {#if row.order}<OperatingOrderHistory order={row.order} {stations} {companyName} />{/if}
                </div>
            {/each}
            {#if !visible.length}<div class="history-entry routine"
                    >No further actions</div
                >{/if}
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
        margin: 1px 0;
        padding: 2px 4px;
    }
    .stock-row {
        display: flex;
        align-items: start;
        position: relative;
    }
    .stock-action {
        display: block;
        min-width: 0;
        overflow-wrap: anywhere;
        width: 100%;
        padding: 2px 0;
        line-height: 16px;
    }
    .stock-player {
        font-weight: 600;
        color: #817565;
    }
    .stock-action strong {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .stock-action small {
        display: block;
        color: #817565;
        font-size: 10px;
        line-height: 13px;
    }

    .passes {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 3px 8px;
        font-size: 11px;
    }
    .passes span {
        color: #8a7c6b;
    }
    .passes .history-entry {
        padding: 1px 0;
    }
    article {
        margin: var(--history-item-gap, 5px) 0;
        padding: 3px 6px 5px;
        color: #463e35;
        font-size: 12px;
    }
    article:not(.history-card) { border-bottom: 1px solid #b9ac994f; }
    article.order-start { border-bottom: 0; }
    .order-start .events .history-entry {
        row-gap: 6px;
    }
    header {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 24px;
    }
    .company-header {
        margin: -3px -6px 5px;
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
        gap: 6px;
        flex: 1;
        min-width: 0;
        padding: 0;
    }
    strong {
        font-weight: 600;
    }
    .company-heading { display: flex; flex-direction: column; gap: 0; line-height: 14px; }
    .actor {
        font-size: 10px;
        color: #817565;
    }
    .events {
        margin-top: 2px;
    }
    .events .history-entry {
        width: 100%;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        column-gap: 6px;
        padding: 2px 0;
        line-height: 16px;
    }
    .events strong {
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .events small {
        grid-column: 1 / -1;
        color: #817565;
        font-size: 10px;
        line-height: 14px;
    }
    .history-entry.phase-change {
        margin: 3px 0;
        padding: 4px 6px;
        border-left: 4px solid var(--phase-color);
        border-radius: 3px;
        background: color-mix(in srgb, var(--phase-color) 32%, #f7f5f0);
        color: #302c27;
    }
    .phase-colors {
        display: inline-block;
        margin-left: 7px;
        font-size: 10px;
        font-weight: 500;
        text-transform: none;
    }
    .map-history-link {
        border: 0;
        padding: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        border-radius: 4px;
    }
    .map-history-link:hover, .map-history-link[aria-pressed='true'] {
        background: #ffffff66;
    }
    .map-history-link:focus-visible {
        outline: 2px solid #865320;
        outline-offset: 2px;
    }
    .run-trains { display: inline-flex; gap: 3px; margin-left: 5px; vertical-align: baseline; }
    .funding-obligation { padding: 2px 0; line-height: 16px; font-weight: 600; }
    .cash-balance { display: flex; flex-direction: column; text-align: right; line-height: 14px; }
    .cash-balance small { font-size: 10px; color: #817565; }
    .ledger-note { margin-left: 5px; font-size: 11px; }
    .events strong.debit { color: #aa352e; }
    .events strong.credit { color: #181818; }
    footer { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
    .end-cash { display: flex; gap: 12px; flex: 1; justify-content: flex-end; padding-top: 3px; }
    .end-cash strong { min-width: 48px; text-align: right; border-top: 1px solid #b9ac9970; padding-top: 3px; }
    .cash-balance strong, .end-cash strong { font-variant-numeric: tabular-nums; }
    .routine {
        color: #918575;
        font-size: 11px;
    }
    .important > span {
        font-weight: 600;
    }

</style>
