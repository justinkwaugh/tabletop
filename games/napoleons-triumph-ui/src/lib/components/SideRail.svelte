<script lang="ts">
    import { HistoryControls, type DefaultTab } from '@tabletop/frontend-components'
    import { UserCircleSolid, ClockSolid, AnnotationSolid } from 'flowbite-svelte-icons'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { HISTORY_CONTROL_INK } from './historyControlInk.js'

    let { onopen }: { onopen: (tab: DefaultTab) => void } = $props()

    const session = getGameSession()
</script>

<div class="nt-rail">
    <HistoryControls
        orientation="vertical"
        {...HISTORY_CONTROL_INK}
        borderClass="rounded-lg border-2 border-[#2b2620]"
    />
    <span class="nt-rail-rule"></span>
    <button type="button" class="nt-rail-tab" title="Armies" onclick={() => onopen('players')}>
        <UserCircleSolid size="md" aria-hidden="true" />
        <span class="sr-only">Armies</span>
    </button>
    <button type="button" class="nt-rail-tab" title="History" onclick={() => onopen('history')}>
        <ClockSolid size="md" aria-hidden="true" />
        <span class="sr-only">History</span>
    </button>
    {#if session.chatAvailable}
        <button type="button" class="nt-rail-tab" title="Chat" onclick={() => onopen('chat')}>
            <AnnotationSolid size="md" aria-hidden="true" />
            <span class="sr-only">Chat</span>
            {#if session.hasUnreadMessages}
                <span class="nt-rail-unread"></span>
            {/if}
        </button>
    {/if}
</div>

<style>
    .nt-rail {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        min-height: 0;
        padding: 8px 0 8px 8px;
        overflow-y: auto;
    }

    .nt-rail-rule {
        width: 22px;
        height: 1px;
        margin: 4px 0;
        background: color-mix(in srgb, var(--nt-ink) 35%, transparent);
    }

    .nt-rail-tab {
        position: relative;
        display: grid;
        place-items: center;
        width: 36px;
        height: 34px;
        border: 2px solid transparent;
        border-radius: 8px;
        color: var(--nt-ink);
    }

    .nt-rail-tab:hover {
        border-color: var(--nt-ink);
    }

    .nt-rail-unread {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #c81e1e;
    }
</style>
