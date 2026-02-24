// Built-in units embedded into the compiled binary via Bun's { type: "file" } import.
// Each import returns a path string: real filesystem in dev, $bunfs/... in compiled binary.
//
// Note: tsc resolves .json imports as JSON objects, but Bun's { type: "file" }
// returns a path string instead. We cast these to string for correct typing.
// .Dockerfile imports aren't resolvable by tsc, so they need @ts-expect-error.

// --- dev-utils ---
import _devUtilsManifest from "../default-units/dev-utils/unit.json" with { type: "file" };
const devUtilsManifest = _devUtilsManifest as unknown as string;
// @ts-expect-error — Bun-specific import attribute
import devUtilsPostInstall from "../default-units/dev-utils/post-install.Dockerfile" with { type: "file" };

// --- node ---
import _nodeManifest from "../default-units/node/unit.json" with { type: "file" };
const nodeManifest = _nodeManifest as unknown as string;

// --- bun ---
import _bunManifest from "../default-units/bun/unit.json" with { type: "file" };
const bunManifest = _bunManifest as unknown as string;
// @ts-expect-error — Bun-specific import attribute
import bunPostInstall from "../default-units/bun/post-install.Dockerfile" with { type: "file" };

// --- github-cli ---
import _githubCliManifest from "../default-units/github-cli/unit.json" with { type: "file" };
const githubCliManifest = _githubCliManifest as unknown as string;

// --- doc-utils ---
import _docUtilsManifest from "../default-units/doc-utils/unit.json" with { type: "file" };
const docUtilsManifest = _docUtilsManifest as unknown as string;

// --- playwright ---
import _playwrightManifest from "../default-units/playwright/unit.json" with { type: "file" };
const playwrightManifest = _playwrightManifest as unknown as string;
// @ts-expect-error — Bun-specific import attribute
import playwrightPostInstall from "../default-units/playwright/post-install.Dockerfile" with { type: "file" };
// @ts-expect-error — Bun-specific import attribute
import playwrightPostAgentInstall from "../default-units/playwright/post-agent-install.Dockerfile" with { type: "file" };

// --- java ---
import _javaManifest from "../default-units/java/unit.json" with { type: "file" };
const javaManifest = _javaManifest as unknown as string;
// @ts-expect-error — Bun-specific import attribute
import javaPostInstall from "../default-units/java/post-install.Dockerfile" with { type: "file" };

// --- dotnet ---
import _dotnetManifest from "../default-units/dotnet/unit.json" with { type: "file" };
const dotnetManifest = _dotnetManifest as unknown as string;
// @ts-expect-error — Bun-specific import attribute
import dotnetPostInstall from "../default-units/dotnet/post-install.Dockerfile" with { type: "file" };

// --- rust ---
import _rustManifest from "../default-units/rust/unit.json" with { type: "file" };
const rustManifest = _rustManifest as unknown as string;
// @ts-expect-error — Bun-specific import attribute
import rustPostInstall from "../default-units/rust/post-install.Dockerfile" with { type: "file" };

// --- ghidra ---
import _ghidraManifest from "../default-units/ghidra/unit.json" with { type: "file" };
const ghidraManifest = _ghidraManifest as unknown as string;
// @ts-expect-error — Bun-specific import attribute
import ghidraBuild from "../default-units/ghidra/build.Dockerfile" with { type: "file" };
// @ts-expect-error — Bun-specific import attribute
import ghidraPostInstall from "../default-units/ghidra/post-install.Dockerfile" with { type: "file" };

// --- jadx ---
import _jadxManifest from "../default-units/jadx/unit.json" with { type: "file" };
const jadxManifest = _jadxManifest as unknown as string;
// @ts-expect-error — Bun-specific import attribute
import jadxBuild from "../default-units/jadx/build.Dockerfile" with { type: "file" };
// @ts-expect-error — Bun-specific import attribute
import jadxPostInstall from "../default-units/jadx/post-install.Dockerfile" with { type: "file" };

// --- il2cpp-tools ---
import _il2cppToolsManifest from "../default-units/il2cpp-tools/unit.json" with { type: "file" };
const il2cppToolsManifest = _il2cppToolsManifest as unknown as string;

export interface BuiltInUnitFiles {
  manifest: string;
  postInstall?: string;
  postAgentInstall?: string;
  build?: string;
}

export const BUILT_IN_UNITS: Record<string, BuiltInUnitFiles> = {
  "dev-utils": { manifest: devUtilsManifest, postInstall: devUtilsPostInstall },
  "node": { manifest: nodeManifest },
  "bun": { manifest: bunManifest, postInstall: bunPostInstall },
  "github-cli": { manifest: githubCliManifest },
  "doc-utils": { manifest: docUtilsManifest },
  "playwright": { manifest: playwrightManifest, postInstall: playwrightPostInstall, postAgentInstall: playwrightPostAgentInstall },
  "java": { manifest: javaManifest, postInstall: javaPostInstall },
  "dotnet": { manifest: dotnetManifest, postInstall: dotnetPostInstall },
  "rust": { manifest: rustManifest, postInstall: rustPostInstall },
  "ghidra": { manifest: ghidraManifest, build: ghidraBuild, postInstall: ghidraPostInstall },
  "jadx": { manifest: jadxManifest, build: jadxBuild, postInstall: jadxPostInstall },
  "il2cpp-tools": { manifest: il2cppToolsManifest },
};
