<script lang="ts">
    import SwitchTrack from './SwitchTrack.svelte'
    let {
        enabled,
        onToggle
    }: {
        enabled: boolean
        onToggle: () => void
    } = $props()
</script>

<button
    class="board-auto-zoom"
    role="switch"
    aria-checked={enabled}
    aria-label="Auto zoom"
    title={enabled
        ? 'The board zooms to follow the game. Click to keep the view still.'
        : 'The board keeps its view. Click to zoom to follow the game.'}
    onclick={onToggle}
>
    <SwitchTrack on={enabled} />
    <span>Auto<span class="full-label">{' zoom'}</span></span>
</button>

<style>
    .board-auto-zoom {
        display: flex;
        align-items: center;
        gap: 6px;
        border: 0;
        padding: 4px 10px 4px 6px;
        border-radius: 999px;
        background: var(--rail-surface, #222c37);
        color: var(--rail-muted, #7f8e9e);
        font: inherit;
        font-size: 12px;
        line-height: 16px;
        white-space: nowrap;
        cursor: pointer;
    }
    .board-auto-zoom:hover,
    .board-auto-zoom[aria-checked='true'] {
        color: var(--rail-text, #e3e9ef);
    }
    .board-auto-zoom:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: 1px;
    }
    @media (width < 40rem) {
        .full-label {
            display: none;
        }
    }
</style>
