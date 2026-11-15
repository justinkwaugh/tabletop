<script lang="ts">
    import { CompanyToken, PlaceText } from '@tabletop/18xx-ui'
    import { lot1822 } from './lots.js'
    import type { Session1822 } from './session.svelte.js'

    let { session, lotId }: { session: Session1822; lotId: string } = $props()
    const lot = $derived(lot1822(lotId, session.presentation.money))
</script>

<div class="lot-card">
    {#if lot.kind === 'private'}
        <span class="number private">{lot.id}</span>
        <div class="text">
            <strong>{lot.power}</strong>
            <span class="name">{lot.name} · {lot.income}</span>
            <details>
                <summary>What it does</summary>
                <p><PlaceText text={lot.description} /></p>
            </details>
        </div>
    {:else}
        <span class="mark"
            ><CompanyToken appearance={session.mapView.stations[lot.markId]} size={30} /></span
        >
        <div class="text" title={lot.name}>
            <strong
                >{lot.kind === 'minor'
                    ? `${lot.id} ${lot.initials}`
                    : `${lot.initials} concession`}</strong
            >
            <span class="detail"><PlaceText text={lot.detail} /></span>
        </div>
    {/if}
</div>

<style>
    .lot-card {
        display: flex;
        align-items: flex-start;
        gap: 7px;
        min-width: 0;
    }
    .mark {
        flex: none;
        display: inline-flex;
    }
    .text {
        display: flex;
        flex-direction: column;
        min-width: 0;
        line-height: 1.25;
    }
    strong {
        font-size: 13px;
        font-weight: 700;
    }
    .name,
    .detail {
        color: var(--rail-muted, #887664);
        font-size: 11px;
    }
    .number.private {
        flex: none;
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        background: var(--rail-surface, #faf7f1);
        font-size: 12px;
        font-weight: 700;
    }
    details {
        font-size: 11px;
    }
    summary {
        cursor: pointer;
        color: var(--rail-muted, #887664);
        text-decoration: underline dotted;
        text-underline-offset: 2px;
        list-style: none;
    }
    summary::-webkit-details-marker {
        display: none;
    }
    details p {
        margin: 3px 0 0;
        color: var(--rail-text, #443c34);
    }
</style>
