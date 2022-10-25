const { ethers } = require("hardhat");

describe("Pool 2 testing", function() {
    it("Testing pool 2", async function() {

        // console.log("Block", await ethers.provider.getBlockNumber());
        // await ethers.provider.send("hardhat_mine", ["0x" + (10 * 86400).toString(16)]);
        // console.log("Block", await ethers.provider.getBlockNumber());
        
        const BamiToken = await ethers.getContractFactory("Bami");
        const BUSDtoken = await ethers.getContractFactory("BUSDToken");
        const HesmanToken = await ethers.getContractFactory("Hesman");
        const Pool1 = await ethers.getContractFactory("Pool2");

        // Get address
        const [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

        // Deploy contract
        const bamiInstance = await BamiToken.deploy();
        const busdInstance = await BUSDtoken.deploy();
        const hesmanInstance = await HesmanToken.deploy();

        await bamiInstance.deployed();
        await busdInstance.deployed();
        await hesmanInstance.deployed();

        const pool2Instance = await Pool1.deploy(bamiInstance.address, busdInstance.address, hesmanInstance.address); 

        await pool2Instance.deployed();

        // Token approving pool1 
        await bamiInstance.approve(pool2Instance.address, 1000000);
        await busdInstance.approve(pool2Instance.address, 1000000);
        await hesmanInstance.approve(pool2Instance.address, 1000000);

        // Test owner of pool1 = owner.address
        const pool1Owner = await pool2Instance.owner();
        console.log(`. Owner of Pool1: \n Expect: ${owner.address} - Result: ${pool1Owner}\n`);

        // Mint token for addr1 address
        await hesmanInstance.mint(pool2Instance.address, 10000);
        let HESBalanceOfPool2 = await hesmanInstance.balanceOf(pool2Instance.address);
        console.log(`. Balance HES token of Pool1: \n Expect: 10000 - Result: ${HESBalanceOfPool2}\n`);

        // Test if user can stake before staking time
        await pool2Instance.connect(addr1).stakeBamiToken()
            .catch(err => {console.log(`. Expect reverted with "Smart contract is paused"\n ${err}\n`)})

        // Test if user can set paused
        await pool2Instance.connect(addr1).setPause(false)
            .catch(err => {console.log(`. Expect reverted with "Ownable: caller is not the owner"\n ${err}\n`)})

        // Test if owner can set pause 
        await pool2Instance.connect(owner).setPause(false)
        console.log(`. Pause state:\n Expect: false - result: ${await pool2Instance.isPause()}\n`);

        // Get timestamp
        const currentBlockNumber = await ethers.provider.getBlockNumber();
        const currentBlock = await ethers.provider.getBlock(currentBlockNumber);
        const currentTimeStamp = await currentBlock.timestamp;


        // Test if user can access onlyOwner function
        await pool2Instance.connect(addr1).configTimer(
            currentTimeStamp + 86400,
            currentTimeStamp + 86400*2,
            currentTimeStamp + 86400*3,
            currentTimeStamp + 86400*4,
            currentTimeStamp + 86400*5
        ).catch(err => {console.log(`. Expect reverted with "Ownable: caller is not the owner"\n ${err}\n`)});

        await pool2Instance.connect(addr1).configPriceAndSlot(
            5000,   //_stakePrice
            100,    //_totalSlots
            0,      //_slotHasBeenBought
            300,    //_BamiToBuySlot
            10,     //_BUSDToBuySlot
            1000,   //_hesmanClaimPerSlot 
        ).catch(err => {console.log(`. Expect reverted with "Ownable: caller is not the owner"\n ${err}\n`)});

        // Test if owner can access onlyOwner function
        await pool2Instance.connect(owner).configTimer(
            currentTimeStamp + 86400,   //stakingTimeStart
            currentTimeStamp + 86400*2, //stakingTimeEnd
            currentTimeStamp + 86400*3, //buySlotTimeStart
            currentTimeStamp + 86400*4, //buySlotTimeEnd
            currentTimeStamp + 86400*10, //unStakeTimeStart
        );

        console.log(`. Test if owner can set time:\n Expect: ${await currentTimeStamp + 86400}, ${await currentTimeStamp + 86400*2}, ${await currentTimeStamp + 86400*3}, ${await currentTimeStamp + 86400*4}, ${await currentTimeStamp + 86400*5}\n Result: ${await pool2Instance.stakingTimeStart()}, ${await pool2Instance.stakingTimeEnd()}, ${await pool2Instance.buySlotTimeStart()}, ${await pool2Instance.buySlotTimeEnd()}, ${await pool2Instance.unStakeTimeStart()}\n`)

        await pool2Instance.connect(owner).configPriceAndSlot(
            200,   //_stakePrice
            100,    //_totalSlots
            0,      //_slotHasBeenBought
            300,    //_BamiToBuySlot
            10,     //_BUSDToBuySlot
            1000,   //_hesmanClaimPerSlot 
        );

        console.log(`. Test if owner can set price and slot:\n Expect: 200, 100, 0, 300, 10, 1000\n Result: ${await pool2Instance.stakePrice()}, ${await pool2Instance.totalSlots()}, ${await pool2Instance.slotHasBeenBought()}, ${await pool2Instance.BamiToBuySlot()}, ${await pool2Instance.BUSDToBuySlot()}, ${await pool2Instance.hesmanClaimPerSlot()}\n`)

        // console.log("Timestamp: ", currentTimeStamp);
        // Test if user can stake before staking time
        await pool2Instance.connect(addr1).stakeBamiToken()
            .catch(err => {console.log(`. Expect reverted with "Invalid staking time"\n ${err}\n`)})

        // Forward 1 day
        await ethers.provider.send("hardhat_mine", ["0x" + (1 * 86400).toString(16)]);

        // Test if user can stake if don't have enough bami
        await pool2Instance.connect(addr1).stakeBamiToken()
            .catch(err => {console.log(`. Expect reverted with "Your account doesn't have enough Bami token to stake"\n ${err}\n`)})
        
        // Test if blacklist user can stake
        await pool2Instance.connect(owner).setBlackList(addr4.address, true);
        console.log(". Expect blacklist[addr4] = true\n Result: ", await pool2Instance.blacklist(addr4.address), "\n");
        await pool2Instance.connect(addr4).stakeBamiToken()
            .catch(err => {console.log(`. Expect reverted with "You are on blacklist"\n Result: ${err}\n`)})
        await pool2Instance.connect(owner).setBlackList(addr4.address, false);
            console.log(". Expect blacklist[addr4] = false\n Result: ", await pool2Instance.blacklist(addr4.address), "\n");
        // Mint bami for addr1
        await bamiInstance.mint(addr1.address, 20000);
        let addr1BamiBalance = await bamiInstance.balanceOf(addr1.address)
        console.log(`. Expected Bami balance of addr1 to change:\n Expect: 20000\n Result: ${addr1BamiBalance}\n`)

        // Mint bami for addr3
        await bamiInstance.mint(addr3.address, 20000);
        let addr3BamiBalance = await bamiInstance.balanceOf(addr3.address)
        console.log(`. Expected Bami balance of addr3 to change:\n Expect: 20000\n Result: ${addr3BamiBalance}\n`)

        // Test if user can stake when pause
        await pool2Instance.connect(owner).setPause(true)
        await pool2Instance.connect(addr1).stakeBamiToken()
            .catch(err => console.log(`. Expected reverted with "Smart contract is paused"\n${err}\n`))

        await pool2Instance.connect(owner).setPause(false)

        // User approve pool1 to transfer token from addr1 to pool1

        await bamiInstance.connect(addr1).approve(pool2Instance.address, 10000);
        // User stake bami, and test if the correct amount of token is transfer from addr1 to pool1
        let pool2BamiBalance = await bamiInstance.balanceOf(pool2Instance.address);
        await pool2Instance.connect(addr1).stakeBamiToken();
        addr1BamiBalance1 = await bamiInstance.balanceOf(addr1.address);
        pool2BamiBalance1 = await bamiInstance.balanceOf(pool2Instance.address);
        let stakePrice = await pool2Instance.stakePrice();
        console.log(`. Test if user can stake and transfer right amount of token:\n Expect: ${addr1BamiBalance - stakePrice} - ${pool2BamiBalance + stakePrice}\n Result: ${addr1BamiBalance1} - ${pool2BamiBalance1}\n`);
        console.log(". Expect userAlreadyStake[addr1] = true\n Result: ", await pool2Instance.userAlreadyStake(addr1.address));
        
        // addr3 stake bami
        await bamiInstance.connect(addr3).approve(pool2Instance.address, 10000);
        await pool2Instance.connect(addr3).stakeBamiToken();

        // Test if user can stake again
        await pool2Instance.connect(addr1).stakeBamiToken()
            .catch(err => {console.log(`. Expect reverted with "You already staked"\n ${err}\n`)});

        // Test if user can buy slot when not buy slot time
        await pool2Instance.connect(addr1).buySlot()
            .catch(err => {console.log(`. Expect reverted with "Invalid buy slot time"\n ${err}\n`)});

        // Forward 1.5 day
        await ethers.provider.send("hardhat_mine", ["0x" + (2 * 86400).toString(16)]);

        // Test if user can stake when pass staking time
        await bamiInstance.connect(addr2).approve(pool2Instance.address, 10000);
        await pool2Instance.connect(addr2).stakeBamiToken()
            .catch(err => {console.log(`. Expect reverted with "Invalid staking time"\n ${err}\n`)})

        // Test if unstake user can buy slot
        await pool2Instance.connect(addr2).buySlot()
            .catch(err => {console.log(`. Expect reverted with "You haven't staked"\n ${err}\n`)})

        // Test if user can buy slot when dont have enough busd
        await pool2Instance.connect(addr1).buySlot()
            .catch(err => {console.log(`. Expect reverted with "Your account doesn't have enough BUSD"\n ${err}\n`)})

        // To set total slot = 0
        await pool2Instance.connect(owner).configPriceAndSlot(
            200,   //_stakePrice
            0,    //_totalSlots
            0,      //_slotHasBeenBought
            300,    //_BamiToBuySlot
            10,     //_BUSDToBuySlot
            1000,   //_hesmanClaimPerSlot 
        );

        // Test if user can buy slot when out of slot
        await pool2Instance.connect(addr1).buySlot()
            .catch(err => {console.log(`. Expect reverted with "Out of slots"\n ${err}\n`)})

        // To set total slot = 100
        await pool2Instance.connect(owner).configPriceAndSlot(
            5000,   //_stakePrice
            100,    //_totalSlots
            0,      //_slotHasBeenBought
            300,    //_BamiToBuySlot
            10,     //_BUSDToBuySlot
            1000,   //_hesmanClaimPerSlot 
        );

        // Mint BUSD for addr1
        await busdInstance.mint(addr1.address, 20000);
        let addr1BUSDBalance = await busdInstance.balanceOf(addr1.address);
        console.log(`. Expected BUSD balance of addr1 to change:\n Expect: 20000\n Result: ${addr1BUSDBalance}\n`)

        // Test if user can buy slot
        await busdInstance.connect(addr1).approve(pool2Instance.address, 10000);
        await busdInstance.connect(addr2).approve(pool2Instance.address, 10000);
        await pool2Instance.connect(addr1).buySlot()
        let addr1BUSDBalance1 = await busdInstance.balanceOf(addr1.address);
        let addr1BamiBalance2 = await bamiInstance.balanceOf(addr1.address);

        let pool2BamiBalance2 = await bamiInstance.balanceOf(pool2Instance.address);
        let pool2BUSDBalance = await busdInstance.balanceOf(pool2Instance.address);

        console.log(". Expected userHasBoughtSlot[addr1.address] = true\n Result: ", await pool2Instance.userHasBoughtSlot(addr1.address), "\n");
        console.log(`. Expected Bami balance of addr1 to minus 300:\n Expect: 19500\n Result: ${addr1BamiBalance2}\n`);
        console.log(`. Expected BUSD balance of addr1 to minus 10:\n Expect: 19990\n Result: ${addr1BUSDBalance1}\n`);
        console.log(`. Expected Bami balance of pool2 to plus 300:\n Expect: 700\n Result: ${pool2BamiBalance2}\n`);
        console.log(`. Expected BUSD balance of pool2 to plus 10:\n Expect: 10\n Result: ${pool2BUSDBalance}\n`);

        // Owner set claim stage
        await pool2Instance.connect(owner).setClaimStage([currentTimeStamp + 86400*7, currentTimeStamp + 86400*8, currentTimeStamp + 86400*9, currentTimeStamp + 86400*10], [25,25,25,25]);

        
        // Test if user can claim hesman before time
        await pool2Instance.connect(addr1).claimHesman()
            .catch(err => {console.log(`. Expect reverted with "Claim time is not started"\n ${err}\n`)})

        // Test if user can claim hesman
        await ethers.provider.send("hardhat_mine", ["0x" + (4 * 86400).toString(16)]);

        await pool2Instance.connect(addr1).claimHesman();
        console.log(". Expect balance of addr1 increase 250\n Result: ", await hesmanInstance.balanceOf(addr1.address), "\n");

        await pool2Instance.connect(addr1).claimHesman()
            .catch(err => {console.log(`. Expect reverted with "Claim time is not started"\n ${err}\n`)})

        await ethers.provider.send("hardhat_mine", ["0x" + (4 * 86400).toString(16)]);
        await pool2Instance.connect(addr1).claimHesman();
        console.log(". Expect balance of addr1 increase by 250\n Result: ", await hesmanInstance.balanceOf(addr1.address), "\n");
        await pool2Instance.connect(addr1).claimHesman();
        console.log(". Expect balance of addr1 increase by 250\n Result: ", await hesmanInstance.balanceOf(addr1.address), "\n");
        await pool2Instance.connect(addr1).claimHesman();
        console.log(". Expect balance of addr1 increase by 250\n Result: ", await hesmanInstance.balanceOf(addr1.address), "\n");

        // Test if user can claim pass limit
        await pool2Instance.connect(addr1).claimHesman()
            .catch(err => {console.log(`. Expect reverted with "You have claimed all of your tokens"\n ${err}\n`)});
        
        // Test emergency withdraw
        let ownerBamiBalance = await bamiInstance.balanceOf(owner.address);
        let ownerHesmanBalance = await hesmanInstance.balanceOf(owner.address);
        let ownerBUSDBalance = await busdInstance.balanceOf(owner.address);
        console.log(`.Before withdraw: ${ownerBamiBalance} - ${ownerHesmanBalance} - ${ownerBUSDBalance}`);
        await pool2Instance.connect(owner).EmergencyWithdrawAllToken();
        ownerBamiBalance = await bamiInstance.balanceOf(owner.address);
        ownerHesmanBalance = await hesmanInstance.balanceOf(owner.address);
        ownerBUSDBalance = await busdInstance.balanceOf(owner.address);
        console.log(`. After withdraw: ${ownerBamiBalance} - ${ownerHesmanBalance} - ${ownerBUSDBalance}`);

    })
})