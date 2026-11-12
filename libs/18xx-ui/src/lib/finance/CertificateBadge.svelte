<script lang="ts">
    import { centredTextShift } from '../presentation/textBaseline.js'
    let { label, title }: { label: string; title: string } = $props()
</script>

<span class="certificate-badge" role="img" aria-label={title} {title}>
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <text x="7" y="7" dy={centredTextShift(9)} font-size="9" text-anchor="middle">{label}</text>
    </svg>
</span>

<style>
    .certificate-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 12px;
        height: 12px;
        margin-left: 4px;
        border: 1px solid var(--president-badge-background, var(--rail-solid, #695540));
        border-radius: 50%;
        background: var(--president-badge-background, var(--rail-solid, #695540));
        color: var(--rail-text, #fffaf4);
        font-size: 9px;
        font-weight: 700;
        line-height: 1;
        vertical-align: -3px;
    }
    svg {
        flex-shrink: 0;
    }
    text {
        fill: currentColor;
    }
</style>
