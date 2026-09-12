<script lang="ts">
    import {
        getCompany,
        certificatesOwnedBy,
        certificatesInPool,
        sameOwner,
        type Cash,
        type Certificate,
        type Owner,
        type FinancialState
    } from '@tabletop/18xx'
    import type { Portfolio as PortfolioModel } from '@tabletop/18xx'
    import type { Snippet } from 'svelte'
    let {
        state,
        owner,
        name,
        cash,
        color,
        label = 'portfolio',
        compact = false,
        certificateDetail,
        certificateWeight = (certificate) => certificate.certificateLimitCount
    }: {
        state: FinancialState
        owner: Owner
        name: string
        cash?: Cash['amount']
        color?: string
        compact?: boolean
        label?: string
        certificateDetail?: Snippet<[Certificate]>
        certificateWeight?: (certificate: PortfolioModel[number]) => number
    } = $props()
    const certificates = $derived(certificatesOwnedBy(state, owner))
    const groups = $derived([
        {
            id: undefined,
            name: undefined,
            certificates: certificates.filter((certificate) => certificate.poolId === undefined)
        },
        ...state.certificatePools
            .filter((pool) => sameOwner(pool.owner, owner))
            .map((pool) => ({
                id: pool.id,
                name: pool.name,
                certificates: certificatesInPool(state, pool.id)
            }))
    ])
    function interest(certificate: Certificate): string {
        if (certificate.kind === 'private') return 'Private'
        const shareCount = getCompany(state, certificate.companyId).shareCount
        const percentage =
            shareCount === undefined ? '' : `${(certificate.shares / shareCount) * 100}% · `
        const number = certificate.number === undefined ? '' : ` · No. ${certificate.number}`
        return `${percentage}${certificate.shares} ${certificate.shares === 1 ? 'share' : 'shares'}${number}`
    }
</script>

{#snippet holdings()}
    {#each groups as group (group.id)}
        {#if group.name || group.certificates.length}
            <div data-pool-id={group.id}>
                {#if group.name}<h4>{group.name}</h4>{/if}
                {#if group.certificates.length}
                    <ul>
                        {#each group.certificates as certificate (certificate.id)}
                            <li data-certificate-id={certificate.id}>
                                <div class="issuer">
                                    {getCompany(state, certificate.companyId).name}
                                    {#if certificate.kind === 'share' && certificate.president}<span
                                            class="badge">President’s certificate</span
                                        >{/if}
                                </div>
                                <div class="details">
                                    <span>{interest(certificate)}</span><span
                                        >Counts as {certificateWeight(certificate)}</span
                                    >
                                </div>
                                {#if certificateDetail}{@render certificateDetail(certificate)}{/if}
                            </li>
                        {/each}
                    </ul>
                {:else}<p class="empty">No certificates</p>{/if}
            </div>
        {/if}
    {/each}
    {#if !certificates.length && groups.length === 1}<p class="empty">No certificates</p>{/if}
{/snippet}

<article aria-label={`${name} ${label}`} style:border-top-color={color ?? '#45685e'}>
    <header>
        <h3>{name}</h3>
        {#if cash !== undefined}<span class="cash"
                >{cash === 'unlimited' ? 'Unlimited bank funds' : `Cash ${cash}`}</span
            >{/if}
    </header>
    {#if compact}
        <details>
            <summary
                >{certificates.length}
                {certificates.length === 1 ? 'certificate' : 'certificates'} · Limit count {certificates.reduce(
                    (sum, certificate) => sum + certificateWeight(certificate),
                    0
                )}</summary
            >{@render holdings()}
        </details>
    {:else}
        <p class="counts">
            {certificates.length}
            {certificates.length === 1 ? 'certificate' : 'certificates'} · Limit count {certificates.reduce(
                (sum, certificate) => sum + certificateWeight(certificate),
                0
            )}
        </p>
        {@render holdings()}
    {/if}
</article>

<style>
    summary {
        margin-top: 10px;
        font-size: 12px;
        color: #576763;
        cursor: pointer;
    }

    h4 {
        margin: 16px 0 8px;
        font-size: 13px;
    }

    article {
        background: #fffefa;
        border: 1px solid #c9d2cb;
        border-top: 4px solid;
        border-radius: 7px;
        padding: 16px;
        min-width: 0;
    }
    header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 8px;
    }
    h3 {
        font-size: 16px;
        font-weight: 650;
        margin: 0;
    }
    .cash {
        font-size: 14px;
        font-variant-numeric: tabular-nums;
    }
    .counts,
    .empty {
        font-size: 12px;
        color: #576763;
        margin: 10px 0;
    }
    ul {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    li {
        padding: 12px 0;
        border-top: 1px solid #e0e5de;
    }
    li:last-child {
        padding-bottom: 0;
    }
    .issuer {
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }
    .badge {
        border: 1px solid #c6d6bc;
        border-radius: 4px;
        background: #edf4e6;
        font-size: 10px;
        padding: 2px 5px;
    }
    .details {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 5px;
        font-size: 12px;
        color: #576763;
        margin-top: 5px;
    }
</style>
