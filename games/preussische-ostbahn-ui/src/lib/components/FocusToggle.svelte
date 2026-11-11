<script lang="ts">
    import { BoardFocus } from '$lib/utils/boardGeometry.js'

    let {
        selected,
        onselect
    }: {
        selected: BoardFocus | undefined
        onselect: (focus: BoardFocus) => void
    } = $props()

    const VIEWS = [
        { focus: BoardFocus.Map, label: 'Map' },
        { focus: BoardFocus.Railroads, label: 'Railroads' }
    ]
</script>

<div class="toggle po-serif" role="group" aria-label="Focus the board">
    {#each VIEWS as { focus, label } (focus)}
        <button
            type="button"
            class:on={selected === focus}
            aria-pressed={selected === focus}
            onclick={() => onselect(focus)}>{label}</button
        >
    {/each}
</div>

<style>
    .toggle {
        position: absolute;
        top: 4px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 2px;
        padding: 2px;
        border-radius: 8px;
        background: var(--po-table);
        pointer-events: auto;
    }

    button {
        padding: 2px 12px;
        border-radius: 6px;
        color: var(--po-table-ink);
        font-size: 14px;
        font-weight: 700;
        white-space: nowrap;
    }

    button.on {
        background: var(--po-table-ink);
        color: var(--po-table);
    }
</style>
