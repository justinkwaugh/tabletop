<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AnnouncementTable from './AnnouncementTable.svelte'
    import TableMenu from './TableMenu.svelte'

    const gameSession = getGameSession()
    const chosen = $derived(gameSession.chosenAnnouncementItems)
</script>

<p>
    {#if chosen.length > 0}
        <span class="chosen-label">Chosen:</span> {chosen.join(' · ')}
    {:else}
        Announce bonuses or doubles, or pass.
    {/if}
</p>
<div class="choices">
    {#if gameSession.announcementSections.length > 0}
        <!-- A new menu for each turn, so it opens as the turn starts. -->
        {#key gameSession.actions.length}
            <TableMenu
                label={chosen.length > 0 ? 'Change' : 'Choose'}
                title="Announce or double"
                openAtOnce
            >
                {#snippet table({ wide })}
                    <AnnouncementTable {wide} />
                {/snippet}
            </TableMenu>
        {/key}
    {/if}
    <button
        type="button"
        class="choice confirm"
        class:quiet={chosen.length === 0}
        disabled={!gameSession.canConfirmAnnouncement}
        onclick={() => gameSession.confirmAnnouncement()}
        >{chosen.length > 0 ? 'Announce' : 'Pass'}</button
    >
</div>

<style>
    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .chosen-label {
        color: #f2c94c;
        font-weight: 600;
    }

    .confirm {
        font-weight: 700;
    }

    .choice:disabled {
        opacity: 0.4;
    }

    .quiet {
        border-style: dashed;
        font-weight: 400;
    }
</style>
