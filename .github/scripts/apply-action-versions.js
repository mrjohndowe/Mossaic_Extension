const fs = require("fs");
const path = require("path");

const registryPath = path.resolve(__dirname, "../action-versions.json");
const workflowsPath = path.resolve(__dirname, "../workflows");

function main() {
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    const workflowFiles = fs.readdirSync(workflowsPath).filter(f => f.endsWith('.yml'));

    let changed = false;

    for (const file of workflowFiles) {
        const filePath = path.join(workflowsPath, file);
        let content = fs.readFileSync(filePath, "utf8");
        const originalContent = content;

        for (const [action, version] of Object.entries(registry)) {
            const regex = new RegExp(`uses:\\s*${action.replace("/", "\\/")}@v\\d+`, "g");
            content = content.replace(regex, `uses: ${action}@${version}`);
        }

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content);
            changed = true;
            console.log(`Updated ${file}`);
        }
    }

    if (changed) {
        console.log("\nWorkflow files updated with new Action versions.");
    } else {
        console.log("\nNo workflow files needed updating.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
