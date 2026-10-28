<script lang="ts">
    import type { HistoryCallout } from './historyCallouts.js'

    let { callout }: { callout: HistoryCallout } = $props()
</script>

<div class="history-callout {callout.kind}" role="note">
    <strong>{callout.title}</strong>
    {#if callout.text}<span>{callout.text}</span>{/if}
</div>

<style>
    .history-callout {
        --callout-color: var(--rail-negative, #b33a32);
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        text-align: left;
        gap: 2px;
        margin: 6px 0 2px;
        padding: 6px 10px;
        border-left: 4px solid var(--callout-color);
        border-radius: 3px;
        background: color-mix(in srgb, var(--callout-color) 16%, transparent);
    }
    .certificate-limit {
        --callout-color: light-dark(#a8630a, #e0a03c);
    }
    strong {
        color: var(--callout-color);
        font-size: 13px;
        font-weight: 750;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
    span {
        font-size: 12px;
    }
</style>
