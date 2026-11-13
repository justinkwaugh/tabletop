<script lang="ts">
    /**
     * R-3.1-H1 A padlock beside a sealed pouch, drawn so no font has to carry it. It stands beside
     * words that say the same, so a reader skips it.
     */
    let { size = 12 }: { size?: number } = $props()
</script>

<svg
    class="inline-block shrink-0"
    width={size}
    height={size}
    viewBox="0 0 16 16"
    aria-hidden="true"
    data-lock
>
    <path
        d="M5 7V5a3 3 0 0 1 6 0v2"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
    ></path>
    <rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor"></rect>
</svg>
