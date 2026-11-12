<script lang="ts" generics="T extends string">
    type Segment = { value: T; label: string }

    let {
        name,
        options,
        value = $bindable(),
        ariaLabel
    }: {
        name: string
        options: Segment[]
        value: T
        ariaLabel: string
    } = $props()

    let selectedIndex = $derived(options.findIndex((option) => option.value === value))
</script>

<div
    role="radiogroup"
    aria-label={ariaLabel}
    class="relative grid rounded-md bg-gray-200 p-0.5 dark:bg-gray-700"
    style:grid-template-columns={`repeat(${options.length}, minmax(0, 1fr))`}
>
    <span
        aria-hidden="true"
        class="absolute inset-y-0.5 left-0.5 rounded bg-primary-600 transition-transform duration-200 ease-out motion-reduce:transition-none"
        style:width={`calc((100% - 0.25rem) / ${options.length})`}
        style:transform={`translateX(${selectedIndex * 100}%)`}
    ></span>
    {#each options as option (option.value)}
        <label
            class={[
                'relative cursor-pointer select-none rounded px-3 py-0.5 text-center text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500',
                option.value === value
                    ? 'text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
            ]}
        >
            <input type="radio" class="sr-only" {name} value={option.value} bind:group={value} />
            {option.label}
        </label>
    {/each}
</div>
