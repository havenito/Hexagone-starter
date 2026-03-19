import { useState, useEffect } from 'react'
import { BrowserProvider, Contract } from 'ethers'
import ABI from './abi.json'
import { CONTRACT_ADDRESS, EXPECTED_CHAIN_ID, EXPECTED_NETWORK_NAME } from './config'
import './index.css'
import imgLeonBlum   from '../img/leon_blum.png'
import imgChirac     from '../img/chiraq.png'
import imgMitterrand from '../img/miterrand.png'

const CANDIDATE_NAMES = ['Léon Blum', 'Jacques Chirac', 'François Mitterrand']
const CANDIDATE_IMGS  = [imgLeonBlum, imgChirac, imgMitterrand]
const EXPLORER_BASE = EXPECTED_CHAIN_ID === 11155111 ? 'https://sepolia.etherscan.io' : null
const isHexAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(value)

function App() {
  const [account, setAccount]                 = useState(null)
  const [provider, setProvider]               = useState(null)
  const [candidates, setCandidates]           = useState([])
  const [isVoting, setIsVoting]               = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [error, setError]                     = useState(null)
  const [lastEvent, setLastEvent]             = useState(null)
  const [txHash, setTxHash]                   = useState(null)
  const [txStatus, setTxStatus]               = useState(null)
  const [lastBlockNumber, setLastBlockNumber] = useState(null)
  const [explorerOpen, setExplorerOpen]       = useState(false)
  const [explorerEvents, setExplorerEvents]   = useState([])
  const [explorerLoading, setExplorerLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) return
      try {
        const p = new BrowserProvider(window.ethereum)
        setProvider(p)
        await loadCandidates(p)
      } catch {}
    }
    init()
  }, [])

  const loadCandidates = async (_provider) => {
    const c = new Contract(CONTRACT_ADDRESS, ABI, _provider)
    const count = await c.getCandidatesCount()
    const list = []
    for (let i = 0; i < Number(count); i++) {
      const [name, voteCount] = await c.getCandidate(i)
      list.push({ id: i, name, votes: Number(voteCount) })
    }
    setCandidates(list)
  }

  const connectWallet = async () => {
    try {
      if (!window.ethereum) { setError("MetaMask n\'est pas installé."); return }
      if (!isHexAddress(CONTRACT_ADDRESS)) {
        setError("Adresse de contrat invalide dans config.js (remplacez le placeholder).")
        return
      }
      const _provider = new BrowserProvider(window.ethereum)
      await _provider.send("eth_requestAccounts", [])
      const network = await _provider.getNetwork()
      if (network.chainId !== BigInt(EXPECTED_CHAIN_ID)) {
        setError(`Mauvais réseau — connectez MetaMask sur ${EXPECTED_NETWORK_NAME}.`)
        return
      }
      const signer  = await _provider.getSigner()
      const address = await signer.getAddress()
      setAccount(address)
      setProvider(_provider)
      setError(null)
      await loadCandidates(_provider)
    } catch (err) {
      if (err?.code === 4001) {
        setError("Connexion MetaMask refusée.")
      } else if (String(err?.message || '').toLowerCase().includes('invalid address')) {
        setError("Adresse de contrat invalide dans config.js.")
      } else {
        setError("Erreur de connexion : " + (err?.message || "inconnue"))
      }
    }
  }

  const vote = async (candidateIndex) => {
    try {
      setIsVoting(true)
      setError(null)
      setTxStatus("signing")
      const signer       = await provider.getSigner()
      const voteContract = new Contract(CONTRACT_ADDRESS, ABI, signer)
      const secondsLeft  = Number(await voteContract.getTimeUntilNextVote(account))
      if (secondsLeft > 0) {
        setCooldownSeconds(secondsLeft)
        setIsVoting(false)
        setTxStatus(null)
        return
      }
      const tx = await voteContract.vote(candidateIndex)
      setTxHash(tx.hash)
      setTxStatus("pending")
      const receipt = await tx.wait()
      setLastBlockNumber(receipt.blockNumber)
      setTxStatus("confirmed")
      await loadCandidates(provider)
      if (explorerOpen) loadExplorerEvents()
      setCooldownSeconds(3 * 60)
    } catch (err) {
      setTxStatus(null)
      setError(err.code === 4001 ? "Transaction annulée." : "Erreur : " + err.message)
    } finally {
      setIsVoting(false)
    }
  }

  useEffect(() => {
    if (!provider) return
    let listenContract
    try {
      listenContract = new Contract(CONTRACT_ADDRESS, ABI, provider)
      const handler = (voter, candidateIndex) => {
        const idx = Number(candidateIndex)
        setLastEvent({
          voter: voter.slice(0, 6) + "..." + voter.slice(-4),
          candidateName: CANDIDATE_NAMES[idx] ?? `Candidat #${idx}`,
        })
        loadCandidates(provider)
      }
      listenContract.on("Voted", handler)
      return () => { listenContract.off("Voted", handler) }
    } catch (err) {
      console.warn("Impossible d\'écouter les events :", err.message)
    }
  }, [provider])

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownSeconds])

  useEffect(() => {
    if (explorerOpen && provider) loadExplorerEvents()
  }, [explorerOpen])

  const loadExplorerEvents = async () => {
    if (!provider) return
    setExplorerLoading(true)
    try {
      const ec  = new Contract(CONTRACT_ADDRESS, ABI, provider)
      const raw = await ec.queryFilter(ec.filters.Voted(), -1000)
      const last20 = raw.slice(-20).reverse()
      const enriched = await Promise.all(last20.map(async (e) => {
        const idx = Number(e.args.candidateIndex)
        let timestamp = null, gasUsed = null
        try {
          const block = await provider.getBlock(e.blockNumber)
          timestamp = block?.timestamp ?? null
        } catch {}
        try {
          const receipt = await provider.getTransactionReceipt(e.transactionHash)
          gasUsed = receipt?.gasUsed != null ? Number(receipt.gasUsed) : null
        } catch {}
        return {
          hash: e.transactionHash,
          blockNumber: e.blockNumber,
          voter: e.args.voter,
          candidateName: CANDIDATE_NAMES[idx] ?? `Candidat #${idx}`,
          timestamp,
          gasUsed,
        }
      }))
      setExplorerEvents(enriched)
    } catch {
      setExplorerEvents([])
    } finally {
      setExplorerLoading(false)
    }
  }

  const totalVotes = candidates.reduce((s, c) => s + c.votes, 0)

  return (
    <div className="page">

      <header className="header">
        <div className="tricolore"><span /><span /><span /></div>
        <div className="header-text">
          <p className="header-sub">République Française · Élection Présidentielle</p>
          <h1 className="header-title">Bureau de Vote <span>On-Chain</span></h1>
          <p className="header-chain">⛓ Contrat permanent sur Ethereum Sepolia</p>
        </div>
        <div className="tricolore"><span /><span /><span /></div>
      </header>

      <main className="main">

        <section className="card">
          <h2 className="section-title">🦊 Connexion</h2>
          {!account ? (
            <button className="btn-connect" onClick={connectWallet}>Connecter MetaMask</button>
          ) : (
            <div className="wallet-info">
              <span className="wallet-dot" />
              <span className="wallet-addr">{account}</span>
              <span className="wallet-net">{EXPECTED_NETWORK_NAME}</span>
            </div>
          )}
          {error && <p className="msg-error">⚠ {error}</p>}
        </section>

        <section className="card card-contract">
          <span className="label">Contrat déployé</span>
          <code className="contract-addr">{CONTRACT_ADDRESS}</code>
          <div className="contract-links">
            {EXPLORER_BASE ? (
              <>
                <a href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer">Etherscan →</a>
                <a href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}#events`} target="_blank" rel="noopener noreferrer">Events →</a>
                <a href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}#transactions`} target="_blank" rel="noopener noreferrer">Transactions →</a>
              </>
            ) : (
              <span className="msg-muted">Explorateur public indisponible en local</span>
            )}
          </div>
        </section>

        {candidates.length > 0 && (
          <section className="card">
            <h2 className="section-title">
              Candidats · <span className="votes-count">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
            </h2>

            <div className="candidates">
              {candidates.map(c => {
                const pct = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0
                const leading = totalVotes > 0 && c.votes === Math.max(...candidates.map(x => x.votes)) && c.votes > 0
                return (
                  <div key={c.id} className={`candidate${leading ? " candidate--leading" : ""}`}>
                    {leading && <div className="leader-badge">🥇 En tête</div>}
                    <img src={CANDIDATE_IMGS[c.id]} alt={c.name} className="candidate-img" />
                    <div className="candidate-name">{c.name}</div>
                    <div className="candidate-votes">{c.votes} <span>vote{c.votes !== 1 ? "s" : ""}</span></div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="candidate-pct">{pct}%</div>
                    {!account ? (
                      <button className="btn-vote btn-locked" onClick={connectWallet}>🔒 Connectez-vous</button>
                    ) : cooldownSeconds === 0 ? (
                      <button className="btn-vote" onClick={() => vote(c.id)} disabled={isVoting}>
                        {isVoting ? "⏳ En cours..." : "Voter"}
                      </button>
                    ) : (
                      <div className="btn-vote btn-cooldown">⏳ Cooldown</div>
                    )}
                  </div>
                )
              })}
            </div>

            {txStatus === "signing" && (
              <div className="tx-status tx-signing">
                <span className="spinner" /> Signature dans MetaMask...
              </div>
            )}
            {txStatus === "pending" && txHash && (
              <div className="tx-status tx-pending">
                <span className="spinner" /> En attente de confirmation (~12s)
                <br /><code className="tx-hash">{txHash}</code>
              </div>
            )}
            {txStatus === "confirmed" && lastBlockNumber && (
              <div className="tx-status tx-ok">
                ✅ Vote enregistré dans le bloc <strong>#{lastBlockNumber}</strong>
                {txHash && EXPLORER_BASE && <> · <a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noopener noreferrer">Voir sur Etherscan →</a></>}
              </div>
            )}

            {cooldownSeconds > 0 && (
              <div className="cooldown">
                <p className="cooldown-label">⏳ Prochain vote dans</p>
                <div className="cooldown-timer">
                  {String(Math.floor(cooldownSeconds / 60)).padStart(2, "0")}:{String(cooldownSeconds % 60).padStart(2, "0")}
                </div>
                <p className="cooldown-sub">Le contrat utilise <code>block.timestamp</code> — règle on-chain.</p>
              </div>
            )}

            {lastEvent && (
              <div className="live-event">
                ⚡ <strong>{lastEvent.voter}</strong> vient de voter pour <strong>{lastEvent.candidateName}</strong>
              </div>
            )}
          </section>
        )}

        <section className="card">
          <div className="explorer-header">
            <h2 className="section-title" style={{margin:0}}>⛓ Blockchain Explorer</h2>
            <button className="btn-toggle" onClick={() => setExplorerOpen(o => !o)}>
              {explorerOpen ? "Masquer" : "Afficher"}
            </button>
          </div>
          {explorerOpen && (
            <div className="explorer-body">
              {explorerLoading ? (
                <p className="explorer-empty">Chargement des données on-chain...</p>
              ) : explorerEvents.length === 0 ? (
                <p className="explorer-empty">Aucun vote dans les 1000 derniers blocs.</p>
              ) : (
                <div className="table-wrap">
                  <table className="ex-table">
                    <thead>
                      <tr>
                        <th>Tx Hash</th><th>Bloc</th><th>Votant</th><th>Candidat</th><th>Heure</th><th>Gas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {explorerEvents.map((e, i) => (
                        <tr key={i}>
                          <td>{EXPLORER_BASE ? <a href={`${EXPLORER_BASE}/tx/${e.hash}`} target="_blank" rel="noopener noreferrer">{e.hash.slice(0,10)}...{e.hash.slice(-6)}</a> : <span>{e.hash.slice(0,10)}...{e.hash.slice(-6)}</span>}</td>
                          <td>{e.blockNumber}</td>
                          <td>{e.voter.slice(0,10)}...{e.voter.slice(-6)}</td>
                          <td>{e.candidateName}</td>
                          <td>{e.timestamp ? new Date(e.timestamp * 1000).toLocaleString("fr-FR") : "—"}</td>
                          <td>{e.gasUsed ? e.gasUsed.toLocaleString() + " u." : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

      </main>

      <footer className="footer">
        Contrat permanent · {CONTRACT_ADDRESS} · Ethereum Sepolia · Les votes sont immuables
      </footer>

    </div>
  )
}

export default App
