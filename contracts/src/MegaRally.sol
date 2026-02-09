// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MegaRally {
    // Constants
    uint256 public constant FEE_BPS = 200; // 2%
    uint256 public constant MAX_ATTEMPTS = 3;
    uint256 public constant MAX_PLAYERS = 256;

    // Structs
    struct Tournament {
        uint256 id;
        uint256 entryFee;
        uint256 startTime;
        uint256 endTime;
        uint256 prizePool;
        uint256 paidOut;
        bool ended;
        address winner;
    }

    struct Entry {
        address player;
        uint256 tournamentId;
        uint256[3] scores;
        uint8 attemptsUsed;
        uint256 totalScore;
    }

    // State
    address public owner;
    address public pendingOwner;
    address public operator;
    uint256 public tournamentCount;
    bool private _locked;

    mapping(uint256 => Tournament) public tournaments;
    mapping(uint256 => mapping(address => Entry)) public entries;
    mapping(uint256 => address[]) public tournamentPlayers;

    // Events
    event TournamentCreated(uint256 indexed tournamentId, uint256 entryFee, uint256 endTime);
    event PlayerEntered(uint256 indexed tournamentId, address indexed player);
    event AttemptStarted(uint256 indexed tournamentId, address indexed player, uint8 attemptNumber);
    event ObstaclePassed(uint256 indexed tournamentId, address indexed player, uint8 attemptNumber, uint256 obstacleId);
    event AttemptEnded(uint256 indexed tournamentId, address indexed player, uint8 attemptNumber, uint256 score);
    event TournamentEnded(uint256 indexed tournamentId, address indexed winner, uint256 prize);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address _operator) {
        require(_operator != address(0), "Zero operator");
        owner = msg.sender;
        operator = _operator;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "Not operator");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "Reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    // --- Ownership ---

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Zero address");
        pendingOwner = _newOwner;
        emit OwnershipTransferStarted(owner, _newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function setOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Zero operator");
        operator = _operator;
    }

    // --- Tournament lifecycle ---

    function createTournament(uint256 _entryFee, uint256 _duration) external onlyOwner returns (uint256) {
        tournamentCount++;
        tournaments[tournamentCount] = Tournament({
            id: tournamentCount,
            entryFee: _entryFee,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            prizePool: 0,
            paidOut: 0,
            ended: false,
            winner: address(0)
        });
        emit TournamentCreated(tournamentCount, _entryFee, block.timestamp + _duration);
        return tournamentCount;
    }

    function enter(uint256 _tournamentId) external payable {
        Tournament storage t = tournaments[_tournamentId];
        require(t.id != 0, "Tournament doesn't exist");
        require(block.timestamp < t.endTime, "Tournament ended");
        require(msg.value == t.entryFee, "Wrong entry fee");
        require(entries[_tournamentId][msg.sender].player == address(0), "Already entered");
        require(tournamentPlayers[_tournamentId].length < MAX_PLAYERS, "Tournament full");

        entries[_tournamentId][msg.sender] = Entry({
            player: msg.sender,
            tournamentId: _tournamentId,
            scores: [uint256(0), uint256(0), uint256(0)],
            attemptsUsed: 0,
            totalScore: 0
        });

        tournamentPlayers[_tournamentId].push(msg.sender);
        t.prizePool += msg.value;

        emit PlayerEntered(_tournamentId, msg.sender);
    }

    // --- Gameplay (operator only) ---

    function startAttempt(uint256 _tournamentId, address _player) external onlyOperator {
        Tournament storage t = tournaments[_tournamentId];
        require(!t.ended, "Tournament ended");
        Entry storage e = entries[_tournamentId][_player];
        require(e.player != address(0), "Not entered");
        require(e.attemptsUsed < MAX_ATTEMPTS, "No attempts left");

        emit AttemptStarted(_tournamentId, _player, e.attemptsUsed + 1);
    }

    function recordObstacle(uint256 _tournamentId, address _player, uint256 _obstacleId) external onlyOperator {
        Tournament storage t = tournaments[_tournamentId];
        require(!t.ended, "Tournament ended");
        Entry storage e = entries[_tournamentId][_player];
        require(e.player != address(0), "Not entered");

        emit ObstaclePassed(_tournamentId, _player, e.attemptsUsed + 1, _obstacleId);
    }

    function recordAttemptEnd(uint256 _tournamentId, address _player, uint256 _score) external onlyOperator {
        Tournament storage t = tournaments[_tournamentId];
        require(!t.ended, "Tournament ended");
        Entry storage e = entries[_tournamentId][_player];
        require(e.player != address(0), "Not entered");
        require(e.attemptsUsed < MAX_ATTEMPTS, "No attempts left");

        e.scores[e.attemptsUsed] = _score;
        e.attemptsUsed++;
        e.totalScore += _score;

        emit AttemptEnded(_tournamentId, _player, e.attemptsUsed, _score);
    }

    // --- Finalization ---

    function endTournament(uint256 _tournamentId) external onlyOwner nonReentrant {
        Tournament storage t = tournaments[_tournamentId];
        require(t.id != 0, "Tournament doesn't exist");
        require(block.timestamp >= t.endTime, "Tournament not ended");
        require(!t.ended, "Already ended");

        address winner;
        uint256 highestScore;
        address[] memory players = tournamentPlayers[_tournamentId];

        // Bounded by MAX_PLAYERS (256) — safe from gas limit
        for (uint256 i = 0; i < players.length; i++) {
            Entry storage e = entries[_tournamentId][players[i]];
            if (e.totalScore > highestScore) {
                highestScore = e.totalScore;
                winner = e.player;
            }
        }

        t.ended = true;
        t.winner = winner;

        if (winner != address(0) && highestScore > 0 && t.prizePool > 0) {
            // Normal payout: winner gets 98%, owner gets 2%
            uint256 fee = (t.prizePool * FEE_BPS) / 10000;
            uint256 prize = t.prizePool - fee;
            t.paidOut = t.prizePool;

            (bool s1,) = payable(winner).call{value: prize}("");
            require(s1, "Prize transfer failed");
            (bool s2,) = payable(owner).call{value: fee}("");
            require(s2, "Fee transfer failed");

            emit TournamentEnded(_tournamentId, winner, prize);
        } else if (players.length > 0 && t.prizePool > 0) {
            // No valid winner — refund all players
            uint256 refundPerPlayer = t.prizePool / players.length;
            uint256 totalRefunded = 0;
            for (uint256 i = 0; i < players.length; i++) {
                (bool ok,) = payable(players[i]).call{value: refundPerPlayer}("");
                if (ok) totalRefunded += refundPerPlayer;
            }
            t.paidOut = totalRefunded;
            emit TournamentEnded(_tournamentId, address(0), 0);
        }
    }

    // Recover residual dust from a specific tournament (not entire contract balance)
    function sweepTournament(uint256 _tournamentId) external onlyOwner nonReentrant {
        Tournament storage t = tournaments[_tournamentId];
        require(t.id != 0, "Tournament doesn't exist");
        require(block.timestamp >= t.endTime + 7 days, "Too early to sweep");
        require(t.ended, "End tournament first");

        uint256 residual = t.prizePool - t.paidOut;
        require(residual > 0, "No funds to sweep");

        t.paidOut = t.prizePool; // Mark fully paid

        (bool ok,) = payable(owner).call{value: residual}("");
        require(ok, "Sweep failed");
    }

    // --- View functions ---

    function getEntry(uint256 _tournamentId, address _player) external view returns (Entry memory) {
        return entries[_tournamentId][_player];
    }

    function getTournamentPlayers(uint256 _tournamentId) external view returns (address[] memory) {
        return tournamentPlayers[_tournamentId];
    }

    function getLeaderboard(uint256 _tournamentId) external view returns (address[] memory, uint256[] memory) {
        address[] memory players = tournamentPlayers[_tournamentId];
        uint256[] memory scores = new uint256[](players.length);

        for (uint256 i = 0; i < players.length; i++) {
            scores[i] = entries[_tournamentId][players[i]].totalScore;
        }

        return (players, scores);
    }
}
