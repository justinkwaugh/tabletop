import { isUsaHex, type HexId } from '@tabletop/ride-the-rails'

/** The hex a board element stands for, from the nearest `data-hex-id` around it. */
export function hexIdOf(target: EventTarget | null): HexId | undefined {
    if (!(target instanceof Element)) return undefined
    const id = target.closest('[data-hex-id]')?.getAttribute('data-hex-id')
    return id && isUsaHex(id) ? id : undefined
}
