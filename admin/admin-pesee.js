// Les Fromages Jean-Paul — espace de Jean-Paul : préparation, pesée et validation des commandes
// Après la clôture, JP rassemble les produits de chaque gourmet et coche chaque article prêt.
// Pour un fromage à la coupe, il indique le prix de chaque morceau (par défaut) ou son poids.
// Quand tous les articles sont cochés, il valide la commande : le montant devient définitif
// et le gourmet reçoit un seul mail (fromages arrivés + lieu + montant + IBAN).
(function () {
  'use strict';
  window.FJP_VUES = window.FJP_VUES || {};

  var COCHE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var STYLE = [
    '.pe-barre { height: 8px; border-radius: 999px; background: #E6ECEE; overflow: hidden; }',
    '.pe-barre span { display: block; height: 100%; border-radius: 999px; background: var(--canard); transition: width .3s; }',
    '.pe-barre.fini span { background: #1E9E57; }',
    '.pe-prog { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 13px; color: var(--texte-doux); margin: 0 0 6px; }',
    '.pe-prog b { color: var(--texte); font-size: 15px; }',
    '.pe-global { margin-top: 14px; }',
    '.pe-global + .pe-global { margin-top: 10px; }',
    '.pe-mini { display: block; width: 100%; margin-top: 6px; }',
    '.pe-mini .pe-barre { height: 5px; }',
    '.pe-ligne { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: 1px solid #EEF1F2; }',
    '.pe-ligne:first-of-type { border-top: 0; }',
    '.pe-ligne.prete .pe-nom { color: var(--texte-doux); }',
    '.pe-coche { flex-shrink: 0; width: 40px; height: 40px; border-radius: 12px; border: 2px solid #C9D5D8; background: #fff; color: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; transition: background .15s, border-color .15s; }',
    '.pe-coche[aria-pressed="true"] { background: #1E9E57; border-color: #1E9E57; color: #fff; }',
    '.pe-coche:disabled { cursor: default; opacity: .6; }',
    '.pe-coche:focus-visible { outline: 3px solid var(--fromage); outline-offset: 2px; }',
    '.pe-corps { flex-grow: 1; min-width: 0; }',
    '.pe-tete { display: flex; gap: 8px; align-items: baseline; }',
    '.pe-tete .pe-nom { flex-grow: 1; font-weight: 600; }',
    '.pe-tete small { display: block; font-weight: 400; color: var(--texte-doux); font-size: 13px; }',
    '.pe-modes { display: inline-flex; margin-top: 8px; border: 1.5px solid var(--bord); border-radius: 999px; overflow: hidden; }',
    '.pe-modes button { border: 0; background: #fff; color: var(--texte-doux); font: inherit; font-size: 13px; font-weight: 700; padding: 5px 14px; cursor: pointer; }',
    '.pe-modes button[aria-pressed="true"] { background: var(--canard); color: #fff; }',
    '.pe-saisie { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }',
    '.pe-saisie label { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--texte-doux); }',
    '.pe-saisie input { width: 92px; font-size: 18px; padding: 8px 10px; border: 1.5px solid var(--bord); border-radius: 10px; font-family: inherit; text-align: right; }',
    '.pe-saisie input:focus { outline: none; border-color: var(--canard); box-shadow: 0 0 0 3px var(--canard-clair); }',
    '.pe-total { display: flex; justify-content: space-between; align-items: baseline; margin: 12px 0; padding-top: 10px; border-top: 2px solid #EEF1F2; font-size: 17px; }',
    '.pe-total b { font-size: 22px; }',
    '.pe-ok { color: #1E7A46; font-weight: 700; }',
    /* La rubrique utilise .detail : on annule sa mise en ligne des blocs */
    '.detail .pe-corps, .detail .pe-barre, .detail [id^="barre-"] { display: block; padding: 0; }',
    '.detail .pe-ligne { display: flex; justify-content: flex-start; gap: 12px; padding: 12px 0; }',
    '.detail .pe-tete { display: flex; justify-content: space-between; padding: 0; }',
    '.detail .pe-modes { display: inline-flex; gap: 0; padding: 0; }',
    '.detail .pe-saisie { display: flex; justify-content: flex-start; flex-wrap: wrap; gap: 8px; padding: 0; }',
    '.detail .pe-prog, .detail .pe-total { display: flex; }'
  ].join(' ');
  if (!document.getElementById('style-pesee')) {
    var st = document.createElement('style'); st.id = 'style-pesee'; st.textContent = STYLE; document.head.appendChild(st);
  }

  var filtre = 'a_faire';   // 'a_faire' | 'validees' | 'toutes'
  var filtrePoint = 'tous';
  var modes = {};           // ligne_id -> 'prix' | 'poids' (le prix par défaut)

  function nombre(v) { var n = Number(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) && n > 0 ? n : 0; }
  function decimal(n) { return n == null ? '' : String(Number(n).toFixed(2)).replace('.', ','); }
  function barre(n, total) {
    var pc = total ? Math.round(100 * n / total) : 0;
    return '<div class="pe-barre' + (total && n >= total ? ' fini' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + n + '"><span style="width:' + pc + '%"></span></div>';
  }

  window.FJP_VUES.pesee = function () {
    var FJP = window.FJP, esc = FJP.esc, prix = FJP.prix, app = FJP.app, nomG = FJP.nomG;
    var campagne = FJP.campagne(), points = FJP.points();
    if (!campagne) { app.innerHTML = '<div class="carte"><h1>Aucune campagne en cours</h1></div>'; return; }

    return FJP.api('commandes?select=id,reference,montant,paye,prete_le,point_id,' +
      'gourmet:gourmets(prenom,nom),' +
      'lignes(id,quantite,prix_unitaire,poids_g,poids_reels,prix_reels,prix_final,preparee,retiree,portion:portions(libelle,mode,ordre,offre:offres(ordre,produit:produits(nom))))' +
      '&campagne_id=eq.' + campagne.id + '&statut=eq.validee').then(function (cmds) {
      var ouvert = null; // commande dépliée
      cmds.forEach(function (c) {
        c.lignes.sort(function (a, b) { return (a.portion.offre.ordre - b.portion.offre.ordre) || (a.portion.ordre - b.portion.ordre); });
      });
      cmds.sort(function (a, b) {
        return (a.point_id - b.point_id) || String(a.gourmet.nom).localeCompare(String(b.gourmet.nom));
      });
      function articles(c) { return c.lignes.filter(function (l) { return !l.retiree; }); }
      function nbPrets(c) { return c.prete_le ? articles(c).length : articles(c).filter(function (l) { return l.preparee; }).length; }
      function chiffree(l) { return (l.poids_reels && l.poids_reels.length) || (l.prix_reels && l.prix_reels.length); }
      function modeDe(l) { return modes[l.id] || (l.poids_reels && l.poids_reels.length ? 'poids' : 'prix'); }
      function ville(id) { var p = points.filter(function (x) { return x.id === id; })[0]; return p ? p.ville : ''; }

      function etat(c) {
        if (c.prete_le) return '<span class="pastille" style="background:#DFF3E7;color:#1E7A46">Validée' + (c.paye ? ' · payée' : '') + '</span>';
        var n = articles(c).length, k = nbPrets(c);
        if (k && k >= n) return '<span class="pastille">Prête à valider</span>';
        return '<span class="pastille' + (k ? '' : ' discrete') + '">' + (k ? k + '/' + n + ' prêts' : 'À préparer') + '</span>';
      }
      function texteProg(k, n) { return '<span><b>' + k + '</b> article' + (k > 1 ? 's' : '') + ' prêt' + (k > 1 ? 's' : '') + ' sur ' + n + '</span>'; }

      function enTete() {
        var validees = cmds.filter(function (c) { return c.prete_le; }).length;
        var totA = 0, totP = 0;
        cmds.forEach(function (c) { totA += articles(c).length; totP += nbPrets(c); });
        return '<h1 style="font-size:20px;margin:0 0 4px">Pesée et validation</h1>' +
          '<p style="margin:0;color:var(--texte-doux);font-size:14px">Rassemblez les produits de chaque gourmet et cochez chaque article prêt. Pour la coupe, indiquez le prix (ou le poids) de chaque morceau. Quand tout est coché, validez : le gourmet reçoit un mail avec le lieu, l’heure et le montant exact à payer.</p>' +
          '<div class="pe-global"><div class="pe-prog"><span><b>' + validees + '</b> commande' + (validees > 1 ? 's' : '') + ' validée' + (validees > 1 ? 's' : '') + ' sur ' + cmds.length + '</span><span>' + (cmds.length ? Math.round(100 * validees / cmds.length) : 0) + ' %</span></div>' + barre(validees, cmds.length) + '</div>' +
          '<div class="pe-global"><div class="pe-prog">' + texteProg(totP, totA) + '</div>' + barre(totP, totA) + '</div>';
      }

      function dessiner() {
        var h = '';
        if (campagne.statut === 'ouverte' || campagne.statut === 'preparation') {
          h += '<p class="bandeau attention" style="margin:16px">La validation se fait après la clôture, quand les fromages sont arrivés. Les commandes peuvent encore changer.</p>';
        }
        h += '<section class="carte" id="pe-entete">' + enTete() + '</section>';

        h += '<div class="filtres">' +
          [['a_faire', 'À faire'], ['validees', 'Validées'], ['toutes', 'Toutes']].map(function (f) {
            return '<button type="button" data-filtre="' + f[0] + '" aria-pressed="' + (filtre === f[0]) + '">' + f[1] + '</button>';
          }).join('') + '</div>';
        if (points.length > 1) {
          h += '<div class="filtres" style="margin-top:0"><button type="button" data-point="tous" aria-pressed="' + (filtrePoint === 'tous') + '">Tous les points</button>' +
            points.map(function (p) { return '<button type="button" data-point="' + p.id + '" aria-pressed="' + (String(filtrePoint) === String(p.id)) + '">' + esc(p.ville) + '</button>'; }).join('') + '</div>';
        }

        var liste = cmds.filter(function (c) {
          if (filtre === 'a_faire' && c.prete_le) return false;
          if (filtre === 'validees' && !c.prete_le) return false;
          return filtrePoint === 'tous' || c.point_id === Number(filtrePoint);
        });
        h += '<div class="liste">';
        if (!liste.length) h += '<div class="ligne"><span class="txt">' + (filtre === 'a_faire' ? 'Rien à faire ici.' : 'Aucune commande.') + '</span></div>';
        liste.forEach(function (c) {
          var n = articles(c).length, k = nbPrets(c);
          h += '<div><button type="button" class="ligne" data-ouvrir="' + c.id + '" aria-expanded="' + (ouvert === c.id) + '" style="width:100%;background:none;border:none;text-align:left;cursor:pointer;color:inherit;font:inherit;flex-wrap:wrap">' +
            '<span class="txt"><b>' + esc(nomG(c.gourmet)) + '</b><small>' + esc(ville(c.point_id)) + ' · ' + esc(c.reference || '') + '</small></span>' +
            '<span id="etat-' + c.id + '">' + etat(c) + '</span><span class="mt" id="mt-' + c.id + '">' + prix(c.montant) + '</span>' +
            '<span class="pe-mini" id="mini-' + c.id + '">' + barre(k, n) + '</span></button>';
          if (ouvert === c.id) h += detail(c);
          h += '</div>';
        });
        h += '</div>';
        app.innerHTML = h;
      }

      function saisie(l, bloque) {
        var m = modeDe(l), h = '';
        h += '<div class="pe-modes" role="group" aria-label="Saisir le prix ou le poids">' +
          '<button type="button" data-mode="prix" data-l="' + l.id + '" aria-pressed="' + (m === 'prix') + '"' + (bloque ? ' disabled' : '') + '>Prix</button>' +
          '<button type="button" data-mode="poids" data-l="' + l.id + '" aria-pressed="' + (m === 'poids') + '"' + (bloque ? ' disabled' : '') + '>Poids</button></div>';
        h += '<div class="pe-saisie">';
        for (var i = 0; i < l.quantite; i++) {
          var etiq = l.quantite > 1 ? 'Morceau ' + (i + 1) : (m === 'prix' ? 'Prix' : 'Poids');
          var v, ph, unite, mode;
          if (m === 'prix') {
            v = l.prix_reels && l.prix_reels[i] != null ? decimal(l.prix_reels[i]) : '';
            ph = decimal(l.prix_unitaire); unite = '€'; mode = 'decimal';
          } else {
            v = l.poids_reels && l.poids_reels[i] ? l.poids_reels[i] : '';
            ph = l.poids_g; unite = 'g'; mode = 'numeric';
          }
          h += '<label>' + etiq + '<input type="text" inputmode="' + mode + '" autocomplete="off" data-ligne="' + l.id + '" data-i="' + i + '" value="' + v + '" placeholder="' + ph + '"' +
            (bloque ? ' disabled' : '') + ' aria-label="' + (m === 'prix' ? 'Prix en euros' : 'Poids en grammes') + ' : ' + esc(l.portion.offre.produit.nom) + (l.quantite > 1 ? ', morceau ' + (i + 1) : '') + '"> ' + unite + '</label>';
        }
        return h + '</div>';
      }

      function detail(c) {
        var bloque = !!c.prete_le;
        var n = articles(c).length, k = nbPrets(c);
        var h = '<div class="detail" id="detail-' + c.id + '">';
        h += '<div class="pe-prog" id="prog-' + c.id + '">' + texteProg(k, n) + '<span>' + (n ? Math.round(100 * k / n) : 0) + ' %</span></div>' +
          '<div id="barre-' + c.id + '" style="margin-bottom:6px">' + barre(k, n) + '</div>';
        c.lignes.forEach(function (l) {
          var nom = l.portion.offre.produit.nom + ', ' + l.portion.libelle;
          var estime = l.quantite * l.prix_unitaire;
          var coupe = l.portion.mode === 'coupe';
          if (l.retiree) {
            h += '<div class="pe-ligne" style="opacity:.5;text-decoration:line-through"><span style="width:40px"></span><div class="pe-corps"><div class="pe-tete"><span class="pe-nom">' +
              l.quantite + ' × ' + esc(nom) + '<small>retiré</small></span></div></div></div>';
            return;
          }
          var pret = bloque || l.preparee;
          h += '<div class="pe-ligne' + (pret ? ' prete' : '') + '" id="ligne-' + l.id + '">' +
            '<button type="button" class="pe-coche" data-cocher="' + l.id + '" aria-pressed="' + pret + '"' + (bloque ? ' disabled' : '') + ' aria-label="Article prêt : ' + esc(nom) + '">' + COCHE + '</button>' +
            '<div class="pe-corps"><div class="pe-tete"><span class="pe-nom">' + l.quantite + ' × ' + esc(nom) +
            '<small>' + (coupe ? 'Estimé ' + prix(estime) + (l.poids_reels && l.poids_reels.length ? ' · pesé ' + l.poids_reels.join(' + ') + ' g' : '') : 'Prix fixe') + '</small></span>' +
            '<b id="prix-' + l.id + '">' + (coupe ? (l.prix_final != null ? prix(l.prix_final) : '—') : prix(estime)) + '</b></div>' +
            (coupe ? saisie(l, bloque) : '') + '</div></div>';
        });
        h += '<div class="pe-total"><span>' + (c.prete_le ? 'Montant définitif' : 'Montant') + '</span><b id="total-' + c.id + '">' + prix(c.montant) + '</b></div>';
        if (c.prete_le) {
          h += '<p class="pe-ok" style="margin:0 0 10px">✓ Validée, mail envoyé au gourmet' + (c.paye ? ' · payée' : '') + '</p>';
          if (!c.paye) h += '<button class="btn clair" type="button" data-rouvrir="' + c.id + '">Corriger (annuler la validation)</button>';
        } else {
          h += '<button class="bouton" type="button" data-valider="' + c.id + '"' + (k < n ? ' disabled' : '') + '>' + texteValider(c) + '</button>';
        }
        h += '</div>';
        return h;
      }
      function texteValider(c) {
        var reste = articles(c).length - nbPrets(c);
        return reste ? 'Encore ' + reste + ' article' + (reste > 1 ? 's' : '') + ' à cocher' : 'Valider et envoyer le montant à ' + esc(c.gourmet.prenom);
      }

      // Met à jour les barres, l'état et le bouton sans redessiner la page (le clavier reste ouvert)
      function majCommande(c) {
        var n = articles(c).length, k = nbPrets(c);
        var e = document.getElementById('pe-entete'); if (e) e.innerHTML = enTete();
        var et = document.getElementById('etat-' + c.id); if (et) et.innerHTML = etat(c);
        var mt = document.getElementById('mt-' + c.id); if (mt) mt.textContent = prix(c.montant);
        var mi = document.getElementById('mini-' + c.id); if (mi) mi.innerHTML = barre(k, n);
        var pg = document.getElementById('prog-' + c.id); if (pg) pg.innerHTML = texteProg(k, n) + '<span>' + (n ? Math.round(100 * k / n) : 0) + ' %</span>';
        var ba = document.getElementById('barre-' + c.id); if (ba) ba.innerHTML = barre(k, n);
        var tot = document.getElementById('total-' + c.id); if (tot) tot.textContent = prix(c.montant);
        var b = app.querySelector('[data-valider="' + c.id + '"]'); if (b) { b.disabled = k < n; b.innerHTML = texteValider(c); }
      }

      function trouverLigne(id) {
        for (var i = 0; i < cmds.length; i++) {
          for (var j = 0; j < cmds[i].lignes.length; j++) if (cmds[i].lignes[j].id === id) return { c: cmds[i], l: cmds[i].lignes[j] };
        }
        return null;
      }

      // Enregistre les prix ou les poids d'une ligne quand tous ses morceaux sont remplis (ou tous vidés)
      function enregistrer(ligneId) {
        var t = trouverLigne(ligneId); if (!t) return;
        var m = modeDe(t.l);
        var champs = app.querySelectorAll('input[data-ligne="' + ligneId + '"]');
        var vals = Array.prototype.map.call(champs, function (x) { return nombre(x.value); });
        var pleins = vals.filter(function (v) { return v > 0; }).length;
        if (pleins && pleins < vals.length) return; // on attend les autres morceaux
        if (m === 'poids') vals = vals.map(function (v) { return Math.round(v); });
        else vals = vals.map(function (v) { return Math.round(v * 100) / 100; });
        var actuel = m === 'poids' ? t.l.poids_reels : t.l.prix_reels;
        var nouveau = pleins ? vals : null;
        if (JSON.stringify(nouveau) === JSON.stringify(actuel ? actuel.map(Number) : null)) return;
        var corps = { p_ligne_id: ligneId, p_poids: m === 'poids' ? nouveau : null, p_prix: m === 'prix' ? nouveau : null };
        FJP.api('rpc/saisir_ligne', { method: 'POST', body: corps }).then(function (r) {
          if (r.erreur) {
            FJP.toast({ poids_invalides: 'Poids incorrect (en grammes, entre 1 et 20 000).', prix_invalides: 'Prix incorrect (en euros, entre 0,01 et 2 000).',
              deja_validee: 'Commande déjà validée.', prix_fixe: 'Ce produit a un prix fixe.' }[r.erreur] || 'Erreur');
            return;
          }
          t.l.poids_reels = corps.p_poids; t.l.prix_reels = corps.p_prix; t.l.prix_final = r.prix_final; t.l.preparee = r.preparee;
          t.c.montant = r.montant;
          var p = document.getElementById('prix-' + ligneId); if (p) p.textContent = r.prix_final != null ? prix(r.prix_final) : '—';
          if (!r.preparee) {
            var bc = app.querySelector('[data-cocher="' + ligneId + '"]'); if (bc) bc.setAttribute('aria-pressed', 'false');
            var li = document.getElementById('ligne-' + ligneId); if (li) li.classList.remove('prete');
          }
          majCommande(t.c);
        }).catch(function (e) { FJP.toast('Erreur : ' + esc(e.message)); });
      }

      function cocher(ligneId, bouton) {
        var t = trouverLigne(ligneId); if (!t) return;
        var coche = !t.l.preparee;
        if (coche && t.l.portion.mode === 'coupe' && !chiffree(t.l)) {
          FJP.toast(modeDe(t.l) === 'prix' ? 'Indiquez d’abord le prix de chaque morceau.' : 'Indiquez d’abord le poids de chaque morceau.');
          var champ = app.querySelector('input[data-ligne="' + ligneId + '"]'); if (champ) champ.focus();
          return;
        }
        bouton.disabled = true;
        FJP.api('rpc/cocher_ligne', { method: 'POST', body: { p_ligne_id: ligneId, p_coche: coche } }).then(function (r) {
          bouton.disabled = false;
          if (r.erreur) { FJP.toast({ a_peser: 'Indiquez d’abord le prix ou le poids.', deja_validee: 'Commande déjà validée.' }[r.erreur] || 'Erreur'); return; }
          t.l.preparee = coche;
          bouton.setAttribute('aria-pressed', String(coche));
          var li = document.getElementById('ligne-' + ligneId); if (li) li.classList.toggle('prete', coche);
          majCommande(t.c);
        }).catch(function (e) { bouton.disabled = false; FJP.toast('Erreur : ' + esc(e.message)); });
      }

      dessiner();

      app.onchange = function (e) {
        var inp = e.target.closest('input[data-ligne]');
        if (inp) enregistrer(Number(inp.dataset.ligne));
      };
      // Touche « Entrée » / « Suivant » du clavier : passe au champ suivant
      app.onkeydown = function (e) {
        var inp = e.target.closest('input[data-ligne]');
        if (!inp || e.key !== 'Enter') return;
        e.preventDefault();
        var tous = Array.prototype.slice.call(app.querySelectorAll('.pe-saisie input:not([disabled])'));
        var suivant = tous[tous.indexOf(inp) + 1];
        if (suivant) suivant.focus(); else inp.blur();
      };
      app.onclick = function (e) {
        var f = e.target.closest('[data-filtre]');
        if (f) { filtre = f.dataset.filtre; ouvert = null; dessiner(); return; }
        var pt = e.target.closest('[data-point]');
        if (pt) { filtrePoint = pt.dataset.point; ouvert = null; dessiner(); return; }
        var o = e.target.closest('[data-ouvrir]');
        if (o) { var id = Number(o.dataset.ouvrir); ouvert = ouvert === id ? null : id; dessiner(); return; }
        var co = e.target.closest('[data-cocher]');
        if (co) { cocher(Number(co.dataset.cocher), co); return; }
        var mo = e.target.closest('[data-mode]');
        if (mo) {
          var lid = Number(mo.dataset.l);
          var tl = trouverLigne(lid);
          if (!tl || modeDe(tl.l) === mo.dataset.mode) return;
          modes[lid] = mo.dataset.mode;
          var y = window.scrollY; dessiner(); window.scrollTo(0, y);
          var ch = app.querySelector('input[data-ligne="' + lid + '"]'); if (ch && !ch.value) ch.focus();
          return;
        }
        var v = e.target.closest('[data-valider]');
        if (v) {
          var c = cmds.filter(function (x) { return x.id === Number(v.dataset.valider); })[0];
          if (!window.confirm('Valider la commande de ' + nomG(c.gourmet) + ' (' + prix(c.montant) + ') et lui envoyer le mail avec le montant à payer ?')) return;
          v.disabled = true;
          FJP.api('rpc/valider_pesee', { method: 'POST', body: { p_commande_id: c.id } }).then(function (r) {
            if (r.erreur) {
              v.disabled = false;
              FJP.toast({ campagne_ouverte: 'La campagne est encore ouverte : attendez la clôture.', pesee_incomplete: 'Il reste des articles à cocher.', deja_validee: 'Déjà validée.' }[r.erreur] || 'Erreur');
              return;
            }
            c.prete_le = r.prete_le; c.montant = r.montant;
            // passe à la commande suivante à préparer
            var suiv = cmds.filter(function (x) { return !x.prete_le && (filtrePoint === 'tous' || x.point_id === Number(filtrePoint)); })[0];
            ouvert = suiv ? suiv.id : null;
            dessiner();
            FJP.toast(FJP.esc(nomG(c.gourmet)) + ' : validée, mail envoyé');
          }).catch(function (err) { v.disabled = false; FJP.toast('Erreur : ' + esc(err.message)); });
          return;
        }
        var ro = e.target.closest('[data-rouvrir]');
        if (ro) {
          var cr = cmds.filter(function (x) { return x.id === Number(ro.dataset.rouvrir); })[0];
          if (!window.confirm('Annuler la validation de la commande de ' + nomG(cr.gourmet) + ' pour corriger ? Un nouveau mail partira quand vous la validerez à nouveau.')) return;
          FJP.api('rpc/rouvrir_pesee', { method: 'POST', body: { p_commande_id: cr.id } }).then(function (r) {
            if (r.erreur) { FJP.toast('Commande déjà payée : impossible de la corriger.'); return; }
            cr.prete_le = null; filtre = 'a_faire'; dessiner();
          }).catch(function (err) { FJP.toast('Erreur : ' + esc(err.message)); });
        }
      };
    });
  };
})();
