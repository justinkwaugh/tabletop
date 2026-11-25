import {
    SettlementKind,
    type ExternalConnectionDefinition,
    type LinkDefinition,
    type SettlementDefinition
} from '../types.js'

export const SETTLEMENTS: readonly SettlementDefinition[] = [
    { id: 'malargue', name: 'Malargüe', kind: SettlementKind.Mine, x: 138, y: 1476 },
    { id: 'tunuyan', name: 'Tunuyán', kind: SettlementKind.Mine, x: 155, y: 1202 },
    { id: 'jachal', name: 'Jáchal', kind: SettlementKind.Mine, x: 190, y: 724 },
    { id: 'mendoza', name: 'Mendoza', kind: SettlementKind.Town, x: 196, y: 1096 },
    { id: 'pie-de-palo', name: 'Pie de Palo', kind: SettlementKind.Town, x: 229, y: 922 },
    { id: 'san-rafael', name: 'San Rafael', kind: SettlementKind.Town, x: 257, y: 1336 },
    { id: 'nevado', name: 'Nevado', kind: SettlementKind.Mine, x: 260, y: 1474 },
    { id: 'alvear', name: 'Alvear', kind: SettlementKind.Town, x: 334, y: 1389 },
    { id: 'tinogasta', name: 'Tinogasta', kind: SettlementKind.Mine, x: 339, y: 439 },
    { id: 'la-rioja', name: 'La Rioja', kind: SettlementKind.Town, x: 421, y: 623 },
    { id: 'san-luis', name: 'San Luis', kind: SettlementKind.City, x: 436, y: 1076 },
    { id: 'milagro', name: 'Milagro', kind: SettlementKind.Town, x: 456, y: 889 },
    { id: 'andalgala', name: 'Andalgalá', kind: SettlementKind.Mine, x: 486, y: 354 },
    { id: 'miraflores', name: 'Miraflores', kind: SettlementKind.City, x: 538, y: 511 },
    { id: 'quines', name: 'Quines', kind: SettlementKind.Mine, x: 539, y: 1010 },
    { id: 'telen', name: 'Telén', kind: SettlementKind.Town, x: 583, y: 1566 },
    { id: 'cruz-del-eje', name: 'Cruz del Eje', kind: SettlementKind.Town, x: 589, y: 792 },
    { id: 'tucuman', name: 'Tucumán', kind: SettlementKind.MetroArea, x: 601, y: 237 },
    { id: 'villa-mercedes', name: 'Villa Mercedes', kind: SettlementKind.Town, x: 608, y: 1199 },
    { id: 'villa-dolores', name: 'Villa Dolores', kind: SettlementKind.Mine, x: 621, y: 959 },
    { id: 'frias', name: 'Frías', kind: SettlementKind.Town, x: 629, y: 507 },
    {
        id: 'rosario-de-la-frontera',
        name: 'Rosario de la Frontera',
        kind: SettlementKind.Town,
        x: 642,
        y: 114
    },
    { id: 'villa-valeria', name: 'Villa Valeria', kind: SettlementKind.Town, x: 666, y: 1299 },
    { id: 'la-maruja', name: 'La Maruja', kind: SettlementKind.Town, x: 676, y: 1446 },
    { id: 'rio-cuarto', name: 'Río Cuarto', kind: SettlementKind.Town, x: 714, y: 1130 },
    { id: 'santa-rosa', name: 'Santa Rosa', kind: SettlementKind.City, x: 716, y: 1605 },
    { id: 'acha', name: 'Acha', kind: SettlementKind.Town, x: 727, y: 1734 },
    { id: 'dean-funes', name: 'Deán Funes', kind: SettlementKind.Town, x: 730, y: 751 },
    { id: 'santiago', name: 'Santiago', kind: SettlementKind.City, x: 732, y: 388 },
    { id: 'realico', name: 'Realicó', kind: SettlementKind.Town, x: 734, y: 1390 },
    { id: 'cordoba', name: 'Córdoba', kind: SettlementKind.MetroArea, x: 740, y: 866 },
    { id: 'pico', name: 'Pico', kind: SettlementKind.Town, x: 786, y: 1481 },
    { id: 'catrilo', name: 'Catriló', kind: SettlementKind.Town, x: 829, y: 1581 },
    { id: 'villa-maria', name: 'Villa María', kind: SettlementKind.Town, x: 848, y: 1028 },
    { id: 'villegas', name: 'Villegas', kind: SettlementKind.Town, x: 888, y: 1403 },
    { id: 'rufino', name: 'Rufino', kind: SettlementKind.Town, x: 907, y: 1282 },
    { id: 'tostado', name: 'Tostado', kind: SettlementKind.Town, x: 909, y: 495 },
    { id: 'bahia-blanca', name: 'Bahía Blanca', kind: SettlementKind.Port, x: 950, y: 1900 },
    { id: 'pigue', name: 'Pigüé', kind: SettlementKind.Town, x: 967, y: 1750 },
    { id: 'gonnet', name: 'Gonnet', kind: SettlementKind.Town, x: 978, y: 1453 },
    { id: 'venado-tuerto', name: 'Venado Tuerto', kind: SettlementKind.Town, x: 982, y: 1182 },
    { id: 'san-francisco', name: 'San Francisco', kind: SettlementKind.Town, x: 998, y: 905 },
    { id: 'pringles', name: 'Pringles', kind: SettlementKind.Town, x: 1063, y: 1806 },
    { id: 'bolivar', name: 'Bolívar', kind: SettlementKind.Town, x: 1072, y: 1535 },
    { id: 'junin', name: 'Junín', kind: SettlementKind.Town, x: 1115, y: 1330 },
    { id: 'santa-fe', name: 'Santa Fe', kind: SettlementKind.City, x: 1139, y: 919 },
    { id: 'pergamino', name: 'Pergamino', kind: SettlementKind.Town, x: 1149, y: 1234 },
    { id: 'avia-terai', name: 'Avia Terai', kind: SettlementKind.Town, x: 1154, y: 251 },
    { id: 'bragado', name: 'Bragado', kind: SettlementKind.Town, x: 1168, y: 1409 },
    { id: 'tres-arroyos', name: 'Tres Arroyos', kind: SettlementKind.Town, x: 1168, y: 1841 },
    { id: 'rosario', name: 'Rosario', kind: SettlementKind.MetroArea, x: 1176, y: 1077 },
    { id: 'olavarria', name: 'Olavarría', kind: SettlementKind.City, x: 1177, y: 1644 },
    { id: 'san-nicolas', name: 'San Nicolás', kind: SettlementKind.Town, x: 1243, y: 1188 },
    { id: 'mercedes', name: 'Mercedes', kind: SettlementKind.Town, x: 1256, y: 1337 },
    { id: 'lobos', name: 'Lobos', kind: SettlementKind.Town, x: 1292, y: 1415 },
    { id: 'tandil', name: 'Tandil', kind: SettlementKind.City, x: 1296, y: 1697 },
    { id: 'las-flores', name: 'Las Flores', kind: SettlementKind.Town, x: 1311, y: 1523 },
    { id: 'buenos-aires', name: 'Buenos Aires', kind: SettlementKind.MetroArea, x: 1368, y: 1296 },
    { id: 'resistencia', name: 'Resistencia', kind: SettlementKind.Town, x: 1374, y: 370 },
    { id: 'maipu', name: 'Maipú', kind: SettlementKind.Town, x: 1437, y: 1633 },
    { id: 'mar-del-plata', name: 'Mar del Plata', kind: SettlementKind.Port, x: 1464, y: 1808 },
    { id: 'la-plata', name: 'La Plata', kind: SettlementKind.City, x: 1486, y: 1377 }
]

