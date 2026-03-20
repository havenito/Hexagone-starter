# Bureau de Vote On-Chain — Documentation Projet

> TD Jour 3 · 3WEB3 · Bloc 4 · B3  
> Stack : Solidity · Hardhat · Ganache · Alchemy · Sepolia · Ethers.js · React

---

## Présentation du projet

**Bureau de Vote On-Chain** est une application décentralisée (dApp) de vote présidentiel déployée sur le réseau de test Ethereum Sepolia. Les votes sont enregistrés directement sur la blockchain — permanents, publics, et vérifiables par n'importe qui sur Etherscan.

Le projet est composé de deux parties distinctes :

- `mon-contrat/` — le smart contract Solidity compilé et déployé avec Hardhat
- `src/` — le frontend React connecté au contrat via Ethers.js et MetaMask

---

## Structure du projet

```
dapp-vote-starter-master/
├── mon-contrat/                  ← Projet Hardhat (smart contract)
│   ├── contracts/
│   │   └── MonContrat.sol        ← Le smart contract Solidity
│   ├── scripts/
│   │   ├── deploy.js             ← Script de déploiement
│   │   ├── extract-abi.js        ← Extraction de l'ABI depuis les artifacts
│   │   └── smoke-check.js        ← Tests rapides post-déploiement
│   ├── abi.json                  ← ABI extraite (copiée dans src/)
│   ├── hardhat.config.js         ← Configuration Hardhat (Ganache + Sepolia)
│   └── package.json
├── src/                          ← Projet React (frontend)
│   ├── App.jsx                   ← Composant principal de la dApp
│   ├── abi.json                  ← ABI du contrat (même fichier que mon-contrat/abi.json)
│   ├── config.js                 ← Adresse du contrat et chainId
│   ├── index.css
│   └── styles.css
├── img/                          ← Photos des candidats
│   ├── leon_blum.png
│   ├── chiraq.png
│   └── miterrand.png
├── index.html
├── vite.config.js
└── package.json
```

---

## Le smart contract — `MonContrat.sol`

### Vue d'ensemble

Le contrat implémente un système de vote avec trois candidats pré-définis, un cooldown de 3 minutes entre chaque vote, et un historique des votes enregistré on-chain via des events.

### Candidats

Les candidats sont initialisés dans le constructor au moment du déploiement :

| Index | Nom |
|-------|-----|
| 0 | Léon Blum |
| 1 | Jacques Chirac |
| 2 | François Mitterrand |

### Variables d'état

```solidity
address public owner;
uint256 public constant COOLDOWN = 3 minutes;
Candidate[] private candidates;
mapping(address => uint256) public lastVoteTime;
```

| Variable | Type | Description |
|----------|------|-------------|
| `owner` | `address` | Adresse qui a déployé le contrat (`msg.sender` au déploiement) |
| `COOLDOWN` | `uint256` constant | Délai minimum entre deux votes : 180 secondes |
| `candidates` | `Candidate[]` | Tableau privé des candidats (struct name + voteCount) |
| `lastVoteTime` | `mapping(address => uint256)` | Timestamp du dernier vote par adresse |

### Struct

```solidity
struct Candidate {
    string name;
    uint256 voteCount;
}
```

### Event

```solidity
event Voted(address indexed voter, uint256 candidateIndex);
```

Émis à chaque vote valide. `voter` est indexé pour pouvoir filtrer les events par adresse dans le frontend. Le frontend écoute cet event en temps réel pour mettre à jour l'interface sans polling.

### Fonctions

#### Fonctions view (lecture gratuite, pas de gas, pas de MetaMask)

**`getCandidatesCount()`**
```solidity
function getCandidatesCount() external view returns (uint256)
```
Retourne le nombre total de candidats. Utilisé par le frontend pour itérer sur les candidats au chargement.

**`getCandidate(uint256 index)`**
```solidity
function getCandidate(uint256 index) external view returns (string memory name, uint256 voteCount)
```
Retourne le nom et le nombre de votes d'un candidat à un index donné. Déclenche un `require` si l'index est hors limites.

**`getTimeUntilNextVote(address voter)`**
```solidity
function getTimeUntilNextVote(address voter) external view returns (uint256)
```
Retourne le nombre de secondes restantes avant que `voter` puisse voter à nouveau. Retourne `0` si le cooldown est passé ou si c'est le premier vote.

#### Fonction d'écriture (coûte du gas, MetaMask requis)

**`vote(uint256 candidateIndex)`**
```solidity
function vote(uint256 candidateIndex) external
```
Enregistre un vote pour le candidat à l'index donné.

Règles métier vérifiées on-chain via `require` :
- L'index doit être valide (`candidateIndex < candidates.length`)
- Le cooldown de 3 minutes doit être respecté (`block.timestamp >= lastVoteTime[msg.sender] + COOLDOWN`)

En cas de succès : incrémente `voteCount` du candidat, met à jour `lastVoteTime[msg.sender]`, et émet l'event `Voted`.

### Code complet du contrat

```solidity
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
```

---

