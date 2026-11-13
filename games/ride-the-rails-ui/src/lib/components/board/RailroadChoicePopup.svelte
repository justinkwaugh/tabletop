<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import type { RailroadChoice } from '$lib/utils/pickMarks.js'
    import { popupSide } from '$lib/utils/phoneLayout.svelte.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import LocomotiveIcon from './LocomotiveIcon.svelte'
    import MarkPill from './MarkPill.svelte'

    let {
        choice,
        reference,
        onChoose
    }: {
        choice: RailroadChoice
        reference: string
        onChoose: (railroadId: RailroadId) => void
    } = $props()
</script>

<!-- Contract, Build and Ride: the popup beside the picked hex, one chip per railroad. -->
<Floater {reference} placement={popupSide('right')} offset={8} trigger="manual">
    <div
        class="max-w-72 rounded-lg border border-rtr-line bg-rtr-panel-raised p-2 text-rtr-ink shadow-lg"
        role="group"
        aria-label={choice.title}
    >
        <div class="px-1 text-sm font-semibold">{choice.title}</div>
        <div class="px-1 pb-1.5 text-xs text-rtr-ink-muted">Undo closes</div>
        <div class="flex flex-wrap gap-1.5">
            {#each choice.chips as chip (chip.railroadId)}
                <button
                    type="button"
                    class="flex flex-col items-start gap-0.5 rounded-md border border-rtr-line bg-rtr-panel px-2 py-1.5 text-left hover:border-rtr-accent focus-visible:outline-2 focus-visible:outline-rtr-accent"
                    aria-label={chip.label}
                    onclick={() => onChoose(chip.railroadId)}
                >
                    <span class="flex items-center gap-1.5 text-sm font-semibold">
                        <LocomotiveIcon railroadId={chip.railroadId} width={24} />
                        {railroadStyle(chip.railroadId).name}
                    </span>
                    {#if chip.detail}
                        <span class="text-xs text-rtr-ink-muted">{chip.detail}</span>
                    {/if}
                    <span class="flex items-center gap-1 text-xs text-rtr-ink-muted">
                        {#if chip.note.kind === 'pays'}
                            pays
                            {#each chip.note.amounts as mark (mark.tone)}
                                <MarkPill tone={mark.tone} text={mark.text} />
                            {/each}
                        {:else if chip.note.kind === 'start-uses-bonus'}
                            <MarkPill tone="five" text="${chip.note.amount}" spent />
                            pays nothing: a start uses it up
                        {:else if chip.note.kind === 'gain'}
                            you +${chip.note.amount}
                        {:else}
                            pays nothing
                        {/if}
                    </span>
                </button>
            {/each}
        </div>
    </div>
</Floater>
