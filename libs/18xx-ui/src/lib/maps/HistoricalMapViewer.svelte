<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import { onMount } from 'svelte'
    import { ScalingWrapper } from '@tabletop/frontend-components'
    import MapScene from './MapScene.svelte'
    import { mapSelectionRect, type BoardArtwork } from './mapDrawing.js'
    import type { HistoricalMap } from './historicalMap.js'
    import type { TileAppearance } from '../tiles/tileAppearance.js'

    let {
        money,
        preview,
        appearance,
        revenueStageColors,
        artwork,
        onclose
    }: {
        money: MoneyFormat
        artwork?: BoardArtwork
        preview: HistoricalMap
        appearance: TileAppearance
        revenueStageColors?: Readonly<Record<string, string>>
        onclose: () => void
    } = $props()
    let dialog: HTMLDialogElement
    let wrapper: ScalingWrapper

    onMount(() => {
        dialog.showModal()
        if (preview.locations.length) {
            const rectangles = preview.locations.map((locationId) =>
                mapSelectionRect(preview.scene, { kind: 'hex', locationId }, 140, 220, artwork)
            )
            const x = Math.min(...rectangles.map((rect) => rect.x))
            const y = Math.min(...rectangles.map((rect) => rect.y))
            const right = Math.max(...rectangles.map((rect) => rect.x + rect.width))
            const bottom = Math.max(...rectangles.map((rect) => rect.y + rect.height))
            wrapper.focusRect({ x, y, width: right - x, height: bottom - y })
        }
        function closeKey(event: KeyboardEvent) {
            if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
            if (event.key !== 'Escape' && event.key.toLowerCase() !== 'f') return
            event.preventDefault()
            event.stopImmediatePropagation()
            onclose()
        }
        window.addEventListener('keydown', closeKey, true)
        return () => window.removeEventListener('keydown', closeKey, true)
    })
</script>

<dialog bind:this={dialog} aria-label="Historical map" oncancel={onclose}>
    <header>
        <span
            ><strong>Historical {preview.kind}</strong> · {preview.label}{#if preview.revenue !== undefined}
                · <strong>{money(preview.revenue)}</strong>{/if}</span
        >
        <button onclick={onclose}>Close</button>
    </header>
    <div class="map" style:background={artwork?.backgroundColor}>
        <ScalingWrapper maxScale={2} bind:this={wrapper} justify="center" controls="bottom-left">
            <MapScene
                {artwork}
                scene={preview.scene}
                tokens={preview.tokens}
                reservations={preview.reservations}
                routes={preview.routes}
                selection={preview.selection}
                maskUnavailableLocations={preview.kind === 'run'}
                highlightedLocationIds={preview.locations}
                {appearance}
                {revenueStageColors}
                hexDiameter={140}
            />
        </ScalingWrapper>
    </div>
</dialog>

<style>
    dialog {
        position: fixed;
        inset: 0;
        width: 90vw;
        height: 90dvh;
        max-width: none;
        max-height: none;
        margin: auto;
        padding: 0;
        border: 0;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 16px 64px var(--rail-shadow, #20180f66);
        background: var(--rail-surface-raised, #eee8dc);
        color: var(--rail-text, #493b2b);
    }
    dialog[open] {
        display: flex;
        flex-direction: column;
    }
    dialog::backdrop {
        background: var(--rail-backdrop, #00000099);
    }
    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 16px;
        background: var(--rail-solid, #493b2b);
        color: #fff8e9;
        font-size: 14px;
    }
    button {
        flex-shrink: 0;
        padding: 5px 12px;
        border: 0;
        border-radius: 4px;
        background: var(--rail-hover, #fff8e91f);
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    button:hover {
        background: var(--rail-hover, #fff8e933);
    }
    .map {
        flex: 1;
        min-height: 0;
    }
    @media (max-width: 760px), (max-height: 560px) {
        dialog {
            width: 100vw;
            height: 100dvh;
            border-radius: 0;
        }
    }
</style>
