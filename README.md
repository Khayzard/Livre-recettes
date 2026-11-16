# Livre de recettes

Site statique de nos recettes de famille : HTML, CSS et JavaScript simples, sans framework ni étape de build.
Il est publié automatiquement sur GitHub Pages : https://khayzard.github.io/Livre-recettes/

## Structure

```
index.html            Accueil : cartes, recherche, filtres
recette.html          Une recette : recette.html?r=<slug>
semaine.html          Menu de la semaine
semaine.json          Le menu de la semaine (à changer chaque semaine)
recettes/index.json   Liste des recettes (les slugs)
recettes/<slug>.json  Une recette par fichier
images/<slug>.jpg     Une photo par recette
assets/               style.css, app.js, favicon.svg
CREDITS.md            Auteur et licence de chaque photo
```

Important : tous les chemins sont **relatifs** (jamais de `/` au début), sinon le site brise sur GitHub Pages.

## Ajouter une recette

1. Choisir un *slug* : minuscules, sans accents, mots séparés par des tirets (ex. `chili-porc-hache`).
2. Copier un fichier existant de `recettes/` (ex. `recettes/tacos-porc-hache.json`) sous le nom `recettes/chili-porc-hache.json` et le modifier :

```json
{
  "slug": "chili-porc-hache",
  "titre": "Chili au porc haché",
  "resume": "Une phrase de description.",
  "portions": 10,
  "portionsNote": "5 à table + lunchs",
  "temps": { "prep": "20 min", "cuisson": "40 min" },
  "tempsTotal": "1 h",
  "etiquettes": ["porc", "rapide"],
  "temperatures": [{ "quoi": "Porc haché", "temp": "71 °C (160 °F)", "note": "plus de rose" }],
  "ingredients": [
    { "groupe": "Sauce", "items": [
      { "q": 1.4, "u": "kg", "nom": "de porc haché" },
      { "q": 0.5, "u": "t", "nom": "de bouillon", "qMax": 1 },
      { "texte": "Sel, poivre" }
    ] }
  ],
  "etapes": ["Première étape.", "Deuxième étape."],
  "substitutions": [], "mealPrep": [], "conservation": [], "notes": [],
  "photo": "images/chili-porc-hache.jpg",
  "credit": { "texte": "Photo : Auteur — CC BY 4.0", "auteur": "Auteur", "licence": "CC BY 4.0",
              "licenceLien": "https://creativecommons.org/licenses/by/4.0/", "source": "Nom du fichier",
              "lien": "https://commons.wikimedia.org/wiki/File:..." }
}
```

- `q` est un nombre (utiliser `0.5`, `0.25`, `0.3333` pour ½, ¼, ⅓) ; `qMax` sert pour un intervalle (« 2–3 c. à soupe »).
- Unités : `t` (tasse), `c. à soupe`, `c. à thé`, `lb`, `kg`, `g`, `ml`, ou `""` pour un nombre d'unités (« 2 oignons »).
- Une quantité qui n'est pas un nombre (« sel, poivre », « persil ») va dans `texte` : elle n'est pas recalculée.
- Champs facultatifs : `temps`, `tempsTotal`, `portionsNote`, `substitutions`, `mealPrep`, `conservation`, `notes`, `liens`, `proteines` (seulement si l'information est connue).
- Étiquettes utilisées : poulet, porc, fruits de mer, poisson, rapide, meal prep, four, mijoteuse, tacos, restes, favori.

3. Ajouter le slug dans `recettes/index.json` :

```json
["...", "chili-porc-hache"]
```

## Ajouter une photo

1. Trouver une photo libre de droits du plat, par exemple sur [Wikimedia Commons](https://commons.wikimedia.org) (licences CC0, CC BY, CC BY-SA ou domaine public).
2. La redimensionner à environ 1200 px de large et l'enregistrer en JPEG sous `images/<slug>.jpg`. Avec Python :

```bash
python3 -c "from PIL import Image; im=Image.open('photo.jpg').convert('RGB'); im.thumbnail((1200,1200)); im.save('images/chili-porc-hache.jpg', quality=80, optimize=True)"
```

3. Remplir `photo` et `credit` dans le JSON de la recette.
4. Ajouter une section dans `CREDITS.md` (recette, source, auteur, licence, modifications).

## Changer le menu de la semaine

Modifier `semaine.json` : le titre, la période, et un élément par jour dans `jours` :

```json
{ "date": "2026-11-23", "jour": "Lundi 23", "slug": "tacos-porc-hache", "titre": "Tacos au porc haché", "portions": "10", "note": "Porc haché à 71 °C." }
```

- `slug` doit correspondre à un fichier de `recettes/` pour faire un lien (sinon, laisser `""` : le jour s'affiche sans lien, utile pour un soir flexible).
- `date` (AAAA-MM-JJ) sert à mettre en évidence le jour même.

## Tester localement

Les pages chargent les données avec `fetch`, donc il faut un petit serveur (ouvrir le fichier directement ne marche pas) :

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000/ dans le navigateur. Pour essayer sur le téléphone, sur le même réseau Wi-Fi : `http://<adresse-ip-de-l-ordinateur>:8000/`.

## Publication

Le workflow `.github/workflows/pages.yml` publie le site à chaque push sur `main` (ou manuellement avec « Run workflow »).
Dans GitHub : *Settings → Pages → Source : GitHub Actions*.

