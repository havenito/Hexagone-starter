# Analyse d'un Outil de Smart Contract

**Cours** 3WEB3 · Jour 2 · Bloc 4 – Ingénierie logicielle · B3  
**Format** Trinôme  
**Étudiants** Enzo M. · Ismail A. · Théo T.  
**Wallet utilisé** `0xe313348ed8E947FB51e63f54Efae8d3b61896e95`  
**Hash de vote** `0x69489d89da8a274ae40532dcb20402e430c65b6460242874b3b038db62b1c918`  
**Bloc** `#10463129`

---

## Phase 1 — Observation de l'interface

### 1.1 — Ce que je vois sans wallet

**Les résultats s'affichent-ils avant MetaMask ? → Oui**

Les trois candidats et leurs scores apparaissent immédiatement au chargement, sans aucune interaction. C'est possible parce que lire l'état d'un contrat Ethereum est gratuit et public : le frontend appelle `getCandidate()`, une fonction `view` qui ne modifie rien sur la blockchain. L'EVM l'exécute sans transaction, sans signature, sans gas. N'importe qui avec une connexion au réseau peut lire — c'est la **transparence** de la blockchain.

| Élément | Présent ? | Localisation |
|---|---|---|
| Adresse du contrat déployé | ✅ | Section "Smart Contract déployé sur Ethereum Sepolia" |
| Lien vers Etherscan | ✅ | Boutons "Voir le contrat", "Transactions", "Events" |
| Nombre de votes par candidat | ✅ | Cartes des 3 candidats avec score et barre de progression |
| Historique des transactions | ✅ | Section "Blockchain Explorer" (bouton Afficher) |
| Explication du fonctionnement | ✅ | Accordéon "Comment fonctionne ce vote on-chain ?" |

### 1.2 — Connexion MetaMask

Après connexion, **mon adresse complète** s'affiche (`0xe313...e95`) avec le label "Sepolia", et les boutons "Voter →" apparaissent sur chaque candidat.

**MetaMask a-t-il demandé un login/mot de passe ? → Non**

En Web2, on s'identifie avec un email + mot de passe stocké sur un serveur qui peut être compromis, réinitialisé, ou supprimé. En Web3, l'identité repose sur une paire de clés cryptographiques : mon adresse publique est connue de tous, et ma clé privée (que je suis seul à posséder) prouve que c'est moi. Aucun serveur central, aucun compte à créer.

---

## Phase 2 — Voter et observer la transaction

### 2.1 — La popup MetaMask avant confirmation

**Adresse du contrat :** `0x291Ac3C6a92dF373dEa40fee62Ad39831B8A1DDC`  
**Gas estimé :** ~0,0001 SepoliaETH

**Pourquoi voter coûte du gas ?**  
Voter appelle la fonction `vote()` qui demande à l'EVM d'exécuter plusieurs opérations : lire le mapping `lastVoteTime[msg.sender]`, vérifier le `require()`, incrémenter le compteur du candidat (écriture `SSTORE` en storage = opcode le plus coûteux), enregistrer le nouveau timestamp, et émettre l'event `Voted`. Chaque opcode a un coût en gas fixé par le protocole. Ce gas est payé aux validateurs pour rémunérer l'exécution sur l'EVM.

### 2.2 — Transaction confirmée sur Etherscan

| Donnée | Valeur |
|---|---|
| Numéro du bloc | `10463129` |
| Timestamp du bloc | Mar-17-2026 10:06:36 AM UTC |
| Gas utilisé (gasUsed) | `53 173` unités |
| Gas limit fixé | ~`79 000` unités |
| Statut | ✅ Success |
| Fonction appelée | `Vote` |

**gasUsed vs gasLimit :**  
Le `gasLimit` est le maximum autorisé à dépenser — c'est une sécurité pour ne pas vider son wallet si le contrat part en boucle infinie. Le `gasUsed` est ce qui a réellement été consommé lors de l'exécution. L'EVM s'arrête dès que l'exécution est terminée ; le surplus de gas non utilisé est remboursé automatiquement. Ici 53 173 < 79 000 car le contrat s'est exécuté normalement sans atteindre la limite.

