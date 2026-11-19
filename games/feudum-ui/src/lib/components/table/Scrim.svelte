<script lang="ts">
    import type { Snippet } from 'svelte'

    /**
     * A layer over the table: its backdrop closes it, its close button too, and it pads by the
     * screen's safe areas (contract: Open seat, Card preview).
     */
    let {
        label,
        layer,
        onClose,
        sheet,
        closeButton = true,
        children
    }: {
        label: string
        layer: string
        onClose: () => void
        /** On a phone it stands as a bottom sheet, up to this much of the dynamic viewport. */
        sheet?: number
        /** Without one, what the layer holds is its own close press (contract: Card preview). */
        closeButton?: boolean
        children: Snippet
    } = $props()
</script>

<div
    class="scrim fixed inset-0 flex items-center justify-center"
    class:as-sheet={sheet !== undefined}
    role="dialog"
    aria-modal="true"
    aria-label={label}
    data-table-layer={layer}
>
    <button
        type="button"
        class="absolute inset-0 cursor-default bg-(--feudum-dim)"
        aria-label="Close {label}"
        data-backdrop
        onclick={onClose}
    ></button>
    <div
        class="relative max-h-full overflow-auto"
        class:sheet-body={sheet !== undefined}
        style:max-height={sheet === undefined ? undefined : `${sheet}dvh`}
        data-sheet={sheet === undefined ? undefined : ''}
    >
        {#if closeButton}
            <button
                type="button"
                class="absolute right-1 top-1 z-10 rounded-full bg-feudum-control hover:bg-feudum-control-hover px-3 py-1 text-sm text-feudum-text"
                data-close
                onclick={onClose}>Close</button
            >
        {/if}
        {@render children()}
    </div>
</div>

<style>
    .scrim {
        z-index: 60;
        padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
            max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    }

    .scrim.as-sheet {
        align-items: flex-end;
        padding: 0;
    }

    .sheet-body {
        width: 100%;
        padding-bottom: env(safe-area-inset-bottom);
        border-radius: 12px 12px 0 0;
        background: var(--feudum-surface-raised);
    }

    .sheet-body [data-close] {
        min-height: 44px;
        min-width: 44px;
    }
</style>