## Configuration Hardhat — `hardhat.config.js`

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const privateKey = process.env.PRIVATE_KEY || "";
const hasValidPrivateKey = /^0x[0-9a-fA-F]{64}$/.test(privateKey);

module.exports = {
  solidity: "0.8.20",
  networks: {
    ganache: {
      url: "http://127.0.0.1:7545",
      chainId: 1337,
    },
    sepolia: {
      url: process.env.ALCHEMY_URL || "",
      chainId: 11155111,
      accounts: hasValidPrivateKey ? [privateKey] : [],
    },
  },
};
```

Les variables sensibles (`ALCHEMY_URL`, `PRIVATE_KEY`) sont chargées depuis un fichier `.env` non versionné.

---

## Scripts Hardhat

### `scripts/deploy.js` — déploiement

Déploie le contrat sur le réseau spécifié via `--network`. Affiche l'adresse déployée et, sur Sepolia, le lien Etherscan correspondant.

```bash
# Déployer en local
npx hardhat run scripts/deploy.js --network ganache

# Déployer sur Sepolia
npx hardhat run scripts/deploy.js --network sepolia
```

### `scripts/extract-abi.js` — extraction de l'ABI

Lit `artifacts/contracts/MonContrat.sol/MonContrat.json` généré par la compilation et en extrait uniquement le tableau `abi` dans `mon-contrat/abi.json`.

```bash
npm run abi:extract
```

### `scripts/smoke-check.js` — vérification post-déploiement

Script de test rapide à lancer juste après un déploiement sur Ganache. Vérifie que les fonctions de lecture répondent correctement, qu'un vote s'enregistre bien, et qu'un index invalide déclenche bien un `require`.

```bash
node scripts/smoke-check.js <adresse_du_contrat>
```

---

## Frontend React — `src/App.jsx`

### Connexion à MetaMask

La connexion est initiée par `connectWallet()`. La fonction vérifie que MetaMask est installé, que l'adresse dans `config.js` est valide, et que MetaMask est sur le bon réseau (`EXPECTED_CHAIN_ID`). En cas d'erreur, un message explicite est affiché.

### Chargement des données

`loadCandidates()` instancie le contrat en lecture seule (provider uniquement), puis appelle `getCandidatesCount()` et `getCandidate(i)` pour chaque candidat. Ces appels sont gratuits — aucune transaction, aucune popup MetaMask.

### Vote

`vote(candidateIndex)` vérifie d'abord le cooldown restant via `getTimeUntilNextVote()`, puis envoie la transaction. Le statut de la transaction est affiché en temps réel (`signing` → `pending` → `confirmed`). Les données sont rechargées après `tx.wait()`.

### Écoute des events en temps réel

Le composant souscrit à l'event `Voted` via `contrat.on("Voted", handler)` dans un `useEffect`. À chaque vote reçu (y compris ceux d'autres utilisateurs), les candidats sont rechargés et un bandeau "live event" est affiché. La désabonnement (`contrat.off`) est géré dans le cleanup du `useEffect` pour éviter les fuites mémoire.

### Cooldown timer

Un `setInterval` décrémente `cooldownSeconds` chaque seconde dès qu'un cooldown est actif. Le timer est nettoyé quand il atteint 0 ou quand le composant est démonté.

### Blockchain Explorer intégré

Un explorateur embarqué affiche les 20 derniers votes en interrogeant directement les events on-chain via `queryFilter`. Pour chaque event, le bloc et la transaction sont enrichis avec le timestamp et le gas consommé.

---

## Configuration frontend — `src/config.js`

```javascript
export const CONTRACT_ADDRESS = "0xA95c4e2653262815f4dA8B83747AB8D990Bf868f";
export const EXPECTED_CHAIN_ID = 11155111;
export const EXPECTED_NETWORK_NAME = "Sepolia";
```

Le contrat est déployé sur **Ethereum Sepolia** à l'adresse `0xA95c4e2653262815f4dA8B83747AB8D990Bf868f`.

Lien Etherscan : [https://sepolia.etherscan.io/address/0xA95c4e2653262815f4dA8B83747AB8D990Bf868f](https://sepolia.etherscan.io/address/0xA95c4e2653262815f4dA8B83747AB8D990Bf868f)

### Modes d'execution frontend

Le frontend peut fonctionner dans deux modes selon `src/config.js`:

- **Mode Sepolia (rendu final/public)**
    - `EXPECTED_CHAIN_ID = 11155111`
    - `EXPECTED_NETWORK_NAME = "Sepolia"`
    - `CONTRACT_ADDRESS = adresse Sepolia`

- **Mode Ganache (tests locaux)**
    - `EXPECTED_CHAIN_ID = 1337`
    - `EXPECTED_NETWORK_NAME = "Ganache"`
    - `CONTRACT_ADDRESS = adresse locale retournee par \'npm run deploy:ganache\'`

Note: l'ABI ne change pas entre les deux modes; seule l'adresse et le chainId changent.

---

## Prérequis techniques

- Node.js v18+
- MetaMask installé dans le navigateur
- Ganache Desktop (pour le dev local)
- Un compte Alchemy avec une app configurée sur Sepolia (pour le déploiement public)

