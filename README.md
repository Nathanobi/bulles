# Bulles d'idées

Application de prise et de tri de notes en bulles imbriquées, sur un ciel étoilé.
Une bulle peut contenir d'autres bulles, à tous les niveaux : on range en glissant-déposant.

Site statique : aucun build, aucune dépendance. Seule la police (Google Fonts) est chargée à distance.

## Lancer

Ouvre `index.html` dans un navigateur, ou publie le dépôt avec GitHub Pages
(Settings > Pages > Deploy from a branch > `main` / racine).

## Installer sur un téléphone (PWA)

L'application est installable : elle s'ouvre en plein écran, avec son icône, et fonctionne sans connexion.
L'installation demande une adresse en `https` (GitHub Pages convient).

- iPhone : ouvrir l'adresse dans **Safari**, puis Partager > « Sur l'écran d'accueil ».
- Android : ouvrir l'adresse dans **Chrome**, puis menu ⋮ > « Installer l'application » (ou « Ajouter à l'écran d'accueil »).

Chaque téléphone garde ses propres bulles. Pense à utiliser « Sauvegarder (.json) » de temps en temps.

### Mettre à jour l'application

Après avoir modifié des fichiers, change `VERSION` dans `sw.js` (`bulles-v1` puis `bulles-v2`, etc.), sinon les téléphones gardent l'ancienne version en cache.
La nouvelle version s'affiche à la deuxième ouverture de l'app.

## Utiliser

- **Ajouter** : la barre du bas ajoute une note dans la bulle sélectionnée (sinon dans la souche).
- **Ranger** : glisse une bulle sur une autre pour la mettre dedans.
- **Sortir / regrouper** : glisse une bulle hors de sa bulle parent. Une fenêtre propose de créer un groupe autour d'elle (ex : « courses »).
  Le bouton « Regrouper… » de la fiche fait la même chose sans déplacer la bulle.
- **Éditer** : un clic sur une bulle ouvre sa fiche (nom, commentaire, couleur du contour, sous-bulle, sortir, supprimer).
  Double-clic sur un groupe : nouvelle sous-bulle à cet endroit. Double-clic dans le vide : nouvelle bulle.
- **Jouer** : les bulles rebondissent, on peut les lancer ou secouer une bulle pour faire ballotter ses sous-bulles.
- **Zoom** : molette ou pincement. Le bouton « Tout voir » recentre.
- **Plan en texte** : bouton en haut à droite, copie ou enregistre l'arborescence (arbre ou liste Markdown).
- **Réglages** : couleurs, contour, rebonds, frottement, agitation, ballottement, étoiles, taille du texte. Ambiances prêtes à l'emploi.

## Données

Hors de Claude, les bulles et les réglages sont enregistrés dans le `localStorage` du navigateur (donc propres à chaque appareil).
Le bouton « Sauvegarder (.json) » des réglages exporte tout ; « Importer » le recharge, par exemple sur un autre appareil.

## Synchronisation entre appareils

La version publiée comme Artifact dans Claude synchronise en direct via la base de l'Artifact (capacités `db`, `user`, `downloads`).
Dans ce dépôt, ce code est conservé mais reste inactif tant que `window.claude` n'existe pas : l'application bascule en mode local.
Pour synchroniser sur un site hébergé ailleurs, il faut brancher un service de stockage (Firebase, Supabase, etc.) :
tout passe par `initSync`, `flush` et `onNodes` dans `app.js` (un document par bulle : `n` nom, `c` commentaire, `p` parent, `h` teinte, `o` ordre).

## Fichiers

- `index.html` : structure de la page
- `style.css` : styles
- `app.js` : modèle de données, physique, rendu canvas, interface, enregistrement
- `manifest.webmanifest` : nom, couleurs et icônes de l'app installée
- `sw.js` : service worker (mode hors ligne)
- `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` : icônes
