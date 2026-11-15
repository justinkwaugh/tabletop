import { isBuyAccessRight, isCorporateFinance } from '@tabletop/18xx'
import { counted, type TitleActionDescription } from '@tabletop/18xx-ui'

export const describe1894Action: TitleActionDescription = (action, _companyName, shared) => {
    if (isBuyAccessRight(action)) return { ...shared(), text: 'Bought a ferry marker' }
    if (isCorporateFinance(action) && action.operation === 'issue')
        return {
            ...shared(),
            text: `Reissued ${counted(action.shares, 'share')}`,
            detail: 'Par becomes ₣100'
        }
    return undefined
}
