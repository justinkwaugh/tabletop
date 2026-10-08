<script lang="ts">
    let { size = 32 }: { size?: number } = $props()
</script>

<svg viewBox="0 0 32 32" width={size} height={size} class="shrink-0">
    <path
        d="M11 8c-1-3 2-5 5-3 3-2 6 0 5 3l-2 2h-6z"
        fill="#b98d52"
        stroke="#5b3f1c"
        stroke-width="1"
    ></path>
    <path
        d="M10 11h12c4 4 6 9 5 14-1 3-4 4-11 4S6 28 5 25c-1-5 1-10 5-14z"
        fill="#d9b47a"
        stroke="#5b3f1c"
        stroke-width="1"
    ></path>
    <path d="M10 11h12" stroke="#7a5626" stroke-width="2"></path>
</svg>
