// Artefacto público; ejecutar después de compilar FranToken_Blockchain.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const input = path.resolve(
  root,
  "../FranToken_Blockchain/artifacts/contracts/compliance/FranchiseCompliance.sol/FranchiseCompliance.json",
);
const { abi, bytecode } = JSON.parse(fs.readFileSync(input, "utf8"));
if (!Array.isArray(abi) || !/^0x[\da-f]+$/i.test(bytecode))
  throw Error("Compilá el contrato de compliance antes de importar.");
const output = path.join(root, "src/blockchain/generated/compliance.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ abi, bytecode }, null, 2) + "\n");
console.log("ABI/bytecode público de compliance actualizado.");
