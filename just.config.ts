import { argv, parallel, series, task, tscTask } from "just-scripts";
import {
    BundleTaskParameters,
    CopyTaskParameters,
    bundleTask,
    cleanTask,
    cleanCollateralTask,
    copyTask,
    coreLint,
    mcaddonTask,
    setupEnvironment,
    ZipTaskParameters,
    STANDARD_CLEAN_PATHS,
    DEFAULT_CLEAN_DIRECTORIES,
    getOrThrowFromProcess,
    watchTask,
} from "@minecraft/core-build-tasks";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";

// Setup env variables
setupEnvironment(path.resolve(__dirname, ".env"));
const projectName = getOrThrowFromProcess("PROJECT_NAME");
const mcworldName = getOrThrowFromProcess("MCWORLD_NAME");

const bundleTaskOptions: BundleTaskParameters = {
    entryPoint: path.join(__dirname, "./scripts/main.ts"),
    external: ["@minecraft/server", "@minecraft/server-ui"],
    outfile: path.resolve(__dirname, "./dist/scripts/main.js"),
    minifyWhitespace: false,
    sourcemap: true,
    outputSourcemapPath: path.resolve(__dirname, "./dist/debug"),
};

const copyTaskOptions: CopyTaskParameters = {
    copyToBehaviorPacks: [`./behavior_packs/${projectName}`],
    copyToScripts: ["./dist/scripts"],
    copyToResourcePacks: [`./resource_packs/${projectName}`],
};

const mcaddonTaskOptions: ZipTaskParameters = {
    ...copyTaskOptions,
    outputFile: `./dist/packages/${projectName}.mcaddon`,
};

const mcworldTaskOptions: ZipTaskParameters = {
    ...copyTaskOptions,
    outputFile: `./dist/packages/${projectName}.mcworld`,
};

// Lint
task("lint", coreLint(["scripts/**/*.ts"], argv().fix));

// Build
task("typescript", tscTask());
task("bundle", bundleTask(bundleTaskOptions));
task("build", series("typescript", "bundle"));

// Clean
task("clean-local", cleanTask(DEFAULT_CLEAN_DIRECTORIES));
task("clean-collateral", cleanCollateralTask(STANDARD_CLEAN_PATHS));
task("clean", parallel("clean-local", "clean-collateral"));

// Package
task("copyArtifacts", copyTask(copyTaskOptions));
task("package", series("clean-collateral", "copyArtifacts"));

// Local Deploy used for deploying local changes directly to output via the bundler. It does a full build and package first just in case.
task(
    "local-deploy",
    watchTask(
        ["scripts/**/*.ts", "behavior_packs/**/*.{json,lang,png}", "resource_packs/**/*.{json,lang,png}"],
        series("clean-local", "build", "package")
    )
);

// Mcaddon
task("createMcaddonFile", mcaddonTask(mcaddonTaskOptions));
task("mcaddon", series("clean-local", "build", "createMcaddonFile"));

// Mcworld
task("createMcworldFile", mcworldTask(mcworldTaskOptions));
task("mcworld", series("clean-local", "build", "createMcworldFile"));

// deploy world to local minecraft
// task("dpw", localDeployWorld());

function mcworldTask(options: ZipTaskParameters) {
    return async (context: any) => {
        const distDir = "./dist";
        const worldDir = "./world"; // world folder template
        if (!fs.existsSync(worldDir)) {
            console.error("World template not found. Please create a folder named 'world' in the root of the project.");
        }

        const worldPath = path.join(distDir, "packages");
        const bpPath = path.join(worldPath, "behavior_packs", projectName);
        const rpPath = path.join(worldPath, "resource_packs", projectName);

        // Copy world template
        copyRecursiveSync(worldDir, worldPath);
        console.log(`Copied world template: ${worldPath}`);

        // Copy packs into dist
        const scriptSource = path.join(distDir, "scripts", "main.js");
        const scriptDest = path.join(`./behavior_packs/${projectName}/scripts/main.js`);
        copyRecursiveSync(scriptSource, scriptDest);
        console.log(`Copied scripts`);

        copyRecursiveSync(`./behavior_packs/${projectName}`, bpPath);
        console.log(`Copied behavior packs`);

        // const scriptSource = path.join(distDir, "scripts", "main.js")
        // copyRecursiveSync(scriptSource, path.join(worldPath, `behavior_packs/${projectName}/scripts/`));
        // console.log(`Copied scripts`);

        copyRecursiveSync(`./resource_packs/${projectName}`, rpPath);
        console.log(`Copied resource packs`);

        // pack UUID linking to world
        // fs.writeFileSync(
        //     path.join(worldBuild, "world_behavior_packs.json"),
        //     JSON.stringify([{ pack_id: "<BP_UUID>", version: [1, 0, 0] }], null, 2)
        // );
        // fs.writeFileSync(
        //     path.join(worldBuild, "world_resource_packs.json"),
        //     JSON.stringify([{ pack_id: "<RP_UUID>", version: [1, 0, 0] }], null, 2)
        // );

        const outputFile = path.resolve(`./dist/packages/${mcworldName}.mcworld`);
        fs.mkdirSync(path.dirname(outputFile), { recursive: true });

        const zip = new AdmZip();
        zip.addLocalFolder(worldPath);
        zip.writeZip(outputFile);

        console.log(`Created .mcworld ${outputFile}`);
        return Promise.resolve();
    };
}

function localDeployWorld() {
    return async (context: any) => {
        const fromWorld = path.resolve(__dirname, "./world");
        if (!fs.existsSync(fromWorld)) {
            console.error("World folder not found");
        }
        const toWorld = path.resolve(
            `C:/Users/Owner/AppData/Local/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang/minecraftWorlds/${projectName}`
        );

        copyRecursiveSync(fromWorld, toWorld);
        return Promise.resolve();
    };
}

function copyRecursiveSync(src: string, dest: string) {
    if (!fs.existsSync(src)) return;
    const stats = fs.statSync(src);

    if (stats.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const file of fs.readdirSync(src)) {
            copyRecursiveSync(path.join(src, file), path.join(dest, file));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}
