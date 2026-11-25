<script lang="ts">
    import { Dropdown, DropdownGroup, DropdownItem } from 'flowbite-svelte'
    import { CheckOutline } from 'flowbite-svelte-icons'
    import { deviceLocale, localeOptions, switchDeviceLocale } from '$lib/i18n/locale'
    import type { Locale } from '$lib/paraglide/runtime'
    import { m } from '$lib/paraglide/messages'

    const options = localeOptions({ includePseudoLocale: import.meta.env.DEV })
    const chosen = deviceLocale()
    let open = $state(false)

    function choose(locale: Locale | undefined) {
        open = false
        if (locale === chosen) return
        switchDeviceLocale(locale)
    }
</script>

{#snippet choice(locale: Locale | undefined, name: string)}
    <DropdownItem
        class="flex w-full items-center justify-between gap-4 text-left whitespace-nowrap"
        aria-current={locale === chosen ? 'true' : undefined}
        lang={locale}
        onclick={() => choose(locale)}
        >{name}{#if locale === chosen}<CheckOutline
                class="h-4 w-4"
                aria-hidden="true"
            />{/if}</DropdownItem
    >
{/snippet}

<button
    id="language-menu"
    class="language-menu me-3 cursor-pointer text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
    aria-label={m.preferences_language()}
    title={m.preferences_language()}
>
    <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        class="h-6 w-6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M3 12h18"></path>
        <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"></path>
    </svg>
</button>
<Dropdown triggeredBy="#language-menu" bind:isOpen={open}>
    <DropdownGroup class="max-h-[70vh] overflow-y-auto py-1">
        {@render choice(undefined, m.language_browser_default())}
        {#each options as option (option.locale)}
            {@render choice(option.locale, option.name)}
        {/each}
    </DropdownGroup>
</Dropdown>

<style>
    .language-menu {
        display: grid;
        place-items: center;
        border-radius: 4px;
    }
    .language-menu:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
    }
</style>
