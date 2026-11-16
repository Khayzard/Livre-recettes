/* Livre de recettes — JavaScript vanilla, sans dépendance.
   Tous les chemins sont relatifs (compatible GitHub Pages). */
(function () {
  "use strict";

  // ---------- Utilitaires ----------
  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? "" : v);
      });
    }
    (enfants || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function chargerJSON(chemin) {
    return fetch(chemin, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(chemin + " : " + r.status);
      return r.json();
    });
  }

  function chargerRecettes() {
    return chargerJSON("recettes/index.json").then(function (slugs) {
      return Promise.all(slugs.map(function (s) {
        return chargerJSON("recettes/" + encodeURIComponent(s) + ".json").catch(function () { return null; });
      }));
    }).then(function (liste) { return liste.filter(Boolean); });
  }

  function sansAccents(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function stockage() {
    try { var k = "__lr"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; }
    catch (e) { return null; }
  }

  function afficherErreur(msg) {
    var e = document.getElementById("erreur");
    if (e) { e.textContent = msg; e.hidden = false; }
  }

  // ---------- Quantités ----------
  // Arrondis « de cuisine » selon l'unité, pour que les portions ajustées restent lisibles.
  var FR_COURANTES = [[0, ""], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"], [1, ""]];
  var FR_QUARTS = [[0, ""], [0.25, "¼"], [0.5, "½"], [0.75, "¾"], [1, ""]];
  var FR_DEMIES = [[0, ""], [0.5, "½"], [1, ""]];
  var CUILLERES = { "t": 1, "c. à soupe": 1, "c. à thé": 1 };
  // Choses qu'on ne coupe pas en deux : toujours un nombre entier.
  var ENTIERS = /^(œufs?|oeufs?|gousses?|feuilles?)(\s|,|$)/i;

  function enFraction(x, grille, minimum) {
    if (x >= 20) return String(Math.round(x));
    var entier = Math.floor(x), reste = x - entier, meilleur = grille[0];
    grille.forEach(function (f) { if (Math.abs(f[0] - reste) < Math.abs(meilleur[0] - reste) - 1e-9) meilleur = f; });
    if (meilleur[0] === 1) { entier += 1; meilleur = grille[0]; }
    if (entier === 0 && !meilleur[1]) return minimum;
    return (entier ? String(entier) : "") + (entier && meilleur[1] ? " " : "") + meilleur[1];
  }

  function enDecimal(v) {
    return v.toLocaleString("fr-CA", { maximumFractionDigits: 1 });
  }

  function formatNombre(x, unite, nom, exact) {
    if (unite === "g" || unite === "ml") {
      if (exact) return String(Math.round(x));
      var pas = x >= 100 ? 10 : 5;
      return String(Math.max(pas, Math.round(x / pas) * pas));
    }
    if (unite === "kg" || unite === "l") return enDecimal(Math.max(0.1, Math.round(x * 10) / 10));
    if (unite === "lb") return enFraction(x, FR_QUARTS, "¼");
    if (CUILLERES[unite]) {
      // Une pincée de sel ou d'épice : on accepte ⅛ c. à thé sous ¼.
      if (unite === "c. à thé" && x < 0.19) return "⅛";
      return enFraction(x, FR_COURANTES, "¼");
    }
    // Unités comptées (gousses, oignons, pommes, tortillas…)
    if (ENTIERS.test(nom || "") || x >= 5) return String(Math.max(1, Math.round(x)));
    return enFraction(x, FR_DEMIES, "½");
  }

  // Valeur réellement affichée (« 1 ½ » → 1.5), pour accorder au singulier ou au pluriel.
  var VAL_FR = { "⅛": 0.125, "¼": 0.25, "⅓": 1 / 3, "½": 0.5, "⅔": 2 / 3, "¾": 0.75 };
  function valeurAffichee(txt) {
    return String(txt).split(" ").reduce(function (t, p) {
      return t + (VAL_FR[p] !== undefined ? VAL_FR[p] : parseFloat(p.replace(",", ".")) || 0);
    }, 0);
  }

  // Accord du nom d'une unité comptée : « 1 lime », « 2 limes », « ½ poivron (pas vert) ».
  var INVARIABLES = { gros: 1, orange: 1, "chou-fleur": 1 };
  var ADJECTIFS = /^(rouges?|jaunes?|verts?|orange|grandes?|gros|grosses?|petits?|petites?|ou)$/;
  var PARTICIPES = /ée?s?$/; // « hachées », « tranchés », « émincé »…
  function accorderMot(m, pluriel) {
    if (INVARIABLES[m]) return m;
    if (pluriel) return /[sx]$/.test(m) ? m : m === "chou" ? "choux" : m + "s";
    return m === "choux" ? "chou" : m.replace(/s$/, "");
  }
  function accorderNom(nom, pluriel) {
    var mots = nom.split(" ");
    for (var i = 0; i < mots.length; i++) {
      if (i > 0 && /^d'[^,]+,$/.test(mots[i])) continue; // « gousses d'ail, hachées »
      var m = mots[i].match(/^([^,;]+)([,;]?)$/);
      if (!m || (i > 0 && !ADJECTIFS.test(m[1]) && !PARTICIPES.test(m[1]))) break;
      if (m[1] !== "ou") mots[i] = accorderMot(m[1], pluriel) + m[2];
    }
    return mots.join(" ").replace(/\(pas verts?\)/, pluriel ? "(pas verts)" : "(pas vert)");
  }

  // Une fois mises à l'échelle, les mesures changent d'unité si c'est plus lisible :
  // 4 c. à soupe et plus → tasses (16 c. à soupe = 1 t) ; moins de ¼ t → c. à soupe ;
  // moins de 1 c. à soupe → c. à thé (3 c. à thé = 1 c. à soupe).
  function uniteAdaptee(x, u) {
    var s = u === "t" ? x * 16 : u === "c. à soupe" ? x : u === "c. à thé" ? x / 3 : null;
    if (s === null) return u;
    if (s >= 3.75) return "t";          // arrondi à ¼ t
    if (s >= 0.875) return "c. à soupe"; // arrondi à 1 c. à soupe
    return "c. à thé";
  }
  function convertir(x, de, vers) {
    var CS = { "t": 16, "c. à soupe": 1, "c. à thé": 1 / 3 };
    return de === vers ? x : x * CS[de] / CS[vers];
  }

  function formatMesure(x, u, nom, exact) {
    if (u === "c. à soupe" && !exact) return enFraction(x, FR_DEMIES, "½");
    return formatNombre(x, u, nom, exact);
  }

  // Renvoie { nb: "1 ½" ou "2–3", u: unité affichée }
  function quantiteAffichee(q, qm, u, nom, exact) {
    var v = exact || !CUILLERES[u] ? u : uniteAdaptee(qm || q, u);
    q = convertir(q, u, v); qm = qm ? convertir(qm, u, v) : null;
    // Moins de 1 kg (ou 1 l) une fois ajusté : en grammes (ou ml), plus lisible que « 0,3 kg ».
    if (!exact && (u === "kg" || u === "l") && (qm || q) < 0.95) { v = u === "kg" ? "g" : "ml"; q *= 1000; qm = qm ? qm * 1000 : null; }
    else if (!exact && (u === "g" || u === "ml") && q >= 1000) { v = u === "g" ? "kg" : "l"; q /= 1000; qm = qm ? qm / 1000 : null; }
    var a = formatMesure(q, v, nom, exact), b = qm ? formatMesure(qm, v, nom, exact) : null;
    return { nb: b && b !== a ? a + "–" + b : a, u: v };
  }

  function formatUnite(u, pluriel) {
    if (u === "t") return pluriel ? "tasses" : "tasse";
    return u;
  }

  function mesure(q, qm, u, nom, facteur) {
    var r = quantiteAffichee(q * facteur, qm ? qm * facteur : null, u, nom, facteur === 1);
    var pluriel = valeurAffichee(r.nb.split("–").pop()) >= 2;
    return { nb: r.nb, u: r.u ? formatUnite(r.u, pluriel) : "", pluriel: pluriel };
  }

  // Quantités écrites dans le texte : « {{0.5|c. à thé}} » se met à l'échelle comme le reste.
  function remplacerMesures(s, facteur) {
    return String(s).replace(/\{\{([\d.]+)\|([^}]*)\}\}/g, function (_, v, u) {
      var m = mesure(parseFloat(v), null, u, "", facteur);
      return [m.nb, m.u].filter(Boolean).join(" ");
    });
  }

  function texteIngredient(it, facteur, portionsBase) {
    if (it.texte) {
      var t = remplacerMesures(it.texte, facteur);
      // Lignes qu'on ne peut pas diviser proprement : on indique pour combien de portions elles valent.
      return it.pourBase && facteur !== 1 && portionsBase ? t + " (pour " + portionsBase + " portions)" : t;
    }
    var m = mesure(it.q, it.qMax, it.u, it.nom, facteur);
    var nom = remplacerMesures(it.nom, facteur);
    if (!it.u && facteur !== 1) nom = accorderNom(nom, m.pluriel);
    // ex. « 1 tasse de miel », « 3 gousses d'ail »
    return [m.nb, m.u, nom].filter(Boolean).join(" ");
  }

  // ---------- Accueil ----------
  function carte(r, jour) {
    var meta = [];
    if (r.tempsTotal) meta.push(el("span", { class: "carte-temps", text: "⏱ " + r.tempsTotal }));
    meta.push(el("span", { class: "carte-portions", text: r.portions ? "🍽 " + r.portions + " portions" : "🍽 " + (r.portionsNote || "") }));
    return el("a", { class: "carte", href: "recette.html?r=" + encodeURIComponent(r.slug) }, [
      el("div", { class: "carte-img" }, [el("img", { src: r.photo, alt: r.titre, loading: "lazy", width: "600", height: "400" })]),
      el("div", { class: "carte-corps" }, [
        jour ? el("span", { class: "carte-jour", text: jour }) : null,
        el("h3", { class: "carte-titre", text: r.titre }),
        el("div", { class: "carte-meta" }, meta),
        el("div", { class: "etiquettes" }, (r.etiquettes || []).map(function (t) { return el("span", { class: "etiquette", text: t }); }))
      ])
    ]);
  }

  // Tri alphabétique en ignorant les accents (« Côtelettes » avec les C, « Œufs » avec les O…)
  function cleTri(t) { return sansAccents(t).replace(/œ/g, "oe").replace(/æ/g, "ae"); }
  function trierAlpha(liste) {
    return liste.slice().sort(function (a, b) {
      var ka = cleTri(a.titre), kb = cleTri(b.titre);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }

  function pageAccueil() {
    var grille = document.getElementById("grille"), champ = document.getElementById("q"),
        filtres = document.getElementById("filtres"), compte = document.getElementById("compte"),
        secSemaine = document.getElementById("sec-semaine"), grilleSemaine = document.getElementById("grille-semaine"),
        titreToutes = document.getElementById("titre-toutes");
    var actifs = new Set(), recettes = [], menu = [];
    var ORDRE = ["poulet", "porc", "fruits de mer", "poisson", "rapide", "meal prep", "four", "mijoteuse", "tacos", "restes", "favori"];

    var params = new URLSearchParams(location.search);
    if (params.get("q")) champ.value = params.get("q");

    function index(r) {
      if (!r._idx) {
        var ing = [];
        (r.ingredients || []).forEach(function (g) { g.items.forEach(function (it) { ing.push(remplacerMesures(it.texte || it.nom, 1)); }); });
        r._idx = sansAccents([r.titre, r.resume, (r.etiquettes || []).join(" "), ing.join(" ")].join(" "));
      }
      return r._idx;
    }

    function rendre() {
      var mots = sansAccents(champ.value).split(/\s+/).filter(Boolean);
      var filtre = mots.length > 0 || actifs.size > 0;
      var liste = recettes.filter(function (r) {
        var ok = true;
        actifs.forEach(function (t) { if ((r.etiquettes || []).indexOf(t) < 0) ok = false; });
        return ok && mots.every(function (m) { return index(r).indexOf(m) >= 0; });
      });
      // Sans recherche ni filtre : « Au menu cette semaine » puis « Toutes les recettes ».
      // Avec une recherche ou un filtre : une seule liste de résultats.
      secSemaine.hidden = filtre || !menu.length;
      if (!secSemaine.hidden) {
        grilleSemaine.replaceChildren.apply(grilleSemaine, menu.map(function (m) { return carte(m.recette, m.jour); }));
      }
      titreToutes.textContent = filtre ? "Résultats" : "Toutes les recettes";
      grille.replaceChildren.apply(grille, liste.map(function (r) { return carte(r); }));
      compte.textContent = liste.length === recettes.length ? recettes.length + " recettes"
        : liste.length + " recette" + (liste.length > 1 ? "s" : "") + " sur " + recettes.length;
      if (!liste.length) grille.appendChild(el("p", { class: "vide", text: "Aucune recette ne correspond. Essayez un autre mot ou retirez un filtre." }));
    }

    function rendreFiltres() {
      var toutes = new Set();
      recettes.forEach(function (r) { (r.etiquettes || []).forEach(function (t) { toutes.add(t); }); });
      var liste = Array.from(toutes).sort(function (a, b) {
        var ia = ORDRE.indexOf(a), ib = ORDRE.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "fr");
      });
      var boutons = [el("button", { type: "button", class: "puce", "aria-pressed": String(actifs.size === 0), onclick: function () { actifs.clear(); rendreFiltres(); rendre(); } }, ["Toutes"])];
      liste.forEach(function (t) {
        boutons.push(el("button", { type: "button", class: "puce", "aria-pressed": String(actifs.has(t)), onclick: function () {
          if (actifs.has(t)) actifs.delete(t); else actifs.add(t);
          rendreFiltres(); rendre();
        } }, [t]));
      });
      filtres.replaceChildren.apply(filtres, boutons);
    }

    champ.addEventListener("input", rendre);
    var semaine = chargerJSON("semaine.json").catch(function () { return null; });
    Promise.all([chargerRecettes(), semaine]).then(function (res) {
      recettes = trierAlpha(res[0]);
      var parSlug = {};
      recettes.forEach(function (r) { parSlug[r.slug] = r; });
      // Les jours dans l'ordre de semaine.json (triés par date si elles sont fournies)
      var jours = ((res[1] && res[1].jours) || []).slice().sort(function (a, b) {
        return a.date && b.date ? (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) : 0;
      });
      menu = jours.filter(function (j) { return j.slug && parSlug[j.slug]; })
        .map(function (j) { return { recette: parSlug[j.slug], jour: j.jour }; });
      rendreFiltres(); rendre();
    }).catch(function () {
      afficherErreur("Impossible de charger les recettes. Si vous ouvrez le fichier directement, lancez plutôt un petit serveur (voir le README).");
    });
  }

  // ---------- Page recette ----------
  var verrouEcran = null;
  function demanderEveil(info) {
    if (!("wakeLock" in navigator)) { if (info) info.textContent = ""; return; }
    navigator.wakeLock.request("screen").then(function (v) {
      verrouEcran = v;
      if (info) info.textContent = "L'écran reste allumé.";
      v.addEventListener("release", function () { verrouEcran = null; });
    }).catch(function () { if (info) info.textContent = ""; });
  }
  function libererEveil() {
    if (verrouEcran) { verrouEcran.release().catch(function () {}); verrouEcran = null; }
  }

  function section(titre, classe, enfants) {
    return el("section", { class: "bloc " + (classe || "") }, [el("h2", { text: titre })].concat(enfants));
  }
  function listeSimple(items, classe, facteur) {
    return el("ul", { class: classe || "liste" }, items.map(function (t) { return el("li", { text: remplacerMesures(t, facteur || 1) }); }));
  }

  // Une étape peut être une simple chaîne (ancien format) ou un objet
  // { titre, texte, feu, four, duree, reperes, pourquoi } (seuls titre et texte sont obligatoires).
  function normaliserEtape(e) {
    if (e && typeof e === "object") return e;
    return { texte: String(e === null || e === undefined ? "" : e) };
  }
  function etapeEnrichie(e) { return !!(e && typeof e === "object"); }

  // Contenu d'une étape (page recette et mode cuisine).
  function contenuEtape(e, facteur) {
    e = normaliserEtape(e);
    var m = function (s) { return remplacerMesures(s, facteur); };
    var pastilles = [];
    if (e.feu) pastilles.push(el("span", { class: "pastille pastille-feu" }, ["🔥 Feu " + m(e.feu)]));
    if (e.four) pastilles.push(el("span", { class: "pastille pastille-four" }, ["♨️ Four " + m(e.four)]));
    if (e.duree) pastilles.push(el("span", { class: "pastille pastille-duree" }, ["⏱ " + m(e.duree)]));
    return [
      e.titre ? el("strong", { class: "etape-titre", text: m(e.titre) }) : null,
      e.texte ? el("p", { class: "etape-texte", text: m(e.texte) }) : null,
      pastilles.length ? el("p", { class: "pastilles" }, pastilles) : null,
      e.reperes ? el("p", { class: "etape-reperes", text: "👀 " + m(e.reperes) }) : null,
      e.pourquoi ? el("p", { class: "etape-pourquoi", text: "💡 Pourquoi : " + m(e.pourquoi) }) : null
    ];
  }

  function pageRecette() {
    var zone = document.getElementById("recette");
    var slug = new URLSearchParams(location.search).get("r");
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      zone.replaceChildren(el("p", { class: "erreur", text: "Recette introuvable." }), el("a", { class: "btn", href: "index.html", text: "Voir toutes les recettes" }));
      return;
    }
    chargerJSON("recettes/" + slug + ".json").then(function (r) { afficherRecette(zone, r); }).catch(function () {
      zone.replaceChildren(el("p", { class: "erreur", text: "Impossible de charger cette recette." }), el("a", { class: "btn", href: "index.html", text: "Voir toutes les recettes" }));
    });
  }

  function afficherRecette(zone, r) {
    document.title = r.titre + " — Livre de recettes";
    var ls = stockage(), cle = "lr-coche-" + r.slug, cleP = "lr-portions-" + r.slug;
    var coches = new Set();
    try { coches = new Set(JSON.parse((ls && ls.getItem(cle)) || "[]")); } catch (e) { /* ignore */ }
    var portions = r.portions || null;
    if (portions && ls) { var p = parseInt(ls.getItem(cleP), 10); if (p > 0 && p < 100) portions = p; }

    // En-tête
    var tempsTxt = [];
    if (r.temps) {
      if (r.temps.prep) tempsTxt.push("Préparation : " + r.temps.prep);
      if (r.temps.cuisson) tempsTxt.push("Cuisson : " + r.temps.cuisson);
      if (r.temps.total) tempsTxt.push("Total : " + r.temps.total);
    }
    var credit = null;
    if (r.credit) {
      if (r.credit.lien && r.credit.licenceLien) {
        credit = el("p", { class: "credit" }, [
          el("a", { href: r.credit.lien, rel: "noopener", target: "_blank", text: "Photo : " + r.credit.auteur }),
          " — ",
          el("a", { href: r.credit.licenceLien, rel: "noopener license", target: "_blank", text: r.credit.licence }),
          ", Wikimedia Commons"
        ]);
      } else if (r.credit.texte) {
        credit = el("p", { class: "credit", text: r.credit.texte });
      }
    }

    var figure = el("figure", { class: "photo" }, [
      el("img", { src: r.photo, alt: r.titre, width: "1200", height: "900" }),
      credit ? el("figcaption", null, [credit]) : null
    ]);

    var entete = el("div", { class: "recette-entete" }, [
      el("h1", { text: r.titre }),
      r.resume ? el("p", { class: "resume", text: r.resume }) : null,
      el("div", { class: "etiquettes" }, (r.etiquettes || []).map(function (t) {
        return el("a", { class: "etiquette", href: "index.html?q=" + encodeURIComponent(t), text: t });
      })),
      tempsTxt.length ? el("p", { class: "temps", text: "⏱ " + tempsTxt.join(" · ") }) : null,
      el("button", { type: "button", class: "btn btn-gros btn-plein btn-cuisine", onclick: function () { ouvrirCuisine(r, facteurActuel()); } }, ["👩‍🍳 Mode cuisine"])
    ]);

    // Températures
    var temps = (r.temperatures || []).length ? el("section", { class: "bloc temperatures", "aria-labelledby": "t-titre" }, [
      el("h2", { id: "t-titre", text: "🌡 Températures sécuritaires" }),
      el("ul", { class: "temp-liste" }, r.temperatures.map(function (t) {
        return el("li", null, [el("span", { class: "temp-quoi", text: t.quoi }), el("strong", { class: "temp-val", text: t.temp }), t.note ? el("span", { class: "temp-note", text: t.note }) : null]);
      }))
    ]) : null;

    // Ingrédients
    var listeIng = el("div", { class: "ingredients" });
    var infoPortions = el("p", { class: "info-portions" });
    var enrichie = (r.etapes || []).some(etapeEnrichie);
    function facteurActuel() { return r.portions && portions ? portions / r.portions : 1; }
    function rendreIngredients() {
      var f = facteurActuel();
      var blocs = [];
      (r.ingredients || []).forEach(function (g, gi) {
        if (g.groupe) blocs.push(el("h3", { text: g.groupe }));
        blocs.push(el("ul", { class: "cases" }, g.items.map(function (it, ii) {
          var id = gi + "-" + ii, cb = el("input", { type: "checkbox", id: "ing-" + id });
          cb.checked = coches.has(id);
          cb.addEventListener("change", function () {
            if (cb.checked) coches.add(id); else coches.delete(id);
            if (ls) ls.setItem(cle, JSON.stringify(Array.from(coches)));
          });
          return el("li", null, [cb, el("label", { for: "ing-" + id, text: texteIngredient(it, f, r.portions) })]);
        })));
      });
      listeIng.replaceChildren.apply(listeIng, blocs);
      infoPortions.textContent = f !== 1 ? "Quantités ajustées pour " + portions + " portions (recette de base : " + r.portions + ")." +
        (enrichie ? " Les quantités dans les étapes sont ajustées aussi ; prévoir au besoin un plus grand récipient ou une plaque de plus." : " Les quantités dans les étapes restent celles de la recette de base.") : "";
      rendreEtapes(f);
    }

    var selecteur = null;
    if (r.portions) {
      var valeur = el("output", { class: "portions-val", "aria-live": "polite" });
      var maj = function () { valeur.textContent = portions + " portion" + (portions > 1 ? "s" : ""); if (ls) ls.setItem(cleP, String(portions)); rendreIngredients(); };
      selecteur = el("div", { class: "portions", role: "group", "aria-label": "Nombre de portions" }, [
        el("button", { type: "button", class: "btn btn-rond", "aria-label": "Moins de portions", onclick: function () { if (portions > 1) { portions--; maj(); } } }, ["−"]),
        valeur,
        el("button", { type: "button", class: "btn btn-rond", "aria-label": "Plus de portions", onclick: function () { if (portions < 60) { portions++; maj(); } } }, ["+"]),
        el("button", { type: "button", class: "btn btn-lien", onclick: function () { portions = r.portions; maj(); } }, ["Base (" + r.portions + ")"])
      ]);
      valeur.textContent = portions + " portion" + (portions > 1 ? "s" : "");
    }

    var blocIng = section("Ingrédients", "bloc-ing", [
      r.portionsNote ? el("p", { class: "note-portions", text: (r.portions ? "Recette de base : " + r.portions + " portions — " : "") + r.portionsNote }) : (r.portions ? el("p", { class: "note-portions", text: "Recette de base : " + r.portions + " portions" }) : null),
      selecteur, infoPortions, listeIng,
      el("button", { type: "button", class: "btn btn-contour", onclick: function () {
        coches.clear(); if (ls) ls.removeItem(cle);
        listeIng.querySelectorAll("input[type=checkbox]").forEach(function (c) { c.checked = false; });
      } }, ["Tout décocher"])
    ].filter(Boolean));

    // Mise en place, étapes et astuces : réaffichées quand les portions changent ({{valeur|unité}}).
    var olEtapes = el("ol", { class: "etapes" + (enrichie ? " etapes-riches" : "") });
    var ulMep = el("ul", { class: "liste liste-mep" }), ulAstuces = el("ul", { class: "liste liste-astuces" });
    function rendreEtapes(f) {
      olEtapes.replaceChildren.apply(olEtapes, (r.etapes || []).map(function (e) {
        return etapeEnrichie(e) ? el("li", { class: "etape" }, contenuEtape(e, f)) : el("li", { text: remplacerMesures(e, f) });
      }));
      ulMep.replaceChildren.apply(ulMep, (r.miseEnPlace || []).map(function (t) { return el("li", { text: remplacerMesures(t, f) }); }));
      ulAstuces.replaceChildren.apply(ulAstuces, (r.astuces || []).map(function (t) { return el("li", { text: remplacerMesures(t, f) }); }));
    }

    var blocMep = (r.miseEnPlace || []).length ? section("🧺 Mise en place", "bloc-mep", [
      el("p", { class: "intro-bloc", text: "À sortir, couper et préparer avant d'allumer le feu." }), ulMep
    ]) : null;
    var blocEtapes = section("Étapes", "bloc-etapes", [olEtapes]);

    // Ordre : Mise en place, Étapes, Astuces, Meal prep, Conservation, puis le reste.
    var extras = [];
    if ((r.astuces || []).length) extras.push(section("⚠️ Astuces et erreurs à éviter", "bloc-astuces", [ulAstuces]));
    if ((r.mealPrep || []).length) extras.push(section("🥡 Meal prep", "bloc-prep", [listeSimple(r.mealPrep)]));
    if ((r.conservation || []).length) extras.push(section("❄️ Conservation et lunchs", "", [listeSimple(r.conservation)]));
    if ((r.substitutions || []).length) extras.push(section("🔁 Substitutions", "", [listeSimple(r.substitutions)]));
    if ((r.notes || []).length) extras.push(section("📝 Notes", "", [listeSimple(r.notes)]));
    if (r.proteines) extras.push(section("Protéines", "", [el("p", { text: r.proteines + " par portion" })]));
    if ((r.liens || []).length) extras.push(el("p", { class: "liens" }, r.liens.map(function (l) {
      return el("a", { class: "btn btn-contour", href: "recette.html?r=" + encodeURIComponent(l.slug), text: l.texte + " →" });
    })));

    zone.replaceChildren(figure, entete, temps,
      el("div", { class: "colonnes" }, [blocIng, el("div", null, [blocMep, blocEtapes].concat(extras))]));
    rendreIngredients();
  }

  // ---------- Mode cuisine ----------
  function ouvrirCuisine(r, facteur) {
    facteur = facteur || 1;
    var boite = document.getElementById("cuisine"), etapes = r.etapes || [], n = 0;
    var txt = document.getElementById("cuisine-etape"), num = document.getElementById("cuisine-num"),
        prec = document.getElementById("cuisine-prec"), suiv = document.getElementById("cuisine-suiv"),
        info = document.getElementById("cuisine-eveil");
    if (!etapes.length) return;
    document.getElementById("cuisine-titre").textContent = r.titre;
    // Cartes : « Mise en place » d'abord (si présente), puis une carte par étape.
    var mep = r.miseEnPlace || [];
    var cartes = (mep.length ? [{ mep: true }] : []).concat(etapes.map(function (e) { return { etape: e }; }));
    var decalage = mep.length ? 1 : 0;
    // Fondu en bas tant qu'il reste du texte à faire défiler.
    function indiquerSuite() {
      txt.classList.toggle("a-suivre", txt.scrollHeight - txt.clientHeight - txt.scrollTop > 8);
    }
    txt.onscroll = indiquerSuite;
    function montrer() {
      var c = cartes[n];
      num.textContent = c.mep ? "Avant de commencer" : "Étape " + (n - decalage + 1) + " sur " + etapes.length;
      if (c.mep) {
        txt.replaceChildren(
          el("strong", { class: "etape-titre", text: "🧺 Mise en place" }),
          el("p", { class: "etape-pourquoi", text: "À sortir, couper et préparer avant d'allumer le feu." }),
          el("ul", { class: "cuisine-mep" }, mep.map(function (t) { return el("li", { text: remplacerMesures(t, facteur) }); }))
        );
      } else if (etapeEnrichie(c.etape)) {
        txt.replaceChildren.apply(txt, contenuEtape(c.etape, facteur).filter(Boolean));
      } else {
        txt.replaceChildren(el("p", { class: "etape-simple", text: remplacerMesures(c.etape, facteur) }));
      }
      txt.scrollTop = 0;
      indiquerSuite();
      prec.disabled = n === 0;
      suiv.textContent = n === cartes.length - 1 ? "Terminé ✓" : "Suivante →";
    }
    function fermer() {
      boite.hidden = true; document.body.classList.remove("sans-defilement");
      libererEveil();
      document.removeEventListener("keydown", clavier);
      document.removeEventListener("visibilitychange", visibilite);
    }
    function clavier(e) {
      if (e.key === "ArrowRight") suiv.click();
      else if (e.key === "ArrowLeft") prec.click();
      else if (e.key === "Escape") fermer();
    }
    function visibilite() { if (document.visibilityState === "visible" && !boite.hidden && !verrouEcran) demanderEveil(info); }
    prec.onclick = function () { if (n > 0) { n--; montrer(); } };
    suiv.onclick = function () { if (n < cartes.length - 1) { n++; montrer(); } else fermer(); };
    document.getElementById("cuisine-fermer").onclick = fermer;
    document.addEventListener("keydown", clavier);
    document.addEventListener("visibilitychange", visibilite);
    boite.hidden = false; document.body.classList.add("sans-defilement");
    montrer(); suiv.focus();
    demanderEveil(info);
  }

  // ---------- Cette semaine ----------
  function pageSemaine() {
    var liste = document.getElementById("semaine");
    Promise.all([chargerJSON("semaine.json"), chargerJSON("recettes/index.json")]).then(function (res) {
      var s = res[0], connus = res[1];
      document.getElementById("semaine-titre").textContent = s.titre || "Cette semaine";
      document.getElementById("semaine-periode").textContent = s.periode || "";
      var auj = new Date(), cleAuj = auj.getFullYear() + "-" + String(auj.getMonth() + 1).padStart(2, "0") + "-" + String(auj.getDate()).padStart(2, "0");
      liste.replaceChildren.apply(liste, (s.jours || []).map(function (j) {
        var existe = j.slug && connus.indexOf(j.slug) >= 0;
        var contenu = [
          existe ? el("img", { src: "images/" + j.slug + ".jpg", alt: "", loading: "lazy", width: "160", height: "120" }) : el("div", { class: "jour-vide", text: "🍽" }),
          el("div", { class: "jour-texte" }, [
            el("p", { class: "jour-nom", text: j.jour + (j.date === cleAuj ? " · aujourd'hui" : "") }),
            el("p", { class: "jour-plat", text: j.titre }),
            el("p", { class: "jour-info", text: [j.portions ? "Portions : " + j.portions : "", j.note || ""].filter(Boolean).join(" · ") })
          ])
        ];
        var item = existe ? el("a", { class: "jour", href: "recette.html?r=" + encodeURIComponent(j.slug) }, contenu) : el("div", { class: "jour" }, contenu);
        return el("li", { class: j.date === cleAuj ? "aujourdhui" : null }, [item]);
      }));
      var notes = document.getElementById("semaine-notes");
      notes.replaceChildren.apply(notes, (s.notes || []).map(function (n) { return el("li", { text: n }); }));
    }).catch(function () {
      afficherErreur("Impossible de charger le menu de la semaine. Si vous ouvrez le fichier directement, lancez plutôt un petit serveur (voir le README).");
    });
  }

  window.LR = { pageAccueil: pageAccueil, pageRecette: pageRecette, pageSemaine: pageSemaine };
})();
