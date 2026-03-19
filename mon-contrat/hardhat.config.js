require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const privateKey = process.env.PRIVATE_KEY || "";
const hasValidPrivateKey = /^0x[0-9a-fA-F]{64}$/.test(privateKey);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    ganache: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },
    sepolia: {
      url: process.env.ALCHEMY_URL || "",
      chainId: 11155111,
      accounts: hasValidPrivateKey ? [privateKey] : [],
    },
  },
};
