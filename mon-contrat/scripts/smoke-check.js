const { JsonRpcProvider, Contract } = require("ethers");
const fs = require("fs");

async function main() {
  const address = process.argv[2];
  if (!address) {
    throw new Error("Missing contract address argument");
  }

  const abi = JSON.parse(fs.readFileSync("./abi.json", "utf8"));
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");
  const read = new Contract(address, abi, provider);
  const signer = await provider.getSigner(0);
  const write = read.connect(signer);

  const count = await read.getCandidatesCount();
  const candidate0 = await read.getCandidate(0);
  const signerAddress = await signer.getAddress();
  const beforeCooldown = await read.getTimeUntilNextVote(signerAddress);

  const voteTx = await write.vote(0);
  await voteTx.wait();

  const candidate0After = await read.getCandidate(0);

  let invalidCandidateReverted = false;
  try {
    await write.vote(999);
  } catch {
    invalidCandidateReverted = true;
  }

  console.log(
    JSON.stringify(
      {
        address,
        count: Number(count),
        candidate0Name: candidate0[0],
        beforeCooldown: Number(beforeCooldown),
        votesBefore: Number(candidate0[1]),
        votesAfter: Number(candidate0After[1]),
        invalidCandidateReverted,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
