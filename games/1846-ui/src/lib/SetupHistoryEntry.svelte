<script lang="ts">
    import { companyLineup } from './companyLineup.js'
    import DraftLineupDialog from './DraftLineupDialog.svelte'
    import LineupTokens from './LineupTokens.svelte'
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const lineup = $derived(companyLineup(session.gameState, (id) => session.companyName(id)))
    let open = $state(false)
</script>

<button class="setup-entry" aria-haspopup="dialog" onclick={() => (open = true)}>
    <span>Set up for {lineup.playerCount} players</span>
    <small
        ><LineupTokens
            companies={lineup.corporations}
            size={16}
            initials={session.tokenInitials}
        /></small
    >
    <small class="kept">{lineup.privateNames.join(' · ')}</small>
    {#if lineup.removedCorporations.length || lineup.removedPrivateNames.length}
        <small
            ><em>Removed</em>
            <LineupTokens
                companies={lineup.removedCorporations}
                size={16}
                removed
                initials={session.tokenInitials}
            />
            {lineup.removedPrivateNames.join(' · ')}</small
        >
    {/if}
</button>
{#if open}
    <DraftLineupDialog {lineup} initials={session.tokenInitials} onclose={() => (open = false)} />
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
    small.kept {
        color: var(--rail-text, #463e35);
    }
</style>
