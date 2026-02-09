// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MegaRally.sol";

contract RejectETH {
    // Contract that rejects ETH — used to test pull-payment
    fallback() external { revert("no ETH"); }
}

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
        assertEq(e.tickets, 1);
    }

    function test_buyMultipleTickets() public {
        rally.createTournament(0.01 ether, 1 days);

        vm.startPrank(alice);
        rally.enter{value: 0.01 ether}(1);
        rally.enter{value: 0.01 ether}(1); // second ticket
        rally.enter{value: 0.01 ether}(1); // third ticket
        vm.stopPrank();

        MegaRally.Entry memory e = rally.getEntry(1, alice);
        assertEq(e.tickets, 3);
        assertEq(e.attemptsUsed, 0);

        // Prize pool should be 0.03 ETH
        (,,,, uint256 prizePool,,,) = rally.tournaments(1);
        assertEq(prizePool, 0.03 ether);

        // Only 1 entry in players array
        address[] memory players = rally.getTournamentPlayers(1);
        assertEq(players.length, 1);
    }

    function test_multipleTicketsGiveMoreAttempts() public {
        rally.createTournament(0.01 ether, 1 days);

        vm.startPrank(alice);
        rally.enter{value: 0.01 ether}(1); // 3 attempts
        rally.enter{value: 0.01 ether}(1); // 3 more = 6 total
        vm.stopPrank();

        vm.startPrank(operator);
        // Use all 6 attempts
        for (uint256 i = 0; i < 6; i++) {
            rally.startAttempt(1, alice);
            rally.recordAttemptEnd(1, alice, 10);
        }

        // 7th attempt should fail
        vm.expectRevert("No attempts left");
        rally.recordAttemptEnd(1, alice, 10);
        vm.stopPrank();

        MegaRally.Entry memory e = rally.getEntry(1, alice);
        assertEq(e.attemptsUsed, 6);
        assertEq(e.totalScore, 60);
        assertEq(e.scores.length, 6);
    }

    function test_maxTicketsLimit() public {
        rally.createTournament(0.01 ether, 1 days);

        vm.startPrank(alice);
        for (uint256 i = 0; i < 10; i++) {
            rally.enter{value: 0.01 ether}(1);
        }

        vm.expectRevert("Max tickets reached");
        rally.enter{value: 0.01 ether}(1);
        vm.stopPrank();
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

    function test_noMoreThan3AttemptsPerTicket() public {
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

        // Alice: best score 4
        vm.startPrank(operator);
        rally.recordAttemptEnd(1, alice, 3);
        rally.recordAttemptEnd(1, alice, 4);
        rally.recordAttemptEnd(1, alice, 3);

        // Bob: best score 5
        rally.recordAttemptEnd(1, bob, 5);
        rally.recordAttemptEnd(1, bob, 5);
        rally.recordAttemptEnd(1, bob, 5);
        vm.stopPrank();

        // Warp past end time
        vm.warp(block.timestamp + 1 days + 1);

        rally.endTournament(1);

        // Pull-payment: funds credited, not sent yet
        assertEq(rally.pendingWithdrawals(bob), 0.0196 ether);
        assertEq(rally.pendingWithdrawals(owner), 0.0004 ether);

        // Withdraw
        uint256 bobBalBefore = bob.balance;
        vm.prank(bob);
        rally.withdraw();
        assertEq(bob.balance - bobBalBefore, 0.0196 ether);

        uint256 ownerBalBefore = owner.balance;
        rally.withdraw(); // owner is address(this)
        assertEq(owner.balance - ownerBalBefore, 0.0004 ether);
    }

    function test_endTournamentWithMultipleTickets() public {
        rally.createTournament(0.01 ether, 1 days);

        // Alice buys 2 tickets (6 attempts)
        vm.startPrank(alice);
        rally.enter{value: 0.01 ether}(1);
        rally.enter{value: 0.01 ether}(1);
        vm.stopPrank();

        // Bob buys 1 ticket (3 attempts)
        vm.prank(bob);
        rally.enter{value: 0.01 ether}(1);

        vm.startPrank(operator);
        // Alice: best score = 10
        for (uint256 i = 0; i < 6; i++) {
            rally.recordAttemptEnd(1, alice, 10);
        }
        // Bob: best score = 5
        rally.recordAttemptEnd(1, bob, 5);
        rally.recordAttemptEnd(1, bob, 5);
        rally.recordAttemptEnd(1, bob, 5);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days + 1);

        rally.endTournament(1);

        // Prize pool = 0.03 ETH, alice wins with bestScore 10 > 5
        uint256 fee = (0.03 ether * 200) / 10000;
        uint256 prize = 0.03 ether - fee;
        assertEq(rally.pendingWithdrawals(alice), prize);

        // Withdraw
        uint256 aliceBalBefore = alice.balance;
        vm.prank(alice);
        rally.withdraw();
        assertEq(alice.balance - aliceBalBefore, prize);
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

    // --- Audit-required tests ---

    function test_winnerRejectsETH_pullPayment() public {
        // HIGH: Winner is a contract that rejects ETH — endTournament must still succeed
        RejectETH rejector = new RejectETH();
        address rejAddr = address(rejector);
        vm.deal(rejAddr, 10 ether);

        rally.createTournament(0.01 ether, 1 days);

        vm.prank(rejAddr);
        rally.enter{value: 0.01 ether}(1);
        vm.prank(alice);
        rally.enter{value: 0.01 ether}(1);

        vm.startPrank(operator);
        rally.recordAttemptEnd(1, rejAddr, 100); // highest score
        rally.recordAttemptEnd(1, alice, 10);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days + 1);

        // endTournament should NOT revert even though winner rejects ETH
        rally.endTournament(1);

        (,,,,,,bool ended, address winner) = rally.tournaments(1);
        assertTrue(ended);
        assertEq(winner, rejAddr);

        // Prize is pending, not transferred
        uint256 prize = 0.02 ether - (0.02 ether * 200) / 10000;
        assertEq(rally.pendingWithdrawals(rejAddr), prize);
    }

    function test_cannotStartAttemptAfterExpiry() public {
        // HIGH: Gameplay functions must enforce endTime
        rally.createTournament(0.01 ether, 1 days);

        vm.prank(alice);
        rally.enter{value: 0.01 ether}(1);

        // Warp past endTime but don't call endTournament
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(operator);
        vm.expectRevert("Tournament expired");
        rally.startAttempt(1, alice);
    }

    function test_recordAttemptEndAfterExpiryStillWorks() public {
        // recordAttemptEnd doesn't check endTime (game started before expiry)
        rally.createTournament(0.01 ether, 1 hours);

        vm.prank(alice);
        rally.enter{value: 0.01 ether}(1);

        vm.prank(operator);
        rally.startAttempt(1, alice); // started before expiry

        // Warp past endTime — score submission should still work
        // (attempt was started in time, just finished after)
        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(operator);
        rally.recordAttemptEnd(1, alice, 50); // should succeed

        MegaRally.Entry memory e = rally.getEntry(1, alice);
        assertEq(e.attemptsUsed, 1);
        assertEq(e.bestScore, 50);
    }

    function test_refundPathWithPullPayment() public {
        // MEDIUM: Refunds use pull-payment so reverting addresses don't block others
        RejectETH rejector = new RejectETH();
        address rejAddr = address(rejector);
        vm.deal(rejAddr, 10 ether);

        rally.createTournament(0.01 ether, 1 days);

        vm.prank(rejAddr);
        rally.enter{value: 0.01 ether}(1);
        vm.prank(alice);
        rally.enter{value: 0.01 ether}(1);

        // No one scores — refund path
        vm.warp(block.timestamp + 1 days + 1);
        rally.endTournament(1);

        // Both should have pending refunds
        assertEq(rally.pendingWithdrawals(rejAddr), 0.01 ether);
        assertEq(rally.pendingWithdrawals(alice), 0.01 ether);

        // Alice can withdraw fine
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        rally.withdraw();
        assertEq(alice.balance - aliceBefore, 0.01 ether);
    }

    function test_withdrawNothingReverts() public {
        vm.prank(alice);
        vm.expectRevert("Nothing to withdraw");
        rally.withdraw();
    }

    function test_sweepAfterPullPayment() public {
        rally.createTournament(0.01 ether, 1 days);

        vm.prank(alice);
        rally.enter{value: 0.01 ether}(1);

        vm.startPrank(operator);
        rally.recordAttemptEnd(1, alice, 10);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days + 1);
        rally.endTournament(1);

        // Alice withdraws her prize
        vm.prank(alice);
        rally.withdraw();

        // Owner withdraws fee
        rally.withdraw();

        // Sweep after 7 days — should have nothing
        vm.warp(block.timestamp + 7 days + 1);

        vm.expectRevert("No funds to sweep");
        rally.sweepTournament(1);
    }
}