### 2.3 — Le cooldown

En essayant de revoter immédiatement, les boutons "Voter →" disparaissent et un compte à rebours s'affiche (ex: `02:37`).

**Cette restriction est dans le smart contract**, pas seulement dans le frontend. Preuve : si on appelait `vote()` directement via Etherscan ou un script Python/JS en contournant l'interface, le contrat répondrait quand même avec une erreur `require` — la transaction serait rejetée par l'EVM. Le frontend ne fait que refléter une règle déjà enforced on-chain.

**Mécanisme Solidity :**  
- Variable : `mapping(address => uint256) public lastVoteTime`  
- Fonction : `getTimeUntilNextVote(address voter)`  
- Condition : `require(block.timestamp >= lastVoteTime[msg.sender] + cooldownDuration)`

`block.timestamp` est fourni par le validateur au moment de l'inclusion du bloc — impossible à falsifier côté client.

---

## Phase 3 — Investigation on-chain via Etherscan

### 3.1 — Onglet "Transactions"

Le contrat a reçu plusieurs transactions de type `Vote` depuis différentes adresses le 17 mars 2026. La **première transaction** est celle du déploiement — dans la colonne "Method", elle n'affiche pas `Vote` mais rien (ou le hash du constructeur), parce que c'est la création du contrat par son déployeur, pas un appel de fonction utilisateur.

### 3.2 — Onglet "Events"

**Nom de l'event :** `Voted`  
**Deux paramètres :** `voter` (address, indexed) et `candidateIndex` (uint256)

**Event vs variable d'état :**  
Une variable d'état (storage) ne conserve que la valeur actuelle — on sait combien de votes un candidat a, mais pas qui a voté ni quand. Un event est émis dans les **logs** de la transaction : immuables, jamais effaçables, consultables de l'extérieur via `queryFilter` ou Etherscan. Émettre un event coûte moins cher en gas que d'écrire en storage, et ça crée un historique complet de toute l'activité du contrat depuis son déploiement.

### 3.3 — Onglet "Contract"

**Le code source est-il vérifié ? → Non** — seul le bytecode compilé est visible sur Etherscan.

C'est une limite importante pour la transparence revendiquée : sans le code Solidity publié, les utilisateurs ne peuvent pas lire les règles directement. En décodant le bytecode à la main, j'ai trouvé la valeur `0x12c = 300 secondes = 5 minutes` (le cooldown réel) et le message d'erreur en clair : *"Vous devez attendre 5 minutes entre deux votes"*. Le frontend affiche "3 minutes" — le contrat enforce 5 minutes. **Incohérence détectable uniquement en lisant le bytecode.**

Si la condition `require()` n'est pas respectée (cooldown pas écoulé ou candidat invalide), l'EVM annule toute l'exécution, les modifications en storage sont annulées, et le gas consommé jusqu'à ce point est quand même payé.

### 3.4 — Blockchain Explorer intégré

| Donnée | Valeur |
|---|---|
| parentHash | `0x9f3a...` (hash du bloc précédent) |
| gasUsed (transaction) | `53 173` unités |
| gasLimit (bloc) | `~30 000 000` unités |
| Validateur (miner) | `0x...` |

**Pourquoi le parentHash est fondamental ?**  
Chaque bloc contient le hash cryptographique du bloc précédent. Si on modifiait un vote dans un bloc passé, son contenu changerait → son hash changerait → le `parentHash` du bloc suivant deviendrait invalide → toute la chaîne à partir de ce point serait cassée. Pour falsifier un vote, il faudrait recalculer tous les blocs suivants plus vite que le reste du réseau : mathématiquement impossible avec Ethereum.

