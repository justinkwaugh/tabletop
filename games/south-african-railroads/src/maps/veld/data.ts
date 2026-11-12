import {
    SettlementKind,
    type ClosedBorderDefinition,
    type ExternalConnectionDefinition,
    type LinkDefinition,
    type SettlementDefinition
} from '../types.js'

export const SETTLEMENTS: readonly SettlementDefinition[] = [
    { id: 'mafeking', name: 'Mafeking', kind: SettlementKind.RailroadStation, x: 650, y: 244 },
    { id: 'vryburg', name: 'Vryburg', kind: SettlementKind.RailroadStation, x: 452.5, y: 286.5 },
    {
        id: 'vaalwater',
        name: 'Vaalwater',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1156.5,
        y: 287
    },
    {
        id: 'lichtenburg',
        name: 'Lichtenburg',
        kind: SettlementKind.AgriculturalRailhead,
        x: 670,
        y: 294.5
    },
    {
        id: 'swartruggens',
        name: 'Swartruggens',
        kind: SettlementKind.RailroadStation,
        x: 813.5,
        y: 316.5
    },
    { id: 'boshoek', name: 'Boshoek', kind: SettlementKind.AgriculturalRailhead, x: 924, y: 345.5 },
    { id: 'purdimoe', name: 'Purdimoe', kind: SettlementKind.RailroadStation, x: 331, y: 352 },
    { id: 'vermaas', name: 'Vermaas', kind: SettlementKind.RailroadStation, x: 586, y: 361.5 },
    {
        id: 'nylstroom',
        name: 'Nylstroom',
        kind: SettlementKind.RailroadStation,
        x: 1161.5,
        y: 368.5
    },
    {
        id: 'naboomspruit',
        name: 'Naboomspruit',
        kind: SettlementKind.RailroadStation,
        x: 1245,
        y: 373.5
    },
    { id: 'coligny', name: 'Coligny', kind: SettlementKind.RailroadStation, x: 676, y: 374.5 },
    {
        id: 'pietersburg',
        name: 'Pietersburg',
        kind: SettlementKind.MercantileCenter,
        x: 1369,
        y: 400.5
    },
    {
        id: 'zoekmakaar',
        name: 'Zoekmakaar',
        kind: SettlementKind.RailroadStation,
        x: 1453.5,
        y: 408.5
    },
    {
        id: 'magaliesburg',
        name: 'Magaliesburg',
        kind: SettlementKind.RailroadStation,
        x: 867.5,
        y: 417.5
    },
    {
        id: 'pienaarsriver',
        name: 'Pienaarsriver',
        kind: SettlementKind.RailroadStation,
        x: 1093.5,
        y: 418.5
    },
    {
        id: 'zebediela',
        name: 'Zebediela',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1319.5,
        y: 453
    },
    {
        id: 'welverdiend',
        name: 'Welverdiend',
        kind: SettlementKind.RailroadStation,
        x: 793.5,
        y: 463.5
    },
    { id: 'pretoria', name: 'Pretoria', kind: SettlementKind.MercantileCenter, x: 1020.5, y: 465 },
    { id: 'warrenton', name: 'Warrenton', kind: SettlementKind.RailroadStation, x: 285, y: 471 },
    { id: 'klerksdorp', name: 'Klerksdorp', kind: SettlementKind.RailroadStation, x: 607, y: 474 },
    { id: 'maquassi', name: 'Maquassi', kind: SettlementKind.RailroadStation, x: 480.5, y: 475.5 },
    {
        id: 'marble-hall',
        name: 'Marble Hall',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1250,
        y: 491
    },
    {
        id: 'potchefstroom',
        name: 'Potchefstroom',
        kind: SettlementKind.RailroadStation,
        x: 698.5,
        y: 495
    },
    { id: 'johannesburg', name: 'Johannesburg', kind: SettlementKind.MetroArea, x: 918, y: 525 },
    {
        id: 'gravelotte',
        name: 'Gravelotte',
        kind: SettlementKind.RailroadStation,
        x: 1509.5,
        y: 545.5
    },
    { id: 'kimberley', name: 'Kimberley', kind: SettlementKind.RailroadBase, x: 193.5, y: 548.5 },
    {
        id: 'vredefort',
        name: 'Vredefort',
        kind: SettlementKind.AgriculturalRailhead,
        x: 696,
        y: 572.5
    },
    {
        id: 'vierfontein',
        name: 'Vierfontein',
        kind: SettlementKind.RailroadStation,
        x: 599.5,
        y: 574.5
    },
    {
        id: 'steelport',
        name: 'Steelport',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1370,
        y: 587
    },
    {
        id: 'vereeniging',
        name: 'Vereeniging',
        kind: SettlementKind.MercantileCenter,
        x: 803,
        y: 613.5
    },
    {
        id: 'bultfontein',
        name: 'Bultfontein',
        kind: SettlementKind.AgriculturalRailhead,
        x: 391.5,
        y: 635.5
    },
    { id: 'witbank', name: 'Witbank', kind: SettlementKind.RailroadStation, x: 1131.5, y: 635.5 },
    { id: 'dover', name: 'Dover', kind: SettlementKind.RailroadStation, x: 697, y: 663.5 },
    {
        id: 'petrusburg',
        name: 'Petrusburg',
        kind: SettlementKind.RailroadStation,
        x: 235.5,
        y: 668
    },
    { id: 'kroonstad', name: 'Kroonstad', kind: SettlementKind.MercantileCenter, x: 606, y: 672 },
    {
        id: 'koffiefontein',
        name: 'Koffiefontein',
        kind: SettlementKind.AgriculturalRailhead,
        x: 165,
        y: 673
    },
    { id: 'belfast', name: 'Belfast', kind: SettlementKind.RailroadStation, x: 1203.5, y: 673 },
    {
        id: 'graskop',
        name: 'Graskop',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1406.5,
        y: 686
    },
    { id: 'balfour', name: 'Balfour', kind: SettlementKind.RailroadStation, x: 948, y: 688 },
    {
        id: 'machadodorp',
        name: 'Machadodorp',
        kind: SettlementKind.RailroadStation,
        x: 1265,
        y: 704
    },
    { id: 'theunissen', name: 'Theunissen', kind: SettlementKind.RailroadStation, x: 450, y: 731 },
    {
        id: 'plaston',
        name: 'Plaston',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1428.5,
        y: 746.5
    },
    { id: 'bethal', name: 'Bethal', kind: SettlementKind.RailroadStation, x: 1097.5, y: 757 },
    {
        id: 'bloemfontein',
        name: 'Bloemfontein',
        kind: SettlementKind.MetroArea,
        x: 310.5,
        y: 760.5
    },
    { id: 'airlie', name: 'Airlie', kind: SettlementKind.RailroadStation, x: 1310, y: 764.5 },
    { id: 'frankfort', name: 'Frankfort', kind: SettlementKind.RailroadStation, x: 840, y: 766 },
    {
        id: 'petrus-steyn',
        name: 'Petrus Steyn',
        kind: SettlementKind.RailroadStation,
        x: 745.5,
        y: 767
    },
    { id: 'breyten', name: 'Breyten', kind: SettlementKind.RailroadStation, x: 1181.5, y: 774.5 },
    { id: 'nelspruit', name: 'Nelspruit', kind: SettlementKind.RailroadStation, x: 1352.5, y: 775 },
    { id: 'sanderton', name: 'Sanderton', kind: SettlementKind.RailroadStation, x: 995.5, y: 805 },
    { id: 'winburg', name: 'Winburg', kind: SettlementKind.AgriculturalRailhead, x: 486, y: 812 },
    {
        id: 'arlington',
        name: 'Arlington',
        kind: SettlementKind.RailroadStation,
        x: 637.5,
        y: 816.5
    },
    { id: 'tweeling', name: 'Tweeling', kind: SettlementKind.RailroadStation, x: 760.5, y: 826 },
    {
        id: 'barberton',
        name: 'Barberton',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1317,
        y: 833.5
    },
    {
        id: 'kaapmuiden',
        name: 'Kaapmuiden',
        kind: SettlementKind.RailroadStation,
        x: 1397.5,
        y: 833.5
    },
    { id: 'lothair', name: 'Lothair', kind: SettlementKind.AgriculturalRailhead, x: 1234, y: 850 },
    { id: 'ermelo', name: 'Ermelo', kind: SettlementKind.RailroadStation, x: 1149, y: 850.5 },
    {
        id: 'watervliet',
        name: 'Watervliet',
        kind: SettlementKind.RailroadStation,
        x: 368.5,
        y: 852.5
    },
    {
        id: 'marquard',
        name: 'Marquard',
        kind: SettlementKind.AgriculturalRailhead,
        x: 521,
        y: 858.5
    },
    {
        id: 'komatipoort',
        name: 'Komatipoort',
        kind: SettlementKind.RailroadStation,
        x: 1470.5,
        y: 858.5
    },
    { id: 'vrede', name: 'Vrede', kind: SettlementKind.AgriculturalRailhead, x: 911.5, y: 860.5 },
    {
        id: 'springfontein',
        name: 'Springfontein',
        kind: SettlementKind.RailroadStation,
        x: 156,
        y: 868
    },
    { id: 'palmford', name: 'Palmford', kind: SettlementKind.RailroadStation, x: 1070, y: 877 },
    {
        id: 'norvals-point',
        name: "Norval's Point",
        kind: SettlementKind.RailroadBase,
        x: 71,
        y: 883
    },
    { id: 'warden', name: 'Warden', kind: SettlementKind.AgriculturalRailhead, x: 834.5, y: 883 },
    { id: 'bethlehem', name: 'Bethlehem', kind: SettlementKind.RailroadStation, x: 689, y: 884 },
    {
        id: 'volksrust',
        name: 'Volksrust',
        kind: SettlementKind.RailroadStation,
        x: 1003.5,
        y: 891.5
    },
    {
        id: 'modderpoort',
        name: 'Modderpoort',
        kind: SettlementKind.RailroadStation,
        x: 471,
        y: 892.5
    },
    {
        id: 'piet-retief',
        name: 'Piet Retief',
        kind: SettlementKind.RailroadStation,
        x: 1160.5,
        y: 953
    },
    {
        id: 'harrismith',
        name: 'Harrismith',
        kind: SettlementKind.RailroadStation,
        x: 805,
        y: 960.5
    },
    {
        id: 'ladybrand',
        name: 'Ladybrand',
        kind: SettlementKind.AgriculturalRailhead,
        x: 534,
        y: 963.5
    },
    { id: 'dreunberg', name: 'Dreunberg', kind: SettlementKind.RailroadStation, x: 122, y: 968 },
    { id: 'newcastle', name: 'Newcastle', kind: SettlementKind.RailroadStation, x: 960, y: 968.5 },
    { id: 'maseru', name: 'Maseru', kind: SettlementKind.AgriculturalRailhead, x: 457, y: 973 },
    { id: 'utrecht', name: 'Utrecht', kind: SettlementKind.AgriculturalRailhead, x: 1039, y: 985 },
    {
        id: 'lourenco-marques',
        name: 'Lourenco Marques',
        kind: SettlementKind.RailroadBase,
        x: 1478,
        y: 993.5
    },
    {
        id: 'aliwal-north',
        name: 'Aliwal North',
        kind: SettlementKind.RailroadBase,
        x: 232,
        y: 1040
    },
    { id: 'vryheid', name: 'Vryheid', kind: SettlementKind.RailroadStation, x: 1043, y: 1041.5 },
    {
        id: 'hlobane',
        name: 'Hlobane',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1124.5,
        y: 1045
    },
    { id: 'ladysmith', name: 'Ladysmith', kind: SettlementKind.RailroadBase, x: 846.5, y: 1046.5 },
    {
        id: 'glencoe-junction',
        name: 'Glencoe Junction',
        kind: SettlementKind.RailroadStation,
        x: 938.5,
        y: 1047
    }
]

