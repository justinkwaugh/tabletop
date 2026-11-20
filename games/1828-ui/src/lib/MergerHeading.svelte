<script lang="ts">
    import { CompanyToken } from '@tabletop/18xx-ui'
    import type { Session1828 } from './session.svelte.js'
    let {
        session,
        first,
        second,
        joiner,
        label
    }: {
        session: Session1828
        first: string
        second: string
        joiner: string
        label: string
    } = $props()
</script>

{#snippet company(companyId: string)}
    <CompanyToken appearance={session.mapView.stations[companyId]} size={28} />
    {session.companyInitials(companyId)}
{/snippet}

<h3 aria-label={label}>
    {@render company(first)}
    <span aria-hidden="true">{joiner}</span>
    {@render company(second)}
</h3>

<style>
    h3 {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        margin: 0;
        font-size: 17px;
        font-weight: 650;
    }
    span {
        margin-inline: 3px;
        color: var(--rail-muted, #887969);
        font-weight: 400;
    }
</style>
