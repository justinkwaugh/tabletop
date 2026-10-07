<script lang="ts">
    let { text }: { text: string } = $props()
</script>

<h2>{text}</h2>

<style>
    h2 {
        margin: 0 0 10px;
        font-size: clamp(11px, calc(9px + 0.5cqw), 14px);
        font-weight: 400;
        letter-spacing: 0.08em;
        text-align: center;
        text-transform: uppercase;
        color: var(--rail-text, #63513e);
    }
</style>
