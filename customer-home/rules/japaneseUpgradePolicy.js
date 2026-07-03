export const JAPANESE_UPGRADE_POLICY = {
  principles: {
    storageCapacityNeverDecrease: true,
    replaceInsteadOfRemove: true,
    preserveCoreStructureAcrossTiers: true,
    maxFunctionalShelfPerBay: 1,
    functionalShelfBelongsToLowerFunctionalZone: true,
    premiumShouldFeelMoreFunctionalNotLessFull: true
  },

  definitions: {
    upperRail2000: {
      componentType: ["singleRail", "doubleRail"],
      heightRange: [1900, 2100],
      meaning: "upper hanging rail / visual alignment rail"
    },

    lowerRail1050: {
      componentType: ["singleRail", "doubleRail"],
      heightRange: [950, 1150],
      meaning: "lower short-hang rail"
    },

    lowerFunctionalZone: {
      members: [
        "singleRail1050",
        "doubleRail1050",
        "trouserRack",
        "jewelryBox",
        "drawer",
        "drawerCabinet",
        "storageCabinet",
        "cabinet"
      ],
      maxFunctionalShelf: 1,
      preserveFunctionalShelfAfterUpgrade: true
    },

    functionalShelf: {
      componentType: "woodShelf",
      belongsTo: "lowerFunctionalZone",
      mustNotBelongTo: "upperRail2000",
      preserveWhenLowerZoneIsReplaced: true
    },

    shoeCapacity: {
      componentType: "woodShelf",
      zoneType: "shoeZone",
      rule: "higher tier should not reduce shoe shelf count unless another shoe-storage component replaces it"
    }
  },

  basic: {
    inherit: [],
    preserve: [],
    replace: [],
    add: [],
    intent: "基础挂衣与基础收纳结构"
  },

  value: {
    inherit: ["basic"],

    preserve: [
      "allBasicCoreStructure",
      "upperRail2000",
      "functionalShelf",
      "shoeCapacity"
    ],

    replace: [
      {
        from: "singleRail1050",
        to: "doubleRail1050",
        rule: "upgrade lower short-hang rail without changing upper 2000 rail"
      }
    ],

    add: [
      {
        component: "cabinet",
        rule: "add only when it does not remove upperRail2000"
      },
      {
        component: "extraShoeShelf",
        rule: "may increase shoe capacity without breaking preserved hanging rail"
      }
    ],

    validation: [
      "valueStorageCapacity >= basicStorageCapacity",
      "valueShoeShelfCount >= basicShoeShelfCount",
      "upperRail2000 must remain if it existed in basic"
    ],

    intent: "在基础结构上提升收纳效率与挂衣效率"
  },

  premium: {
    inherit: ["value"],

    preserve: [
      "upperRail2000",
      "functionalShelf",
      "shoeCapacity",
      "cabinet",
      "allValueCoreStructure"
    ],

    replace: [
      {
        from: "doubleRail1050",
        to: "trouserRack",
        rule: "trouserRack replaces the lower 1050 functional position only"
      },
      {
        from: "singleRail1050",
        to: "trouserRack",
        rule: "trouserRack may replace lower rail, but must not remove functional shelf above lower zone"
      }
    ],

    add: [
      {
        component: "functionalShelf",
        rule: "add at most one shelf above each lowerFunctionalZone if not already present"
      },
      {
        component: "jewelryBox",
        rule: "add only as premium lower functional accessory"
      },
      {
        component: "drawer",
        rule: "add only when it increases usable storage and does not reduce shoeCapacity"
      }
    ],

    constraints: [
      "premiumStorageCapacity >= valueStorageCapacity",
      "premiumShoeShelfCount >= valueShoeShelfCount unless replaced by equivalent shoeStorage",
      "premiumFunctionalShelfCount >= valueFunctionalShelfCount",
      "upperRail2000 must remain if it existed in value",
      "trouserRack must replace lowerFunctionalZone only",
      "do not remove functionalShelf when replacing lower rail with trouserRack",
      "do not add premium functional shelf to 2000-only rail bay",
      "do not add premium functional shelf to pure shoeShelfZone bay",
      "oneFunctionalShelfPerLowerFunctionalZone"
    ],

    validation: [
      "no tier upgrade may reduce visible functional completeness",
      "every visible rail must have clothing visual",
      "no premium upgrade may delete a core shelf unless an equivalent higher-value storage component replaces it",
      "premium should look more organized than value, not emptier"
    ],

    intent: "用更高价值配件替换基础挂衣位，同时保留并增强收纳完整性"
  }
};