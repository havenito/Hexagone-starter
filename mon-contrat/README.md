# Mon Contrat - TP Web3 (Hardhat)

Projet smart contract du TP Bloc 4.

Stack: Solidity, Hardhat, Ganache, Alchemy, Sepolia, Ethers.js

## 1. Prerequis

- Node.js installe
- MetaMask installe
- Ganache Desktop ou Ganache CLI
- Un compte Alchemy (pour Sepolia)

## 2. Installation

Dans ce dossier:

```bash
npm install
```

## 3. Variables d'environnement

Creer un fichier `.env` a la racine de `mon-contrat`:

```env
PRIVATE_KEY=0xVOTRE_CLE_PRIVEE
ALCHEMY_URL=https://eth-sepolia.g.alchemy.com/v2/VOTRE_API_KEY
```

Important:
- Utiliser un wallet dedie au test
- Ne jamais versionner `.env`

## 4. Configuration reseaux

Configuration actuelle dans `hardhat.config.js`:

- Ganache: `http://127.0.0.1:7545`, chainId `1337`
- Sepolia: chainId `11155111` via `ALCHEMY_URL`

## 5. Commandes utiles

Compiler:

```bash
npm run compile
```

Console Hardhat sur Ganache:

```bash
npm run console:ganache
```

Deployer sur Ganache:

```bash
npm run deploy:ganache
```

Deployer sur Sepolia:

```bash
npm run deploy:sepolia
```

Extraire l'ABI:

```bash
npm run abi:extract
```

## 6. Workflow recommande

1. Lancer Ganache (port 7545, chainId 1337)
2. `npm run compile`
3. `npm run deploy:ganache`
4. Tester le contrat en console (`npm run console:ganache`)
5. Mettre a jour le frontend avec l'adresse locale pour les tests
6. Deployer sur Sepolia (`npm run deploy:sepolia`)
7. Mettre a jour le frontend avec l'adresse Sepolia finale

## 7. Checklist de validation TP

Le contrat doit contenir au minimum:

- 2 fonctions `view`
- 1 fonction d'ecriture
- 1 `event`
- 1 `require()`

Validation attendue:

- Deploiement Ganache OK
- Deploiement Sepolia OK
- Adresse Sepolia visible sur Etherscan
- Frontend connecte au contrat cible

## 8. Erreurs frequentes

Mauvais reseau MetaMask:
- Verifier chainId attendu par le frontend
- Verifier le reseau actif dans MetaMask

`insufficient funds` sur Sepolia:
- Alimenter le wallet avec le faucet Sepolia

Port Ganache deja utilise:
- Fermer l'instance deja ouverte ou choisir un autre port

## 9. Rendu conseille

- Lien Etherscan du contrat Sepolia
- URL de la dApp (si demandee)
- Captures: vote confirme, events, interface
- ZIP sans secrets (`.env`, `node_modules`, `dist`)
