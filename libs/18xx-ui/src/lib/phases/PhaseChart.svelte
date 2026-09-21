<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import { onMount } from 'svelte'
    import PhaseChartContent from './PhaseChartContent.svelte'
    import type { PhaseChartData, PhaseChartDepotState } from './phaseChart.js'

    let {
        money,
        chart,
        depotState,
        depotOnly = false,
        currentPhaseId,
        trainColors,
        onclose
    }: {
        money: MoneyFormat
        depotState: PhaseChartDepotState
        depotOnly?: boolean
        chart: PhaseChartData
        currentPhaseId: string
        trainColors: Readonly<Record<string, string>>
        onclose: () => void
    } = $props()
    let dialog: HTMLDialogElement
    const titleId = $props.id()
    onMount(() => {
        dialog.showModal()
        return () => dialog.close()
    })
    function closeOutside(event: MouseEvent) {
        if (event.target !== dialog) return
        const bounds = dialog.getBoundingClientRect()
        if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
        )
            dialog.close()
    }
</script>

<dialog class:depot={depotOnly} bind:this={dialog} aria-labelledby={titleId} {onclose} onclick={closeOutside}>
    <header>
        <h2 id={titleId}>{depotOnly ? 'Train Depot' : 'Phase Chart & Train Roster'}</h2>
        <button class="close" aria-label={depotOnly ? 'Close depot' : 'Close phase chart'} onclick={() => dialog.close()}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
                ><path
                    d="m4 4 8 8m0-8-8 8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                /></svg
            >
        </button>
    </header>
    <PhaseChartContent {money} {chart} {depotState} {depotOnly} {currentPhaseId} {trainColors} />
</dialog>

<style>
    dialog {
        margin: auto;
        box-sizing: border-box;
        width: min(850px, calc(100vw - 40px));
        max-height: calc(100dvh - 48px);
        padding: 0;
        border: 1px solid var(--rail-border, #c3b39e);
        border-radius: 10px;
        background: var(--rail-surface, #faf7f1);
        color: var(--rail-text, #463e35);
        box-shadow: 0 20px 70px var(--rail-shadow, #16120d55);
    }
    dialog.depot { width: min(430px, calc(100vw - 40px)); }
    dialog::backdrop {
        background: var(--rail-backdrop, #17141099);
    }
    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 10px 16px;
        border-bottom: 1px solid var(--rail-border, #ded4c7);
    }
    h2 {
        margin: 0;
        font-size: 17px;
        font-weight: 650;
    }
    .close {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: var(--rail-text, #766653);
        cursor: pointer;
    }
    .close:hover {
        background: var(--rail-surface-raised, #e9e1d5);
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: 2px;
    }
</style>
