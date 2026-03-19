// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MonContrat {
    struct Candidate {
        string name;
        uint256 voteCount;
    }

    address public owner;
    uint256 public constant COOLDOWN = 3 minutes;
    Candidate[] private candidates;
    mapping(address => uint256) public lastVoteTime;

    event Voted(address indexed voter, uint256 candidateIndex);

    constructor() {
        owner = msg.sender;
        candidates.push(Candidate("Leon Blum", 0));
        candidates.push(Candidate("Jacques Chirac", 0));
        candidates.push(Candidate("Francois Mitterrand", 0));
    }

    function getCandidatesCount() external view returns (uint256) {
        return candidates.length;
    }

    function getCandidate(uint256 index) external view returns (string memory name, uint256 voteCount) {
        require(index < candidates.length, "Candidat invalide");
        Candidate storage c = candidates[index];
        return (c.name, c.voteCount);
    }

    function getTimeUntilNextVote(address voter) external view returns (uint256) {
        uint256 last = lastVoteTime[voter];
        if (last == 0 || block.timestamp >= last + COOLDOWN) {
            return 0;
        }
        return (last + COOLDOWN) - block.timestamp;
    }

    function vote(uint256 candidateIndex) external {
        require(candidateIndex < candidates.length, "Candidat invalide");
        require(
            block.timestamp >= lastVoteTime[msg.sender] + COOLDOWN,
            "Attends 3 minutes entre deux votes"
        );

        candidates[candidateIndex].voteCount += 1;
        lastVoteTime[msg.sender] = block.timestamp;

        emit Voted(msg.sender, candidateIndex);
    }
}
