# Tâches — comment les bots lisent et mettent à jour la liste

Le fichier `taches.json` à la racine du dépôt est la seule source partagée.
La page [taches.html](https://khayzard.github.io/Livre-recettes/taches.html) affiche les tâches actives. Cocher une case la marque comme faite (`statut: fait`, `maj_par: Joel (page)`) et l’enregistre via l’API GitHub Contents. Les tâches faites sont masquées derrière « Afficher les tâches faites (N) » ; on peut les décocher pour les rouvrir (`a_faire`).


## Cocher une tâche depuis la page (jeton GitHub)

À la première coche, si aucun jeton n’est déjà enregistré, la page affiche un petit formulaire (pas une fenêtre `prompt`) pour coller un **jeton d’accès précisé** (fine-grained). Il est stocké seulement dans le `localStorage` du navigateur, sous la clé `taches-github-token`. Le lien « Oublier le code » l’efface. **Ne jamais commettre ce jeton** dans le dépôt, un fichier ou un message de commit.

### Créer le jeton

1. Ouvrir https://github.com/settings/personal-access-tokens/new (être connecté au compte qui a accès au dépôt, en pratique **Khayzard**).
2. Donner un nom clair, par exemple `Tâches Livre-recettes`, et une date d’expiration (90 jours suffit).
3. **Resource owner** : le compte **Khayzard**.
4. **Repository access** : *Only select repositories*, puis seulement **Khayzard/Livre-recettes**.
5. **Permissions** du dépôt : **Contents** → **Read and write**. (Metadata en lecture seule est ajouté automatiquement. Aucune autre permission n’est nécessaire.)
6. Générer le jeton, le copier, puis le coller dans le formulaire de la page à la première coche.

La page envoie ensuite un `GET` `https://api.github.com/repos/Khayzard/Livre-recettes/contents/taches.json` pour lire le `sha`, puis un `PUT` avec le JSON encodé en Base64 (UTF-8). En cas de conflit `409`, elle relit le fichier et réessaie une fois.

## Sur la box (recommandé)

```bash
python3 /workspace/chief-os/taches.py list
python3 /workspace/chief-os/taches.py list --statut a_faire
python3 /workspace/chief-os/taches.py add --titre "…" --responsable Joel --echeance 2026-11-20 --notes "…" --par Chief
python3 /workspace/chief-os/taches.py set T-041 --statut fait --par Chief
python3 /workspace/chief-os/taches.py sync
```

Chaque écriture fait un `git pull --rebase`, enregistre `taches.json`, crée un commit du type `taches: T-041 -> fait (par Chief)` et pousse sur `main` (une relance en cas de conflit). Variable d’environnement utile : `TACHES_PAR` (nom du bot), `TACHES_REPO` (défaut : `/workspace/livre-recettes`).

## Sans la box : lire

- Page : https://khayzard.github.io/Livre-recettes/taches.html
- JSON publié : https://khayzard.github.io/Livre-recettes/taches.json
- Source brute : https://raw.githubusercontent.com/Khayzard/Livre-recettes/main/taches.json

Le JSON publié sur Pages peut avoir une ou deux minutes de retard après un push. Pour l’état le plus récent, lire l’URL `raw.githubusercontent.com` (ou l’API ci-dessous).

## Sans la box : écrire avec l’API GitHub Contents

`GET` puis `PUT` `/repos/Khayzard/Livre-recettes/contents/taches.json`. Le `PUT` doit renvoyer le `sha` actuel du fichier, le contenu encodé en Base64, et un message de commit.

```bash
# Lire le fichier et son sha
gh api repos/Khayzard/Livre-recettes/contents/taches.json --jq '{sha, content}'

# Exemple d’écriture (après avoir modifié le JSON localement)
SHA=$(gh api repos/Khayzard/Livre-recettes/contents/taches.json --jq .sha)
gh api --method PUT repos/Khayzard/Livre-recettes/contents/taches.json \
  -f message='taches: T-041 -> fait (par Chief)' \
  -f content="$(base64 -w0 taches.json)" \
  -f sha="$SHA" \
  -f branch=main
```

Si le `PUT` est refusé (sha périmé), refaire un `GET`, réappliquer la modification, puis renvoyer le `PUT` avec le nouveau sha.

## Schéma

`taches.json` est un tableau d’objets :

| Champ         | Type   | Valeurs |
|---------------|--------|---------|
| `id`          | texte  | ex. `T-041` |
| `titre`       | texte  |         |
| `statut`      | texte  | `a_faire`, `en_cours`, `fait`, `bloque` |
| `responsable` | texte  | Joel, Cindy, ou le nom d’un bot |
| `echeance`    | texte ou `null` | `AAAA-MM-JJ` |
| `notes`       | texte ou `null` |         |
| `maj`         | texte  | horodatage ISO (America/Toronto) |
| `maj_par`     | texte  | qui a fait la dernière mise à jour |

Ne pas y mettre de mots de passe, de numéros de carte ou de compte, ni d’adresse complète. Ne pas modifier `semaine.json`, le dossier `mealprep/` ni les fichiers de recettes : ils appartiennent à Ricardo.