export const LINKS: readonly LinkDefinition[] = [
    { id: 'airlie~machadodorp', ends: ['airlie', 'machadodorp'], box: { x: 1279.5, y: 741 } },
    { id: 'airlie~nelspruit', ends: ['airlie', 'nelspruit'], box: { x: 1338.5, y: 738.5 } },
    {
        id: 'aliwal-north~dreunberg',
        ends: ['aliwal-north', 'dreunberg'],
        box: { x: 194, y: 1015 },
        oneWayFrom: 'aliwal-north'
    },
    {
        id: 'aliwal-north~watervliet',
        ends: ['aliwal-north', 'watervliet'],
        box: { x: 337, y: 951.5 }
    },
    { id: 'arlington~bethlehem', ends: ['arlington', 'bethlehem'], box: { x: 665, y: 849 } },
    { id: 'arlington~kroonstad', ends: ['arlington', 'kroonstad'], box: { x: 616, y: 749.5 } },
    { id: 'arlington~marquard', ends: ['arlington', 'marquard'], box: { x: 575, y: 834 } },
    { id: 'arlington~petrus-steyn', ends: ['arlington', 'petrus-steyn'], box: { x: 690, y: 799 } },
    { id: 'balfour~frankfort', ends: ['balfour', 'frankfort'], box: { x: 882.5, y: 733 } },
    { id: 'balfour~johannesburg', ends: ['balfour', 'johannesburg'], box: { x: 926.5, y: 613.5 } },
    { id: 'balfour~sanderton', ends: ['balfour', 'sanderton'], box: { x: 976, y: 750.5 } },
    { id: 'balfour~vereeniging', ends: ['balfour', 'vereeniging'], box: { x: 877, y: 643 } },
    { id: 'barberton~kaapmuiden', ends: ['barberton', 'kaapmuiden'], box: { x: 1357, y: 825.5 } },
    { id: 'belfast~machadodorp', ends: ['belfast', 'machadodorp'], box: { x: 1225.5, y: 706.5 } },
    { id: 'belfast~steelport', ends: ['belfast', 'steelport'], box: { x: 1288.5, y: 632 } },
    { id: 'belfast~witbank', ends: ['belfast', 'witbank'], box: { x: 1165, y: 660.5 } },
    { id: 'bethal~breyten', ends: ['bethal', 'breyten'], box: { x: 1138.5, y: 765.5 } },
    { id: 'bethal~johannesburg', ends: ['bethal', 'johannesburg'], box: { x: 995, y: 633.5 } },
    { id: 'bethal~palmford', ends: ['bethal', 'palmford'], box: { x: 1085, y: 831 } },
    {
        id: 'bethlehem~harrismith',
        ends: ['bethlehem', 'harrismith'],
        box: { x: 745, y: 913.5 },
        oneWayFrom: 'bethlehem'
    },
    { id: 'bethlehem~modderpoort', ends: ['bethlehem', 'modderpoort'], box: { x: 593, y: 917 } },
    { id: 'bethlehem~tweeling', ends: ['bethlehem', 'tweeling'], box: { x: 724.5, y: 854 } },
    {
        id: 'bloemfontein~petrusburg',
        ends: ['bloemfontein', 'petrusburg'],
        box: { x: 262, y: 704.5 }
    },
    {
        id: 'bloemfontein~springfontein',
        ends: ['bloemfontein', 'springfontein'],
        box: { x: 218, y: 834 }
    },
    {
        id: 'bloemfontein~theunissen',
        ends: ['bloemfontein', 'theunissen'],
        box: { x: 381.5, y: 751.5 }
    },
    {
        id: 'bloemfontein~watervliet',
        ends: ['bloemfontein', 'watervliet'],
        box: { x: 341.5, y: 814 }
    },
    { id: 'boshoek~pretoria', ends: ['boshoek', 'pretoria'], box: { x: 969.5, y: 408 } },
    { id: 'breyten~ermelo', ends: ['breyten', 'ermelo'], box: { x: 1168.5, y: 814.5 } },
    { id: 'breyten~machadodorp', ends: ['breyten', 'machadodorp'], box: { x: 1222.5, y: 748.5 } },
    {
        id: 'bultfontein~vierfontein',
        ends: ['bultfontein', 'vierfontein'],
        box: { x: 495.5, y: 604 }
    },
    { id: 'coligny~lichtenburg', ends: ['coligny', 'lichtenburg'], box: { x: 676.5, y: 335 } },
    { id: 'coligny~vermaas', ends: ['coligny', 'vermaas'], box: { x: 632.5, y: 361.5 } },
    { id: 'coligny~welverdiend', ends: ['coligny', 'welverdiend'], box: { x: 723, y: 419.5 } },
    { id: 'dover~kroonstad', ends: ['dover', 'kroonstad'], box: { x: 652.5, y: 668.5 } },
    { id: 'dover~vereeniging', ends: ['dover', 'vereeniging'], box: { x: 741, y: 643 } },
    { id: 'dover~vredefort', ends: ['dover', 'vredefort'], box: { x: 698, y: 618.5 } },
    {
        id: 'dreunberg~springfontein',
        ends: ['dreunberg', 'springfontein'],
        box: { x: 146, y: 921.5 }
    },
    { id: 'ermelo~lothair', ends: ['ermelo', 'lothair'], box: { x: 1192, y: 849.5 } },
    { id: 'ermelo~piet-retief', ends: ['ermelo', 'piet-retief'], box: { x: 1158, y: 900.5 } },
    { id: 'frankfort~tweeling', ends: ['frankfort', 'tweeling'], box: { x: 798.5, y: 795.5 } },
    {
        id: 'glencoe-junction~ladysmith',
        ends: ['glencoe-junction', 'ladysmith'],
        box: { x: 893, y: 1043.5 }
    },
    {
        id: 'glencoe-junction~newcastle',
        ends: ['glencoe-junction', 'newcastle'],
        box: { x: 952.5, y: 1008.5 }
    },
    {
        id: 'glencoe-junction~vryheid',
        ends: ['glencoe-junction', 'vryheid'],
        box: { x: 1001, y: 1041.5 }
    },
    { id: 'graskop~nelspruit', ends: ['graskop', 'nelspruit'], box: { x: 1376.5, y: 716.5 } },
    {
        id: 'gravelotte~komatipoort',
        ends: ['gravelotte', 'komatipoort'],
        box: { x: 1490.5, y: 687.5 }
    },
    {
        id: 'gravelotte~zoekmakaar',
        ends: ['gravelotte', 'zoekmakaar'],
        box: { x: 1482.5, y: 477.5 }
    },
    { id: 'harrismith~ladysmith', ends: ['harrismith', 'ladysmith'], box: { x: 825, y: 1006 } },
    { id: 'harrismith~warden', ends: ['harrismith', 'warden'], box: { x: 818.5, y: 922 } },
    { id: 'hlobane~vryheid', ends: ['hlobane', 'vryheid'], box: { x: 1084, y: 1040.5 } },
    {
        id: 'johannesburg~magaliesburg',
        ends: ['johannesburg', 'magaliesburg'],
        box: { x: 885, y: 455.5 }
    },
    {
        id: 'johannesburg~potchefstroom',
        ends: ['johannesburg', 'potchefstroom'],
        box: { x: 792, y: 509.5 }
    },
    { id: 'johannesburg~pretoria', ends: ['johannesburg', 'pretoria'], box: { x: 992.5, y: 497 } },
    {
        id: 'johannesburg~vereeniging',
        ends: ['johannesburg', 'vereeniging'],
        box: { x: 839, y: 578 }
    },
    {
        id: 'johannesburg~welverdiend',
        ends: ['johannesburg', 'welverdiend'],
        box: { x: 834, y: 480.5 }
    },
    { id: 'johannesburg~witbank', ends: ['johannesburg', 'witbank'], box: { x: 1056.5, y: 603 } },
    {
        id: 'kaapmuiden~komatipoort',
        ends: ['kaapmuiden', 'komatipoort'],
        box: { x: 1438.5, y: 831 }
    },
    { id: 'kaapmuiden~nelspruit', ends: ['kaapmuiden', 'nelspruit'], box: { x: 1386, y: 795.5 } },
    { id: 'kimberley~petrusburg', ends: ['kimberley', 'petrusburg'], box: { x: 218, y: 618 } },
    { id: 'kimberley~warrenton', ends: ['kimberley', 'warrenton'], box: { x: 236.5, y: 518.5 } },
    { id: 'klerksdorp~maquassi', ends: ['klerksdorp', 'maquassi'], box: { x: 541, y: 478 } },
    {
        id: 'klerksdorp~potchefstroom',
        ends: ['klerksdorp', 'potchefstroom'],
        box: { x: 650.5, y: 483.5 }
    },
    { id: 'klerksdorp~vierfontein', ends: ['klerksdorp', 'vierfontein'], box: { x: 605, y: 518 } },
    {
        id: 'koffiefontein~springfontein',
        ends: ['koffiefontein', 'springfontein'],
        box: { x: 158, y: 769.5 }
    },
    {
        id: 'komatipoort~lourenco-marques',
        ends: ['komatipoort', 'lourenco-marques'],
        box: { x: 1477, y: 920.5 }
    },
    { id: 'kroonstad~theunissen', ends: ['kroonstad', 'theunissen'], box: { x: 528, y: 703 } },
    { id: 'kroonstad~vierfontein', ends: ['kroonstad', 'vierfontein'], box: { x: 600.5, y: 618 } },
    { id: 'ladybrand~modderpoort', ends: ['ladybrand', 'modderpoort'], box: { x: 507, y: 930.5 } },
    { id: 'mafeking~swartruggens', ends: ['mafeking', 'swartruggens'], box: { x: 745, y: 285.5 } },
    { id: 'mafeking~vryburg', ends: ['mafeking', 'vryburg'], box: { x: 513, y: 275.5 } },
    { id: 'magaliesburg~pretoria', ends: ['magaliesburg', 'pretoria'], box: { x: 926, y: 442.5 } },
    {
        id: 'magaliesburg~swartruggens',
        ends: ['magaliesburg', 'swartruggens'],
        box: { x: 838.5, y: 362.5 }
    },
    { id: 'maquassi~vermaas', ends: ['maquassi', 'vermaas'], box: { x: 524.5, y: 411 } },
    { id: 'maquassi~warrenton', ends: ['maquassi', 'warrenton'], box: { x: 396, y: 472.5 } },
    {
        id: 'marble-hall~pienaarsriver',
        ends: ['marble-hall', 'pienaarsriver'],
        box: { x: 1184.5, y: 454.5 }
    },
    { id: 'maseru~modderpoort', ends: ['maseru', 'modderpoort'], box: { x: 465.5, y: 933.5 } },
    { id: 'modderpoort~watervliet', ends: ['modderpoort', 'watervliet'], box: { x: 410, y: 877 } },
    {
        id: 'naboomspruit~nylstroom',
        ends: ['naboomspruit', 'nylstroom'],
        box: { x: 1203.5, y: 369.5 }
    },
    {
        id: 'naboomspruit~pietersburg',
        ends: ['naboomspruit', 'pietersburg'],
        box: { x: 1304, y: 386.5 }
    },
    {
        id: 'naboomspruit~zebediela',
        ends: ['naboomspruit', 'zebediela'],
        box: { x: 1281.5, y: 421 }
    },
    { id: 'nelspruit~plaston', ends: ['nelspruit', 'plaston'], box: { x: 1388.5, y: 755 } },
    { id: 'newcastle~utrecht', ends: ['newcastle', 'utrecht'], box: { x: 998.5, y: 982.5 } },
    { id: 'newcastle~volksrust', ends: ['newcastle', 'volksrust'], box: { x: 987.5, y: 935 } },
    {
        id: 'norvals-point~springfontein',
        ends: ['norvals-point', 'springfontein'],
        box: { x: 116.5, y: 881 }
    },
    {
        id: 'nylstroom~pienaarsriver',
        ends: ['nylstroom', 'pienaarsriver'],
        box: { x: 1125.5, y: 389.5 }
    },
    { id: 'nylstroom~vaalwater', ends: ['nylstroom', 'vaalwater'], box: { x: 1155.5, y: 328.5 } },
    { id: 'palmford~volksrust', ends: ['palmford', 'volksrust'], box: { x: 1065, y: 919.5 } },
    {
        id: 'petrus-steyn~vereeniging',
        ends: ['petrus-steyn', 'vereeniging'],
        box: { x: 772.5, y: 710.5 }
    },
    {
        id: 'pienaarsriver~pretoria',
        ends: ['pienaarsriver', 'pretoria'],
        box: { x: 1057.5, y: 441 }
    },
    { id: 'piet-retief~vryheid', ends: ['piet-retief', 'vryheid'], box: { x: 1105, y: 995.5 } },
    { id: 'pietersburg~zoekmakaar', ends: ['pietersburg', 'zoekmakaar'], box: { x: 1412, y: 401 } },
    {
        id: 'potchefstroom~welverdiend',
        ends: ['potchefstroom', 'welverdiend'],
        box: { x: 749, y: 477 }
    },
    { id: 'pretoria~witbank', ends: ['pretoria', 'witbank'], box: { x: 1102, y: 568 } },
    { id: 'purdimoe~vermaas', ends: ['purdimoe', 'vermaas'], box: { x: 461, y: 351.5 } },
    { id: 'purdimoe~vryburg', ends: ['purdimoe', 'vryburg'], box: { x: 401.5, y: 297.5 } },
    { id: 'purdimoe~warrenton', ends: ['purdimoe', 'warrenton'], box: { x: 309, y: 411 } },
    { id: 'sanderton~volksrust', ends: ['sanderton', 'volksrust'], box: { x: 1005.5, y: 846.5 } },
    { id: 'sanderton~vrede', ends: ['sanderton', 'vrede'], box: { x: 949.5, y: 825 } },
    { id: 'theunissen~winburg', ends: ['theunissen', 'winburg'], box: { x: 467.5, y: 770 } }
]

export const EXTERNAL_CONNECTIONS: readonly ExternalConnectionDefinition[] = [
    {
        id: 'bechuanaland',
        name: 'Bechuanaland',
        settlementId: 'mafeking',
        price: 30,
        value: 40,
        x: 650,
        y: 192
    },
    {
        id: 'matabeleland',
        name: 'Matabeleland',
        settlementId: 'zoekmakaar',
        price: 40,
        value: 30,
        x: 1455.5,
        y: 342.5
    }
]

export const CLOSED_BORDERS: readonly ClosedBorderDefinition[] = [
    { opensAfterDividend: 1, linkIds: ['newcastle~volksrust', 'piet-retief~vryheid'] },
    {
        opensAfterDividend: 2,
        linkIds: [
            'balfour~frankfort',
            'balfour~vereeniging',
            'johannesburg~vereeniging',
            'klerksdorp~vierfontein',
            'sanderton~vrede'
        ]
    },
    {
        opensAfterDividend: 3,
        linkIds: ['mafeking~swartruggens', 'maquassi~warrenton', 'purdimoe~vermaas']
    }
]
