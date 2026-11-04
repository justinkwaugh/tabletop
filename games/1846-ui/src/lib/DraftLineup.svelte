<script lang="ts">
    import { companyLineup } from './companyLineup.js'
    import DraftLineupDialog from './DraftLineupDialog.svelte'
    import type { EighteenFortySixSession } from './session.svelte.js'
    // Setup removes corporations and privates by player count and reveals them to everyone.
    let { session }: { session: EighteenFortySixSession } = $props()
    let open = $state(false)
</script>

<button class="draft-lineup" aria-haspopup="dialog" onclick={() => (open = true)}
    >Companies in this game</button
>
{#if open}
    <DraftLineupDialog
        lineup={companyLineup(session.gameState, (id) => session.companyName(id))}
        onclose={() => (open = false)}
    />
{/if}

<style>
    button.draft-lineup {
        padding: 0;
        border: 0;
        background: none;
        color: var(--rail-muted, #786550);
        text-decoration: underline;
        text-underline-offset: 3px;
    }
</style>
