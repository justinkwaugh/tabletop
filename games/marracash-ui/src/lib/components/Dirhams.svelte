<script lang="ts">
    import { DirhamSign } from '$lib/utils/currency.js'

    let { amount }: { amount: number } = $props()
</script>

<span class="whitespace-nowrap">{amount}&nbsp;<bdi>{DirhamSign}</bdi></span>