export const LINKS: readonly LinkDefinition[] = [
    { id: 'acha~bahia-blanca', ends: ['acha', 'bahia-blanca'], box: { x: 825, y: 1829 } },
    { id: 'acha~santa-rosa', ends: ['acha', 'santa-rosa'], box: { x: 707, y: 1670 } },
    { id: 'alvear~nevado', ends: ['alvear', 'nevado'], box: { x: 289, y: 1425 } },
    { id: 'alvear~realico', ends: ['alvear', 'realico'], box: { x: 542, y: 1375 } },
    { id: 'alvear~san-rafael', ends: ['alvear', 'san-rafael'], box: { x: 295, y: 1362 } },
    { id: 'andalgala~la-rioja', ends: ['andalgala', 'la-rioja'], box: { x: 459, y: 458 } },
    { id: 'avia-terai~resistencia', ends: ['avia-terai', 'resistencia'], box: { x: 1289, y: 279 } },
    {
        id: 'avia-terai~rosario-de-la-frontera',
        ends: ['avia-terai', 'rosario-de-la-frontera'],
        box: { x: 900, y: 197 }
    },
    { id: 'avia-terai~tostado', ends: ['avia-terai', 'tostado'], box: { x: 1009, y: 345 } },
    {
        id: 'bahia-blanca~catrilo',
        ends: ['bahia-blanca', 'catrilo'],
        box: { x: 905, y: 1782 },
        oneWayFrom: 'bahia-blanca'
    },
    { id: 'bahia-blanca~pigue', ends: ['bahia-blanca', 'pigue'], box: { x: 959, y: 1814 } },
    { id: 'bahia-blanca~pringles', ends: ['bahia-blanca', 'pringles'], box: { x: 1007, y: 1853 } },
    {
        id: 'bahia-blanca~tres-arroyos',
        ends: ['bahia-blanca', 'tres-arroyos'],
        box: { x: 1068, y: 1883 }
    },
    { id: 'bolivar~gonnet', ends: ['bolivar', 'gonnet'], box: { x: 1025, y: 1492 } },
    { id: 'bolivar~lobos', ends: ['bolivar', 'lobos'], box: { x: 1184, y: 1475 } },
    { id: 'bolivar~pigue', ends: ['bolivar', 'pigue'], box: { x: 1001, y: 1629 } },
    { id: 'bragado~gonnet', ends: ['bragado', 'gonnet'], box: { x: 1073, y: 1425 } },
    { id: 'bragado~lobos', ends: ['bragado', 'lobos'], box: { x: 1233, y: 1407 } },
    { id: 'bragado~mercedes', ends: ['bragado', 'mercedes'], box: { x: 1213, y: 1370 } },
    { id: 'bragado~villegas', ends: ['bragado', 'villegas'], box: { x: 1027, y: 1400 } },
    { id: 'buenos-aires~la-plata', ends: ['buenos-aires', 'la-plata'], box: { x: 1427, y: 1341 } },
    {
        id: 'buenos-aires~las-flores',
        ends: ['buenos-aires', 'las-flores'],
        box: { x: 1348, y: 1417 }
    },
    { id: 'buenos-aires~lobos', ends: ['buenos-aires', 'lobos'], box: { x: 1322, y: 1364 } },
    { id: 'buenos-aires~maipu', ends: ['buenos-aires', 'maipu'], box: { x: 1401, y: 1446 } },
    { id: 'buenos-aires~mercedes', ends: ['buenos-aires', 'mercedes'], box: { x: 1305, y: 1320 } },
    {
        id: 'buenos-aires~pergamino',
        ends: ['buenos-aires', 'pergamino'],
        box: { x: 1251, y: 1262 }
    },
    {
        id: 'buenos-aires~san-nicolas',
        ends: ['buenos-aires', 'san-nicolas'],
        box: { x: 1296, y: 1230 }
    },
    { id: 'catrilo~gonnet', ends: ['catrilo', 'gonnet'], box: { x: 909, y: 1519 } },
    { id: 'catrilo~pico', ends: ['catrilo', 'pico'], box: { x: 808, y: 1525 } },
    { id: 'catrilo~santa-rosa', ends: ['catrilo', 'santa-rosa'], box: { x: 777, y: 1598 } },
    {
        id: 'cordoba~cruz-del-eje',
        ends: ['cordoba', 'cruz-del-eje'],
        box: { x: 655, y: 820 },
        oneWayFrom: 'cordoba'
    },
    {
        id: 'cordoba~dean-funes',
        ends: ['cordoba', 'dean-funes'],
        box: { x: 738, y: 802 },
        oneWayFrom: 'cordoba'
    },
    { id: 'cordoba~rio-cuarto', ends: ['cordoba', 'rio-cuarto'], box: { x: 726, y: 996 } },
    { id: 'cordoba~san-francisco', ends: ['cordoba', 'san-francisco'], box: { x: 875, y: 886 } },
    {
        id: 'cordoba~villa-maria',
        ends: ['cordoba', 'villa-maria'],
        box: { x: 799, y: 940 },
        oneWayFrom: 'villa-maria'
    },
    {
        id: 'cruz-del-eje~dean-funes',
        ends: ['cruz-del-eje', 'dean-funes'],
        box: { x: 657, y: 767 }
    },
    { id: 'cruz-del-eje~la-rioja', ends: ['cruz-del-eje', 'la-rioja'], box: { x: 494, y: 714 } },
    { id: 'cruz-del-eje~milagro', ends: ['cruz-del-eje', 'milagro'], box: { x: 521, y: 835 } },
    { id: 'dean-funes~frias', ends: ['dean-funes', 'frias'], box: { x: 677, y: 633 } },
    { id: 'frias~santiago', ends: ['frias', 'santiago'], box: { x: 684, y: 441 } },
    { id: 'frias~tucuman', ends: ['frias', 'tucuman'], box: { x: 607, y: 376 } },
    { id: 'gonnet~pico', ends: ['gonnet', 'pico'], box: { x: 888, y: 1460 } },
    { id: 'jachal~pie-de-palo', ends: ['jachal', 'pie-de-palo'], box: { x: 216, y: 819 } },
    { id: 'junin~mercedes', ends: ['junin', 'mercedes'], box: { x: 1181, y: 1333 } },
    { id: 'junin~pergamino', ends: ['junin', 'pergamino'], box: { x: 1133, y: 1281 } },
    { id: 'junin~rufino', ends: ['junin', 'rufino'], box: { x: 1007, y: 1301 } },
    { id: 'la-maruja~pico', ends: ['la-maruja', 'pico'], box: { x: 729, y: 1462 } },
    { id: 'la-rioja~miraflores', ends: ['la-rioja', 'miraflores'], box: { x: 479, y: 564 } },
    { id: 'la-rioja~tinogasta', ends: ['la-rioja', 'tinogasta'], box: { x: 380, y: 536 } },
    { id: 'las-flores~olavarria', ends: ['las-flores', 'olavarria'], box: { x: 1260, y: 1581 } },
    { id: 'las-flores~tandil', ends: ['las-flores', 'tandil'], box: { x: 1315, y: 1612 } },
    { id: 'lobos~olavarria', ends: ['lobos', 'olavarria'], box: { x: 1236, y: 1524 } },
    { id: 'maipu~mar-del-plata', ends: ['maipu', 'mar-del-plata'], box: { x: 1451, y: 1727 } },
    { id: 'maipu~tandil', ends: ['maipu', 'tandil'], box: { x: 1374, y: 1663 } },
    { id: 'malargue~san-rafael', ends: ['malargue', 'san-rafael'], box: { x: 225, y: 1399 } },
    {
        id: 'mar-del-plata~tres-arroyos',
        ends: ['mar-del-plata', 'tres-arroyos'],
        box: { x: 1325, y: 1826 }
    },
    { id: 'mendoza~pie-de-palo', ends: ['mendoza', 'pie-de-palo'], box: { x: 215, y: 1015 } },
    { id: 'mendoza~san-luis', ends: ['mendoza', 'san-luis'], box: { x: 326, y: 1073 } },
    { id: 'mendoza~san-rafael', ends: ['mendoza', 'san-rafael'], box: { x: 247, y: 1226 } },
    { id: 'mendoza~tunuyan', ends: ['mendoza', 'tunuyan'], box: { x: 174, y: 1145 } },
    { id: 'mendoza~villa-mercedes', ends: ['mendoza', 'villa-mercedes'], box: { x: 428, y: 1153 } },
    { id: 'milagro~pie-de-palo', ends: ['milagro', 'pie-de-palo'], box: { x: 348, y: 911 } },
    { id: 'milagro~quines', ends: ['milagro', 'quines'], box: { x: 497, y: 943 } },
    { id: 'olavarria~pigue', ends: ['olavarria', 'pigue'], box: { x: 1070, y: 1703 } },
    { id: 'olavarria~pringles', ends: ['olavarria', 'pringles'], box: { x: 1127, y: 1725 } },
    { id: 'pergamino~rosario', ends: ['pergamino', 'rosario'], box: { x: 1163, y: 1150 } },
    {
        id: 'pergamino~venado-tuerto',
        ends: ['pergamino', 'venado-tuerto'],
        box: { x: 1067, y: 1202 }
    },
    { id: 'pico~realico', ends: ['pico', 'realico'], box: { x: 760, y: 1425 } },
    { id: 'pico~telen', ends: ['pico', 'telen'], box: { x: 687, y: 1517 } },
    { id: 'realico~villa-valeria', ends: ['realico', 'villa-valeria'], box: { x: 699, y: 1336 } },
    { id: 'realico~villegas', ends: ['realico', 'villegas'], box: { x: 813, y: 1396 } },
    { id: 'resistencia~santa-fe', ends: ['resistencia', 'santa-fe'], box: { x: 1292, y: 662 } },
    {
        id: 'rio-cuarto~venado-tuerto',
        ends: ['rio-cuarto', 'venado-tuerto'],
        box: { x: 878, y: 1151 }
    },
    { id: 'rio-cuarto~villa-maria', ends: ['rio-cuarto', 'villa-maria'], box: { x: 785, y: 1074 } },
    {
        id: 'rio-cuarto~villa-mercedes',
        ends: ['rio-cuarto', 'villa-mercedes'],
        box: { x: 663, y: 1147 }
    },
    {
        id: 'rosario-de-la-frontera~tucuman',
        ends: ['rosario-de-la-frontera', 'tucuman'],
        box: { x: 613, y: 173 }
    },
    { id: 'rosario~san-francisco', ends: ['rosario', 'san-francisco'], box: { x: 1078, y: 980 } },
    {
        id: 'rosario~san-nicolas',
        ends: ['rosario', 'san-nicolas'],
        box: { x: 1214, y: 1135 },
        oneWayFrom: 'san-nicolas'
    },
    { id: 'rosario~santa-fe', ends: ['rosario', 'santa-fe'], box: { x: 1166, y: 992 } },
    { id: 'rosario~venado-tuerto', ends: ['rosario', 'venado-tuerto'], box: { x: 1082, y: 1128 } },
    { id: 'rosario~villa-maria', ends: ['rosario', 'villa-maria'], box: { x: 1014, y: 1053 } },
    { id: 'rufino~venado-tuerto', ends: ['rufino', 'venado-tuerto'], box: { x: 949, y: 1224 } },
    { id: 'rufino~villa-mercedes', ends: ['rufino', 'villa-mercedes'], box: { x: 755, y: 1239 } },
    { id: 'rufino~villa-valeria', ends: ['rufino', 'villa-valeria'], box: { x: 765, y: 1289 } },
    { id: 'san-francisco~santa-fe', ends: ['san-francisco', 'santa-fe'], box: { x: 1073, y: 913 } },
    { id: 'san-francisco~tostado', ends: ['san-francisco', 'tostado'], box: { x: 916, y: 687 } },
    {
        id: 'san-francisco~villa-maria',
        ends: ['san-francisco', 'villa-maria'],
        box: { x: 929, y: 960 }
    },
    {
        id: 'san-luis~villa-mercedes',
        ends: ['san-luis', 'villa-mercedes'],
        box: { x: 524, y: 1121 }
    },
    {
        id: 'san-rafael~villa-valeria',
        ends: ['san-rafael', 'villa-valeria'],
        box: { x: 472, y: 1314 }
    },
    { id: 'santa-fe~tostado', ends: ['santa-fe', 'tostado'], box: { x: 1037, y: 694 } },
    { id: 'santiago~tostado', ends: ['santiago', 'tostado'], box: { x: 812, y: 435 } },
    { id: 'santiago~tucuman', ends: ['santiago', 'tucuman'], box: { x: 665, y: 314 } },
    { id: 'tandil~tres-arroyos', ends: ['tandil', 'tres-arroyos'], box: { x: 1250, y: 1775 } },
    {
        id: 'villa-dolores~villa-mercedes',
        ends: ['villa-dolores', 'villa-mercedes'],
        box: { x: 607, y: 1076 }
    },
    {
        id: 'villa-mercedes~villa-valeria',
        ends: ['villa-mercedes', 'villa-valeria'],
        box: { x: 632, y: 1249 }
    }
]

export const EXTERNAL_CONNECTIONS: readonly ExternalConnectionDefinition[] = [
    {
        id: 'bolivia',
        name: 'Bolivia',
        settlementId: 'rosario-de-la-frontera',
        price: 35,
        value: 20,
        x: 530,
        y: 62
    },
    {
        id: 'paraguay',
        name: 'Paraguay',
        settlementId: 'rosario-de-la-frontera',
        price: 20,
        value: 15,
        x: 755,
        y: 62
    },
    { id: 'chile', name: 'Chile', settlementId: 'mendoza', price: 40, value: 30, x: 122, y: 1035 },
    {
        id: 'overseas',
        name: 'Overseas',
        settlementId: 'bahia-blanca',
        price: 25,
        value: 15,
        x: 760,
        y: 1905
    }
]
