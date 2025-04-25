import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi'
import { bsc } from 'wagmi/chains'
import { ethers } from 'ethers'

// WalletConnect Project ID
const projectId = 'ff2db6544a529027450c74a34fc4fb74'

// Wagmi config
const metadata = {
  name: 'My Dapp',
  description: 'My Dapp Description',
  url: 'https://ebray783.github.io/wagmitest',
  icons: ['https://walletconnect.com/walletconnect-logo.png']
}
const chains = [bsc]
const wagmiConfig = defaultWagmiConfig({ chains, projectId, metadata })

// Create Web3Modal
createWeb3Modal({ wagmiConfig, projectId, chains })

// Add the Web3Modal button to the page
const connectBtn = document.createElement('w3m-button')
document.body.appendChild(connectBtn)

// ===== CONTRACT CONFIGURATION ===== //
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

// ===== MINT BUTTON LOGIC ===== //
const mintBtn = document.getElementById('mint-btn');
const statusEl = document.getElementById('nft-status');
const walletAddressEl = document.getElementById('wallet-address');

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

// Mint NFT function
async function mintNFT() {
  try {
    mintBtn.disabled = true;
    updateStatus("⏳ Minting...");
    // Get the provider and signer from wagmi
    const { getWalletClient, getAccount } = await import('@wagmi/core')
    const account = getAccount()
    if (!account?.address) {
      updateStatus("Connect your wallet first!");
      return;
    }
    const walletClient = await getWalletClient()
    const ethersProvider = new ethers.BrowserProvider(walletClient)
    const signer = await ethersProvider.getSigner()
    const mintContract = new ethers.Contract(config.mintContract.address, config.mintContract.abi, signer)
    const tx = await mintContract.mintNFT({
      value: ethers.parseEther(config.mintContract.mintPrice)
    })
    const receipt = await tx.wait()
    updateStatus(`✅ Minted! TX: ${createExplorerLink(receipt.hash)}`, "success")
    // Extract tokenId from Transfer event
    const event = receipt.logs.map(log => {
      try {
        return mintContract.interface.parseLog(log)
      } catch {
        return null
      }
    }).find(e => e?.name === "Transfer")
    const tokenId = event?.args?.tokenId || event?.args?.[2]
    if (!tokenId) throw new Error("Mint event not found")
    // Auto-wrap
    const wrapContract = new ethers.Contract(config.wrapContract.address, config.wrapContract.abi, signer)
    updateStatus("⏳ Wrapping NFT...")
    await wrapContract.wrap(tokenId, config.wrapContract.defaultTokenURI)
    updateStatus("✅ Wrapped NFT!", "success")
  } catch (err) {
    handleError(err)
  } finally {
    mintBtn.disabled = false
  }
}

// Add mint button event
mintBtn?.addEventListener('click', mintNFT)

// On page load, show wallet address if connected
(async () => {
  const { getAccount } = await import('@wagmi/core')
  const account = getAccount()
  if (account?.address && walletAddressEl) {
    walletAddressEl.textContent = `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
  }
})()
