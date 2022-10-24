const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");

describe("Pool 1 testing", function() {
    it("Testing pool 1", async function() {

        // console.log("Block", await ethers.provider.getBlockNumber());
        // await ethers.provider.send("hardhat_mine", ["0x" + (10 * 86400).toString(16)]);
        // console.log("Block", await ethers.provider.getBlockNumber());
        
        const BamiToken = await ethers.getContractFactory("Bami");
        const BUSDtoken = await ethers.getContractFactory("BUSDToken");
        const HesmanToken = await ethers.getContractFactory("Hesman");
        const Pool1 = await ethers.getContractFactory("Pool1");

        // Get address
        const [owner, addr1, addr2, addr3] = await ethers.getSigners();

        // Deploy contract
        const bamiInstance = await BamiToken.deploy();
        const busdInstance = await BUSDtoken.deploy();
        const hesmanInstance = await HesmanToken.deploy();

        await bamiInstance.deployed();
        await busdInstance.deployed();
        await hesmanInstance.deployed();

        const pool1Instance = await Pool1.deploy(bamiInstance.address, busdInstance.address, hesmanInstance.address); 

        await pool1Instance.deployed();

        // Token approving pool1 
        await bamiInstance.approve(pool1Instance.address, 1000000);
        await busdInstance.approve(pool1Instance.address, 1000000);
        await hesmanInstance.approve(pool1Instance.address, 1000000);

        // Test owner of pool1 = owner.address
        const pool1Owner = await pool1Instance.owner();
        console.log(`. Owner of Pool1: \n Expect: ${owner.address} - Result: ${pool1Owner}`);

        // Mint token for addr1 address
        await hesmanInstance.mint(pool1Instance.address, 10000);
        let HESBalanceOfPool1 = await hesmanInstance.balanceOf(pool1Instance.address);
        console.log(`. Balance HES token of Pool1: \n Expect: 10000 - Result: ${HESBalanceOfPool1}`);

        // Test if user can stake before staking time
        await pool1Instance.connect(addr1).stakeBamiToken()
            .catch(err => {console.log(`. Expect reverted with "Smart contract is paused"\n ${err}`)})

        // Test if user can set paused
        await pool1Instance.connect(addr1).setPause(false)
            .catch(err => {console.log(`. Expect reverted with "Ownable: caller is not the owner"\n ${err}`)})

        // Test if owner can set pause 
        await pool1Instance.connect(owner).setPause(false)
        console.log(`. Pause state:\n Expect: false - result: ${await pool1Instance.isPause()}`);

        // Get timestamp
        const currentBlockNumber = await ethers.provider.getBlockNumber();
        const currentBlock = await ethers.provider.getBlock(currentBlockNumber);
        const currentTimeStamp = await currentBlock.timestamp;


        // Test if user can access onlyOwner function
        await pool1Instance.connect(addr1).configTimer(
            currentTimeStamp + 86400,
            currentTimeStamp + 86400*2,
            currentTimeStamp + 86400*3,
            currentTimeStamp + 86400*4,
            currentTimeStamp + 86400*5,
        ).catch(err => {console.log(`. Expect reverted with "Ownable: caller is not the owner"\n ${err}`)});

        await pool1Instance.connect(addr1).configPriceAndSlot(
            5000,   //_stakePrice
            100,    //_totalSlots
            0,      //_slotHasBeenBought
            300,    //_BamiToBuySlot
            10,     //_BUSDToBuySlot
            1000,   //_hesmanPerSlot 
        ).catch(err => {console.log(`. Expect reverted with "Ownable: caller is not the owner"\n ${err}`)});

        // Test if owner can access onlyOwner function
        await pool1Instance.connect(owner).configTimer(
            currentTimeStamp + 86400,   //stakingTimeStart
            currentTimeStamp + 86400*2, //stakingTimeEnd
            currentTimeStamp + 86400*3, //buySlotTimeStart
            currentTimeStamp + 86400*4, //buySlotTimeEnd
            currentTimeStamp + 86400*10, //unStakeTimeStart
        );

        console.log(`. Test if owner can set time:\n Expect: ${await currentTimeStamp + 86400}, ${await currentTimeStamp + 86400*2}, ${await currentTimeStamp + 86400*3}, ${await currentTimeStamp + 86400*4}, ${await currentTimeStamp + 86400*5}\n Result: ${await pool1Instance.stakingTimeStart()}, ${await pool1Instance.stakingTimeEnd()}, ${await pool1Instance.buySlotTimeStart()}, ${await pool1Instance.buySlotTimeEnd()}, ${await pool1Instance.unStakeTimeStart()}`)

        await pool1Instance.connect(owner).configPriceAndSlot(
            5000,   //_stakePrice
            100,    //_totalSlots
            0,      //_slotHasBeenBought
            300,    //_BamiToBuySlot
            10,     //_BUSDToBuySlot
            1000,   //_hesmanPerSlot 
        );

        console.log(`. Test if owner can set price and slot:\n Expect: 5000, 100, 0, 300, 10, 1000\n Result: ${await pool1Instance.stakePrice()}, ${await pool1Instance.totalSlots()}, ${await pool1Instance.slotHasBeenBought()}, ${await pool1Instance.BamiToBuySlot()}, ${await pool1Instance.BUSDToBuySlot()}, ${await pool1Instance.hesmanPerSlot()}`)

        // console.log("Timestamp: ", currentTimeStamp);
        // Test if user can stake before staking time
        await pool1Instance.connect(addr1).stakeBamiToken()
            .catch(err => {console.log(`. Expect reverted with "Invalid staking time"\n ${err}`)})

        // Forward 1.5 day
        await ethers.provider.send("hardhat_mine", ["0x" + (1.5 * 86400).toString(16)]);

        // Test if user can stake if don't have enough bami
        await pool1Instance.connect(addr1).stakeBamiToken()
            .catch(err => {console.log(`. Expect reverted with "Your account doesn't have enough Bami token to stake"\n ${err}`)})

        
        // Mint bami for addr1
        await bamiInstance.mint(addr1.address, 20000);
        let addr1BamiBalance = await bamiInstance.balanceOf(addr1.address)
        console.log(`. Expected Bami balance of addr1 to change:\n Expect: 20000\n Result: ${addr1BamiBalance}`)

        // Mint bami for addr3
        await bamiInstance.mint(addr3.address, 20000);
        let addr3BamiBalance = await bamiInstance.balanceOf(addr3.address)
        console.log(`. Expected Bami balance of addr3 to change:\n Expect: 20000\n Result: ${addr3BamiBalance}`)

        // Test if user can stake when pause
        await pool1Instance.connect(owner).setPause(true)
        await pool1Instance.connect(addr1).stakeBamiToken()
            .catch(err => console.log(`. Expected reverted with "Smart contract is paused"\n${err}`))

        await pool1Instance.connect(owner).setPause(false)

        // User approve pool1 to transfer token from addr1 to pool1

        // User stake bami, and test if the correct amount of token is transfer from addr1 to pool1
        await bamiInstance.connect(addr1).approve(pool1Instance.address, 10000);
        let pool1BamiBalance = await bamiInstance.balanceOf(pool1Instance.address);
        await pool1Instance.connect(addr1).stakeBamiToken();
        let addr1BamiBalance1 = await bamiInstance.balanceOf(addr1.address);
        let pool1BamiBalance1 = await bamiInstance.balanceOf(pool1Instance.address);
        let stakePrice = await pool1Instance.stakePrice();
        console.log(`. Test if user can stake and transfer right amount of token:\n Expect: ${addr1BamiBalance - stakePrice} - ${pool1BamiBalance + stakePrice}\n Result: ${addr1BamiBalance1} - ${pool1BamiBalance1}`);
        console.log("15. Expect userAlreadyStake[addr1] = true\n Result: ", await pool1Instance.userAlreadyStake(addr1.address));
        
        // addr3 stake bami
        await bamiInstance.connect(addr3).approve(pool1Instance.address, 10000);
        await pool1Instance.connect(addr3).stakeBamiToken();

        // Test if user can stake again
        await pool1Instance.connect(addr1).stakeBamiToken()
            .catch(err => {console.log(`. Expect reverted with "You already staked"\n ${err}`)})

        // Test if user can buy slot when not buy slot time
        await pool1Instance.connect(addr1).buySlot()
            .catch(err => {console.log(`. Expect reverted with "Invalid buy slot time"\n ${err}`)});

        // Test if user can withdraw bami when not unstake time
        await pool1Instance.connect(addr1).withdrawStakedBamiToken()
            .catch(err => {console.log(`. Expect reverted with "Invalid unstake time"\n ${err}`)});         

        // Forward 1.5 day
        await ethers.provider.send("hardhat_mine", ["0x" + (1.5 * 86400).toString(16)]);

        // Test if user can stake when pass staking time
        await bamiInstance.connect(addr2).approve(pool1Instance.address, 10000);
        await pool1Instance.connect(addr2).stakeBamiToken()
            .catch(err => {console.log(`. Expect reverted with "Invalid staking time"\n ${err}`)})

        // Test if unstake user can buy slot
        await pool1Instance.connect(addr2).buySlot()
            .catch(err => {console.log(`. Expect reverted with "You haven't staked"\n ${err}`)})

        // Test if user can buy slot when dont have enough busd
        await pool1Instance.connect(addr1).buySlot()
            .catch(err => {console.log(`. Expect reverted with "Your account doesn't have enough BUSD token to buy slot"\n ${err}`)})

        // To set total slot = 0
        await pool1Instance.connect(owner).configPriceAndSlot(
            5000,   //_stakePrice
            0,    //_totalSlots
            0,      //_slotHasBeenBought
            300,    //_BamiToBuySlot
            10,     //_BUSDToBuySlot
            1000,   //_hesmanPerSlot 
        );

        // Test if user can buy slot when out of slot
        await pool1Instance.connect(addr1).buySlot()
            .catch(err => {console.log(`. Expect reverted with "Out of slots"\n ${err}`)})

        // To set total slot = 100
        await pool1Instance.connect(owner).configPriceAndSlot(
            5000,   //_stakePrice
            100,    //_totalSlots
            0,      //_slotHasBeenBought
            300,    //_BamiToBuySlot
            10,     //_BUSDToBuySlot
            1000,   //_hesmanPerSlot 
        );

        // Mint BUSD for addr1
        await busdInstance.mint(addr1.address, 20000);
        let addr1BUSDBalance = await busdInstance.balanceOf(addr1.address);
        console.log(`. Expected BUSD balance of addr1 to change:\n Expect: 20000\n Result: ${addr1BUSDBalance}`)

        // Test if user can buy slot
        await busdInstance.connect(addr1).approve(pool1Instance.address, 10000);
        await busdInstance.connect(addr2).approve(pool1Instance.address, 10000);
        await pool1Instance.connect(addr1).buySlot()
        let addr1BUSDBalance1 = await busdInstance.balanceOf(addr1.address);
        let addr1BamiBalance2 = await bamiInstance.balanceOf(addr1.address);

        let pool1BamiBalance2 = await bamiInstance.balanceOf(pool1Instance.address);
        let pool1BUSDBalance = await busdInstance.balanceOf(pool1Instance.address);

        console.log(". Expected userHasBoughtSlot[addr1.address] = true\n Result: ", await pool1Instance.userHasBoughtSlot(addr1.address));
        console.log(`. Expected Bami balance of addr1 to minus 300:\n Expect: 14700\n Result: ${addr1BamiBalance2}`);
        console.log(`. Expected BUSD balance of addr1 to minus 10:\n Expect: 19990\n Result: ${addr1BUSDBalance1}`);
        console.log(`. Expected Bami balance of pool1 to plus 300:\n Expect: 5300\n Result: ${pool1BamiBalance2}`);
        console.log(`. Expected BUSD balance of pool1 to plus 10:\n Expect: 10\n Result: ${pool1BUSDBalance}`);

        // Owner set claim stage
        await pool1Instance.connect(owner).setClaimStage([currentTimeStamp + 86400*7, currentTimeStamp + 86400*8, currentTimeStamp + 86400*9, currentTimeStamp + 86400*10], [25,25,25,25]);

        
        // Test if user can claim hesman before time
        await pool1Instance.connect(addr1).claimHesman()
            .catch(err => {console.log(`. Expect reverted with "Claim time is not started"\n ${err}`)})

        // Test if user can claim hesman
        await ethers.provider.send("hardhat_mine", ["0x" + (4 * 86400).toString(16)]);

        await pool1Instance.connect(addr1).claimHesman();
        console.log(". Expect balance of addr1 increase 250\n Result: ", await hesmanInstance.balanceOf(addr1.address));

        await pool1Instance.connect(addr1).claimHesman()
            .catch(err => {console.log(`. Expect reverted with "Claim time is not started"\n ${err}`)})

        await ethers.provider.send("hardhat_mine", ["0x" + (4 * 86400).toString(16)]);
        await pool1Instance.connect(addr1).claimHesman();
        console.log(". Expect balance of addr1 increase 250\n Result: ", await hesmanInstance.balanceOf(addr1.address));
        await pool1Instance.connect(addr1).claimHesman();
        console.log(". Expect balance of addr1 increase 250\n Result: ", await hesmanInstance.balanceOf(addr1.address));
        await pool1Instance.connect(addr1).claimHesman();
        console.log(". Expect balance of addr1 increase 250\n Result: ", await hesmanInstance.balanceOf(addr1.address));

        // Test if user can claim pass limit
        await pool1Instance.connect(addr1).claimHesman()
            .catch(err => {console.log(`. Expect reverted with "You have claimed all of your tokens"\n ${err}`)});
        
        // Test if user can withdraw Bami
        // console.log(`. Expect balance of user and pool change +/-5000:\n Expect: +5000 -5000\n Result: ${addr1BamiBalance2} ${pool1BamiBalance2}`);
        await pool1Instance.connect(addr1).withdrawStakedBamiToken();
        addr1BamiBalance = await bamiInstance.balanceOf(addr1.address);
        pool1BamiBalance = await bamiInstance.balanceOf(pool1Instance.address);
        console.log(`. Expect balance of user and pool change +/-5000:\n Expect: +5000 -5000\n Result: ${addr1BamiBalance} ${pool1BamiBalance}`);
        
        // Test if user stake but didn't buy Hesman can withdraw Bami
        await pool1Instance.connect(addr3).withdrawStakedBamiToken();
        addr3BamiBalance = await bamiInstance.balanceOf(addr3.address);
        pool1BamiBalance = await bamiInstance.balanceOf(pool1Instance.address);
        console.log(`. Expect balance of user and pool change +/-5000:\n Expect: +5000 -5000\n Result: ${addr1BamiBalance} ${pool1BamiBalance}`);

        // Test if user can withdraw Bami again
        await pool1Instance.connect(addr1).withdrawStakedBamiToken()
            .catch(err => {console.log(`. Expect reverted with "You haven't staked"\n ${err}`)})

        // Test emergency withdraw
        let ownerBamiBalance = await bamiInstance.balanceOf(owner.address);
        let ownerHesmanBalance = await hesmanInstance.balanceOf(owner.address);
        let ownerBUSDBalance = await busdInstance.balanceOf(owner.address);
        console.log(`${ownerBamiBalance} - ${ownerHesmanBalance} - ${ownerBUSDBalance}`);
        await pool1Instance.connect(owner).EmergencyWithdrawAllToken()
        ownerBamiBalance = await bamiInstance.balanceOf(owner.address);
        ownerHesmanBalance = await hesmanInstance.balanceOf(owner.address);
        ownerBUSDBalance = await busdInstance.balanceOf(owner.address);
        console.log(`${ownerBamiBalance} - ${ownerHesmanBalance} - ${ownerBUSDBalance}`);

    })
})