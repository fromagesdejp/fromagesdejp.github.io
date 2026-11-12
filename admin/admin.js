// Les Fromages Jean-Paul — espace de Jean-Paul (admins)
(function () {
  'use strict';

  var C = window.CONFIG;
  var app = document.getElementById('app');
  var onglets = document.getElementById('onglets');
  var qui = document.getElementById('qui');
  var btnDeco = document.getElementById('deconnexion');

  // ---------- Outils ----------
  var euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  function prix(n) { return euro.format(Number(n) || 0); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function stocker(cle, val) { try { if (val == null) localStorage.removeItem(cle); else localStorage.setItem(cle, val); } catch (e) {} }
  function lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return null; } }
  var TZ = 'Europe/Paris';
  function dateHeure(iso) {
    if (!iso) return '';
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(new Date(iso));
  }
  function dateCourte(iso) {
    if (!iso) return '';
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso));
  }
  function kg(g) { return (g / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' kg'; }
  var STATUTS = { preparation: 'En préparation', ouverte: 'Ouverte', cloturee: 'Clôturée', terminee: 'Terminée' };
  var MOYENS = { virement: 'virement', especes: 'espèces', cheque: 'chèque', autre: 'autre' };

  var toastTimer = null;
  function toast(html, action) {
    var t = document.querySelector('.toast');
    if (t) t.remove();
    t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<span>' + html + '</span>' + (action ? '<button type="button">' + esc(action.libelle) + '</button>' : '');
    if (action) t.querySelector('button').onclick = function () { t.remove(); action.faire(); };
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, action ? 8000 : 3500);
  }

  // ---------- Connexion (Supabase Auth) ----------
  var session = null;
  try { session = JSON.parse(lire('fjp_admin') || 'null'); } catch (e) { session = null; }

  function auth(chemin, corps) {
    return fetch(C.supabaseUrl + '/auth/v1/' + chemin, {
      method: 'POST',
      headers: { 'apikey': C.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps)
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });
  }
  function garderSession(j) {
    session = {
      access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
      email: j.user && j.user.email
    };
    stocker('fjp_admin', JSON.stringify(session));
  }
  function rafraichir() {
    if (!session || !session.refresh_token) return Promise.reject(new Error('non connecté'));
    return auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token }).then(function (r) {
      if (!r.ok) throw new Error('session expirée');
      garderSession(r.j);
    });
  }
  function jetonValide() {
    if (!session) return Promise.reject(new Error('non connecté'));
    if (session.expires_at - 60 > Date.now() / 1000) return Promise.resolve();
    return rafraichir();
  }
  function deconnexion() {
    if (session) {
      fetch(C.supabaseUrl + '/auth/v1/logout', { method: 'POST', headers: { 'apikey': C.supabaseKey, 'Authorization': 'Bearer ' + session.access_token } }).catch(function () {});
    }
    session = null; stocker('fjp_admin', null);
    afficherConnexion();
  }

  // Appel à la base, en tant qu'admin connecté
  function api(chemin, options, deuxiemeEssai) {
    options = options || {};
    return jetonValide().then(function () {
      var h = { 'apikey': C.supabaseKey, 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' };
      if (options.method && options.method !== 'GET') h['Prefer'] = 'return=representation';
      return fetch(C.supabaseUrl + '/rest/v1/' + chemin, { method: options.method || 'GET', headers: h, body: options.body ? JSON.stringify(options.body) : undefined });
    }).then(function (r) {
      if (r.status === 401 && !deuxiemeEssai) return rafraichir().then(function () { return api(chemin, options, true); });
      return r.text().then(function (t) {
        var j = t ? JSON.parse(t) : null;
        if (!r.ok) throw new Error((j && (j.message || j.hint)) || 'Erreur ' + r.status);
        return j;
      });
    });
  }

  function afficherConnexion(msg) {
    onglets.hidden = true; btnDeco.hidden = true; qui.textContent = '';
    app.innerHTML = '<form class="carte" id="form-connexion"><h1>Connexion</h1>' +
      (msg ? '<p class="erreur-txt" role="alert">' + esc(msg) + '</p>' : '') +
      '<div class="champ"><label for="email">Adresse e-mail</label><input id="email" type="email" autocomplete="username" required></div>' +
      '<div class="champ"><label for="mdp">Mot de passe</label><input id="mdp" type="password" autocomplete="current-password" required></div>' +
      '<button class="bouton" type="submit">Se connecter</button></form>';
    document.getElementById('form-connexion').onsubmit = function (e) {
      e.preventDefault();
      var b = e.target.querySelector('button'); b.disabled = true; b.textContent = 'Connexion…';
      auth('token?grant_type=password', { email: document.getElementById('email').value.trim(), password: document.getElementById('mdp').value })
        .then(function (r) {
          if (!r.ok) { afficherConnexion('Adresse ou mot de passe incorrect.'); return; }
          garderSession(r.j);
          demarrer();
        }).catch(function () { afficherConnexion('Connexion impossible. Vérifiez Internet.'); });
    };
  }

  // ---------- Navigation ----------
  var vueCourante = lire('fjp_vue') || 'accueil';
  var campagne = null;
  var points = [];

  function aller(vue) {
    vueCourante = vue; stocker('fjp_vue', vue);
    onglets.querySelectorAll('button').forEach(function (b) {
      if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    app.innerHTML = '<p class="chargement">Chargement…</p>';
    app.onclick = null;
    var f = { accueil: vueAccueil, commandes: vueCommandes, paiements: vuePaiements, gourmets: vueGourmets, ferme: vueFerme, reglages: vueReglages }[vue] || vueAccueil;
    chargerCampagne().then(f).catch(erreur);
    window.scrollTo(0, 0);
  }
  onglets.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) aller(b.dataset.vue); });
  btnDeco.onclick = deconnexion;

  function erreur(e) {
    if (/non connecté|session expirée/.test(e.message)) { deconnexion(); return; }
    app.innerHTML = '<div class="carte"><h1>Oups…</h1><p class="erreur-txt">' + esc(e.message) + '</p><button class="btn" type="button" id="reessayer">Réessayer</button></div>';
    document.getElementById('reessayer').onclick = function () { aller(vueCourante); };
  }

  function chargerCampagne() {
    return api('campagnes?select=*&statut=neq.terminee&order=cloture.desc&limit=1').then(function (l) {
      campagne = l[0] || null;
      if (!campagne) { points = []; return; }
      return api('points_livraison?select=*&campagne_id=eq.' + campagne.id + '&order=ordre,id').then(function (p) { points = p; });
    });
  }
  function sansCampagne() {
    app.innerHTML = '<div class="carte"><h1>Aucune campagne en cours</h1><p>La création des campagnes depuis l’appli arrive bientôt.</p></div>';
  }

  function chargerCommandes() {
    return api('commandes?select=id,numero,reference,montant,paye,moyen,paye_le,montant_recu,recupere,commentaire,point_id,created_at,updated_at,' +
      'gourmet:gourmets(prenom,nom,email,telephone),' +
      'lignes(quantite,prix_unitaire,retiree,portion:portions(libelle,ordre,offre:offres(ordre,produit:produits(nom))))' +
      '&campagne_id=eq.' + campagne.id + '&statut=eq.validee&order=created_at.desc');
  }
  function nomPoint(id) { var p = points.filter(function (x) { return x.id === id; })[0]; return p ? p.ville : ''; }
  function nbArticles(c) { return c.lignes.reduce(function (a, l) { return a + (l.retiree ? 0 : l.quantite); }, 0); }

  // ---------- Accueil ----------
  function vueAccueil() {
    if (!campagne) { sansCampagne(); return; }
    return Promise.all([chargerCommandes(), api('gourmets?select=id&actif=eq.true')]).then(function (r) {
      var cmds = r[0], gourmets = r[1];
      var total = cmds.reduce(function (a, c) { return a + Number(c.montant); }, 0);
      var aPayer = cmds.filter(function (c) { return !c.paye; });
      var attendu = aPayer.reduce(function (a, c) { return a + Number(c.montant); }, 0);
      var sans = Math.max(0, gourmets.length - cmds.length);
      var h = '<section class="carte"><div style="display:flex;gap:8px;align-items:center"><h1 style="flex-grow:1">' + esc(campagne.nom) + '</h1>' +
        '<span class="pastille discrete">' + esc(STATUTS[campagne.statut]) + '</span></div>' +
        '<p style="color:var(--texte-doux);font-size:14px">Clôture ' + esc(dateHeure(campagne.cloture)) + (campagne.livraison ? ' · livraison ' + esc(dateCourte(campagne.livraison)) : '') + '</p>' +
        '<div class="grille2">' +
        '<div class="stat"><b>' + cmds.length + '</b><span>commande' + (cmds.length > 1 ? 's' : '') + ' reçue' + (cmds.length > 1 ? 's' : '') + '</span></div>' +
        '<div class="stat"><b>' + prix(total) + '</b><span>au total</span></div>' +
        '<div class="stat jaune"><b>' + sans + '</b><span>gourmet' + (sans > 1 ? 's' : '') + ' n’ont pas encore commandé</span></div>' +
        '<div class="stat jaune"><b>' + aPayer.length + '</b><span>à payer · ' + prix(attendu) + ' attendus</span></div>' +
        '</div></section>' +
        '<div class="actions">' +
        '<button class="bouton" type="button" data-aller="commandes">Voir les commandes</button>' +
        '<button class="bouton second" type="button" data-aller="ferme">Bon de commande pour la ferme</button>' +
        '<button class="bouton second" type="button" data-aller="paiements">Paiements</button>' +
        '<button class="bouton second" type="button" data-aller="gourmets">Mes gourmets et leurs liens</button></div>';
      app.innerHTML = h;
    });
  }
  app.addEventListener('click', function (e) { var b = e.target.closest('[data-aller]'); if (b) aller(b.dataset.aller); });

  // ---------- Commandes ----------
  var filtrePoint = 'tous';
  function vueCommandes() {
    if (!campagne) { sansCampagne(); return; }
    return chargerCommandes().then(function (cmds) {
      function dessiner() {
        var liste = cmds.filter(function (c) { return filtrePoint === 'tous' || c.point_id === Number(filtrePoint); });
        var somme = liste.reduce(function (a, c) { return a + Number(c.montant); }, 0);
        var h = '<div class="filtres" style="margin-top:16px"><button type="button" data-filtre="tous" aria-pressed="' + (filtrePoint === 'tous') + '">Toutes</button>';
        points.forEach(function (p) { h += '<button type="button" data-filtre="' + p.id + '" aria-pressed="' + (String(filtrePoint) === String(p.id)) + '">' + esc(p.ville) + '</button>'; });
        h += '</div><p class="avis">' + liste.length + ' commande' + (liste.length > 1 ? 's' : '') + ' · ' + prix(somme) + '</p><div class="liste" style="margin-top:8px">';
        if (!liste.length) h += '<div class="ligne"><span class="txt">Aucune commande pour l’instant.</span></div>';
        liste.forEach(function (c) {
          var g = c.gourmet || {};
          h += '<div><button type="button" class="ligne" data-ouvrir="' + c.id + '" style="width:100%;background:none;border:none;text-align:left;cursor:pointer;color:inherit;font:inherit">' +
            '<span class="txt"><b>' + esc(g.prenom + ' ' + g.nom) + '</b><small>' + nbArticles(c) + ' article(s) · ' + esc(nomPoint(c.point_id)) + ' · ' + esc(c.reference || '') + '</small></span>' +
            (c.commentaire ? '<span class="pastille">un mot</span>' : '') +
            '<span class="mt">' + prix(c.montant) + '</span></button>' +
            '<div class="detail" id="detail-' + c.id + '" hidden>';
          c.lignes.slice().sort(function (a, b) { return (a.portion.offre.ordre - b.portion.offre.ordre) || (a.portion.ordre - b.portion.ordre); }).forEach(function (l) {
            h += '<div' + (l.retiree ? ' style="text-decoration:line-through;color:var(--texte-doux)"' : '') + '><span>' + l.quantite + ' × ' + esc(l.portion.offre.produit.nom + ', ' + l.portion.libelle) + '</span><b>' + prix(l.quantite * l.prix_unitaire) + '</b></div>';
          });
          if (c.commentaire) h += '<p style="margin:8px 0 0"><b>Son mot :</b> « ' + esc(c.commentaire) + ' »</p>';
          h += '<p style="margin:8px 0 0;color:var(--texte-doux)">' + esc([g.email, g.telephone].filter(Boolean).join(' · ')) + '</p>' +
            '<p style="margin:8px 0 0">' + (c.paye ? 'Payée (' + esc(MOYENS[c.moyen] || '') + ')' : 'Pas encore payée') + '</p></div></div>';
        });
        h += '</div>';
        app.innerHTML = h;
      }
      dessiner();
      app.onclick = function (e) {
        var f = e.target.closest('[data-filtre]');
        if (f) { filtrePoint = f.dataset.filtre; dessiner(); return; }
        var o = e.target.closest('[data-ouvrir]');
        if (o) { var d = document.getElementById('detail-' + o.dataset.ouvrir); d.hidden = !d.hidden; }
      };
    });
  }

  // ---------- Paiements ----------
  function vuePaiements() {
    if (!campagne) { sansCampagne(); return; }
    return chargerCommandes().then(function (cmds) {
      var recherche = '';
      function dessiner() {
        var payes = cmds.filter(function (c) { return c.paye; });
        var aPayer = cmds.filter(function (c) { return !c.paye; });
        var attendu = aPayer.reduce(function (a, c) { return a + Number(c.montant); }, 0);
        var q = recherche.toLowerCase().replace(',', '.');
        var vis = aPayer.filter(function (c) {
          if (!q) return true;
          var g = c.gourmet || {};
          return (g.prenom + ' ' + g.nom + ' ' + (c.reference || '')).toLowerCase().indexOf(q) >= 0 || String(Number(c.montant).toFixed(2)).indexOf(q) >= 0;
        }).sort(function (a, b) { return (a.gourmet.nom || '').localeCompare(b.gourmet.nom || ''); });
        var h = '<section class="carte"><div class="grille2" style="grid-template-columns:repeat(3,minmax(0,1fr))">' +
          '<div class="stat"><b>' + payes.length + '</b><span>payés</span></div>' +
          '<div class="stat jaune"><b>' + aPayer.length + '</b><span>à payer</span></div>' +
          '<div class="stat"><b style="font-size:19px">' + prix(attendu) + '</b><span>attendus</span></div></div></section>' +
          '<div class="champ" style="margin:0 16px 12px"><label for="cherche">Chercher un nom, une référence ou un montant</label>' +
          '<input id="cherche" type="search" value="' + esc(recherche) + '" placeholder="Ex. : Martin ou 48,60"></div>' +
          '<h2 style="margin:8px 16px;font-size:17px">Reste à payer</h2><div class="liste">';
        if (!vis.length) h += '<div class="ligne"><span class="txt">' + (aPayer.length ? 'Aucun résultat.' : 'Tout est payé !') + '</span></div>';
        vis.forEach(function (c) {
          var g = c.gourmet || {};
          h += '<div class="ligne" style="flex-wrap:wrap"><span class="txt"><b>' + esc(g.prenom + ' ' + g.nom) + '</b><small>' + esc(c.reference || '') + ' · ' + esc(nomPoint(c.point_id)) + '</small></span>' +
            '<span class="mt">' + prix(c.montant) + '</span>' +
            '<span style="display:flex;gap:6px;width:100%;justify-content:flex-end">' +
            '<button class="btn" type="button" data-payer="' + c.id + '" data-moyen="virement">Virement</button>' +
            '<button class="btn clair" type="button" data-payer="' + c.id + '" data-moyen="especes">Espèces</button>' +
            '<button class="btn clair" type="button" data-payer="' + c.id + '" data-moyen="cheque">Chèque</button></span></div>';
        });
        h += '</div>';
        if (payes.length) {
          h += '<h2 style="margin:20px 16px 8px;font-size:17px">Déjà payés</h2><div class="liste">';
          payes.forEach(function (c) {
            var g = c.gourmet || {};
            h += '<div class="ligne"><span class="txt"><b>' + esc(g.prenom + ' ' + g.nom) + '</b><small>' + esc(MOYENS[c.moyen] || '') + (c.paye_le ? ' · ' + esc(dateCourte(c.paye_le)) : '') + '</small></span>' +
              '<span class="mt">' + prix(c.montant) + '</span><button class="btn rouge" type="button" data-annuler="' + c.id + '">Annuler</button></div>';
          });
          h += '</div>';
        }
        app.innerHTML = h;
        var inp = document.getElementById('cherche');
        inp.oninput = function () { recherche = inp.value; var pos = inp.selectionStart; dessiner(); var n = document.getElementById('cherche'); n.focus(); n.setSelectionRange(pos, pos); };
      }
      function marquer(id, paye, moyen) {
        var c = cmds.filter(function (x) { return x.id === id; })[0];
        var corps = paye ? { paye: true, moyen: moyen, paye_le: new Date().toISOString() } : { paye: false, moyen: null, paye_le: null };
        return api('commandes?id=eq.' + id, { method: 'PATCH', body: corps }).then(function () {
          Object.assign(c, corps); dessiner();
          if (paye) toast(esc(c.gourmet.prenom + ' ' + c.gourmet.nom) + ' : payé (' + esc(MOYENS[moyen]) + ')', { libelle: 'Annuler', faire: function () { marquer(id, false); } });
        }).catch(function (e) { toast('Erreur : ' + esc(e.message)); });
      }
      dessiner();
      app.onclick = function (e) {
        var p = e.target.closest('[data-payer]');
        if (p) { p.disabled = true; marquer(Number(p.dataset.payer), true, p.dataset.moyen); return; }
        var a = e.target.closest('[data-annuler]');
        if (a) marquer(Number(a.dataset.annuler), false);
      };
    });
  }

  // ---------- Gourmets ----------
  function vueGourmets() {
    return api('gourmets?select=id,numero,prenom,nom,email,telephone,ville_habituelle,actif,jeton_cree_le&order=actif.desc,nom,prenom').then(function (gs) {
      var dernierLien = null; // { id, url }
      function dessiner() {
        var h = '<form class="carte" id="ajout"><h1 style="font-size:20px">Ajouter un gourmet</h1>' +
          '<div class="grille2"><div class="champ"><label for="g-prenom">Prénom</label><input id="g-prenom" required></div>' +
          '<div class="champ"><label for="g-nom">Nom</label><input id="g-nom" required></div></div>' +
          '<div class="champ"><label for="g-email">E-mail</label><input id="g-email" type="email" required></div>' +
          '<div class="grille2"><div class="champ"><label for="g-tel">Téléphone (facultatif)</label><input id="g-tel" type="tel"></div>' +
          '<div class="champ"><label for="g-ville">Ville de livraison</label><input id="g-ville" list="villes"></div></div>' +
          '<datalist id="villes">' + points.map(function (p) { return '<option value="' + esc(p.ville) + '">'; }).join('') + '</datalist>' +
          '<button class="bouton" type="submit">Ajouter et créer son lien</button></form>';
        h += '<h2 style="margin:8px 16px;font-size:17px">' + gs.filter(function (g) { return g.actif; }).length + ' gourmets actifs</h2><div class="liste">';
        gs.forEach(function (g) {
          h += '<div><div class="ligne" style="flex-wrap:wrap' + (g.actif ? '' : ';opacity:.55') + '"><span class="txt"><b>' + esc(g.prenom + ' ' + g.nom) + (g.actif ? '' : ' (inactif)') + '</b>' +
            '<small>' + esc([g.email, g.ville_habituelle].filter(Boolean).join(' · ')) + '<br>' + (g.jeton_cree_le ? 'Lien créé le ' + esc(dateCourte(g.jeton_cree_le)) : 'Pas encore de lien') + '</small></span>' +
            '<span style="display:flex;gap:6px">' +
            (g.actif ? '<button class="btn" type="button" data-lien="' + g.id + '">' + (g.jeton_cree_le ? 'Nouveau lien' : 'Créer le lien') + '</button>' : '') +
            '<button class="btn clair" type="button" data-actif="' + g.id + '">' + (g.actif ? 'Désactiver' : 'Réactiver') + '</button></span></div>';
          if (dernierLien && dernierLien.id === g.id) {
            var sujet = 'Votre lien pour commander les fromages';
            var corps = 'Bonjour ' + g.prenom + ',\n\nVoici votre lien personnel pour passer vos commandes de fromages :\n' + dernierLien.url +
              '\n\nGardez-le précieusement (par exemple en favori) : il servira pour toutes les prochaines commandes. Ne le partagez pas, il est à votre nom.\n\nAmitié,\nJP';
            h += '<div class="detail"><p style="margin:0 0 4px"><b>Lien de ' + esc(g.prenom) + '</b> (l’ancien lien ne fonctionne plus) :</p><div class="lien-box" id="lien-txt">' + esc(dernierLien.url) + '</div>' +
              '<span style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" type="button" id="copier-lien">Copier le lien</button>' +
              '<a class="btn clair" style="display:inline-flex;align-items:center;text-decoration:none" href="mailto:' + encodeURIComponent(g.email) + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps) + '">Préparer le mail</a></span></div>';
          }
          h += '</div>';
        });
        h += '</div>';
        app.innerHTML = h;
        document.getElementById('ajout').onsubmit = function (e) {
          e.preventDefault();
          var b = e.target.querySelector('button'); b.disabled = true;
          var corpsG = {
            prenom: document.getElementById('g-prenom').value.trim(), nom: document.getElementById('g-nom').value.trim(),
            email: document.getElementById('g-email').value.trim().toLowerCase(),
            telephone: document.getElementById('g-tel').value.trim() || null, ville_habituelle: document.getElementById('g-ville').value.trim() || null
          };
          api('gourmets', { method: 'POST', body: corpsG }).then(function (r) {
            var g = r[0]; gs.push(g); return creerLien(g);
          }).catch(function (err) {
            b.disabled = false;
            toast(/duplicate|unique/i.test(err.message) ? 'Cette adresse e-mail est déjà enregistrée.' : 'Erreur : ' + esc(err.message));
          });
        };
      }
      function creerLien(g) {
        return api('rpc/creer_lien_gourmet', { method: 'POST', body: { p_gourmet_id: g.id } }).then(function (jeton) {
          g.jeton_cree_le = new Date().toISOString();
          var base = location.href.replace(/admin\/.*$/, '');
          dernierLien = { id: g.id, url: base + '?k=' + encodeURIComponent(jeton) };
          gs.sort(function (a, b) { return (b.actif - a.actif) || a.nom.localeCompare(b.nom); });
          dessiner();
          var d = document.getElementById('lien-txt'); if (d) d.scrollIntoView({ block: 'center' });
        });
      }
      dessiner();
      app.onclick = function (e) {
        var l = e.target.closest('[data-lien]');
        if (l) {
          var g = gs.filter(function (x) { return x.id === l.dataset.lien; })[0];
          if (g.jeton_cree_le && !window.confirm('Créer un nouveau lien pour ' + g.prenom + ' ' + g.nom + ' ? L’ancien lien ne fonctionnera plus.')) return;
          creerLien(g).catch(function (err) { toast('Erreur : ' + esc(err.message)); });
          return;
        }
        var a = e.target.closest('[data-actif]');
        if (a) {
          var g2 = gs.filter(function (x) { return x.id === a.dataset.actif; })[0];
          api('gourmets?id=eq.' + g2.id, { method: 'PATCH', body: { actif: !g2.actif } }).then(function () { g2.actif = !g2.actif; dessiner(); })
            .catch(function (err) { toast('Erreur : ' + esc(err.message)); });
          return;
        }
        if (e.target.id === 'copier-lien') {
          var t = document.getElementById('lien-txt').textContent;
          if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('Lien copié'); });
        }
      };
    });
  }

  // ---------- Bon de commande pour la ferme ----------
  function vueFerme() {
    if (!campagne) { sansCampagne(); return; }
    return api('totaux_ferme?campagne_id=eq.' + campagne.id + '&order=categorie_ordre,offre_ordre,portion_ordre').then(function (rows) {
      var cats = [], parCat = {};
      rows.forEach(function (r) {
        if (!parCat[r.categorie]) { parCat[r.categorie] = { nom: r.categorie, produits: [], parProd: {} }; cats.push(parCat[r.categorie]); }
        var c = parCat[r.categorie];
        if (!c.parProd[r.produit]) { c.parProd[r.produit] = { nom: r.produit, details: [], poids: 0, pieces: 0, coupe: false }; c.produits.push(c.parProd[r.produit]); }
        var p = c.parProd[r.produit];
        p.details.push(r.quantite + ' × ' + r.portion);
        p.poids += r.poids_total_g; p.pieces += r.quantite;
        if (r.mode === 'coupe') p.coupe = true;
      });
      var h = '<div class="carte"><div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><div style="flex-grow:1"><h1 style="margin:0">Bon de commande</h1>' +
        '<div style="color:var(--texte-doux)">' + esc(campagne.nom) + (campagne.livraison ? ' · livraison souhaitée le ' + esc(dateCourte(campagne.livraison)) : '') + '</div></div>' +
        '<button class="btn non-imprime" type="button" id="imprimer">Imprimer / PDF</button></div>';
      if (campagne.statut === 'ouverte') h += '<p class="bandeau attention non-imprime" style="margin:0 0 12px">La campagne est encore ouverte : ce bon peut encore changer jusqu’à la clôture.</p>';
      if (!rows.length) h += '<p>Aucune commande pour l’instant.</p>';
      else {
        h += '<table class="bon"><thead><tr><th>Produit</th><th>Détail</th><th style="text-align:right">Total</th></tr></thead><tbody>';
        cats.forEach(function (c) {
          h += '<tr class="cat"><td colspan="3">' + esc(c.nom) + '</td></tr>';
          c.produits.forEach(function (p) {
            h += '<tr><td>' + esc(p.nom) + '</td><td>' + esc(p.details.join(' · ')) + '</td><td class="n">' + (p.coupe ? esc(kg(p.poids)) : p.pieces + ' pièce' + (p.pieces > 1 ? 's' : '')) + '</td></tr>';
          });
        });
        h += '</tbody></table><p style="font-size:12px;color:var(--texte-doux);margin-top:10px">Quantités regroupées pour toutes les commandes. Chaque morceau « à la coupe » est préparé séparément (ex. 6 × 500 g = six morceaux de 500 g).</p>';
      }
      h += '</div>';
      app.innerHTML = h;
      var b = document.getElementById('imprimer'); if (b) b.onclick = function () { window.print(); };
    });
  }

  // ---------- Réglages ----------
  function vueReglages() {
    return api('reglages?id=eq.1&select=*').then(function (l) {
      var r = l[0] || {};
      app.innerHTML = '<form class="carte" id="form-reglages"><h1 style="font-size:20px">Réglages</h1>' +
        '<div class="champ"><label for="r-titulaire">Titulaire du compte</label><input id="r-titulaire" value="' + esc(r.titulaire || '') + '"></div>' +
        '<div class="champ"><label for="r-iban">IBAN (affiché aux gourmets pour le virement)</label><input id="r-iban" value="' + esc(r.iban || '') + '" autocomplete="off" spellcheck="false"></div>' +
        '<div class="champ"><label for="r-signature">Signature des messages</label><input id="r-signature" value="' + esc(r.signature || '') + '"></div>' +
        '<div class="champ"><label for="r-taux">Supplément transport (€ par kg)</label><input id="r-taux" type="number" step="0.01" min="0" value="' + esc(r.taux_transport_kg) + '"><small>1,50 € par kg = 0,15 € par 100 g</small></div>' +
        '<button class="bouton" type="submit">Enregistrer</button></form>';
      document.getElementById('form-reglages').onsubmit = function (e) {
        e.preventDefault();
        var corps = {
          titulaire: document.getElementById('r-titulaire').value.trim() || null,
          iban: document.getElementById('r-iban').value.replace(/\s+/g, ' ').trim().toUpperCase() || null,
          signature: document.getElementById('r-signature').value.trim() || 'Amitié JP',
          taux_transport_kg: Number(document.getElementById('r-taux').value) || 0
        };
        api('reglages?id=eq.1', { method: 'PATCH', body: corps }).then(function () { toast('Réglages enregistrés'); })
          .catch(function (err) { toast('Erreur : ' + esc(err.message)); });
      };
    });
  }

  // ---------- Démarrage ----------
  function demarrer() {
    if (!session) { afficherConnexion(); return; }
    api('rpc/est_admin', { method: 'POST', body: {} }).then(function (ok) {
      if (!ok) { deconnexion(); afficherConnexion('Ce compte n’a pas accès à l’espace de Jean-Paul.'); return; }
      qui.textContent = session.email || '';
      onglets.hidden = false; btnDeco.hidden = false;
      aller(vueCourante);
    }).catch(function () { deconnexion(); });
  }
  demarrer();
})();
