import { MasterType } from '@tabletop/bridges-of-shangri-la'

export function nameForMasterType(masterType: MasterType, withArticle = false) {
    switch (masterType) {
        case MasterType.Astrologer:
            return `${withArticle ? 'an ' : ''} Astrologer`
        case MasterType.DragonBreeder:
            return `${withArticle ? 'a ' : ''} Dragon Breeder`
        case MasterType.Firekeeper:
            return `${withArticle ? 'a ' : ''} Firekeeper`
        case MasterType.Healer:
            return `${withArticle ? 'a ' : ''} Healer`
        case MasterType.Priest:
            return `${withArticle ? 'a ' : ''} Priest`
        case MasterType.Rainmaker:
            return `${withArticle ? 'a ' : ''} Rainmaker`
        case MasterType.YetiWhisperer:
            return `${withArticle ? 'a ' : ''} Yeti Whisperer`
    }
}
