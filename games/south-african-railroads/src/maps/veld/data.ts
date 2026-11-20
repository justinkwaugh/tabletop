import {
    SettlementKind,
    type ClosedBorderDefinition,
    type ExternalConnectionDefinition,
    type LinkDefinition,
    type SettlementDefinition
} from '../types.js'

export const SETTLEMENTS: readonly SettlementDefinition[] = [
    { id: 'mafeking', name: 'Mafeking', kind: SettlementKind.RailroadStation, x: 650, y: 244.5 },
    { id: 'vryburg', name: 'Vryburg', kind: SettlementKind.RailroadStation, x: 452.5, y: 286.5 },
    {
        id: 'vaalwater',
        name: 'Vaalwater',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1156.5,
        y: 285.5
    },
    {
        id: 'lichtenburg',
        name: 'Lichtenburg',
        kind: SettlementKind.AgriculturalRailhead,
        x: 678.5,
        y: 302.5
    },
    {
        id: 'swartruggens',
        name: 'Swartruggens',
        kind: SettlementKind.RailroadStation,
        x: 811,
        y: 307.5
    },
    { id: 'boshoek', name: 'Boshoek', kind: SettlementKind.AgriculturalRailhead, x: 924.5, y: 339 },
    { id: 'purdimoe', name: 'Purdimoe', kind: SettlementKind.RailroadStation, x: 331, y: 352 },
    { id: 'vermaas', name: 'Vermaas', kind: SettlementKind.RailroadStation, x: 572.5, y: 350 },
    {
        id: 'nylstroom',
        name: 'Nylstroom',
        kind: SettlementKind.RailroadStation,
        x: 1162.5,
        y: 369.5
    },
    {
        id: 'naboomspruit',
        name: 'Naboomspruit',
        kind: SettlementKind.RailroadStation,
        x: 1247,
        y: 372.5
    },
    { id: 'coligny', name: 'Coligny', kind: SettlementKind.RailroadStation, x: 676.5, y: 384.5 },
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
        x: 860,
        y: 401
    },
    {
        id: 'pienaarsriver',
        name: 'Pienaarsriver',
        kind: SettlementKind.RailroadStation,
        x: 1108.5,
        y: 416.5
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
        x: 778.5,
        y: 458.5
    },
    { id: 'pretoria', name: 'Pretoria', kind: SettlementKind.MercantileCenter, x: 1028, y: 454.5 },
    { id: 'warrenton', name: 'Warrenton', kind: SettlementKind.RailroadStation, x: 285, y: 471 },
    { id: 'klerksdorp', name: 'Klerksdorp', kind: SettlementKind.RailroadStation, x: 607, y: 474 },
    { id: 'maquassi', name: 'Maquassi', kind: SettlementKind.RailroadStation, x: 480.5, y: 481 },
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
        x: 692.5,
        y: 492.5
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
        x: 690.5,
        y: 577
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
        x: 791,
        y: 618
    },
    {
        id: 'bultfontein',
        name: 'Bultfontein',
        kind: SettlementKind.AgriculturalRailhead,
        x: 391.5,
        y: 635.5
    },
    { id: 'witbank', name: 'Witbank', kind: SettlementKind.RailroadStation, x: 1130, y: 632.5 },
    { id: 'dover', name: 'Dover', kind: SettlementKind.RailroadStation, x: 695, y: 664.5 },
    {
        id: 'petrusburg',
        name: 'Petrusburg',
        kind: SettlementKind.RailroadStation,
        x: 235.5,
        y: 665
    },
    { id: 'kroonstad', name: 'Kroonstad', kind: SettlementKind.MercantileCenter, x: 606.5, y: 672 },
    {
        id: 'koffiefontein',
        name: 'Koffiefontein',
        kind: SettlementKind.AgriculturalRailhead,
        x: 165,
        y: 673
    },
    { id: 'belfast', name: 'Belfast', kind: SettlementKind.RailroadStation, x: 1208, y: 668.5 },
    {
        id: 'graskop',
        name: 'Graskop',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1406.5,
        y: 675.5
    },
    { id: 'balfour', name: 'Balfour', kind: SettlementKind.RailroadStation, x: 950.5, y: 700.5 },
    {
        id: 'machadodorp',
        name: 'Machadodorp',
        kind: SettlementKind.RailroadStation,
        x: 1269.5,
        y: 687
    },
    {
        id: 'theunissen',
        name: 'Theunissen',
        kind: SettlementKind.RailroadStation,
        x: 450,
        y: 727.5
    },
    {
        id: 'plaston',
        name: 'Plaston',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1430,
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
    { id: 'airlie', name: 'Airlie', kind: SettlementKind.RailroadStation, x: 1302.5, y: 778 },
    { id: 'frankfort', name: 'Frankfort', kind: SettlementKind.RailroadStation, x: 844.5, y: 769 },
    {
        id: 'petrus-steyn',
        name: 'Petrus Steyn',
        kind: SettlementKind.RailroadStation,
        x: 745.5,
        y: 767
    },
    { id: 'breyten', name: 'Breyten', kind: SettlementKind.RailroadStation, x: 1192.5, y: 781 },
    { id: 'nelspruit', name: 'Nelspruit', kind: SettlementKind.RailroadStation, x: 1341.5, y: 788 },
    { id: 'sanderton', name: 'Sanderton', kind: SettlementKind.RailroadStation, x: 995.5, y: 805 },
    { id: 'winburg', name: 'Winburg', kind: SettlementKind.AgriculturalRailhead, x: 486, y: 810.5 },
    {
        id: 'arlington',
        name: 'Arlington',
        kind: SettlementKind.RailroadStation,
        x: 637.5,
        y: 804
    },
    { id: 'tweeling', name: 'Tweeling', kind: SettlementKind.RailroadStation, x: 766.5, y: 827 },
    {
        id: 'barberton',
        name: 'Barberton',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1313.5,
        y: 835.5
    },
    {
        id: 'kaapmuiden',
        name: 'Kaapmuiden',
        kind: SettlementKind.RailroadStation,
        x: 1397,
        y: 840
    },
    {
        id: 'lothair',
        name: 'Lothair',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1234.5,
        y: 856
    },
    { id: 'ermelo', name: 'Ermelo', kind: SettlementKind.RailroadStation, x: 1149, y: 858.5 },
    {
        id: 'watervliet',
        name: 'Watervliet',
        kind: SettlementKind.RailroadStation,
        x: 368.5,
        y: 855
    },
    {
        id: 'marquard',
        name: 'Marquard',
        kind: SettlementKind.AgriculturalRailhead,
        x: 523.5,
        y: 859.5
    },
    {
        id: 'komatipoort',
        name: 'Komatipoort',
        kind: SettlementKind.RailroadStation,
        x: 1470.5,
        y: 858.5
    },
    { id: 'vrede', name: 'Vrede', kind: SettlementKind.AgriculturalRailhead, x: 900, y: 863 },
    {
        id: 'springfontein',
        name: 'Springfontein',
        kind: SettlementKind.RailroadStation,
        x: 159,
        y: 868
    },
    { id: 'palmford', name: 'Palmford', kind: SettlementKind.RailroadStation, x: 1070, y: 876.5 },
    {
        id: 'norvals-point',
        name: "Norval's Point",
        kind: SettlementKind.RailroadBase,
        x: 71,
        y: 883
    },
    { id: 'warden', name: 'Warden', kind: SettlementKind.AgriculturalRailhead, x: 834.5, y: 877.5 },
    { id: 'bethlehem', name: 'Bethlehem', kind: SettlementKind.RailroadStation, x: 689.5, y: 881 },
    {
        id: 'volksrust',
        name: 'Volksrust',
        kind: SettlementKind.RailroadStation,
        x: 1009.5,
        y: 891.5
    },
    {
        id: 'modderpoort',
        name: 'Modderpoort',
        kind: SettlementKind.RailroadStation,
        x: 470.5,
        y: 889.5
    },
    {
        id: 'piet-retief',
        name: 'Piet Retief',
        kind: SettlementKind.RailroadStation,
        x: 1161,
        y: 952.5
    },
    {
        id: 'harrismith',
        name: 'Harrismith',
        kind: SettlementKind.RailroadStation,
        x: 791.5,
        y: 960.5
    },
    {
        id: 'ladybrand',
        name: 'Ladybrand',
        kind: SettlementKind.AgriculturalRailhead,
        x: 534,
        y: 964
    },
    { id: 'dreunberg', name: 'Dreunberg', kind: SettlementKind.RailroadStation, x: 122, y: 968 },
    { id: 'newcastle', name: 'Newcastle', kind: SettlementKind.RailroadStation, x: 958, y: 978 },
    { id: 'maseru', name: 'Maseru', kind: SettlementKind.AgriculturalRailhead, x: 457, y: 976.5 },
    {
        id: 'utrecht',
        name: 'Utrecht',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1041.5,
        y: 985
    },
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
    { id: 'vryheid', name: 'Vryheid', kind: SettlementKind.RailroadStation, x: 1043.5, y: 1043.5 },
    {
        id: 'hlobane',
        name: 'Hlobane',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1127,
        y: 1045
    },
    { id: 'ladysmith', name: 'Ladysmith', kind: SettlementKind.RailroadBase, x: 846.5, y: 1046.5 },
    {
        id: 'glencoe-junction',
        name: 'Glencoe Junction',
        kind: SettlementKind.RailroadStation,
        x: 938,
        y: 1064.5
    }
]

