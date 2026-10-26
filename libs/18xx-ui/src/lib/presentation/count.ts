/** A count with its noun, singular for one: "1 train", "3 stations". */
export function counted(count: number, noun: string, plural = `${noun}s`): string {
    return `${count} ${count === 1 ? noun : plural}`
}
