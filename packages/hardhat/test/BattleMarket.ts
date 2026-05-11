import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";

import { ConfidentialBattleMarket, ConfidentialBattleMarket__factory } from "../types";

const ZERO = ethers.ZeroHash;

const JoinMode = { ADMIN_INVITE: 0, INVITE_LINK: 1, PUBLIC: 2 } as const;
const BattleScope = { ONE_V_ONE: 0, GROUP: 1 } as const;
const BattleStatus = { PENDING: 0, ACTIVE: 1, CANCELLED: 2 } as const;
const MarketKind = { BTC_PRICE: 0, ETH_PRICE: 1, MANUAL: 2 } as const;

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
  mallory: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ConfidentialBattleMarket")) as ConfidentialBattleMarket__factory;
  // BTC/ETH feed addresses are unused in the manual-market flow we test below.
  const dummyFeed = ethers.Wallet.createRandom().address;
  const contract = (await factory.deploy(dummyFeed, dummyFeed)) as ConfidentialBattleMarket;
  const address = await contract.getAddress();
  return { contract, address };
}

async function expectId(tx: { wait: () => Promise<any> }, eventName: string): Promise<number> {
  const receipt = await tx.wait();
  const log = receipt.logs.find((l: any) => l.fragment && l.fragment.name === eventName);
  if (!log) throw new Error(`Event ${eventName} not found`);
  return Number(log.args.id);
}

