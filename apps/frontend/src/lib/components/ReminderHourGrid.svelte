<script lang="ts">
    import { hourLabel, hourName, withHour, withHourRange } from '$lib/utils/reminderHours'

    let {
        hours,
        label,
        onchange
    }: { hours: number[]; label: string; onchange: (hours: number[]) => void } = $props()

    const HALF_DAYS = [
        { name: 'AM', hours: Array.from({ length: 12 }, (_, index) => index) },
        { name: 'PM', hours: Array.from({ length: 12 }, (_, index) => index + 12) }
    ]

    type HourDrag = { anchor: number; current: number; selected: boolean }

    let grid: HTMLDivElement
    let drag = $state<HourDrag | undefined>(undefined)
    const shownHours = $derived(
        drag ? withHourRange(hours, drag.anchor, drag.current, drag.selected) : hours
    )

    function hourAt(event: PointerEvent): number | undefined {
        const cell = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest<HTMLElement>('[data-hour]')
        if (!cell || !grid.contains(cell)) {
            return undefined
        }
        return Number(cell.dataset.hour)
    }

    function startDrag(event: PointerEvent) {
        const hour = hourAt(event)
        if (hour === undefined) {
            return
        }
        drag = { anchor: hour, current: hour, selected: !hours.includes(hour) }
        grid.setPointerCapture(event.pointerId)
    }

    function extendDrag(event: PointerEvent) {
        const hour = hourAt(event)
        if (drag && hour !== undefined) {
            drag.current = hour
        }
    }

    function finishDrag() {
        if (!drag) {
            return
        }
        const result = shownHours
        drag = undefined
        onchange(result)
    }

    function isKeyboardClick(event: MouseEvent): boolean {
        return event.detail === 0
    }

    function toggleFromKeyboard(event: MouseEvent, hour: number) {
        if (isKeyboardClick(event)) {
            onchange(withHour(hours, hour, !hours.includes(hour)))
        }
    }
</script>

<div
    bind:this={grid}
    role="group"
    aria-label={label}
    class="flex touch-none select-none flex-col gap-1"
    onpointerdown={startDrag}
    onpointermove={extendDrag}
    onpointerup={finishDrag}
    onpointercancel={finishDrag}
>
    {#each HALF_DAYS as halfDay (halfDay.name)}
        <div class="flex items-center gap-1">
            <span class="w-8 shrink-0 text-xs text-gray-600 dark:text-gray-400">{halfDay.name}</span
            >
            <div class="grid flex-1 grid-cols-6 gap-1 sm:grid-cols-12">
                {#each halfDay.hours as hour (hour)}
                    {@const selected = shownHours.includes(hour)}
                    <button
                        type="button"
                        data-hour={hour}
                        aria-pressed={selected}
                        aria-label={hourName(hour)}
                        class={[
                            'h-9 rounded-md border text-xs',
                            selected
                                ? 'border-primary-500 bg-primary-600 text-white'
                                : 'border-gray-400 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        ]}
                        onclick={(event) => toggleFromKeyboard(event, hour)}
                    >
                        {hourLabel(hour)}
                    </button>
                {/each}
            </div>
        </div>
    {/each}
</div>
