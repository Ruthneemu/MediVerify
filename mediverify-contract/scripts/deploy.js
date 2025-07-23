const hre = require("hardhat");

async function main() {
  const MediVerify = await hre.ethers.getContractFactory("MediVerify");
  console.log("Deploying MediVerify...");
  
  const contract = await MediVerify.deploy();
  await contract.waitForDeployment();
  
  console.log(`Deployed to: ${await contract.getAddress()}`);
  console.log(`Explorer: https://alfajores.celoscan.io/address/${await contract.getAddress()}`);
}main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
