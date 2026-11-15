<script lang="ts">
    import SwitchTrack from './SwitchTrack.svelte'
    let {
        enabled,
        onToggle,
        label,
        compactLabel = label,
        title,
        small = false
    }: {
        enabled: boolean
        onToggle: () => void
        label: string
        compactLabel?: string
        title: string
        small?: boolean
    } = $props()
</script>

<button
    class="view-switch"
    class:small
    role="switch"
    aria-checked={enabled}
    aria-label={label}
    {title}
    onclick={onToggle}
>
    <SwitchTrack on={enabled} />
    <span class="full-label">{label}</span>
    <span class="compact-label">{compactLabel}</span>
</button>

<style>
    .view-switch {
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
    .view-switch.small {
        padding-block: 2px;
        font-size: 11px;
    }
    .view-switch:hover,
    .view-switch[aria-checked='true'] {
        color: var(--rail-text, #e3e9ef);
    }
    .view-switch:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: 1px;
    }
    .compact-label {
        display: none;
    }
    @media (width < 40rem) {
        .full-label {
            display: none;
        }
        .compact-label {
            display: inline;
        }
    }
</style>
