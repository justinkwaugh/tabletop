<script lang="ts">
    import { CompanyToken, marketColors } from '@tabletop/18xx-ui'
    import BranchSplitAllocation from './BranchSplitAllocation.svelte'
    import { getCompany } from '@tabletop/18xx'
    import type { TheOldPrinceSession } from './session.svelte.js'
    let {
        session,
        showUndo = true,
        onFocusLocation
    }: {
        showUndo?: boolean
        session: TheOldPrinceSession
        onFocusLocation?: (locationId: string) => void
    } = $props()
    const gameState = $derived(session.gameState)
    const selection = $derived(session.splitSelection)
    const preview = $derived(session.splitPreview?.details)
    const parents = $derived(
        session.myPlayer
            ? session.splitModel.parents(session.myPlayer.id).filter((parent) => !parent.reason)
            : []
    )
</script>

{#if gameState.machineState === 'StockRound' && session.splitModel.branches().length && !session.isViewingHistory && !session.updatingVisibleState}
    <section class="centered-panel" aria-label="Branch split preview">
        <h2>
            {!selection.parentId
                ? 'Choose a parent company'
                : !selection.branchId
                  ? 'Choose a branch company'
                  : !selection.marketSpaceId
                    ? 'Choose a starting price'
                    : 'Branch split'}
        </h2>
        {#if selection.parentId}
            <div class="selected-companies">
                <span
                    ><CompanyToken
                        appearance={session.mapView.stations[selection.parentId.value]}
                        size={26}
                    />{getCompany(gameState, selection.parentId.value).name}</span
                >
                {#if selection.branchId}
                    <span class="arrow" aria-hidden="true">→</span>
                    <span
                        ><CompanyToken
                            appearance={session.mapView.stations[selection.branchId.value]}
                            size={26}
                        />{getCompany(gameState, selection.branchId.value).name}</span
                    >
                {/if}
                {#if preview}<span class="selected-price"
                        ><span>Par</span><strong>{preview.price}</strong></span
                    >{/if}
            </div>
        {/if}
        <div class="controls">
            {#if !selection.parentId}
                {#each parents as { company } (company.id)}
                    <button
                        class="company-choice"
                        aria-label={`Split ${company.name}`}
                        data-split-parent={company.id}
                        disabled={!session.canPreviewSplit}
                        onclick={() => session.selectSplitParent(company.id)}
                    >
                        <CompanyToken appearance={session.mapView.stations[company.id]} size={36} />
                        <span>{company.name}</span>
                    </button>
                {/each}
                {#if !parents.length}<p>No companies can split.</p>{/if}
            {:else if !selection.branchId}
                {#each session.splitModel.branches() as company (company.id)}
                    <button
                        class="company-choice"
                        aria-label={`Choose ${company.name}`}
                        data-split-branch={company.id}
                        disabled={!session.canPreviewSplit}
                        onclick={() => session.selectSplitBranch(company.id)}
                    >
                        <CompanyToken appearance={session.mapView.stations[company.id]} size={36} />
                        <span>{company.name}</span>
                    </button>
                {/each}
            {:else if !selection.marketSpaceId}
                {#each session.splitModel.prices() as price (price.id)}
                    <button
                        class="price-choice"
                        style:background={marketColors[price.color] ?? price.color}
                        aria-label={`Start branch at ${price.price}`}
                        data-split-price={price.id}
                        disabled={!session.canPreviewSplit}
                        onclick={() => session.selectSplitPrice(price.id)}
                    >
                        {price.price}
                    </button>
                {/each}
            {/if}
        </div>
        {#if showUndo}<button
                class="local-undo"
                onclick={() => session.undo()}
                disabled={session.busy || (!session.splitInProgress && !session.undoableAction)}
                >Undo</button
            >{/if}
        {#if session.splitPreview?.reason}<p role="status">{session.splitPreview.reason}</p>{/if}
        {#if preview}
            <table aria-label="Split share ownership">
                <thead>
                    <tr class="column-groups">
                        <th rowspan="2" scope="col" aria-label="Owner"></th>
                        <th scope="colgroup">Before</th>
                        <th colspan="2" scope="colgroup" class="after-divider">After</th>
                    </tr>
                    <tr class="company-columns">
                        <th scope="col" aria-label="Parent before"
                            ><span class="column-token"
                                ><CompanyToken
                                    appearance={session.mapView.stations[preview.request.parentId]}
                                    size={22}
                                /></span
                            ></th
                        >
                        <th scope="col" aria-label="Parent after" class="after-divider"
                            ><span class="column-token"
                                ><CompanyToken
                                    appearance={session.mapView.stations[preview.request.parentId]}
                                    size={22}
                                /></span
                            ></th
                        >
                        <th scope="col" aria-label="Branch after"
                            ><span class="column-token"
                                ><CompanyToken
                                    appearance={session.mapView.stations[preview.request.branchId]}
                                    size={22}
                                /></span
                            ></th
                        >
                    </tr>
                </thead>
                <tbody
                    >{#each preview.ownership as row, i (i)}<tr>
                            <th
                                >{row.reserved
                                    ? 'Reserved exchanges'
                                    : session.ownerName(row.owner)}</th
                            >
                            <td>{row.beforeShares}</td><td class="after-divider"
                                >{row.parentShares}</td
                            ><td>{row.childShares}</td>
                        </tr>{/each}</tbody
                >
            </table>
            <BranchSplitAllocation {session} {onFocusLocation} />
        {/if}
    </section>
{/if}

<style>
    section {
        padding: 4px 0;
        color: var(--rail-text, #514536);
    }
    h2 {
        margin: 0 0 10px;
        text-align: center;
        font-size: 13px;
        font-weight: 400;
    }
    .controls,
    .selected-companies {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 8px;
    }
    .selected-companies {
        margin-bottom: 12px;
        font-size: 12px;
    }
    .selected-companies span {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .arrow {
        color: var(--rail-muted, #95816a);
        font-size: 18px;
    }
    button {
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 7px;
        background: var(--rail-surface, #fffdf8);
        color: inherit;
        font: inherit;
        padding: 8px 12px;
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
        border-color: var(--rail-border, #a68c6d);
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    .company-choice {
        display: flex;
        align-items: center;
        gap: 9px;
        text-align: left;
        font-size: 13px;
        font-weight: 600;
        max-width: 240px;
    }
    .price-choice {
        min-width: 60px;
        font-size: 26px;
        font-weight: 600;
        border-color: var(--rail-shadow, #66574740);
        color: #39352f;
    }
    .price-choice:hover:not(:disabled) {
        filter: brightness(0.96);
        border-color: var(--rail-shadow, #66574780);
    }
    .local-undo {
        display: block;
        margin: 10px auto 0;
    }
    :disabled {
        opacity: 0.5;
        cursor: default;
    }
    table {
        width: auto;
        margin: 0 auto;
        border-collapse: collapse;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
    }
    th,
    td {
        text-align: right;
        padding: 4px 10px;
        border-bottom: 1px solid var(--rail-border, #e4dacd);
    }
    th:first-child {
        text-align: left;
    }
    p {
        font-size: 14px;
        line-height: 1.5;
    }
    .selected-price {
        padding: 3px 8px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 5px;
        background: var(--rail-surface, #fffdf8);
        font-variant-numeric: tabular-nums;
    }
    .selected-price > span {
        color: var(--rail-text, #786550);
        font-size: 10px;
    }
    thead th {
        font-weight: 500;
        font-size: 11px;
        line-height: 1.25;
    }
    tbody th {
        font-weight: 500;
    }
    tbody td {
        text-align: center;
    }
    .column-groups th:not(:first-child) {
        text-align: center;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        border-bottom: none;
        padding-bottom: 0;
    }
    .column-token {
        display: flex;
        justify-content: center;
    }
    .after-divider {
        border-left: 1px solid var(--rail-border, #bba995);
    }
</style>
