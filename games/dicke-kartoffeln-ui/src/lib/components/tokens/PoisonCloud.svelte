<script lang="ts">
    // A "Giftwolke" counter, drawn after the cloud on the rulebook's spraying illustration.
    let { size, pending = false }: { size: number; pending?: boolean } = $props()
</script>

<svg
    class="cloud"
    class:pending
    width={size}
    height={size * 0.8}
    viewBox="0 0 100 80"
    role="img"
    aria-label="Poison cloud"
>
    <path
        d="M18 62 C4 62 2 44 14 40 C10 24 30 16 40 26 C44 10 70 8 74 26 C90 22 98 40 88 48 C98 58 88 70 76 66 C70 76 52 76 46 68 C38 76 22 74 18 62 Z"
        fill="#b9c35a"
        stroke="#3d4210"
        stroke-width="3"
        stroke-linejoin="round"
    />
    <path d="M30 38 l6 6 m0 -6 l-6 6 M60 34 l6 6 m0 -6 l-6 6" stroke="#3d4210" stroke-width="3" />
    <path d="M38 56 Q 50 48 62 56" fill="none" stroke="#3d4210" stroke-width="3" />
    {#each [24, 44, 66, 84] as x (x)}
        <circle cx={x} cy={x % 3 === 0 ? 74 : 77} r="2.6" fill="#6b7520" />
    {/each}
</svg>

<style>
    .cloud {
        display: block;
        flex: none;
        filter: drop-shadow(1px 2px 2px rgba(0, 0, 0, 0.4));
    }

    .cloud.pending {
        opacity: 0.55;
    }
</style>