export const LINKS: readonly LinkDefinition[] = [
    { id: 'airlie~machadodorp', ends: ['airlie', 'machadodorp'], box: { x: 1288, y: 734 } },
    { id: 'airlie~nelspruit', ends: ['airlie', 'nelspruit'], box: { x: 1327, y: 741 } },
    {
        id: 'aliwal-north~dreunberg',
        ends: ['aliwal-north', 'dreunberg'],
        box: { x: 194, y: 991.5 },
        oneWayFrom: 'aliwal-north'
    },
    {
        id: 'aliwal-north~watervliet',
        ends: ['aliwal-north', 'watervliet'],
        box: { x: 299, y: 927.5 }
    },
    { id: 'arlington~bethlehem', ends: ['arlington', 'bethlehem'], box: { x: 665, y: 842.5 } },
    { id: 'arlington~kroonstad', ends: ['arlington', 'kroonstad'], box: { x: 613.5, y: 749.5 } },
    { id: 'arlington~marquard', ends: ['arlington', 'marquard'], box: { x: 575, y: 834 } },
    { id: 'arlington~petrus-steyn', ends: ['arlington', 'petrus-steyn'], box: { x: 690, y: 799 } },
    { id: 'balfour~frankfort', ends: ['balfour', 'frankfort'], box: { x: 891, y: 734 } },
    { id: 'balfour~johannesburg', ends: ['balfour', 'johannesburg'], box: { x: 928.5, y: 634.5 } },
    { id: 'balfour~sanderton', ends: ['balfour', 'sanderton'], box: { x: 977.5, y: 755.5 } },
    { id: 'balfour~vereeniging', ends: ['balfour', 'vereeniging'], box: { x: 871.5, y: 659 } },
    { id: 'barberton~kaapmuiden', ends: ['barberton', 'kaapmuiden'], box: { x: 1357.5, y: 837 } },
    { id: 'belfast~machadodorp', ends: ['belfast', 'machadodorp'], box: { x: 1233, y: 707.5 } },
    { id: 'belfast~steelport', ends: ['belfast', 'steelport'], box: { x: 1260, y: 609.5 } },
    { id: 'belfast~witbank', ends: ['belfast', 'witbank'], box: { x: 1169, y: 659.5 } },
    { id: 'bethal~breyten', ends: ['bethal', 'breyten'], box: { x: 1138.5, y: 765.5 } },
    { id: 'bethal~johannesburg', ends: ['bethal', 'johannesburg'], box: { x: 1004.5, y: 646.5 } },
    { id: 'bethal~palmford', ends: ['bethal', 'palmford'], box: { x: 1085, y: 832 } },
    {
        id: 'bethlehem~harrismith',
        ends: ['bethlehem', 'harrismith'],
        box: { x: 741, y: 916.5 },
        oneWayFrom: 'bethlehem'
    },
    { id: 'bethlehem~modderpoort', ends: ['bethlehem', 'modderpoort'], box: { x: 594.5, y: 902 } },
    { id: 'bethlehem~tweeling', ends: ['bethlehem', 'tweeling'], box: { x: 728.5, y: 854 } },
    {
        id: 'bloemfontein~petrusburg',
        ends: ['bloemfontein', 'petrusburg'],
        box: { x: 262, y: 704 }
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
        box: { x: 341.5, y: 816 }
    },
    { id: 'boshoek~pretoria', ends: ['boshoek', 'pretoria'], box: { x: 976, y: 392.5 } },
    { id: 'breyten~ermelo', ends: ['breyten', 'ermelo'], box: { x: 1168.5, y: 819.5 } },
    { id: 'breyten~machadodorp', ends: ['breyten', 'machadodorp'], box: { x: 1247, y: 746.5 } },
    {
        id: 'bultfontein~vierfontein',
        ends: ['bultfontein', 'vierfontein'],
        box: { x: 495.5, y: 604 }
    },
    { id: 'coligny~lichtenburg', ends: ['coligny', 'lichtenburg'], box: { x: 676.5, y: 345.5 } },
    { id: 'coligny~vermaas', ends: ['coligny', 'vermaas'], box: { x: 632.5, y: 361.5 } },
    { id: 'coligny~welverdiend', ends: ['coligny', 'welverdiend'], box: { x: 715.5, y: 422 } },
    { id: 'dover~kroonstad', ends: ['dover', 'kroonstad'], box: { x: 652.5, y: 668.5 } },
    { id: 'dover~vereeniging', ends: ['dover', 'vereeniging'], box: { x: 735, y: 647 } },
    { id: 'dover~vredefort', ends: ['dover', 'vredefort'], box: { x: 694, y: 621.5 } },
    {
        id: 'dreunberg~springfontein',
        ends: ['dreunberg', 'springfontein'],
        box: { x: 146, y: 921.5 }
    },
    { id: 'ermelo~lothair', ends: ['ermelo', 'lothair'], box: { x: 1190, y: 859.5 } },
    { id: 'ermelo~piet-retief', ends: ['ermelo', 'piet-retief'], box: { x: 1158, y: 900.5 } },
    { id: 'frankfort~tweeling', ends: ['frankfort', 'tweeling'], box: { x: 805.5, y: 790 } },
    {
        id: 'glencoe-junction~ladysmith',
        ends: ['glencoe-junction', 'ladysmith'],
        box: { x: 913.5, y: 1029 }
    },
    {
        id: 'glencoe-junction~newcastle',
        ends: ['glencoe-junction', 'newcastle'],
        box: { x: 948.5, y: 1017 }
    },
    {
        id: 'glencoe-junction~vryheid',
        ends: ['glencoe-junction', 'vryheid'],
        box: { x: 986.5, y: 1024.5 }
    },
    { id: 'graskop~nelspruit', ends: ['graskop', 'nelspruit'], box: { x: 1373, y: 719 } },
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
    { id: 'harrismith~ladysmith', ends: ['harrismith', 'ladysmith'], box: { x: 825, y: 998.5 } },
    { id: 'harrismith~warden', ends: ['harrismith', 'warden'], box: { x: 818.5, y: 921.5 } },
    { id: 'hlobane~vryheid', ends: ['hlobane', 'vryheid'], box: { x: 1082.5, y: 1040.5 } },
    {
        id: 'johannesburg~magaliesburg',
        ends: ['johannesburg', 'magaliesburg'],
        box: { x: 875.5, y: 440.5 }
    },
    {
        id: 'johannesburg~potchefstroom',
        ends: ['johannesburg', 'potchefstroom'],
        box: { x: 776.5, y: 507.5 }
    },
    { id: 'johannesburg~pretoria', ends: ['johannesburg', 'pretoria'], box: { x: 1013, y: 496.5 } },
    {
        id: 'johannesburg~vereeniging',
        ends: ['johannesburg', 'vereeniging'],
        box: { x: 847, y: 583.5 }
    },
    {
        id: 'johannesburg~welverdiend',
        ends: ['johannesburg', 'welverdiend'],
        box: { x: 818, y: 471 }
    },
    { id: 'johannesburg~witbank', ends: ['johannesburg', 'witbank'], box: { x: 1068, y: 609.5 } },
    {
        id: 'kaapmuiden~komatipoort',
        ends: ['kaapmuiden', 'komatipoort'],
        box: { x: 1436, y: 831 }
    },
    { id: 'kaapmuiden~nelspruit', ends: ['kaapmuiden', 'nelspruit'], box: { x: 1386, y: 798 } },
    { id: 'kimberley~petrusburg', ends: ['kimberley', 'petrusburg'], box: { x: 218, y: 618 } },
    { id: 'kimberley~warrenton', ends: ['kimberley', 'warrenton'], box: { x: 242.5, y: 511 } },
    { id: 'klerksdorp~maquassi', ends: ['klerksdorp', 'maquassi'], box: { x: 541, y: 477.5 } },
    {
        id: 'klerksdorp~potchefstroom',
        ends: ['klerksdorp', 'potchefstroom'],
        box: { x: 650, y: 481.5 }
    },
    {
        id: 'klerksdorp~vierfontein',
        ends: ['klerksdorp', 'vierfontein'],
        box: { x: 605.5, y: 513.5 }
    },
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
    { id: 'ladybrand~modderpoort', ends: ['ladybrand', 'modderpoort'], box: { x: 526, y: 919.5 } },
    { id: 'mafeking~swartruggens', ends: ['mafeking', 'swartruggens'], box: { x: 745, y: 286 } },
    { id: 'mafeking~vryburg', ends: ['mafeking', 'vryburg'], box: { x: 512.5, y: 272 } },
    { id: 'magaliesburg~pretoria', ends: ['magaliesburg', 'pretoria'], box: { x: 928, y: 421 } },
    {
        id: 'magaliesburg~swartruggens',
        ends: ['magaliesburg', 'swartruggens'],
        box: { x: 833.5, y: 352.5 }
    },
    { id: 'maquassi~vermaas', ends: ['maquassi', 'vermaas'], box: { x: 497, y: 443 } },
    { id: 'maquassi~warrenton', ends: ['maquassi', 'warrenton'], box: { x: 396, y: 472.5 } },
    {
        id: 'marble-hall~pienaarsriver',
        ends: ['marble-hall', 'pienaarsriver'],
        box: { x: 1185, y: 454.5 }
    },
    { id: 'maseru~modderpoort', ends: ['maseru', 'modderpoort'], box: { x: 461.5, y: 932.5 } },
    {
        id: 'modderpoort~watervliet',
        ends: ['modderpoort', 'watervliet'],
        box: { x: 411.5, y: 874 }
    },
    {
        id: 'naboomspruit~nylstroom',
        ends: ['naboomspruit', 'nylstroom'],
        box: { x: 1203.5, y: 371 }
    },
    {
        id: 'naboomspruit~pietersburg',
        ends: ['naboomspruit', 'pietersburg'],
        box: { x: 1304, y: 386 }
    },
    {
        id: 'naboomspruit~zebediela',
        ends: ['naboomspruit', 'zebediela'],
        box: { x: 1271, y: 426.5 }
    },
    { id: 'nelspruit~plaston', ends: ['nelspruit', 'plaston'], box: { x: 1385.5, y: 758.5 } },
    { id: 'newcastle~utrecht', ends: ['newcastle', 'utrecht'], box: { x: 997, y: 983.5 } },
    { id: 'newcastle~volksrust', ends: ['newcastle', 'volksrust'], box: { x: 981.5, y: 939.5 } },
    {
        id: 'norvals-point~springfontein',
        ends: ['norvals-point', 'springfontein'],
        box: { x: 120, y: 881 }
    },
    {
        id: 'nylstroom~pienaarsriver',
        ends: ['nylstroom', 'pienaarsriver'],
        box: { x: 1123, y: 377 }
    },
    { id: 'nylstroom~vaalwater', ends: ['nylstroom', 'vaalwater'], box: { x: 1155.5, y: 330 } },
    { id: 'palmford~volksrust', ends: ['palmford', 'volksrust'], box: { x: 1063.5, y: 916 } },
    {
        id: 'petrus-steyn~vereeniging',
        ends: ['petrus-steyn', 'vereeniging'],
        box: { x: 769.5, y: 714.5 }
    },
    {
        id: 'pienaarsriver~pretoria',
        ends: ['pienaarsriver', 'pretoria'],
        box: { x: 1069.5, y: 434.5 }
    },
    { id: 'piet-retief~vryheid', ends: ['piet-retief', 'vryheid'], box: { x: 1091, y: 984 } },
    { id: 'pietersburg~zoekmakaar', ends: ['pietersburg', 'zoekmakaar'], box: { x: 1412, y: 401 } },
    {
        id: 'potchefstroom~welverdiend',
        ends: ['potchefstroom', 'welverdiend'],
        box: { x: 736.5, y: 474 }
    },
    { id: 'pretoria~witbank', ends: ['pretoria', 'witbank'], box: { x: 1112, y: 570.5 } },
    { id: 'purdimoe~vermaas', ends: ['purdimoe', 'vermaas'], box: { x: 459.5, y: 349 } },
    { id: 'purdimoe~vryburg', ends: ['purdimoe', 'vryburg'], box: { x: 401.5, y: 297.5 } },
    { id: 'purdimoe~warrenton', ends: ['purdimoe', 'warrenton'], box: { x: 309, y: 411 } },
    { id: 'sanderton~volksrust', ends: ['sanderton', 'volksrust'], box: { x: 1005.5, y: 846.5 } },
    { id: 'sanderton~vrede', ends: ['sanderton', 'vrede'], box: { x: 951, y: 824 } },
    { id: 'theunissen~winburg', ends: ['theunissen', 'winburg'], box: { x: 467.5, y: 766.5 } }
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
