<script lang="ts">
    import { CompanyToken, PresidentBadge } from '@tabletop/18xx-ui'
    import type { MergerPreview, PreviewSingle } from '@tabletop/1828'
    import type { Session1828 } from './session.svelte.js'
    let { session, preview }: { session: Session1828; preview: MergerPreview } = $props()
    const money = $derived(session.presentation.money)
    const terms = $derived(session.terms)
    const singleShown = $derived(preview.rows.some((row) => row.single))

    // Each part stays whole, so a narrow panel breaks the choice between its two halves.
    function singleParts(single: PreviewSingle): string[] {
        const up = money(preview.systemPrice - single.price)
        const sale = money(single.price)
        if (!single.chosen) return [`Must sell ${sale}`]
        if (!single.decided) {
            if (!single.canSell) return ['Must trade up', up]
            if (!single.canTradeUp) return [`Must sell ${sale}`]
            return [`Trade up ${up}`, `or sell ${sale}`]
        }
        return [single.tradeUp ? `Traded up ${up}` : `Sold ${sale}`]
    }
</script>

<div class="outcome">
    <table aria-label="Merger outcome">
        <thead>
            <tr>
                <td></td>
                {#each preview.companies as { companyId } (companyId)}
                    <th scope="col">
                        <span class="company"
                            ><CompanyToken
                                appearance={session.mapView.stations[companyId]}
                                size={18}
                            />{session.companyInitials(companyId)}</span
                        >
                    </th>
                {/each}
                <th scope="col" class="system">System</th>
                {#if singleShown}<th scope="col" class="single">Single share</th>{/if}
            </tr>
        </thead>
        <tbody>
            <tr class="prices">
                <th scope="row">Stock price</th>
                {#each preview.companies as { companyId, price } (companyId)}
                    <td>{money(price)}</td>
                {/each}
                <td class="system">{money(preview.systemPrice)}</td>
                {#if singleShown}<td></td>{/if}
            </tr>
            {#each preview.rows as row (row.key)}
                <tr>
                    <th scope="row"
                        >{row.playerId ? session.getPlayerName(row.playerId) : row.label}</th
                    >
                    <td>{row.held[0] || ''}</td>
                    <td>{row.held[1] || ''}</td>
                    <td class="system"
                        >{row.shares}{#if row.director}<PresidentBadge
                                label={terms.presidentMark}
                                title={terms.president}
                            />{/if}</td
                    >
                    {#if singleShown}
                        <td class="single">
                            {#if row.single}
                                {#each singleParts(row.single) as part (part)}
                                    <span>{part}</span>{' '}
                                {/each}
                            {/if}
                        </td>
                    {/if}
                </tr>
            {/each}
        </tbody>
    </table>
    {#each preview.failsIfSoldBy as playerId (playerId)}
        <p class="warning">Fails if {session.getPlayerName(playerId)} sells.</p>
    {/each}
    {#if preview.assumesTradeUp}<p class="note">Assumes single shares are traded up.</p>{/if}
</div>

<style>
    .outcome {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        width: 100%;
        container-type: inline-size;
        font-size: 12px;
        color: var(--rail-text, #514536);
    }
    table {
        border-collapse: collapse;
        font-variant-numeric: tabular-nums;
    }
    th,
    td {
        padding: 3px 8px;
        text-align: center;
        font-weight: 400;
    }
    thead th {
        color: var(--rail-muted, #887969);
        font-size: 11px;
        font-weight: 600;
        vertical-align: middle;
    }
    tbody th {
        color: var(--rail-text, #514536);
        text-align: left;
        white-space: nowrap;
    }
    tbody tr {
        border-top: 1px solid var(--rail-border, #c7b8a6);
    }
    .company {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
    }
    .prices th,
    .prices td {
        color: var(--rail-muted, #887969);
    }
    .system {
        font-weight: 700;
        white-space: nowrap;
    }
    thead .system {
        font-weight: 600;
    }
    .prices .system {
        color: var(--rail-text, #514536);
    }
    .single {
        text-align: left;
    }
    .single span {
        white-space: nowrap;
    }
    @container (max-width: 420px) {
        table {
            font-size: 11px;
        }
        th,
        td {
            padding: 3px;
        }
        .company {
            gap: 2px;
        }
    }
    p {
        margin: 0;
    }
    .warning {
        color: var(--rail-negative, #b33a32);
        font-weight: 600;
    }
    .note {
        color: var(--rail-muted, #887969);
        font-size: 11px;
    }
</style>