---

## Installation et lancement

### Smart contract (dossier `mon-contrat/`)

```bash
cd mon-contrat
npm install
```

Créer un fichier `.env` à la racine de `mon-contrat/` :

```
ALCHEMY_URL=https://eth-sepolia.g.alchemy.com/v2/VOTRE_API_KEY
PRIVATE_KEY=0xVOTRE_CLE_PRIVEE
```

> ⚠ Ne jamais committer le fichier `.env`. Il est déjà listé dans `.gitignore`.

```bash
# Compiler
npx hardhat compile

# Tester la logique en console (Ganache doit tourner)
npx hardhat console --network ganache

# Déployer sur Ganache
npm run deploy:ganache

# Extraire l'ABI
npm run abi:extract

# Déployer sur Sepolia
npm run deploy:sepolia
```

### Frontend (racine du projet)

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:5173](http://localhost:5173). MetaMask doit être configuré sur Sepolia (chainId 11155111).

Pour tester en local sur Ganache, basculer `src/config.js` en mode Ganache puis sélectionner le réseau Ganache dans MetaMask.

---

## Validation rapide (prof/correcteur)

1. **Compilation contrat**: `npx hardhat compile`
2. **Déploiement local**: `npm run deploy:ganache`
3. **Déploiement public**: `npm run deploy:sepolia`
4. **Preuve on-chain**: ouvrir l'adresse Sepolia sur Etherscan
5. **Test fonctionnel dApp**: connexion MetaMask, vote, confirmation transaction

---

## Checklist des 4 éléments requis

| Élément requis | Implémentation |
|----------------|----------------|
| ≥ 2 fonctions `view` | `getCandidatesCount()`, `getCandidate()`, `getTimeUntilNextVote()` |
| ≥ 1 fonction d'écriture | `vote()` |
| ≥ 1 event | `Voted(address indexed voter, uint256 candidateIndex)` |
| ≥ 1 `require()` | Index invalide + cooldown non respecté |

---

## Flux de données complet

```
Utilisateur clique "Voter"
        ↓
App.jsx — vote(candidateIndex)
        ↓
getTimeUntilNextVote() — vérification cooldown côté frontend
        ↓
contratEcriture.vote(index) — transaction envoyée à MetaMask
        ↓
MetaMask ouvre la popup de signature
        ↓
Transaction envoyée au réseau Sepolia via le provider
        ↓
MonContrat.vote() s'exécute sur l'EVM
  ├── require(index valide)
  ├── require(cooldown respecté)
  ├── candidates[index].voteCount += 1
  ├── lastVoteTime[msg.sender] = block.timestamp
  └── emit Voted(msg.sender, index)
        ↓
tx.wait() — attente de confirmation (~12s)
        ↓
loadCandidates() — rechargement des données
        ↓
Interface mise à jour
```

---

## Résultats obtenus

Le projet a été validé sur les deux environnements de la stack:

- **Ganache (local)**
    - Déploiement du contrat réussi
    - Appels `view` validés
    - Vote on-chain validé
    - Cooldown correctement appliqué

- **Sepolia (public)**
    - Déploiement public réussi
    - Contrat accessible sur Etherscan
    - Votes confirmés et événements visibles on-chain

Adresse du contrat déployé sur Sepolia:
- `0xA95c4e2653262815f4dA8B83747AB8D990Bf868f`

Lien de vérification:
- [https://sepolia.etherscan.io/address/0xA95c4e2653262815f4dA8B83747AB8D990Bf868f](https://sepolia.etherscan.io/address/0xA95c4e2653262815f4dA8B83747AB8D990Bf868f)

Exemple de transaction de vote confirmée:
- `0x1d4f9300b6ba586d3a10be3bff30023d43d910fe1e9746f96d3ae54c85473c72`

---

## Limites actuelles

- Les tests automatisés Hardhat ne sont pas encore formalisés dans des fichiers `test/` complets.
- Le contrat Sepolia n'est pas encore publié/vérifié en code source sur Etherscan (lecture des logs et transactions disponible, mais source non vérifiée).
- Le frontend est configuré via un fichier statique `src/config.js` (pas de gestion multi-environnement automatisée).

---

## Améliorations possibles

1. Ajouter une suite de tests unitaires et d'intégration (Hardhat + Chai).
2. Vérifier et publier le code source du contrat sur Etherscan.
3. Ajouter un script de bascule `Ganache/Sepolia` pour éviter les modifications manuelles de configuration.
4. Déployer le frontend sur Vercel avec une documentation utilisateur courte.
5. Ajouter une CI simple (lint/build/tests) pour fiabiliser le rendu.

---

## Livrables de remise

Livrable minimum:
- Smart contract Solidity déployé sur Sepolia avec les 4 éléments requis
- Lien Etherscan du contrat

Livrable complet:
- Frontend connecté au contrat déployé
- Preuve de transactions de vote confirmées

Éléments recommandés dans la remise:
- ZIP du projet smart contract + frontend (sans `.env`, `node_modules`, `dist`, `artifacts` inutiles)
- 2 à 3 captures (interface, transaction confirmée, événements)