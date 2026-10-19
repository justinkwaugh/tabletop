<script lang="ts">
    import type { Snippet } from 'svelte'
    import { wheelDeltaUnit } from '@tabletop/frontend-components'
    import ViewSwitch from './ViewSwitch.svelte'

    let {
        children,
        wrap,
        onToggleWrap
    }: {
        children: Snippet
        wrap: boolean
        onToggleWrap: () => void
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
            enabled={wrap}
            onToggle={onToggleWrap}
            label="Wrap"
            title={wrap
                ? 'Cards wrap onto new rows. Click to keep them in one row.'
                : 'Cards stay in one row. Click to wrap them onto new rows.'}
        />
    </div>
    <div class="company-cards" class:wrap aria-label="Started companies" {@attach scrollRowOnWheel}>
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
</style>
