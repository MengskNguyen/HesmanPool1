// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Pool1 is Ownable, ReentrancyGuard {

    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    ERC20 public bamiTokenAddress;
    ERC20 public BUSDTokenAddress;
    ERC20 public hesmanTokenAddress;

    mapping(address => bool) public userAlreadyStake;
    mapping(address => bool) public userHasBoughtSlot;
    mapping(address => uint256) public nextStageIndex;
    mapping(address => bool) public blacklist;

    bool public isPause = false;

    uint256 public totalSlots = 100; 
    uint256 public slotHasBeenBought = 0; 

    uint256 public BamiToBuySlot = 300; 
    uint256 public BUSDToBuySlot = 10;  
    uint256 public BamiStakingLimit = 5000;
    uint256 public stakePrice = 5000; 
    uint256 public hesmanPerSlot = 5000; 

    uint256 public stakingTimeStart; 
    uint256 public stakingTimeEnd; 
    uint256 public buySlotTimeStart; 
    uint256 public buySlotTimeEnd; 
    uint256 public unStakeTimeStart; 

    function setPause(bool _pause) public onlyOwner {
        isPause = _pause;
    }

    // Modifer to check pause = false;
    modifier isNotPaused() {
        require(!isPause, "Smart contract is paused");
        _;
    }

    // Claimstage
    struct ClaimStage {
      uint256 claimIndex;
      uint256 claimPercent;
      uint256 claimTimestamp;
    }
    ClaimStage[] public ClaimStageList;

    function setClaimStage(uint256[] calldata _claimTimestamp, uint256[] calldata _claimPercent) public onlyOwner {
      delete ClaimStageList;
      for(uint256 index = 0; index < _claimTimestamp.length; index++)
      {
        ClaimStage memory claimStage;
        claimStage.claimIndex = index;
        claimStage.claimPercent = _claimPercent[index];
        claimStage.claimTimestamp = _claimTimestamp[index];
        ClaimStageList.push(claimStage);
      }
    }

    // Config time
    function configTimer (
        uint256 _stakingTimeStart,
        uint256 _stakingTimeEnd,
        uint256 _buySlotTimeStart,
        uint256 _buySlotTimeEnd,
        uint256 _unStakeTimeStart
    ) external onlyOwner {
        stakingTimeStart = _stakingTimeStart;
        stakingTimeEnd = _stakingTimeEnd;
        buySlotTimeStart = _buySlotTimeStart;
        buySlotTimeEnd = _buySlotTimeEnd;
        unStakeTimeStart = _unStakeTimeStart;
    }

    // Config price and slot
    function configPriceAndSlot (
        uint256 _stakePrice,
        uint256 _totalSlots,
        uint256 _slotHasBeenBought,
        uint256 _BamiToBuySlot,
        uint256 _BUSDToBuySlot,
        uint256 _hesmanPerSlot
    ) external onlyOwner {
        stakePrice = _stakePrice;
        totalSlots = _totalSlots;
        slotHasBeenBought = _slotHasBeenBought;
        BamiToBuySlot = _BamiToBuySlot;
        BUSDToBuySlot = _BUSDToBuySlot;
        hesmanPerSlot = _hesmanPerSlot;
    }

    // Blacklist
    function setBlackList(address _address, bool _isBlackList) external onlyOwner {
        blacklist[_address] = _isBlackList;
    }

    // Confirm user is not blacklist
    modifier isWhiteList() {
        require(!blacklist[msg.sender], "You are on blacklist");
        _;
    }

    // Confirm user has enough Bami to stake
    modifier hasEnoughBamiTokenToStake() {
        require(bamiTokenAddress.balanceOf(msg.sender) >= BamiStakingLimit, "Your account doesn't have enough Bami token to stake");
        _;
    } 

    // Confirm user has enough Bami token to buy a slot
    modifier hasEnoughBamiTokenToBuySlot() {
        require(bamiTokenAddress.balanceOf(msg.sender) >= BamiToBuySlot, "Your account doesn't have enough Bami token to buy slot");
        _;
    } 

    // Confirm user has enough BUSD token to buy slot
    modifier hasEnoughBUSDTokenToBuySlot() {
        require(BUSDTokenAddress.balanceOf(msg.sender) >= BUSDToBuySlot, "Your account doesn't have enough BUSD token to buy slot");
        _;
    } 

    // Confirm user has staked
    modifier hasStaked() {
        require(userAlreadyStake[msg.sender], "You haven't staked");
        _;
    } 

    // Confirm user hasn't staked bami
    modifier hasNotStaked() {
        require(!userAlreadyStake[msg.sender], "You already staked");
        _;
    }

    // Confirm still staking time 
    modifier validStakingTime() {
        require(block.timestamp <= stakingTimeEnd && block.timestamp >= stakingTimeStart, "Invalid staking time");
        _;
    }

    // Confirm still in un-stake time 
    modifier validBuySlotTime() {
        require(block.timestamp <= buySlotTimeEnd && block.timestamp >= buySlotTimeStart, "Invalid buy slot time");
        _;
    }

    // Confim user has buy slot
    modifier hasBoughtSlot() {
        require(userHasBoughtSlot[msg.sender], "You haven't bought slot");
        _;
    }

    // Confim user has not buy slot
    modifier hasNotBoughtSlot() {
        require(!userHasBoughtSlot[msg.sender], "You already bought slot");
        _;
    }

    // Confirm not out of slots
    modifier isNotOutOfSlot() {
        require(slotHasBeenBought < totalSlots, "Out of slots");
        _;
    }

    // Confirm staking time has passed
    modifier ValidUnStakeTime() {
        require(block.timestamp >= unStakeTimeStart, "Can't unstake yet");
        _;
    } 


    constructor (ERC20 _bamiTokenAddress, ERC20 _BUSDTokenAddress, ERC20 _hesmanTokenAddress) {
        bamiTokenAddress = _bamiTokenAddress;
        BUSDTokenAddress = _BUSDTokenAddress;
        hesmanTokenAddress = _hesmanTokenAddress;
        setPause(true);
    } 

    // Function to change address of Bami, BUSD and Hesman token
    // Choose 0 for Bami, 1 for BUSD, 2 for Hesman
    function changeTokenAddress(uint256 _options, ERC20 _tokenAddress) external onlyOwner {
        require(_options >= 0 && _options <= 2, "Input 0 for Bami, 1 for BUSD, 2 for Hesman");
        if(_options == 0) {
            bamiTokenAddress = _tokenAddress;
        } else if(_options == 1) {
            BUSDTokenAddress = _tokenAddress;
        } else if(_options == 2) {
            hesmanTokenAddress = _tokenAddress;
        }
    } 

    // Withdraw all tokens inside this pool to owner
    function EmergencyWithdrawAllToken() external onlyOwner {
        bamiTokenAddress.transfer(msg.sender, bamiTokenAddress.balanceOf(address(this)));
        BUSDTokenAddress.transfer(msg.sender, BUSDTokenAddress.balanceOf(address(this)));
        hesmanTokenAddress.transfer(msg.sender, hesmanTokenAddress.balanceOf(address(this)));
    } 

    // Withdraw certain amount of token from this pool to owner
    // Choose 0 for Bami, 1 for BUSD, 2 for Hesman, any other number to transfer all
    function ownerWithdrawToken(uint256 _options, uint256 _amount) external onlyOwner {
        if(_options == 0) {
            bamiTokenAddress.transfer(msg.sender, _amount);
        } else if(_options == 1) {
            BUSDTokenAddress.transfer(msg.sender, _amount);
        } else if(_options == 2) {
            hesmanTokenAddress.transfer(msg.sender, _amount);
        } else {
            bamiTokenAddress.transfer(msg.sender, _amount);
            BUSDTokenAddress.transfer(msg.sender, _amount);
            hesmanTokenAddress.transfer(msg.sender, _amount);
        }
    } 


    // --------- ĐĂNG KÍ --------- //


    // Staking BAMI
    function stakeBamiToken() external nonReentrant isNotPaused isWhiteList validStakingTime hasNotStaked isNotOutOfSlot hasEnoughBamiTokenToStake  {
        bamiTokenAddress.transferFrom(msg.sender, address(this), stakePrice);
        userAlreadyStake[msg.sender] = true;
    } 

    // --------- KẾT THÚC ĐĂNG KÍ --------- //


    // --------- MUA SLOT --------- //
    function buySlot() external nonReentrant isNotPaused isWhiteList validBuySlotTime isNotOutOfSlot hasStaked hasNotBoughtSlot hasEnoughBUSDTokenToBuySlot hasEnoughBamiTokenToBuySlot {
        bamiTokenAddress.transferFrom(msg.sender, address(this), BamiToBuySlot);
        BUSDTokenAddress.transferFrom(msg.sender, address(this), BUSDToBuySlot);
        userHasBoughtSlot[msg.sender] = true;
        slotHasBeenBought++;
    }
    // --------- KẾT THÚC MUA SLOT --------- //


    // --------- RÚT HESMAN --------- //


    // Withdraw Hesman token
    function claimHesman() nonReentrant isNotPaused isWhiteList hasBoughtSlot external {
        uint256 currentTime = block.timestamp;
        require(nextStageIndex[msg.sender] < ClaimStageList.length, "You have claimed all of your tokens");

        ClaimStage memory claimStage = ClaimStageList[nextStageIndex[msg.sender]];

        require(currentTime >= claimStage.claimTimestamp, "Claim time is not started");
        nextStageIndex[msg.sender] ++;

        uint256 amountClaimCurrentStage = claimStage.claimPercent.mul(hesmanPerSlot).div(100);
        hesmanTokenAddress.safeTransfer(msg.sender, amountClaimCurrentStage);
    }

    // --------- KẾT THÚC RÚT HESMAN --------- //

    // --------- RÚT BAMI --------- //

    // Withdraw staked Bami token

    function withdrawStakedBamiToken() nonReentrant isNotPaused isWhiteList ValidUnStakeTime hasStaked public {
        bamiTokenAddress.transfer(msg.sender, stakePrice);
        userAlreadyStake[msg.sender] = false;
    }

    // --------- KẾT THÚC RÚT BAMI --------- //
}