describe("ConfidentialBattleMarket", function () {
  let signers: Signers;
  let contract: ConfidentialBattleMarket;
  let address: string;

  before(async function () {
    const s = await ethers.getSigners();
    signers = { deployer: s[0], alice: s[1], bob: s[2], carol: s[3], mallory: s[4] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("Skipping local-only suite on non-mock network");
      this.skip();
    }
    ({ contract, address } = await deployFixture());
  });

  // -----------------------------------------------------------------------
  // Groups
  // -----------------------------------------------------------------------

  describe("Groups", function () {
    it("creator becomes admin and first member", async function () {
      const tx = await contract.connect(signers.alice).createGroup("Friends", JoinMode.ADMIN_INVITE, ZERO);
      const id = await expectId(tx, "GroupCreated");

      const g = await contract.groups(id);
      expect(g.admin).to.eq(signers.alice.address);
      expect(g.name).to.eq("Friends");
      expect(g.joinMode).to.eq(JoinMode.ADMIN_INVITE);
      expect(g.exists).to.eq(true);

      expect(await contract.groupMembers(id, signers.alice.address)).to.eq(true);
      expect(await contract.groupMemberCount(id)).to.eq(1);
    });

    it("INVITE_LINK requires non-zero hash", async function () {
      await expect(contract.connect(signers.alice).createGroup("L", JoinMode.INVITE_LINK, ZERO)).to.be.revertedWith(
        "INVITE_HASH_REQUIRED",
      );
    });

    it("PUBLIC group rejects an invite hash", async function () {
      await expect(
        contract.connect(signers.alice).createGroup("P", JoinMode.PUBLIC, ethers.id("garbage")),
      ).to.be.revertedWith("UNEXPECTED_HASH");
    });

    it("admin can add members; non-admin cannot", async function () {
      const tx = await contract.connect(signers.alice).createGroup("A", JoinMode.ADMIN_INVITE, ZERO);
      const id = await expectId(tx, "GroupCreated");

      await contract.connect(signers.alice).addGroupMember(id, signers.bob.address);
      expect(await contract.groupMembers(id, signers.bob.address)).to.eq(true);

      await expect(
        contract.connect(signers.mallory).addGroupMember(id, signers.carol.address),
      ).to.be.revertedWith("NOT_ADMIN");

      await expect(contract.connect(signers.alice).addGroupMember(id, signers.bob.address)).to.be.revertedWith(
        "ALREADY_MEMBER",
      );
    });

    it("INVITE_LINK self-join with correct secret", async function () {
      const secret = ethers.toUtf8Bytes("super-secret-link");
      const hash = ethers.keccak256(secret);
      const tx = await contract.connect(signers.alice).createGroup("L", JoinMode.INVITE_LINK, hash);
      const id = await expectId(tx, "GroupCreated");

      await expect(
        contract.connect(signers.bob).joinGroupWithSecret(id, ethers.toUtf8Bytes("wrong")),
      ).to.be.revertedWith("BAD_SECRET");

      await contract.connect(signers.bob).joinGroupWithSecret(id, secret);
      expect(await contract.groupMembers(id, signers.bob.address)).to.eq(true);

      // Public-join should fail on link group
      await expect(contract.connect(signers.carol).joinGroupPublic(id)).to.be.revertedWith("NOT_PUBLIC");
    });

    it("PUBLIC self-join works", async function () {
      const tx = await contract.connect(signers.alice).createGroup("P", JoinMode.PUBLIC, ZERO);
      const id = await expectId(tx, "GroupCreated");

      await contract.connect(signers.bob).joinGroupPublic(id);
      expect(await contract.groupMembers(id, signers.bob.address)).to.eq(true);

      // Wrong join method is rejected
      await expect(
        contract.connect(signers.carol).joinGroupWithSecret(id, ethers.toUtf8Bytes("x")),
      ).to.be.revertedWith("NOT_INVITE_LINK");
    });
  });

  // -----------------------------------------------------------------------
  // 1v1 Battles
  // -----------------------------------------------------------------------

  describe("1v1 Battles", function () {
    async function createBattle() {
      const tx = await contract.connect(signers.alice).createOneVOneBattle(signers.bob.address);
      const id = await expectId(tx, "BattleCreated");
      return id;
    }

    it("creates as PENDING and accepts to ACTIVE", async function () {
      const id = await createBattle();
      let b = await contract.battles(id);
      expect(b.status).to.eq(BattleStatus.PENDING);
      expect(b.scope).to.eq(BattleScope.ONE_V_ONE);

      await contract.connect(signers.bob).acceptBattle(id);
      b = await contract.battles(id);
      expect(b.status).to.eq(BattleStatus.ACTIVE);
    });

    it("only invited opponent can accept", async function () {
      const id = await createBattle();
      await expect(contract.connect(signers.mallory).acceptBattle(id)).to.be.revertedWith("NOT_INVITED");
    });

    it("creator can cancel while PENDING but not after ACTIVE", async function () {
      const id = await createBattle();
      await contract.connect(signers.alice).cancelBattle(id);
      const b = await contract.battles(id);
      expect(b.status).to.eq(BattleStatus.CANCELLED);

      const id2 = await createBattle();
      await contract.connect(signers.bob).acceptBattle(id2);
      await expect(contract.connect(signers.alice).cancelBattle(id2)).to.be.revertedWith("NOT_PENDING");
    });

    it("rejects self as opponent and zero address", async function () {
      await expect(contract.connect(signers.alice).createOneVOneBattle(signers.alice.address)).to.be.revertedWith(
        "BAD_OPPONENT",
      );
      await expect(contract.connect(signers.alice).createOneVOneBattle(ethers.ZeroAddress)).to.be.revertedWith(
        "BAD_OPPONENT",
      );
    });
  });

  // -----------------------------------------------------------------------
  // Group Battles
  // -----------------------------------------------------------------------

  describe("Group Battles", function () {
    it("any member can create a group-battle; non-members cannot", async function () {
      const tx = await contract.connect(signers.alice).createGroup("G", JoinMode.PUBLIC, ZERO);
      const groupId = await expectId(tx, "GroupCreated");
      await contract.connect(signers.bob).joinGroupPublic(groupId);

      const bTx = await contract.connect(signers.bob).createGroupBattle(groupId);
      const battleId = await expectId(bTx, "BattleCreated");

      const b = await contract.battles(battleId);
      expect(b.scope).to.eq(BattleScope.GROUP);
      expect(b.status).to.eq(BattleStatus.ACTIVE);
      expect(b.groupId).to.eq(groupId);

      await expect(contract.connect(signers.mallory).createGroupBattle(groupId)).to.be.revertedWith("NOT_MEMBER");
    });
  });

  // -----------------------------------------------------------------------
  // Market creation gating
  // -----------------------------------------------------------------------

  describe("Market creation (ETH)", function () {
    async function setupActive1v1() {
      const tx = await contract.connect(signers.alice).createOneVOneBattle(signers.bob.address);
      const id = await expectId(tx, "BattleCreated");
      await contract.connect(signers.bob).acceptBattle(id);
      return id;
    }

    it("non-participant cannot create a market", async function () {
      const battleId = await setupActive1v1();
      const future = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      await expect(
        contract
          .connect(signers.mallory)
          .createMarketETH(battleId, MarketKind.MANUAL, 0, "?", future, ethers.parseEther("0.01"), ethers.parseEther("0.01"), {
            value: ethers.parseEther("0.02"),
          }),
      ).to.be.revertedWith("NOT_ALLOWED");
    });

    it("participant can create a manual ETH market", async function () {
      const battleId = await setupActive1v1();
      const future = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      const tx = await contract
        .connect(signers.alice)
        .createMarketETH(battleId, MarketKind.MANUAL, 0, "Will Bob lose?", future, ethers.parseEther("0.01"), ethers.parseEther("0.01"), {
          value: ethers.parseEther("0.02"),
        });
      const marketId = await expectId(tx, "MarketCreated");

      const m = await contract.markets(marketId);
      expect(m.battleId).to.eq(battleId);
      expect(m.kind).to.eq(MarketKind.MANUAL);
      expect(m.assetType).to.eq(0); // ETH
      expect(m.question).to.eq("Will Bob lose?");
    });

    it("rejects mismatched msg.value and seeds", async function () {
      const battleId = await setupActive1v1();
      const future = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      await expect(
        contract
          .connect(signers.alice)
          .createMarketETH(battleId, MarketKind.MANUAL, 0, "?", future, ethers.parseEther("0.01"), ethers.parseEther("0.01"), {
            value: ethers.parseEther("0.01"),
          }),
      ).to.be.revertedWith("INVALID_ETH");
    });
  });

  // -----------------------------------------------------------------------
  // Bet placement
  // -----------------------------------------------------------------------

  describe("Bet placement (ETH)", function () {
    async function setupMarket() {
      const battleTx = await contract.connect(signers.alice).createOneVOneBattle(signers.bob.address);
      const battleId = await expectId(battleTx, "BattleCreated");
      await contract.connect(signers.bob).acceptBattle(battleId);

      const future = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const mkTx = await contract
        .connect(signers.alice)
        .createMarketETH(battleId, MarketKind.MANUAL, 0, "?", future, ethers.parseEther("0.01"), ethers.parseEther("0.01"), {
          value: ethers.parseEther("0.02"),
        });
      const marketId = await expectId(mkTx, "MarketCreated");
      return { battleId, marketId, future };
    }

    async function encryptBool(value: boolean, user: HardhatEthersSigner) {
      return fhevm.createEncryptedInput(address, user.address).addBool(value).encrypt();
    }

    it("non-participant cannot bet", async function () {
      const { marketId } = await setupMarket();
      const enc = await encryptBool(true, signers.mallory);
      await expect(
        contract.connect(signers.mallory).placeBetETH(marketId, enc.handles[0], enc.inputProof, {
          value: ethers.parseEther("0.005"),
        }),
      ).to.be.revertedWith("NOT_PARTICIPANT");
    });

    it("both participants can bet exactly once", async function () {
      const { marketId } = await setupMarket();

      const aliceEnc = await encryptBool(true, signers.alice);
      await contract.connect(signers.alice).placeBetETH(marketId, aliceEnc.handles[0], aliceEnc.inputProof, {
        value: ethers.parseEther("0.005"),
      });

      const bobEnc = await encryptBool(false, signers.bob);
      await contract.connect(signers.bob).placeBetETH(marketId, bobEnc.handles[0], bobEnc.inputProof, {
        value: ethers.parseEther("0.005"),
      });

      const aliceBet = await contract.bets(marketId, signers.alice.address);
      expect(aliceBet.hasBet).to.eq(true);
      expect(aliceBet.ethAmount).to.eq(ethers.parseEther("0.005"));

      const aliceEnc2 = await encryptBool(true, signers.alice);
      await expect(
        contract.connect(signers.alice).placeBetETH(marketId, aliceEnc2.handles[0], aliceEnc2.inputProof, {
          value: ethers.parseEther("0.001"),
        }),
      ).to.be.revertedWith("ALREADY_BET");
    });
  });

  // -----------------------------------------------------------------------
  // Resolve manual market
  // -----------------------------------------------------------------------

  describe("Resolve manual market", function () {
    it("only participant can resolve, only after resolveTime", async function () {
      const battleTx = await contract.connect(signers.alice).createOneVOneBattle(signers.bob.address);
      const battleId = await expectId(battleTx, "BattleCreated");
      await contract.connect(signers.bob).acceptBattle(battleId);

      const future = (await ethers.provider.getBlock("latest"))!.timestamp + 60;
      const mkTx = await contract
        .connect(signers.alice)
        .createMarketETH(battleId, MarketKind.MANUAL, 0, "?", future, ethers.parseEther("0.01"), ethers.parseEther("0.01"), {
          value: ethers.parseEther("0.02"),
        });
      const marketId = await expectId(mkTx, "MarketCreated");

      // Before resolveTime
      await expect(contract.connect(signers.alice).resolveManualMarket(marketId, true)).to.be.revertedWith("EARLY");

      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);

      // Non-participant
      await expect(contract.connect(signers.mallory).resolveManualMarket(marketId, true)).to.be.revertedWith(
        "NOT_ALLOWED",
      );

      // Participant resolves
      await contract.connect(signers.bob).resolveManualMarket(marketId, true);
      const m = await contract.markets(marketId);
      expect(m.resolved).to.eq(true);
      expect(m.outcome).to.eq(true);

      // Cannot resolve again
      await expect(contract.connect(signers.alice).resolveManualMarket(marketId, false)).to.be.revertedWith("DONE");
    });
  });
});
