<script lang="ts">
    import { assertExists, type GameAction } from '@tabletop/common'
    import { isAdvancePhase, isSellFundingShares, sameOwner, isDistributeEarnings } from '@tabletop/18xx'
    import { TileColors } from '../tiles/tilePresentation.js'
    import type { HistoryGroup } from './historyGroups.js'
    import type { HistoryDescription } from './historyDescription.js'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import OperatingOrderHistory from './OperatingOrderHistory.svelte'
    import type { HistoryCash } from './historyCash.js'
    import type { HistoryOperatingOrder } from './historyOperatingOrder.js'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    let {
        group,
        appearance,
        playerName,
        describe,
        disabled,
        onSelect,
        lastOwnActionId,
        companyName,
        phaseColors,
        phaseTileColors,
        trainColors,
        trainName,
        orderChanges,
        stations,
        cash
    }: {
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
        disabled: boolean
        onSelect: (action: GameAction) => void
        lastOwnActionId?: string
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
    const last = $derived(group.actions.at(-1)!)
</script>

<article
    hidden={!visible.length}
    class:stock={group.kind === 'turn'}
    class:operation={group.kind === 'operation'}
    aria-label={group.companyId
        ? `${group.companyId} operation history`
        : `${playerName(group.playerId ?? '')} turn history`}
>
    {#if group.kind === 'passes'}
        <div class="passes">
            {#each group.actions as action (action.id)}<button
                    {disabled}
                    onclick={() => onSelect(action)}
                    >{playerName(action.playerId ?? '')} <span>passed</span></button
                >{/each}
        </div>
    {:else if group.kind === 'turn'}
        {#each visible as row, index (row.action.id)}
            <div class="stock-row">
                <button
                    class="stock-action"
                    class:phase-change={!!row.phase}
                    style:--phase-color={row.phase?.color}
                    class:important={row.important}
                    class:routine={row.routine}
                    disabled={disabled || row.action.index === undefined}
                    onclick={() => onSelect(row.action)}
                >
                    <span class="stock-player"
                        >{index === 0 ? playerName(group.playerId ?? '') : ''}</span
                    >
                    <span
                        >{row.text}{#if row.phase}<span class="phase-colors">{row.phase.label}</span>{/if}{#if row.value}
                            for <strong>{row.value}</strong>{/if}</span
                    >
                    {#if row.detail}<small>{row.detail}</small>{/if}
                    {#if row.order}<OperatingOrderHistory order={row.order} {stations} {companyName} />{/if}
                </button>
            </div>
        {/each}
    {:else}
        <header class:company-header={group.kind === 'operation'}>
            <button
                class="heading"
                disabled={disabled || last.index === undefined}
                onclick={() => onSelect(last)}
            >
                {#if appearance}<CompanyToken {appearance} size={23} />{/if}
                <span class="company-heading">
                <strong
                    >{(group.companyId ? companyName(group.companyId) : undefined) ??
                        (group.kind === 'event'
                            ? 'Game'
                            : playerName(group.playerId ?? ''))}</strong
                >
                {#if group.companyId}<span class="actor">{playerName(group.playerId ?? '')}</span
                    >{/if}
                </span>
            </button>
            {#if startingCash !== undefined}<span class="cash-balance"><small>Start cash</small><strong>{money(startingCash)}</strong></span>{/if}
        </header>
        {#if group.actions.some((action) => action.id === lastOwnActionId)}<div class="last-own">
                Your last action
            </div>{/if}
        <div class="events">
            {#each visible as row (row.action.id)}
                {#if row.beforeText && !group.actions.slice(0, group.actions.indexOf(row.action)).some((earlier) => isSellFundingShares(earlier) && isSellFundingShares(row.action) && sameOwner(earlier.seller, row.action.seller))}
                    <div class="funding-obligation">{row.beforeText}</div>
                {/if}
                <button
                    class:phase-change={!!row.phase}
                    style:--phase-color={row.phase?.color}
                    class:important={row.important}
                    class:routine={row.routine}
                    disabled={disabled || row.action.index === undefined}
                    onclick={() => onSelect(row.action)}
                >
                    {#if row.action.playerId && row.action.playerId !== group.playerId}<small
                            >{playerName(row.action.playerId)}</small
                        >{/if}
                    <span>{startingCash !== undefined ? row.ledgerText ?? row.text : row.text}{#if row.trainDefinitionIds?.length}<span class="run-trains">{#each row.trainDefinitionIds as id}<TrainBadge name={trainName(id)} color={trainColors[id]} />{/each}</span>{/if}{#if row.phase}<span class="phase-colors">{row.phase.label}</span>{/if}{#if row.ledgerValue}<span class="ledger-note">{row.ledgerValue}</span>{/if}</span><strong class:debit={row.delta < 0} class:credit={row.delta > 0}>{startingCash !== undefined ? row.delta ? `${row.delta > 0 ? '+' : '−'}${money(Math.abs(row.delta))}` : '' : row.value ?? ''}</strong>
                    {#if row.detail}<small>{row.detail}</small>{/if}
                    {#if row.order}<OperatingOrderHistory order={row.order} {stations} {companyName} />{/if}
                </button>
            {/each}
            {#if !visible.length}<button class="routine" {disabled} onclick={() => onSelect(last)}
                    >No further actions</button
                >{/if}
        </div>
        <footer>
            {#if endingCash !== undefined}<span class="end-cash"><span>End cash</span><strong>{money(endingCash)}</strong></span>{/if}
        </footer>
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
        display: grid;
        grid-template-columns: 55px minmax(0, 1fr);
        column-gap: 5px;
        width: 100%;
        padding: 2px 0;
        line-height: 16px;
    }
    .stock-player {
        font-size: 11px;
        color: #817565;
    }
    .stock-action strong {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .stock-action small {
        grid-column: 2 / -1;
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
    .passes button {
        padding: 1px 0;
    }
    article {
        margin: 5px 0;
        padding: 3px 6px 5px;
        border-bottom: 1px solid #b9ac994f;
        color: #463e35;
        font-size: 12px;
    }
    article.operation { border-bottom: 0; }
    header {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 24px;
    }
    .company-header {
        background: #d9cdbc;
        margin: -3px -6px 5px;
        padding: 5px 6px;
        border-radius: 3px 3px 0 0;
    }
    button {
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
        text-align: left;
    }
    button:hover:not(:disabled) {
        background: #ffffff65;
        border-radius: 3px;
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: -2px;
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
    .events button {
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
    button.phase-change {
        margin: 3px 0;
        padding: 4px 6px;
        border-left: 4px solid var(--phase-color);
        border-radius: 3px;
        background: color-mix(in srgb, var(--phase-color) 32%, #f7f5f0);
        color: #302c27;
    }
    button.phase-change:hover:not(:disabled) {
        background: color-mix(in srgb, var(--phase-color) 42%, #f7f5f0);
    }
    .phase-colors {
        display: inline-block;
        margin-left: 7px;
        font-size: 10px;
        font-weight: 500;
        text-transform: none;
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
    .end-cash > span { padding-top: 4px; }
    .cash-balance strong, .end-cash strong { font-variant-numeric: tabular-nums; }
    .routine {
        color: #918575;
        font-size: 11px;
    }
    .important > span {
        font-weight: 600;
    }
    .last-own {
        color: #8b6035;
        border-top: 1px solid #b79a75;
        font-size: 10px;
        margin-top: 3px;
    }
</style>
