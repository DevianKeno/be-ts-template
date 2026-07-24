import fs from "fs";
import path from "path";
import fg from "fast-glob";
import { parse } from "jsonc-parser";
import { createHeader } from "./utils";

export async function generateBlockSoundIds() {
	const matches = fg.sync("resource_packs/*/blocks.json");

	const blockSounds: Record<string, string> = {};

	for (const file of matches) {
		const json = parse(fs.readFileSync(file, "utf8"));

		for (const [identifier, definition] of Object.entries<any>(json)) {
			// Skip metadata
			if (identifier === "format_version") continue;

			const sound = definition?.sound;
			if (!sound) continue;

			const blockName = extractNameFromIdentifier(identifier);

			if (blockSounds[blockName]) {
				throw new Error(`Duplicate generated block sound name '${blockName}'.`);
			}

			blockSounds[identifier] = sound;
		}
	}

	const mapEntries = Object.entries(blockSounds)
		.sort(([a], [b]) => a[0].localeCompare(b[0]))
		.map(([identifier, sound]) => `\t["${identifier}", "${sound}"],`)
		.join("\n");

const output = `${createHeader("codegen:block-sounds")}

export const AddonBlockSounds = new Map([
${mapEntries}
]);
`;

	const outputPath = path.resolve("scripts/generated/definitions/block-sounds.ts");

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, output);

	console.log(`Generated ${outputPath}`);
}

function extractNameFromIdentifier(identifier: string) {
	const name = identifier.split(":")[1] ?? identifier;
	return toPascalCase(name);
}

function toPascalCase(str: string) {
	return str
		.split(/[_\-]/g)
		.filter(Boolean)
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join("");
}
