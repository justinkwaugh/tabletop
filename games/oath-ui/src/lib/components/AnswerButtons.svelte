<script lang="ts">
    // Accept and Refuse, as wide as the longer label at every width, 44 px tall on a phone.
    let {
        acceptShown = true,
        acceptBlocked = false,
        busy,
        onanswer
    }: {
        acceptShown?: boolean
        acceptBlocked?: boolean
        busy: boolean
        onanswer: (accept: boolean) => void
    } = $props()
</script>

<div class="answers gap-2">
    {#if acceptShown}
        <button
            class="rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                   border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold"
            disabled={busy || acceptBlocked}
            onclick={() => onanswer(true)}
        >
            Accept
        </button>
    {/if}
    <button
        class="rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40
               px-3 py-1.5 text-sm font-semibold"
        disabled={busy}
        onclick={() => onanswer(false)}
    >
        Refuse
    </button>
</div>

<style>
    .answers {
        display: inline-grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
    }
    @media (max-width: 639px) {
        .answers button {
            min-height: 44px;
        }
    }
</style>
