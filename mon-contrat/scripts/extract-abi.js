const fs = require("fs");
const path = require("path");

const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "MonContrat.sol", "MonContrat.json");
const abiOutPath = path.join(__dirname, "..", "abi.json");

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
fs.writeFileSync(abiOutPath, JSON.stringify(artifact.abi, null, 2));

console.log("ABI extraite dans mon-contrat/abi.json");
