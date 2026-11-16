import {
    SettlementKind,
    type ExternalConnectionDefinition,
    type LinkDefinition,
    type SettlementDefinition
} from '../types.js'

export const SETTLEMENTS: readonly SettlementDefinition[] = [
    {
        id: 'norvals-point',
        name: "Norval's Point",
        kind: SettlementKind.RailroadBase,
        x: 78,
        y: 882
    },
    { id: 'dreunberg', name: 'Dreunberg', kind: SettlementKind.RailroadStation, x: 145, y: 974 },
    {
        id: 'springfontein',
        name: 'Springfontein',
        kind: SettlementKind.RailroadStation,
        x: 161,
        y: 866
    },
    {
        id: 'koffiefontein',
        name: 'Koffiefontein',
        kind: SettlementKind.AgriculturalRailhead,
        x: 178,
        y: 672
    },
    {
        id: 'kimberley',
        name: 'Kimberley',
        kind: SettlementKind.RailroadBase,
        x: 211,
        y: 550
    },
    {
        id: 'aliwal-north',
        name: 'Aliwal North',
        kind: SettlementKind.RailroadBase,
        x: 223,
        y: 1019
    },
    { id: 'warrenton', name: 'Warrenton', kind: SettlementKind.RailroadStation, x: 305, y: 478 },
    { id: 'bloemfontein', name: 'Bloemfontein', kind: SettlementKind.MetroArea, x: 349, y: 750 },
    { id: 'purdimoe', name: 'Purdimoe', kind: SettlementKind.RailroadStation, x: 372, y: 371 },
    { id: 'watervliet', name: 'Watervliet', kind: SettlementKind.RailroadStation, x: 415, y: 831 },
    {
        id: 'bultfontein',
        name: 'Bultfontein',
        kind: SettlementKind.AgriculturalRailhead,
        x: 441,
        y: 633
    },
    { id: 'maseru', name: 'Maseru', kind: SettlementKind.AgriculturalRailhead, x: 480, y: 948 },
    { id: 'theunissen', name: 'Theunissen', kind: SettlementKind.RailroadStation, x: 506, y: 716 },
    {
        id: 'modderpoort',
        name: 'Modderpoort',
        kind: SettlementKind.RailroadStation,
        x: 511,
        y: 871
    },
    { id: 'maquassi', name: 'Maquassi', kind: SettlementKind.RailroadStation, x: 538, y: 495 },
    { id: 'winburg', name: 'Winburg', kind: SettlementKind.AgriculturalRailhead, x: 544, y: 783 },
    {
        id: 'ladybrand',
        name: 'Ladybrand',
        kind: SettlementKind.AgriculturalRailhead,
        x: 552,
        y: 944
    },
    { id: 'marquard', name: 'Marquard', kind: SettlementKind.AgriculturalRailhead, x: 569, y: 826 },
    { id: 'vermaas', name: 'Vermaas', kind: SettlementKind.RailroadStation, x: 621, y: 391 },
    {
        id: 'vierfontein',
        name: 'Vierfontein',
        kind: SettlementKind.RailroadStation,
        x: 656,
        y: 582
    },
    { id: 'mafeking', name: 'Mafeking', kind: SettlementKind.RailroadStation, x: 657, y: 255 },
    { id: 'kroonstad', name: 'Kroonstad', kind: SettlementKind.MercantileCenter, x: 662, y: 660 },
    { id: 'klerksdorp', name: 'Klerksdorp', kind: SettlementKind.RailroadStation, x: 663, y: 502 },
    { id: 'arlington', name: 'Arlington', kind: SettlementKind.RailroadStation, x: 679, y: 783 },
    {
        id: 'lichtenburg',
        name: 'Lichtenburg',
        kind: SettlementKind.AgriculturalRailhead,
        x: 686,
        y: 324
    },
    { id: 'coligny', name: 'Coligny', kind: SettlementKind.RailroadStation, x: 701, y: 394 },
    { id: 'bethlehem', name: 'Bethlehem', kind: SettlementKind.RailroadStation, x: 710, y: 852 },
    {
        id: 'potchefstroom',
        name: 'Potchefstroom',
        kind: SettlementKind.RailroadStation,
        x: 741,
        y: 522
    },
    {
        id: 'vredefort',
        name: 'Vredefort',
        kind: SettlementKind.AgriculturalRailhead,
        x: 741,
        y: 582
    },
    { id: 'dover', name: 'Dover', kind: SettlementKind.RailroadStation, x: 742, y: 651 },
    { id: 'harrismith', name: 'Harrismith', kind: SettlementKind.RailroadStation, x: 811, y: 936 },
    {
        id: 'welverdiend',
        name: 'Welverdiend',
        kind: SettlementKind.RailroadStation,
        x: 812,
        y: 494
    },
    {
        id: 'vereeniging',
        name: 'Vereeniging',
        kind: SettlementKind.MercantileCenter,
        x: 826,
        y: 613
    },
    { id: 'warden', name: 'Warden', kind: SettlementKind.AgriculturalRailhead, x: 838, y: 858 },
    {
        id: 'ladysmith',
        name: 'Ladysmith',
        kind: SettlementKind.RailroadBase,
        x: 846,
        y: 1038
    },
    {
        id: 'magaliesburg',
        name: 'Magaliesburg',
        kind: SettlementKind.RailroadStation,
        x: 872,
        y: 454
    },
    { id: 'vrede', name: 'Vrede', kind: SettlementKind.AgriculturalRailhead, x: 908, y: 828 },
    {
        id: 'johannesburg',
        name: 'Johannesburg',
        kind: SettlementKind.MetroArea,
        x: 910,
        y: 547
    },
    { id: 'boshoek', name: 'Boshoek', kind: SettlementKind.AgriculturalRailhead, x: 920, y: 373 },
    { id: 'balfour', name: 'Balfour', kind: SettlementKind.RailroadStation, x: 931, y: 668 },
    {
        id: 'glencoe-junction',
        name: 'Glencoe Junction',
        kind: SettlementKind.RailroadStation,
        x: 940,
        y: 1036
    },
    { id: 'newcastle', name: 'Newcastle', kind: SettlementKind.RailroadStation, x: 962, y: 963 },
    { id: 'sanderton', name: 'Sanderton', kind: SettlementKind.RailroadStation, x: 976, y: 772 },
    { id: 'volksrust', name: 'Volksrust', kind: SettlementKind.RailroadStation, x: 991, y: 862 },
    { id: 'pretoria', name: 'Pretoria', kind: SettlementKind.MercantileCenter, x: 992, y: 496 },
    { id: 'utrecht', name: 'Utrecht', kind: SettlementKind.AgriculturalRailhead, x: 1027, y: 970 },
    { id: 'vryheid', name: 'Vryheid', kind: SettlementKind.RailroadStation, x: 1044, y: 1036 },
    { id: 'bethal', name: 'Bethal', kind: SettlementKind.RailroadStation, x: 1056, y: 728 },
    {
        id: 'pienaarsriver',
        name: 'Pienaarsriver',
        kind: SettlementKind.RailroadStation,
        x: 1058,
        y: 451
    },
    { id: 'witbank', name: 'Witbank', kind: SettlementKind.RailroadStation, x: 1090, y: 634 },
    { id: 'ermelo', name: 'Ermelo', kind: SettlementKind.RailroadStation, x: 1114, y: 813 },
    { id: 'hlobane', name: 'Hlobane', kind: SettlementKind.AgriculturalRailhead, x: 1114, y: 1039 },
    { id: 'nylstroom', name: 'Nylstroom', kind: SettlementKind.RailroadStation, x: 1127, y: 394 },
    { id: 'breyten', name: 'Breyten', kind: SettlementKind.RailroadStation, x: 1134, y: 752 },
    {
        id: 'vaalwater',
        name: 'Vaalwater',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1140,
        y: 310
    },
    { id: 'belfast', name: 'Belfast', kind: SettlementKind.RailroadStation, x: 1154, y: 669 },
    { id: 'lothair', name: 'Lothair', kind: SettlementKind.AgriculturalRailhead, x: 1188, y: 820 },
    {
        id: 'naboomspruit',
        name: 'Naboomspruit',
        kind: SettlementKind.RailroadStation,
        x: 1198,
        y: 402
    },
    {
        id: 'marble-hall',
        name: 'Marble Hall',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1208,
        y: 505
    },
    {
        id: 'machadodorp',
        name: 'Machadodorp',
        kind: SettlementKind.RailroadStation,
        x: 1218,
        y: 706
    },
    {
        id: 'zebediela',
        name: 'Zebediela',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1287,
        y: 465
    },
    {
        id: 'barberton',
        name: 'Barberton',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1292,
        y: 816
    },
    { id: 'nelspruit', name: 'Nelspruit', kind: SettlementKind.RailroadStation, x: 1335, y: 758 },
    {
        id: 'pietersburg',
        name: 'Pietersburg',
        kind: SettlementKind.MercantileCenter,
        x: 1346,
        y: 411
    },
    {
        id: 'steelport',
        name: 'Steelport',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1346,
        y: 588
    },
    { id: 'kaapmuiden', name: 'Kaapmuiden', kind: SettlementKind.RailroadStation, x: 1375, y: 814 },
    { id: 'graskop', name: 'Graskop', kind: SettlementKind.AgriculturalRailhead, x: 1388, y: 684 },
    { id: 'plaston', name: 'Plaston', kind: SettlementKind.AgriculturalRailhead, x: 1406, y: 744 },
    { id: 'zoekmakaar', name: 'Zoekmakaar', kind: SettlementKind.RailroadStation, x: 1441, y: 412 },
    {
        id: 'komatipoort',
        name: 'Komatipoort',
        kind: SettlementKind.RailroadStation,
        x: 1460,
        y: 853
    },
    {
        id: 'lourenco-marques',
        name: 'Lourenco Marques',
        kind: SettlementKind.RailroadBase,
        x: 1471,
        y: 988
    }
]

