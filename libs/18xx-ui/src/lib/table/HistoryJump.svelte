<script lang="ts">
    let { label, disabled = false, onclick }: {
        label: string
        disabled?: boolean
        onclick: () => void
    } = $props()
</script>
<button type="button" aria-label={label} title={label} {disabled} {onclick}>
    <svg width="8" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <svg class="clock" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="M12 6v6l4 2" stroke="#f8f2e9" stroke-width="2" fill="none" stroke-linecap="round" />
    </svg>
</button>
<style>
    button { display: inline-flex; align-items: center; flex-shrink: 0; padding: 4px; border: 0; border-radius: 4px; background: transparent; color: var(--rail-text, #665044); cursor: pointer; }
    button:hover:not(:disabled) { background: var(--rail-hover, #49352a20); color: var(--rail-text, #30251e); }
    button:disabled { opacity: .35; cursor: default; }
    button .clock { width: 13px; height: 13px; margin-left: -2px; }
</style>
