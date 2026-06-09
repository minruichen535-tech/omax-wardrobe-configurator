# Base support closet

This directory is a framework placeholder only. The series is intentionally
disabled and contains no product, BOM, cutting, or model implementation.

To enable it:

1. Add the series Excel and asset directories declared in `series.config.js`.
2. Implement `bomCalculator.js`, `cuttingRules.js`, and `modelTransforms.js`.
3. Register those modules in `src/series/index.js`.
4. Set `enabled: true` only after configurator, client, admin, BOM, cut-length,
   model, and export regression tests pass.
