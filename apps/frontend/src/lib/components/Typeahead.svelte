<script lang="ts">
    import type { AppContext } from '$lib/stores/appContext.svelte'
    import { trim } from '$lib/utils/trimInput'
    import { Dropdown, DropdownItem, Input } from 'flowbite-svelte'
    import { nanoid } from 'nanoid'
    import { getContext, type Snippet } from 'svelte'

    let {
        id = 'abc',
        text = $bindable(),
        oninput = () => {},
        children,
        ...others
    }: {
        id: string
        text: string
        oninput: (event: InputEvent) => void
        children: Snippet
    } = $props()

    let { api } = getContext('appContext') as AppContext

    let inputId = $state(`in-${id}`)
    let hiddenTriggerId = $derived(`no-${inputId}`)

    let open: boolean = $state(false)
    let lastRequestId: string | undefined = $state(undefined)
    let items: string[] = $state([])

    let delay = 100
    let inputDelayTimeout: ReturnType<typeof setTimeout>

    function onInput(event: InputEvent) {
        trim(event)
        text = (event.target as HTMLInputElement).value

        if (inputDelayTimeout) {
            clearTimeout(inputDelayTimeout)
        }

        if (delay) {
            inputDelayTimeout = setTimeout(processInput, delay)
        } else {
            processInput()
        }

        oninput(event)
    }

    async function processInput() {
        if (await search()) {
            openDropdown()
        } else {
            closeDropdown()
        }
    }

    function openDropdown() {
        open = true
    }

    function closeDropdown() {
        open = false
        items = []
    }

    async function search() {
        let searchText = text
        if (searchText.length < 2) {
            return false
        }
        const currentRequestId = nanoid()
        lastRequestId = currentRequestId

        let results = await api.searchUsernames(searchText)
        if (currentRequestId !== lastRequestId) {
            return false
        }

        items = results

        return items.length > 0
    }

    function onItemClick(event: Event) {
        const value = (event.target as HTMLElement).textContent
        if (value) {
            text = value
        }
        closeDropdown()
    }

    $effect(() => {
        if (text.length < 2) {
            closeDropdown()
        }
    })
</script>

<div class="relative">
    <div id={hiddenTriggerId} class="hidden"></div>
    <Input id={inputId} bind:value={text} oninput={onInput} {...others}>
        <div slot="right">{@render children()}</div>
    </Input>
    <Dropdown
        bind:open
        reference={`#${inputId}`}
        triggeredBy={`#${hiddenTriggerId}`}
        trigger={'focus'}
        color="dropdown"
        classContainer="w-full border-2 dark:border-gray-700 dark:bg-gray-800"
    >
        {#each items as item}
            <DropdownItem onclick={onItemClick}>{item}</DropdownItem>
        {/each}
    </Dropdown>
</div>