**Le bloc précédent contient-il un vote ?** Pas forcément. Ethereum traite des milliers de transactions différentes (transferts ETH, appels à d'autres contrats, déploiements...). Un bloc peut ne contenir aucun appel à ce contrat de vote spécifique.

---

## Phase 4 — Analyse critique

### 4.1 — Propriétés exploitées

| Propriété | Exploitée ? | Justification |
|---|---|---|
| Immuabilité | ✅ Oui | Une fois inclus dans un bloc finalisé, un vote ne peut plus être supprimé ni modifié |
| Transparence | ✅ Oui | Tous les votes sont visibles sur Etherscan sans permission, vérifiables par n'importe qui |
| Désintermédiation | ⚠️ Partielle | Pas de serveur pour les votes eux-mêmes, mais l'interface tourne sur Vercel (centralisé) |
| Décentralisation | ⚠️ Partielle | Le contrat tourne sur Ethereum (décentralisé), mais une seule adresse l'a déployé |

### 4.2 — Les limites

**Ce vote est-il anonyme ?**  
Non. Chaque vote est lié à une adresse Ethereum publique visible sur Etherscan. Si cette adresse est liée à une identité réelle (échange crypto avec KYC, ENS, réseaux sociaux), le vote est parfaitement traçable. La blockchain est *pseudonyme*, pas anonyme.

**Contourner le cooldown ?**  
Oui facilement : créer un deuxième wallet MetaMask. Chaque adresse Ethereum est indépendante — le contrat ne connaît que les adresses, pas les personnes derrière. Un utilisateur motivé peut voter depuis autant d'adresses qu'il veut tant qu'il a du SepoliaETH sur chacune.

**N'importe qui peut déployer une autre interface ?**  
Oui. Le contrat est public, l'ABI est accessible dans le bundle JS du frontend. N'importe qui peut construire une interface différente (ou malveillante) qui appelle les mêmes fonctions `vote()`. Ça implique qu'il n'y a aucun "contrôle" de l'expérience utilisateur — le créateur du contrat ne peut pas empêcher ça, et les votes faits via une autre interface sont tout aussi valides.

### 4.3 — Verdict final

Ce qui fonctionne bien : les règles métier (cooldown, validation du candidat) sont enforced dans le smart contract, pas dans le frontend — un attaquant ne peut pas les contourner en manipulant l'interface. L'historique des votes est vérifiable publiquement sur Etherscan, indépendamment du site Vercel.

Ce qui pourrait être amélioré : le contrat n'est pas vérifié sur Etherscan (pas de Solidity publié), ce qui contredit la transparence revendiquée. L'incohérence "3 min affiché / 5 min enforced" montre qu'il n'y a pas eu de test de bout en bout après déploiement.

L'usage de la blockchain est **justifié pour un TD pédagogique** : il illustre concrètement les concepts — transactions signées, gas, immuabilité, events. Pour un vrai vote, ce serait insuffisant (pas d'anonymat, multi-wallets possible, interface centralisée).

---

## Synthèse finale

**En une phrase — qu'est-ce qu'un smart contract ?**  
Un programme stocké et exécuté directement sur la blockchain, dont le code est immuable après déploiement et dont les règles s'appliquent automatiquement sans qu'aucun humain ou serveur ne puisse les contourner.

**Frontend vs smart contract en une phrase :**  
Le frontend (Vercel) est une interface visuelle remplaçable qui peut mentir ou tomber en panne ; le smart contract (Sepolia) est la couche de vérité — il exécute les règles et stocke les votes de façon permanente, indépendamment de toute interface.

**La question que cette analyse m'a donné envie de poser :**  
Si le contrat n'a pas de `owner` et que son code est immuable, comment fait-on pour corriger un bug critique après déploiement — et qui décide de migrer vers un nouveau contrat ?

---

*Contrat : [`0x291Ac3C6a92dF373dEa40fee62Ad39831B8A1DDC`](https://sepolia.etherscan.io/address/0x291Ac3C6a92dF373dEa40fee62Ad39831B8A1DDC) · Ethereum Sepolia*
