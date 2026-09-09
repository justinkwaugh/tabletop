<script lang="ts" generics="T extends string">
    import { Dropdown, DropdownGroup, DropdownItem, type SelectOptionType } from 'flowbite-svelte'

    let {
        id,
        value,
        options,
        placeholder = 'Choose an option',
        onchange
    }: {
        id: string
        value: T
        options: readonly SelectOptionType<T>[]
        placeholder?: string
        onchange: (value: T) => void
    } = $props()
    let open = $state(false)
</script>

<button
    {id}
    type="button"
    aria-haspopup="true"
    aria-expanded={open}
    onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            open = !open
        }
    }}
    class="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-left text-sm text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
>
    <span class="truncate"
        >{options.find((option) => option.value === value)?.name ?? placeholder}</span
    >
    <svg
        class="size-3 shrink-0 text-gray-500 dark:text-gray-400"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
        ><path d="m4 6 4 4 4-4" stroke-linecap="round" stroke-linejoin="round"></path></svg
    >
</button>
<Dropdown
    triggeredBy={`#${id}`}
    bind:isOpen={open}
    placement="bottom-start"
    onkeydown={(event) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            open = false
        }
    }}
    class="max-h-64 w-72 max-w-[calc(100vw-3rem)] overflow-y-auto"
>
    <DropdownGroup class="py-1">
        {#each options as option (option.value)}
            <DropdownItem
                class="flex w-full items-center justify-between gap-3 text-left text-sm"
                disabled={option.disabled}
                onclick={() => {
                    onchange(option.value)
                    open = false
                }}
            >
                {option.name}<span aria-hidden="true">{value === option.value ? '✓' : ''}</span>
            </DropdownItem>
        {/each}
    </DropdownGroup>
</Dropdown>
