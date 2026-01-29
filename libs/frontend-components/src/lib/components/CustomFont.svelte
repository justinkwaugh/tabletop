<script lang="ts">
    let {
        fontFamily,
        url,
        format
    }: {
        fontFamily: string
        url: string
        format: string
    } = $props()

    let fontStyle = $derived(
        `<style>@font-face { font-family: '${fontFamily}'; src: url(${url}) format('${format}'); font-display: swap; }</style>`
    )
</script>

<svelte:head>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html fontStyle}
</svelte:head>
