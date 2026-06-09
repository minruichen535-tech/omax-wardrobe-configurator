# Series framework

Each product series owns its product-specific calculation and rendering rules.
The shared application resolves a series through `src/series/index.js`.

Required modules for an enabled series:

- `series.config.js`: data, brand, image, and model paths.
- `bomCalculator.js`: automatic placements and BOM expansion behavior.
- `cuttingRules.js`: wall dimensions, bay widths, cut lengths, and component metadata.
- `modelTransforms.js`: GLB transforms and series-specific visual alignment.
- `displayRules.js`: SKU-specific web and Excel presentation rules.

Register all modules under the same `seriesId` in `src/series/index.js`. A series
must remain disabled until its Excel files, assets, and all three runtime modules
are available.
