<script lang="ts">
    import { ActionSource } from '@tabletop/common'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
    const actions = $derived(
        session.actions.filter((action) => action.source === ActionSource.User).toReversed()
    )
</script>

<ol aria-label="Action history">
    {#each actions as action (action.id)}
        <li>
            <button
                disabled={session.busy ||
                    session.updatingVisibleState ||
                    action.index === undefined}
                onclick={() => {
                    if (action.index !== undefined) session.history.goToActionIndex(action.index)
                }}
            >
                <span>{session.getPlayerName(action.playerId)}</span>
                <strong>{action.type.replace(/([a-z])([A-Z])/g, '$1 $2')}</strong>
                {#if 'locationId' in action && typeof action.locationId === 'string'}<small
                        >{action.locationId}</small
                    >{/if}
            </button>
        </li>
    {:else}<li class="empty">No actions yet.</li>{/each}
</ol>

<style>
    ol {
        list-style: none;
        padding: 8px 0;
        margin: 0;
    }
    li {
        border-bottom: 1px solid #d4c9bc;
    }
    button {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 4px;
        padding: 12px 8px;
        text-align: left;
        background: none;
        border: 0;
        color: #3e3933;
        cursor: pointer;
        font: inherit;
    }
    button:hover {
        background: #ffffff55;
    }
    span {
        grid-column: 1 / -1;
        font-size: 11px;
        color: #7d7266;
    }
    strong {
        font-size: 13px;
        font-weight: 500;
    }
    small {
        font-size: 12px;
    }
    .empty {
        padding: 20px 8px;
        color: #7d7266;
        font-size: 13px;
    }
</style>
