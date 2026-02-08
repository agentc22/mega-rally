// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MegaRally.sol";

contract MegaRallyTest is Test {
    MegaRally public rally;
    address public owner = address(this);
    address public operator = address(0xBEEF);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    receive() external payable {}

    function setUp() public {
        rally = new MegaRally(operator);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function test_createTournament() public {
        uint256 id = rally.createTournament(0.01 ether, 1 days);
        assertEq(id, 1);
        assertEq(rally.tournamentCount(), 1);
    }

    function test_enterTournament() public {
        rally.createTournament(0.01 ether, 1 days);

        vm.prank(alice);
        rally.enter{value: 0.01 ether}(1);

        MegaRally.Entry memory e = rally.getEntry(1, alice);
        assertEq(e.player, alice);
        assertEq(e.attemptsUsed, 0);
    }

    function test_cannotEnterTwice() public {
        rally.createTournament(0.01 ether, 1 days);

        vm.prank(alice);
        rally.enter{value: 0.01 ether}(1);

        vm.prank(alice);
        vm.expectRevert("Already entered");
        rally.enter{value: 0.01 ether}(1);
    }

    function test_wrongEntryFee() public {
        rally.createTournament(0.01 ether, 1 days);

        vm.prank(alice);
        vm.expectRevert("Wrong entry fee");
        rally.enter{value: 0.02 ether}(1);
    }

    function test_recordScores() public {
        rally.createTournament(0.01 ether, 1 days);

        vm.prank(alice);
        rally.enter{value: 0.01 ether}(1);

        vm.startPrank(operator);
        rally.startAttempt(1, alice);
        rally.recordObstacle(1, alice, 1);
        rally.recordObstacle(1, alice, 2);
        rally.recordAttemptEnd(1, alice, 2);

        rally.startAttempt(1, alice);
        rally.recordAttemptEnd(1, alice, 5);

        rally.startAttempt(1, alice);
        rally.recordAttemptEnd(1, alice, 3);
        vm.stopPrank();

        MegaRally.Entry memory e = rally.getEntry(1, alice);
        assertEq(e.attemptsUsed, 3);
        assertEq(e.totalScore, 10);
        assertEq(e.scores[0], 2);
        assertEq(e.scores[1], 5);
        assertEq(e.scores[2], 3);
    }

    function test_noMoreThan3Attempts() public {
        rally.createTournament(0.01 ether, 1 days);

        vm.prank(alice);
        rally.enter{value: 0.01 ether}(1);

        vm.startPrank(operator);
        rally.recordAttemptEnd(1, alice, 1);
        rally.recordAttemptEnd(1, alice, 2);
        rally.recordAttemptEnd(1, alice, 3);

        vm.expectRevert("No attempts left");
        rally.recordAttemptEnd(1, alice, 4);
        vm.stopPrank();
    }

    function test_endTournamentAndPayout() public {
        rally.createTournament(0.01 ether, 1 days);

        vm.prank(alice);
        rally.enter{value: 0.01 ether}(1);
        vm.prank(bob);
        rally.enter{value: 0.01 ether}(1);

        // Alice: total 10
        vm.startPrank(operator);
        rally.recordAttemptEnd(1, alice, 3);
        rally.recordAttemptEnd(1, alice, 4);
        rally.recordAttemptEnd(1, alice, 3);

        // Bob: total 15
        rally.recordAttemptEnd(1, bob, 5);
        rally.recordAttemptEnd(1, bob, 5);
        rally.recordAttemptEnd(1, bob, 5);
        vm.stopPrank();

        // Warp past end time
        vm.warp(block.timestamp + 1 days + 1);

        uint256 bobBalBefore = bob.balance;
        uint256 ownerBalBefore = owner.balance;

        rally.endTournament(1);

        // Prize pool = 0.02 ETH, fee = 2% = 0.0004, prize = 0.0196
        assertEq(bob.balance - bobBalBefore, 0.0196 ether);
        assertEq(owner.balance - ownerBalBefore, 0.0004 ether);
    }

    function test_cannotEndBeforeTime() public {
        rally.createTournament(0.01 ether, 1 days);

        vm.expectRevert("Tournament not ended");
        rally.endTournament(1);
    }

    function test_cannotEndTwice() public {
        rally.createTournament(0.01 ether, 1 days);
        vm.warp(block.timestamp + 1 days + 1);
        rally.endTournament(1);

        vm.expectRevert("Already ended");
        rally.endTournament(1);
    }

    function test_leaderboard() public {
        rally.createTournament(0.01 ether, 1 days);

        vm.prank(alice);
        rally.enter{value: 0.01 ether}(1);
        vm.prank(bob);
        rally.enter{value: 0.01 ether}(1);

        vm.startPrank(operator);
        rally.recordAttemptEnd(1, alice, 10);
        rally.recordAttemptEnd(1, bob, 20);
        vm.stopPrank();

        (address[] memory players, uint256[] memory scores) = rally.getLeaderboard(1);
        assertEq(players.length, 2);
        assertEq(scores[0], 10); // alice
        assertEq(scores[1], 20); // bob
    }

    function test_onlyOperatorCanRecord() public {
        rally.createTournament(0.01 ether, 1 days);

        vm.prank(alice);
        rally.enter{value: 0.01 ether}(1);

        vm.prank(alice);
        vm.expectRevert("Not operator");
        rally.recordAttemptEnd(1, alice, 5);
    }

    function test_onlyOwnerCanCreate() public {
        vm.prank(alice);
        vm.expectRevert("Not owner");
        rally.createTournament(0.01 ether, 1 days);
    }
}
