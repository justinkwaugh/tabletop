<script lang="ts">
    let { count, limit }: { count: number; limit: number } = $props()
    const over = $derived(count > limit)
</script>

<span class="certificate-count"
    ><span class:over title={over ? 'Over the certificate limit' : undefined}>{count}</span
    >/{limit}</span
>

<style>
    .over {
        color: var(--rail-negative, #b33a32);
        font-weight: 700;
    }
</style>
