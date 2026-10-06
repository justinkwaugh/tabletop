<script lang="ts">
    const DirhamSign = 'د.م.'

    let { amount, class: className = '' }: { amount: number; class?: string } = $props()
</script>

<span class="whitespace-nowrap {className}"
    >{amount}<bdi class="marracash-dirham-sign sign" dir="rtl" aria-hidden="true">{DirhamSign}</bdi
    ><span class="sr-only"> dirham</span></span
>

<style>
    .sign {
        margin-left: 0.22em;
        font-size: var(--dirham-sign-size, 1.1em);
    }
</style>
