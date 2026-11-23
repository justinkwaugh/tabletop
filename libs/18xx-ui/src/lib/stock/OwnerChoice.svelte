<script lang="ts">
    import { sameOwner, type Owner } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { ownerShortLabel } from './ownerLabels.js'
    let {
        session,
        owners,
        selected,
        label,
        disabled = false,
        onChoose
    }: {
        session: EighteenXXSessionView
        owners: readonly Owner[]
        selected: Owner | undefined
        label: string
        disabled?: boolean
        onChoose: (owner: Owner) => void
    } = $props()
</script>

<div class="owner-choice" role="group" aria-label={label}>
    {#each owners as owner (ownerShortLabel(session, owner))}
        <button
            {disabled}
            aria-pressed={!!selected && sameOwner(owner, selected)}
            title={session.ownerName(owner)}
            onclick={() => onChoose(owner)}>{ownerShortLabel(session, owner)}</button
        >
    {/each}
</div>

<style>
    .owner-choice {
        display: flex;
        gap: 4px;
    }
    button {
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        padding: 1px 8px;
        background: transparent;
        color: var(--rail-muted, #95816a);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    button[aria-pressed='true'] {
        border-color: var(--rail-focus, #a87948);
        background: var(--rail-surface-raised, #efe7db);
        color: inherit;
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #a87948);
        outline-offset: 1px;
    }
</style>
