<script lang="ts">
    import { CompanyToken } from '@tabletop/18xx-ui'
    import { companyLineup } from './companyLineup.js'
    import DraftLineupDialog from './DraftLineupDialog.svelte'
    import { MapView1846 } from './mapView.js'
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const lineup = $derived(companyLineup(session.gameState, (id) => session.companyName(id)))
    let open = $state(false)
</script>

<button class="setup-entry" aria-haspopup="dialog" onclick={() => (open = true)}>
    <span>Set up for {lineup.playerCount} players</span>
    <small
        >{#each lineup.corporations as company (company.id)}<span class="token" title={company.name}
                ><CompanyToken appearance={MapView1846.stations[company.id]} size={16} /></span
            >{/each}
        {lineup.privateNames.join(' · ')}</small
    >
</button>
{#if open}
    <DraftLineupDialog {lineup} onclose={() => (open = false)} />
{/if}

<style>
    .setup-entry {
        display: flex;
        flex-direction: column;
        gap: 0.167em;
        width: 100%;
        padding: 0.167em 0;
        border: 0;
        background: none;
        color: var(--rail-text, #463e35);
        font: inherit;
        line-height: 1.333em;
        text-align: left;
        cursor: pointer;
    }
    .setup-entry > span {
        font-weight: 600;
    }
    .setup-entry:hover > span {
        text-decoration: underline;
        text-underline-offset: 3px;
    }
    small {
        color: var(--rail-muted, #817565);
        font-size: 0.833em;
        line-height: 1.4em;
    }
    .token {
        display: inline-block;
        margin-right: 2px;
        vertical-align: middle;
    }
</style>
