<script lang="ts">
    import SeatLedger from './SeatLedger.svelte'

    // Contract, "Full screen": the seat ledger over the board while full screen hides the side
    // column. A row press opens its seat in the ledger's place.
    let { open = $bindable(false) }: { open?: boolean } = $props()

    // One press closes one layer: the enlarged view takes Escape first (on the window, in the
    // capture phase); the ledger takes it next (on the document), before the full-screen dialog.
    function closeOnEscape(event: KeyboardEvent) {
        if (event.key === 'Escape' && open) {
            event.preventDefault()
            event.stopPropagation()
            open = false
        }
    }
</script>

<svelte:document onkeydowncapture={closeOnEscape} />

{#if open}
    <div
        class="backdrop fixed inset-0 z-40 bg-pp-veil"
        role="presentation"
        data-seats-sheet-backdrop
        onclick={() => (open = false)}
    ></div>
    <div
        class="sheet fixed z-40"
        role="dialog"
        aria-modal="true"
        aria-label="Seats"
        data-seats-sheet
    >
        <SeatLedger onopenseat={() => (open = false)} />
        <div class="mt-2 flex justify-end">
            <button
                type="button"
                class="min-h-11 rounded bg-pp-paper px-4 text-sm text-pp-ink sm:min-h-0 sm:px-3 sm:py-1"
                onclick={() => (open = false)}>Close</button
            >
        </div>
    </div>
{/if}

<style>
    .sheet {
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(
            520px,
            calc(100vw - 32px - env(safe-area-inset-left) - env(safe-area-inset-right))
        );
        max-height: calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
        overflow-y: auto;
    }

    /* Contract, "Phone layout": as the open seat, a bottom sheet up to 85 % of the dynamic
       viewport. */
    @media (width < 40rem) {
        .sheet {
            left: 0;
            right: 0;
            top: auto;
            bottom: 0;
            transform: none;
            width: auto;
            max-height: 85dvh;
            padding: 10px 10px calc(10px + env(safe-area-inset-bottom));
            border-radius: 14px 14px 0 0;
            background: var(--pp-column);
            box-shadow: 0 -4px 18px var(--pp-veil);
        }
    }
</style>
