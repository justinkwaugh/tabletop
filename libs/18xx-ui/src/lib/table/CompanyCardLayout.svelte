<script lang="ts">
    import type { Snippet } from 'svelte'
    import { wheelDeltaUnit } from '@tabletop/frontend-components'
    import ViewSwitch from './ViewSwitch.svelte'

    let {
        children,
        wrap,
        onToggleWrap,
        wide,
        onToggleWide
    }: {
        children: Snippet
        wrap: boolean
        onToggleWrap: () => void
        wide: boolean
        onToggleWide: () => void
    } = $props()

    function scrollRowOnWheel(row: HTMLElement) {
        function onWheel(event: WheelEvent) {
            if (wrap || event.shiftKey || event.ctrlKey) return
            if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
            const distance = event.deltaY * wheelDeltaUnit(event, row.clientWidth)
            const endScrollLeft = row.scrollWidth - row.clientWidth
            const atEnd =
                distance < 0 ? row.scrollLeft <= 0 : Math.ceil(row.scrollLeft) >= endScrollLeft
            if (atEnd) return
            event.preventDefault()
            row.scrollLeft += distance
        }
        row.addEventListener('wheel', onWheel, { passive: false })
        return () => row.removeEventListener('wheel', onWheel)
    }
</script>

<div class="company-card-layout">
    <div class="company-card-tools">
        <ViewSwitch
            small
            enabled={wide}
            onToggle={onToggleWide}
            label="Wide"
            title={wide
                ? 'Cards show their details side by side. Click for narrow cards.'
                : 'Cards are narrow. Click to show their details side by side.'}
        />
        <ViewSwitch
            small
            enabled={wrap}
            onToggle={onToggleWrap}
            label="Wrap"
            title={wrap
                ? 'Cards wrap onto new rows. Click to keep them in one row.'
                : 'Cards stay in one row. Click to wrap them onto new rows.'}
        />
    </div>
    <div
        class="company-cards"
        class:wrap
        class:wide
        aria-label="Started companies"
        {@attach scrollRowOnWheel}
    >
        {@render children()}
    </div>
</div>

<style>
    .company-card-layout {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        height: 100%;
        min-height: 0;
    }
    .company-card-tools {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 6px 10px 0;
    }
    .company-cards {
        display: flex;
        align-items: flex-start;
        align-content: flex-start;
        gap: 10px;
        padding: 10px;
        box-sizing: border-box;
        min-height: 0;
        overflow: auto;
    }
    .company-cards > :global(*) {
        flex: none;
    }
    .company-cards.wrap {
        flex-wrap: wrap;
    }
    .company-cards.wide {
        display: grid;
        grid-auto-rows: max-content;
    }
    .company-cards.wide.wrap {
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    }
    .company-cards.wide:not(.wrap) {
        grid-auto-flow: column;
        grid-auto-columns: min(100%, 400px);
    }
</style>
