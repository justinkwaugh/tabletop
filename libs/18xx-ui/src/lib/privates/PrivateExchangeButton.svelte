<script lang="ts">
    import { getCompany, type PrivateExchangeRequest } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'

    let {
        session,
        option,
        label = 'Exchange'
    }: { session: EighteenXXSessionView; option: PrivateExchangeRequest; label?: string } = $props()
    const company = $derived(session.privates.exchangeCompany(option.certificateId))
</script>

<button
    class="exchange"
    data-description-exclude
    aria-label={`Exchange ${getCompany(session.gameState, option.privateCompanyId).name} for ${company.name}`}
    disabled={session.busy}
    onclick={() => void session.privates.exchange(option)}
>
    <span>{label}</span>
    <CompanyToken appearance={session.mapView.stations[company.id]} size={16} />
</button>

<style>
    .exchange {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 1px 4px 1px 7px;
        border: 1px solid var(--rail-border, #a99983);
        border-radius: 10px;
        background: var(--rail-surface, #fffdf8);
        color: var(--rail-text, #514538);
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.4;
        cursor: pointer;
    }
    .exchange:hover:enabled {
        background: var(--rail-surface-raised, #eee5d8);
        border-color: var(--rail-focus, #796047);
    }
    .exchange:focus-visible {
        outline: 2px solid var(--rail-focus, #796047);
        outline-offset: 2px;
    }
    .exchange:disabled {
        opacity: 0.45;
        cursor: default;
    }
</style>
