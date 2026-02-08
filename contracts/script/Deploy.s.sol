// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MegaRally.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Use deployer as operator for now
        MegaRally rally = new MegaRally(deployer);

        console.log("MegaRally deployed at:", address(rally));
        console.log("Owner:", deployer);
        console.log("Operator:", deployer);

        vm.stopBroadcast();
    }
}
