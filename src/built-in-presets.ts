// Built-in preset.json files embedded into the compiled binary via Bun's { type: "file" } import.
// Each import returns a path string: real filesystem in dev, $bunfs/... in compiled binary.
//
// Note: tsc resolves .json imports as JSON objects, but Bun's { type: "file" }
// returns a path string instead. We cast these to string for correct typing.

import _fullStack from "../default-presets/full-stack/preset.json" with { type: "file" };
import _fullStackPlaywright from "../default-presets/full-stack-playwright/preset.json" with { type: "file" };
import _il2cppRe from "../default-presets/il2cpp-re/preset.json" with { type: "file" };
import _rustWasm from "../default-presets/rust-wasm/preset.json" with { type: "file" };

export const BUILT_IN_PRESETS_V2: Record<string, string> = {
  "full-stack": _fullStack as unknown as string,
  "full-stack-playwright": _fullStackPlaywright as unknown as string,
  "il2cpp-re": _il2cppRe as unknown as string,
  "rust-wasm": _rustWasm as unknown as string,
};
