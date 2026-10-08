<script lang="ts">
    import { favorToken } from '$lib/images/tileImages.js'

    let { count, sign = '' }: { count: number; sign?: '' | '+' } = $props()

    const token = favorToken()
</script>

<span class="favor-cost"
    ><span class="favor-cost__count">{sign}{count}</span><img
        class="favor-cost__token"
        src={token.src}
        width={token.width}
        height={token.height}
        alt="favor"
    /></span
>

<style>
    .favor-cost {
        display: inline-flex;
        align-items: center;
        gap: 0.2em;
        white-space: nowrap;
    }
    .favor-cost__count {
        color: var(--oath-accent);
        font-weight: 600;
    }
    .favor-cost__token {
        display: inline-block;
        width: auto;
        height: 1.2em;
    }
</style>
