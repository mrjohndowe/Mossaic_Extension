const fs = require("fs");
const path = require("path");

const registryPath = path.resolve(__dirname, "../action-versions.json");

async function getLatestVersion(action) {
    const response = await fetch(
        `https://api.github.com/repos/${action}/releases/latest`,
        {
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": "github-action-version-manager"
            }
        }
    );

    if (!response.ok) {
        throw new Error(
            `Failed to get latest version for ${action}: ${response.status} ${response.statusText}`
        );
    }

    const release = await response.json();

    if (!release.tag_name) {
        throw new Error(`No release tag found for ${action}`);
    }

    const match = release.tag_name.match(/^v?(\d+)/);

    if (!match) {
        throw new Error(
            `Could not determine major version from ${release.tag_name} for ${action}`
        );
    }

    return `v${match[1]}`;
}

async function main() {
    const registry = JSON.parse(
        fs.readFileSync(registryPath, "utf8")
    );

    let changed = false;

    for (const action of Object.keys(registry)) {
        const currentVersion = registry[action];
        const latestVersion = await getLatestVersion(action);

        console.log(
            `${action}: ${currentVersion} -> ${latestVersion}`
        );

        if (currentVersion !== latestVersion) {
            registry[action] = latestVersion;
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(
            registryPath,
            JSON.stringify(registry, null, 2) + "\n"
        );

        console.log("\nAction versions updated.");
    } else {
        console.log("\nAll Action versions are already current.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
