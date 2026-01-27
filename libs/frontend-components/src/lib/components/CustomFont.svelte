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
    {@html fontStyle}
</svelte:head>
