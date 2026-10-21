import { isBuyAccessRight } from '@tabletop/18xx'
import type { TitleActionDescription } from '@tabletop/18xx-ui'

export const describe1894Action: TitleActionDescription = (action, _companyName, shared) =>
    isBuyAccessRight(action) ? { ...shared(), text: 'Bought a ferry marker' } : undefined
