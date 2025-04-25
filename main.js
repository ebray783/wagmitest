// ===== CONFIGURATION ===== //
const config = {
  mintContract: {
    address: "0x1BEe8d11f11260A4E39627EDfCEB345aAfeb57d9",
    mintPrice: "0.01",
    abi: [
      {
        "inputs": [],
        "name": "mintNFT",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          { "internalType": "address", "name": "owner", "type": "address" },
          { "internalType": "address", "name": "spender", "type": "address" }
        ],
        "name": "approve",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "anonymous": false,
        "inputs": [
          { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
          { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
          { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }
        ],
        "name": "Transfer",
        "type": "event"
      }
    ]
  },
  wrapContract: {
    address: "0xa069fd4ed3be5262166a5392ee31467951822206",
    defaultTokenURI: "ipfs://bafybeig6wisourp6cvqqczwyfa6nyz7jwbsbbgbilz3d3m2maenxnzvxui",
    abi: [
      {
        "inputs": [
          { "internalType": "uint256", "name": "internalTokenId", "type": "uint256" },
          { "internalType": "string", "name": "newTokenURI", "type": "string" }
        ],
        "name": "wrap",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ]
  },
  chainId: 56,
  explorerUrl: "https://bscscan.com"
};

let provider, signer, address, walletProvider;
let walletAddressEl, connectBtn, disconnectBtn, mintBtn, statusEl;

async function connectWallet() {
  if (window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    address = await signer.getAddress();
  } else if (window.WalletConnectProvider || window.WalletConnectProvider?.default) {
    walletProvider = new (window.WalletConnectProvider?.default || window.WalletConnectProvider)({
      rpc: { 56: "https://bsc-dataseed.binance.org/" },
      chainId: 56
    });
    await walletProvider.enable();
    provider = new ethers.BrowserProvider(walletProvider);
    signer = await provider.getSigner();
    address = await signer.getAddress();
  } else {
    alert("No wallet found. Please install MetaMask or use WalletConnect.");
    return;
  }
  if (walletAddressEl) walletAddressEl.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
  enableMintButton();
  connectBtn.style.display = 'none';
  disconnectBtn.style.display = 'inline-block';
}

function enableMintButton() {
  if (mintBtn) mintBtn.disabled = false;
  updateStatus("🟢 Wallet connected");
  if (statusEl) statusEl.className = "connected";
}

function disableMintButton() {
  if (mintBtn) mintBtn.disabled = true;
  if (walletAddressEl) walletAddressEl.textContent = "";
  updateStatus("🔴 Wallet Not Connected");
  if (statusEl) statusEl.className = "disconnected";
}

function updateStatus(msg, status = "info") {
  if (statusEl) statusEl.textContent = msg;
}

function createExplorerLink(txHash) {
  return `${config.explorerUrl}/tx/${txHash}`;
}

function handleError(err) {
  console.error(err);
  updateStatus("❌ " + (err.message || "Something went wrong"), "error");
}

document.addEventListener('DOMContentLoaded', async () => {
  walletAddressEl = document.getElementById('wallet-address');
  connectBtn = document.getElementById('connect-btn');
  disconnectBtn = document.getElementById('disconnect-btn');
  mintBtn = document.getElementById('mint-btn');
  statusEl = document.getElementById('nft-status');

  connectBtn?.addEventListener('click', connectWallet);
  disconnectBtn?.addEventListener('click', () => {
    signer = null;
    address = null;
    disableMintButton();
    connectBtn.style.display = 'inline-block';
    disconnectBtn.style.display = 'none';
  });

  mintBtn?.addEventListener('click', async () => {
    if (!signer) {
      updateStatus("Connect your wallet first!");
      return;
    }
    try {
      mintBtn.disabled = true;
      updateStatus("⏳ Minting...");
      const mintContract = new ethers.Contract(config.mintContract.address, config.mintContract.abi, signer);
      const tx = await mintContract.mintNFT({ value: ethers.parseEther(config.mintContract.mintPrice) });
      const receipt = await tx.wait();
      updateStatus(`✅ Minted! TX: ${createExplorerLink(receipt.hash)}`, "success");
      // Extract tokenId from Transfer event
      const event = receipt.logs.map(log => {
        try { return mintContract.interface.parseLog(log); } catch { return null; }
      }).find(e => e?.name === "Transfer");
      const tokenId = event?.args?.tokenId || event?.args?.[2];
      if (!tokenId) throw new Error("Mint event not found");
      // Auto-wrap
      const wrapContract = new ethers.Contract(config.wrapContract.address, config.wrapContract.abi, signer);
      updateStatus("⏳ Wrapping NFT...");
      const tokenURI = config.wrapContract.defaultTokenURI + "/" + tokenId + ".json";
      await wrapContract.wrap(tokenId, tokenURI);
      updateStatus("✅ Wrapped NFT!", "success");
    } catch (err) {
      handleError(err);
    } finally {
      mintBtn.disabled = false;
    }
  });

  // On page load, disable mint button
  disableMintButton();
});
