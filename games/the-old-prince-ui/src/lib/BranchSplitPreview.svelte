<script lang="ts">
    import BranchSplitAllocation from './BranchSplitAllocation.svelte'
    import { getCompany } from '@tabletop/18xx'
    import { TheOldPrinceMap } from '@tabletop/the-old-prince'
    import type { TheOldPrinceSession } from './session.svelte.js'
    let { session }: { session: TheOldPrinceSession } = $props()
    const state = $derived(session.financialState)
    const selection = $derived(session.splitSelection)
    const preview = $derived(session.splitPreview?.details)
    const parents = $derived(
        session.myPlayer ? session.splitModel.parents(session.myPlayer.id) : []
    )
</script>

{#if state.machineState === 'StockRound' && session.splitModel.branches().length && !session.isViewingHistory && !session.updatingVisibleState}
    <section aria-label="Branch split preview">
        <h2>Branch split</h2>
        {#if session.latestSplit?.metadata}
            <p role="status">
                {getCompany(state, session.latestSplit.parentId).name} split into {getCompany(
                    state,
                    session.latestSplit.branchId
                ).name}. Branch funding: ${session.latestSplit.metadata.childFunding}.
            </p>
        {/if}
        <div class="controls">
            <label
                >Parent company
                <select
                    aria-label="Split parent"
                    value={selection.parentId?.value ?? ''}
                    disabled={!session.canPreviewSplit}
                    onchange={(event) => session.selectSplitParent(event.currentTarget.value)}
                >
                    <option value="" disabled>Choose a parent</option>
                    {#each parents as { company, reason }}<option
                            value={company.id}
                            disabled={!!reason}>{company.name}{reason ? ` — ${reason}` : ''}</option
                        >{/each}
                </select>
            </label>
            <label
                >Branch company
                <select
                    aria-label="Split branch"
                    value={selection.branchId?.value ?? ''}
                    disabled={!session.canPreviewSplit || !selection.parentId}
                    onchange={(event) => session.selectSplitBranch(event.currentTarget.value)}
                >
                    <option value="" disabled>Choose a branch</option>
                    {#each session.splitModel.branches() as branch}<option value={branch.id}
                            >{branch.name}</option
                        >{/each}
                </select>
            </label>
            <label
                >Starting price
                <select
                    aria-label="Branch starting price"
                    value={selection.marketSpaceId?.value ?? ''}
                    disabled={!session.canPreviewSplit || !selection.branchId}
                    onchange={(event) => session.selectSplitPrice(event.currentTarget.value)}
                >
                    <option value="" disabled>Choose a price</option>
                    {#each session.splitModel.prices() as price}<option value={price.id}
                            >${price.price}</option
                        >{/each}
                </select>
            </label>
            <button
                onclick={() => session.backSplit()}
                disabled={!session.hasSplitDraft || !session.canPreviewSplit}>Back</button
            >
            <button
                onclick={() => session.undo()}
                disabled={session.busy || (!session.hasSplitDraft && !session.undoableAction)}
                >Undo</button
            >
        </div>
        {#if session.splitPreview?.reason}<p role="status">{session.splitPreview.reason}</p>{/if}
        {#if preview}
            <p class="summary">
                {getCompany(state, preview.request.parentId).name} → {getCompany(
                    state,
                    preview.request.branchId
                ).name} · Tranche {preview.trancheId} · ${preview.price} starting price
            </p>
            <table aria-label="Split share ownership">
                <thead
                    ><tr
                        ><th>Owner</th><th>Parent before</th><th>Moved to parent treasury</th><th
                            >Parent after</th
                        ><th>Branch after</th></tr
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
        margin-bottom: 20px;
        padding: 20px;
        background: #fffefa;
        border: 1px solid #b0c0b4;
        border-radius: 8px;
    }
    h2 {
        margin: 0 0 16px;
        font-size: 18px;
    }
    h3 {
        font-size: 15px;
        margin: 0 0 10px;
    }
    .controls {
        display: flex;
        align-items: flex-end;
        gap: 12px;
    }
    label {
        display: grid;
        gap: 6px;
        font-size: 12px;
    }
    select,
    button {
        border: 1px solid #aebfb4;
        border-radius: 5px;
        background: white;
        color: inherit;
        font: inherit;
        height: 38px;
    }
    select {
        padding: 8px 32px 8px 10px;
        max-width: 350px;
    }
    button {
        padding: 8px 14px;
        cursor: pointer;
    }
    :disabled {
        opacity: 0.5;
        cursor: default;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
    }
    th,
    td {
        text-align: right;
        padding: 10px;
        border-bottom: 1px solid #d7dfd7;
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
    .summary {
        margin-top: 20px;
    }
    .preview-note {
        margin-bottom: 0;
        color: #52645b;
    }
</style>
