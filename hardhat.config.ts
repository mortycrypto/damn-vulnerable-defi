import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-dependency-compiler";
import "@typechain/hardhat";

import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const config: HardhatUserConfig = {
	networks: {
		hardhat: {
			allowUnlimitedContractSize: true,
		},
	},
	typechain: {
		alwaysGenerateOverloads: true,
	},
	solidity: {
		compilers: [{ version: "0.8.7" }, { version: "0.7.6" }, { version: "0.6.6" }],
	},
	dependencyCompiler: {
		paths: [
			"@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol",
			"@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol",
		],
	},
};

export default config;
