<script lang="ts">
    import { HistoryControls, type DefaultTab } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { onopen }: { onopen: (tab: DefaultTab) => void } = $props()

    const gameSession = getGameSession()

    // Each tab's icon, drawn in a 20-unit box.
    const TABS: readonly { tab: DefaultTab; label: string; icon: string }[] = [
        {
            tab: 'players',
            label: 'Players',
            icon: 'M10 3.5a3.2 3.2 0 1 1 0 6.4a3.2 3.2 0 1 1 0-6.4ZM3.8 16.5c.6-3.2 3.1-5 6.2-5s5.6 1.8 6.2 5Z'
        },
        {
            tab: 'history',
            label: 'History',
            icon: 'M10 3a7 7 0 1 1 0 14a7 7 0 1 1 0-14Zm-.9 3.2v4.6l3.6 2.2.9-1.4-2.8-1.7V6.2Z'
        },
        {
            tab: 'chat',
            label: 'Chat',
            icon: 'M3.5 4.5h13v8.5H8.2L4.8 16v-3H3.5Z'
        }
    ]
    const tabs = $derived(TABS.filter(({ tab }) => tab !== 'chat' || gameSession.chatAvailable))
</script>

<!-- Contract, Desktop layout: the folded side panel, a rail with the history controls and one
     button per tab, each opening the panel at its tab. -->
<div class="side-rail">
    <HistoryControls
        orientation="vertical"
        enabledColor="text-rtr-ink"
        disabledColor="text-rtr-line"
        borderClass="rounded-lg border-2 border-rtr-line"
        bgClass="bg-rtr-panel-raised"
    />
    <span class="rule"></span>
    {#each tabs as { tab, label, icon } (tab)}
        <button
            type="button"
            class="tab border-2 border-transparent text-rtr-ink hover:enabled:border-rtr-line"
            aria-label={label}
            onclick={() => onopen(tab)}
        >
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
                <path d={icon} fill="currentColor" fill-rule="evenodd"></path>
            </svg>
            {#if tab === 'chat' && gameSession.hasUnreadMessages}
                <span class="unread"></span>
            {/if}
        </button>
    {/each}
</div>

<style>
    .side-rail {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        min-height: 0;
        padding: 8px 0 8px 8px;
        overflow-y: auto;
    }

    .rule {
        width: 22px;
        height: 1px;
        margin: 4px 0;
        background: var(--rtr-line);
    }

    .tab {
        position: relative;
        display: grid;
        place-items: center;
        width: 36px;
        height: 34px;
        border-radius: 8px;
    }

    .unread {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--rtr-cost);
    }
</style>
