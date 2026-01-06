<script lang="ts">
    import type { AppContext } from '$lib/model/appContext.js'
    import { trim } from '$lib/utils/trimInput'
    import { Dropdown, DropdownGroup, DropdownItem, Input, type InputProps } from 'flowbite-svelte'
    import { nanoid } from 'nanoid'
    import { getContext, type Snippet } from 'svelte'

    let {
        id = nanoid(),
        text = $bindable(),
        active = true,
        exclude = [],
        oninput = () => {},
        children,
        ...others
    }: {
        id: string
        text: string
        active: boolean
        exclude: string[]
        oninput: (event: Event) => void
        children: Snippet
    } & InputProps = $props()

    let { api } = getContext('appContext') as AppContext

    let inputId = $state(`in-${id}`)
    let hiddenTriggerId = $derived(`no-${inputId}`)

    let isOpen: boolean = $state(false)
    let lastRequestId: string | undefined = $state(undefined)
    let items: string[] = $state([])
    let highlightIndex: number = $state(-1)

    let delay = 100
    let inputDelayTimeout: ReturnType<typeof setTimeout>
    let inputWidth: number = $state(0)

    function onInput(event: Event) {
        trim(event)
        text = (event.target as HTMLInputElement).value

        if (active) {
            if (inputDelayTimeout) {
                clearTimeout(inputDelayTimeout)
            }

            if (delay) {
                inputDelayTimeout = setTimeout(processInput, delay)
            } else {
                processInput()
            }
        }
        oninput(event as InputEvent)
    }

    async function processInput() {
        if (await search()) {
            openDropdown()
        } else {
            closeDropdown()
        }
    }

    function openDropdown() {
        isOpen = true
    }

    function closeDropdown() {
        highlightIndex = -1
        isOpen = false
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

        items = results.filter((item) => !exclude.includes(item))

        return items.length > 0
    }

    function onItemClick(event: Event) {
        const value = (event.target as HTMLElement).textContent
        if (value) {
            text = value
        }
        closeDropdown()
        items = []
    }

    function up() {
        if (highlightIndex > 0) {
            highlightIndex--
        } else {
            highlightIndex = items.length - 1
        }
    }

    function down() {
        if (!open && items.length > 0) {
            openDropdown()
            return
        }

        if (highlightIndex < items.length - 1) {
            highlightIndex++
        } else {
            highlightIndex = 0
        }
    }

    function onKeyDown(event: KeyboardEvent) {
        switch (event.key) {
            case 'ArrowUp':
                up()
                break
            case 'ArrowDown':
                down()
                break
            case 'Enter':
                if (highlightIndex >= 0 && highlightIndex < items.length) {
                    event.preventDefault()
                    text = items[highlightIndex]
                    closeDropdown()
                    items = []
                }
                break
            case 'Escape':
                closeDropdown()
                break
        }
    }

    function highlight(index: number) {
        highlightIndex = index
    }

    $effect(() => {
        if (text.length < 2) {
            closeDropdown()
            items = []
        }
    })
</script>

<div bind:clientWidth={inputWidth} class="relative">
    <div id={hiddenTriggerId} class="hidden"></div>
    <Input id={inputId} bind:value={text} oninput={onInput} onkeydown={onKeyDown} {...others}>
        {#snippet right()}
            <div>{@render children()}</div>
        {/snippet}
    </Input>
    <Dropdown
        bind:isOpen
        reference={`#${inputId}`}
        triggeredBy={`#${hiddenTriggerId}`}
        trigger={'click'}
        offset={0}
        class="mt-2 border-2 dark:border-gray-700 dark:bg-gray-800"
        strategy="fixed"
    >
        <div style="width: {inputWidth}px">
            <DropdownGroup class="py-1">
                {#each items as item, i}
                    <DropdownItem
                        onclick={onItemClick}
                        onmouseenter={() => highlight(i)}
                        class="w-full text-left font-medium py-2 px-4 text-sm hover:bg-gray-100 dark:hover:bg-gray-600
                {highlightIndex === i ? 'dark:bg-gray-600' : ''} "
                        >{item}
                    </DropdownItem>
                {/each}
            </DropdownGroup>
        </div>
    </Dropdown>
</div>