export const LINKS: readonly LinkDefinition[] = [
    { id: 'aliwal-north~dreunberg', ends: ['aliwal-north', 'dreunberg'], box: { x: 184, y: 1000 } },
    {
        id: 'aliwal-north~watervliet',
        ends: ['aliwal-north', 'watervliet'],
        box: { x: 370, y: 932 }
    },
    { id: 'arlington~bethlehem', ends: ['arlington', 'bethlehem'], box: { x: 696, y: 817 } },
    { id: 'arlington~kroonstad', ends: ['arlington', 'kroonstad'], box: { x: 671, y: 721 } },
    { id: 'arlington~marquard', ends: ['arlington', 'marquard'], box: { x: 622, y: 800 } },
    { id: 'arlington~vereeniging', ends: ['arlington', 'vereeniging'], box: { x: 775, y: 737 } },
    { id: 'balfour~bethlehem', ends: ['balfour', 'bethlehem'], box: { x: 814, y: 762 } },
    { id: 'balfour~johannesburg', ends: ['balfour', 'johannesburg'], box: { x: 914, y: 613 } },
    { id: 'balfour~sanderton', ends: ['balfour', 'sanderton'], box: { x: 956, y: 720 } },
    { id: 'balfour~vereeniging', ends: ['balfour', 'vereeniging'], box: { x: 879, y: 634 } },
    { id: 'barberton~kaapmuiden', ends: ['barberton', 'kaapmuiden'], box: { x: 1332, y: 816 } },
    { id: 'belfast~machadodorp', ends: ['belfast', 'machadodorp'], box: { x: 1187, y: 688 } },
    { id: 'belfast~steelport', ends: ['belfast', 'steelport'], box: { x: 1250, y: 630 } },
    { id: 'belfast~witbank', ends: ['belfast', 'witbank'], box: { x: 1123, y: 652 } },
    { id: 'bethal~breyten', ends: ['bethal', 'breyten'], box: { x: 1090, y: 737 } },
    { id: 'bethal~johannesburg', ends: ['bethal', 'johannesburg'], box: { x: 966, y: 628 } },
    { id: 'bethal~volksrust', ends: ['bethal', 'volksrust'], box: { x: 1050, y: 898 } },
    { id: 'bethlehem~harrismith', ends: ['bethlehem', 'harrismith'], box: { x: 757, y: 887 } },
    { id: 'bethlehem~modderpoort', ends: ['bethlehem', 'modderpoort'], box: { x: 618, y: 891 } },
    { id: 'bloemfontein~kimberley', ends: ['bloemfontein', 'kimberley'], box: { x: 256, y: 671 } },
    {
        id: 'bloemfontein~springfontein',
        ends: ['bloemfontein', 'springfontein'],
        box: { x: 239, y: 827 }
    },
    {
        id: 'bloemfontein~theunissen',
        ends: ['bloemfontein', 'theunissen'],
        box: { x: 430, y: 738 }
    },
    {
        id: 'bloemfontein~watervliet',
        ends: ['bloemfontein', 'watervliet'],
        box: { x: 384, y: 798 }
    },
    { id: 'boshoek~pretoria', ends: ['boshoek', 'pretoria'], box: { x: 956, y: 440 } },
    { id: 'breyten~ermelo', ends: ['breyten', 'ermelo'], box: { x: 1121, y: 782 } },
    { id: 'breyten~machadodorp', ends: ['breyten', 'machadodorp'], box: { x: 1178, y: 729 } },
    {
        id: 'bultfontein~vierfontein',
        ends: ['bultfontein', 'vierfontein'],
        box: { x: 554, y: 606 }
    },
    { id: 'coligny~lichtenburg', ends: ['coligny', 'lichtenburg'], box: { x: 695, y: 363 } },
    { id: 'coligny~vermaas', ends: ['coligny', 'vermaas'], box: { x: 662, y: 391 } },
    { id: 'coligny~welverdiend', ends: ['coligny', 'welverdiend'], box: { x: 750, y: 452 } },
    { id: 'dover~kroonstad', ends: ['dover', 'kroonstad'], box: { x: 704, y: 656 } },
    { id: 'dover~vereeniging', ends: ['dover', 'vereeniging'], box: { x: 778, y: 635 } },
    { id: 'dover~vredefort', ends: ['dover', 'vredefort'], box: { x: 743, y: 617 } },
    {
        id: 'dreunberg~springfontein',
        ends: ['dreunberg', 'springfontein'],
        box: { x: 156, y: 917 }
    },
    { id: 'ermelo~lothair', ends: ['ermelo', 'lothair'], box: { x: 1150, y: 816 } },
    { id: 'ermelo~vryheid', ends: ['ermelo', 'vryheid'], box: { x: 1144, y: 933 } },
    {
        id: 'glencoe-junction~ladysmith',
        ends: ['glencoe-junction', 'ladysmith'],
        box: { x: 892, y: 1038 }
    },
    {
        id: 'glencoe-junction~newcastle',
        ends: ['glencoe-junction', 'newcastle'],
        box: { x: 950, y: 996 }
    },
    {
        id: 'glencoe-junction~vryheid',
        ends: ['glencoe-junction', 'vryheid'],
        box: { x: 1003, y: 1036 }
    },
    { id: 'graskop~nelspruit', ends: ['graskop', 'nelspruit'], box: { x: 1356, y: 716 } },
    { id: 'harrismith~ladysmith', ends: ['harrismith', 'ladysmith'], box: { x: 828, y: 999 } },
    { id: 'harrismith~warden', ends: ['harrismith', 'warden'], box: { x: 824, y: 897 } },
    { id: 'hlobane~vryheid', ends: ['hlobane', 'vryheid'], box: { x: 1081, y: 1035 } },
    {
        id: 'johannesburg~magaliesburg',
        ends: ['johannesburg', 'magaliesburg'],
        box: { x: 885, y: 487 }
    },
    {
        id: 'johannesburg~potchefstroom',
        ends: ['johannesburg', 'potchefstroom'],
        box: { x: 814, y: 534 }
    },
    { id: 'johannesburg~pretoria', ends: ['johannesburg', 'pretoria'], box: { x: 968, y: 523 } },
    {
        id: 'johannesburg~vereeniging',
        ends: ['johannesburg', 'vereeniging'],
        box: { x: 852, y: 588 }
    },
    {
        id: 'johannesburg~welverdiend',
        ends: ['johannesburg', 'welverdiend'],
        box: { x: 845, y: 509 }
    },
    { id: 'johannesburg~witbank', ends: ['johannesburg', 'witbank'], box: { x: 1017, y: 605 } },
    { id: 'kaapmuiden~komatipoort', ends: ['kaapmuiden', 'komatipoort'], box: { x: 1420, y: 828 } },
    { id: 'kaapmuiden~nelspruit', ends: ['kaapmuiden', 'nelspruit'], box: { x: 1356, y: 786 } },
    { id: 'kimberley~warrenton', ends: ['kimberley', 'warrenton'], box: { x: 260, y: 522 } },
    { id: 'klerksdorp~maquassi', ends: ['klerksdorp', 'maquassi'], box: { x: 600, y: 501 } },
    {
        id: 'klerksdorp~potchefstroom',
        ends: ['klerksdorp', 'potchefstroom'],
        box: { x: 702, y: 512 }
    },
    { id: 'klerksdorp~vierfontein', ends: ['klerksdorp', 'vierfontein'], box: { x: 661, y: 537 } },
    {
        id: 'koffiefontein~springfontein',
        ends: ['koffiefontein', 'springfontein'],
        box: { x: 170, y: 767 }
    },
    {
        id: 'komatipoort~lourenco-marques',
        ends: ['komatipoort', 'lourenco-marques'],
        box: { x: 1470, y: 917 }
    },
    { id: 'komatipoort~zoekmakaar', ends: ['komatipoort', 'zoekmakaar'], box: { x: 1506, y: 545 } },
    { id: 'kroonstad~theunissen', ends: ['kroonstad', 'theunissen'], box: { x: 587, y: 688 } },
    { id: 'kroonstad~vierfontein', ends: ['kroonstad', 'vierfontein'], box: { x: 657, y: 617 } },
    { id: 'ladybrand~modderpoort', ends: ['ladybrand', 'modderpoort'], box: { x: 533, y: 908 } },
    { id: 'machadodorp~nelspruit', ends: ['machadodorp', 'nelspruit'], box: { x: 1274, y: 738 } },
    { id: 'mafeking~magaliesburg', ends: ['mafeking', 'magaliesburg'], box: { x: 821, y: 342 } },
    { id: 'mafeking~purdimoe', ends: ['mafeking', 'purdimoe'], box: { x: 433, y: 318 } },
    { id: 'magaliesburg~pretoria', ends: ['magaliesburg', 'pretoria'], box: { x: 918, y: 474 } },
    { id: 'maquassi~vermaas', ends: ['maquassi', 'vermaas'], box: { x: 582, y: 443 } },
    { id: 'maquassi~warrenton', ends: ['maquassi', 'warrenton'], box: { x: 446, y: 487 } },
    {
        id: 'marble-hall~pienaarsriver',
        ends: ['marble-hall', 'pienaarsriver'],
        box: { x: 1138, y: 479 }
    },
    { id: 'maseru~modderpoort', ends: ['maseru', 'modderpoort'], box: { x: 498, y: 910 } },
    { id: 'modderpoort~watervliet', ends: ['modderpoort', 'watervliet'], box: { x: 462, y: 848 } },
    { id: 'naboomspruit~nylstroom', ends: ['naboomspruit', 'nylstroom'], box: { x: 1164, y: 400 } },
    {
        id: 'naboomspruit~pietersburg',
        ends: ['naboomspruit', 'pietersburg'],
        box: { x: 1267, y: 403 }
    },
    { id: 'naboomspruit~zebediela', ends: ['naboomspruit', 'zebediela'], box: { x: 1245, y: 437 } },
    { id: 'nelspruit~plaston', ends: ['nelspruit', 'plaston'], box: { x: 1370, y: 750 } },
    { id: 'newcastle~utrecht', ends: ['newcastle', 'utrecht'], box: { x: 993, y: 965 } },
    { id: 'newcastle~volksrust', ends: ['newcastle', 'volksrust'], box: { x: 980, y: 912 } },
    {
        id: 'norvals-point~springfontein',
        ends: ['norvals-point', 'springfontein'],
        box: { x: 125, y: 877 }
    },
    {
        id: 'nylstroom~pienaarsriver',
        ends: ['nylstroom', 'pienaarsriver'],
        box: { x: 1095, y: 419 }
    },
    { id: 'nylstroom~vaalwater', ends: ['nylstroom', 'vaalwater'], box: { x: 1132, y: 355 } },
    { id: 'pienaarsriver~pretoria', ends: ['pienaarsriver', 'pretoria'], box: { x: 1026, y: 472 } },
    { id: 'pietersburg~zoekmakaar', ends: ['pietersburg', 'zoekmakaar'], box: { x: 1396, y: 408 } },
    {
        id: 'potchefstroom~welverdiend',
        ends: ['potchefstroom', 'welverdiend'],
        box: { x: 778, y: 506 }
    },
    { id: 'pretoria~witbank', ends: ['pretoria', 'witbank'], box: { x: 1058, y: 577 } },
    { id: 'purdimoe~vermaas', ends: ['purdimoe', 'vermaas'], box: { x: 507, y: 380 } },
    { id: 'purdimoe~warrenton', ends: ['purdimoe', 'warrenton'], box: { x: 346, y: 424 } },
    { id: 'sanderton~volksrust', ends: ['sanderton', 'volksrust'], box: { x: 988, y: 812 } },
    { id: 'sanderton~vrede', ends: ['sanderton', 'vrede'], box: { x: 939, y: 791 } },
    { id: 'theunissen~winburg', ends: ['theunissen', 'winburg'], box: { x: 524, y: 748 } }
]

export const EXTERNAL_CONNECTIONS: readonly ExternalConnectionDefinition[] = [
    {
        id: 'bechuanaland',
        name: 'Bechuanaland',
        settlementId: 'mafeking',
        price: 30,
        value: 40,
        x: 657,
        y: 203
    },
    {
        id: 'matabeleland',
        name: 'Matabeleland',
        settlementId: 'zoekmakaar',
        price: 40,
        value: 30,
        x: 1443,
        y: 346
    }
]
