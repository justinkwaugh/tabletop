const FirstRepeatDelayMs = 500
const RepeatDelayMs = 200
const FastRepeatDelayMs = 100
const RepeatsBeforeFast = 8

// A button that steps once on press and keeps stepping while held, faster after a
// few repeats. The step reports whether it changed anything, so holding stops at a limit.
export function holdRepeat(node: HTMLButtonElement, step: () => boolean) {
    let currentStep = step
    let timer: ReturnType<typeof setTimeout> | undefined
    let repeats = 0

    const stop = () => {
        clearTimeout(timer)
        timer = undefined
    }
    const scheduleRepeat = (delay: number) => {
        timer = setTimeout(() => {
            if (!currentStep()) return stop()
            repeats += 1
            scheduleRepeat(repeats < RepeatsBeforeFast ? RepeatDelayMs : FastRepeatDelayMs)
        }, delay)
    }
    const press = (event: PointerEvent) => {
        if (event.button !== 0) return
        event.preventDefault()
        stop()
        repeats = 0
        if (currentStep()) scheduleRepeat(FirstRepeatDelayMs)
    }
    // Pointer presses step on pointerdown; a click with no pointer detail is the keyboard.
    const keyboardClick = (event: MouseEvent) => {
        if (event.detail === 0) currentStep()
    }
    const suppressMenu = (event: Event) => event.preventDefault()

    node.addEventListener('pointerdown', press)
    node.addEventListener('click', keyboardClick)
    node.addEventListener('contextmenu', suppressMenu)
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
        node.addEventListener(type, stop)
    }

    return {
        update(next: () => boolean) {
            currentStep = next
        },
        destroy() {
            stop()
            node.removeEventListener('pointerdown', press)
            node.removeEventListener('click', keyboardClick)
            node.removeEventListener('contextmenu', suppressMenu)
            for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
                node.removeEventListener(type, stop)
            }
        }
    }
}
