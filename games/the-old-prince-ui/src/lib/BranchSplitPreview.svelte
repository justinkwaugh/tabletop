<script lang="ts">
    import { CompanyToken } from '@tabletop/18xx-ui'
    import BranchSplitAllocation from './BranchSplitAllocation.svelte'
    import { getCompany } from '@tabletop/18xx'
    import { TheOldPrinceMap } from '@tabletop/the-old-prince'
    import type { TheOldPrinceSession } from './session.svelte.js'
    let { session, showUndo = true }: { showUndo?: boolean; session: TheOldPrinceSession } =
        $props()
    const state = $derived(session.financialState)
    const selection = $derived(session.splitSelection)
    const preview = $derived(session.splitPreview?.details)
    const parents = $derived(
        session.myPlayer ? session.splitModel.parents(session.myPlayer.id).filter((parent) => !parent.reason) : []
    )
</script>

{#if state.machineState === 'StockRound' && session.splitModel.branches().length && !session.isViewingHistory && !session.updatingVisibleState}
    <section aria-label="Branch split preview">
        <h2>{!selection.parentId ? 'Choose a parent company' : !selection.branchId ? 'Choose a branch company' : !selection.marketSpaceId ? 'Choose a starting price' : 'Branch split'}</h2>
        {#if selection.parentId}
            <div class="selected-companies">
                <span><CompanyToken appearance={session.mapView.stations[selection.parentId.value]} size={26} />{getCompany(state, selection.parentId.value).name}</span>
                {#if selection.branchId}
                    <span class="arrow" aria-hidden="true">→</span>
                    <span><CompanyToken appearance={session.mapView.stations[selection.branchId.value]} size={26} />{getCompany(state, selection.branchId.value).name}</span>
                {/if}
                {#if preview}<span class="selected-price"><span>Par</span><strong>{preview.price}</strong></span>{/if}
            </div>
        {/if}
        <div class="controls">
            {#if !selection.parentId}
                {#each parents as { company }}
                    <button class="company-choice" aria-label={`Split ${company.name}`} data-split-parent={company.id}
                        disabled={!session.canPreviewSplit} onclick={() => session.selectSplitParent(company.id)}>
                        <CompanyToken appearance={session.mapView.stations[company.id]} size={36} />
                        <span>{company.name}</span>
                    </button>
                {/each}
                {#if !parents.length}<p>No companies can split.</p>{/if}
            {:else if !selection.branchId}
                {#each session.splitModel.branches() as company}
                    <button class="company-choice" aria-label={`Choose ${company.name}`} data-split-branch={company.id}
                        disabled={!session.canPreviewSplit} onclick={() => session.selectSplitBranch(company.id)}>
                        <CompanyToken appearance={session.mapView.stations[company.id]} size={36} />
                        <span>{company.name}</span>
                    </button>
                {/each}
            {:else if !selection.marketSpaceId}
                {#each session.splitModel.prices() as price}
                    <button class="price-choice" aria-label={`Start branch at ${price.price}`} data-split-price={price.id}
                        disabled={!session.canPreviewSplit} onclick={() => session.selectSplitPrice(price.id)}>
                        {price.price}
                    </button>
                {/each}
            {/if}
        </div>
        {#if showUndo}<button class="local-undo"
            onclick={() => session.undo()}
            disabled={session.busy || (!session.hasSplitDraft && !session.undoableAction)}>Undo</button>{/if}
        {#if session.splitPreview?.reason}<p role="status">{session.splitPreview.reason}</p>{/if}
        {#if preview}
            <table aria-label="Split share ownership">
                <thead
                    ><tr
                        ><th>Owner</th><th>Parent<br />before</th><th>To parent<br />treasury</th><th>Parent<br />after</th><th>Branch<br />after</th></tr
                    ></thead
                >
                <tbody
                    >{#each preview.ownership as row}<tr>
                            <th
                                >{row.reserved
                                    ? 'Reserved exchanges'
                                    : session.ownerName(row.owner)}</th
                            >
                            <td>{row.beforeShares * 10}%</td><td>{row.exchangedShares * 10}%</td><td
                                >{row.parentShares * 10}%</td
                            ><td>{row.childShares * 10}%</td>
                        </tr>{/each}</tbody
                >
            </table>
            <p>
                {session.getPlayerName(preview.request.playerId)} retains the parent’s president certificate
                and receives the branch’s president certificate.
            </p>
            <div class="assets">
                <article aria-label="Branch funding">
                    <h3>Branch funding</h3>
                    <p>
                        {preview.childBankShares} shares in the Bank × ${preview.price} =
                        <strong>${preview.childFunding}</strong> from the Bank.
                    </p>
                    <p>
                        {preview.childFloated
                            ? 'Floated.'
                            : `${preview.sharesUntilFlotation} more shares must leave the Bank before flotation.`}
                    </p>
                    <p>This grant is paid on splitting; flotation gives no second grant.</p>
                </article>
                <article aria-label="Assets available to divide">
                    <h3>Assets available to divide</h3>
                    <p>Parent cash: ${preview.parentCash}</p>
                    <p>
                        Trains: {preview.parentTrains
                            .map((train) => train.definitionId)
                            .join(', ') || 'None'}
                    </p>
                    <p>
                        Hunslet Steam Engine: {preview.hunsletCertificateId
                            ? 'Available'
                            : 'Not owned by the parent'}
                    </p>
                    <ul>
                        {#each preview.stations as { station, protectedHome }}<li>
                                {TheOldPrinceMap.location(station.position.locationId).name ??
                                    station.position.locationId}: {protectedHome
                                    ? 'Protected parent home'
                                    : 'May become a branch station'}
                            </li>{/each}
                    </ul>
                    <p>
                        The branch must receive at least one station. Cash, trains, and Hunslet can
                        be divided when the split is committed.
                    </p>
                </article>
            </div>
            {#if !selection.allocation}
                <button
                    class="allocate"
                    onclick={() => session.beginSplitAllocation()}
                    disabled={!session.canPreviewSplit}>Allocate assets</button
                >
            {:else}
                <BranchSplitAllocation {session} />
            {/if}
            <p class="preview-note">
                No shares, cash, or stations move until you confirm the split.
            </p>
        {/if}
    </section>
{/if}

<style>
    section {
        padding: 4px 0;
        color: #514536;
    }
    h2 {
        margin: 0 0 10px;
        text-align: center;
        font-size: 13px;
        font-weight: 400;
    }
    h3 { font-size: 15px; margin: 0 0 10px; }
    .controls, .selected-companies {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 8px;
    }
    .selected-companies { margin-bottom: 12px; font-size: 12px; }
    .selected-companies span { display: flex; align-items: center; gap: 6px; }
    .arrow { color: #95816a; font-size: 18px; }
    button {
        border: 1px solid #c7b8a6;
        border-radius: 7px;
        background: #fffdf8;
        color: inherit;
        font: inherit;
        padding: 8px 12px;
        cursor: pointer;
    }
    button:hover:not(:disabled) { background: #efe7db; border-color: #a68c6d; }
    button:focus-visible { outline: 2px solid #a87948; outline-offset: 2px; }
    .company-choice {
        display: flex;
        align-items: center;
        gap: 9px;
        text-align: left;
        font-size: 13px;
        font-weight: 600;
        max-width: 240px;
    }
    .price-choice { min-width: 60px; font-size: 15px; font-weight: 600; }
    .local-undo { display: block; margin: 10px auto 0; }
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
        border-bottom: 1px solid #e4dacd;
    }
    th:first-child {
        text-align: left;
    }
    .assets {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
    }
    article {
        padding: 16px;
        background: #f0f3ed;
        border-radius: 6px;
    }
    p,
    li {
        font-size: 14px;
        line-height: 1.5;
    }
    .allocate {
        margin-top: 16px;
    }
    .selected-price {
        padding: 3px 8px;
        border: 1px solid #c7b8a6;
        border-radius: 5px;
        background: #fffdf8;
        font-variant-numeric: tabular-nums;
    }
    .selected-price > span { color: #786550; font-size: 10px; }
    thead th { font-weight: 500; font-size: 11px; line-height: 1.25; }
    tbody th { font-weight: 500; }
    .preview-note {
        margin-bottom: 0;
        color: #52645b;
    }
</style>
