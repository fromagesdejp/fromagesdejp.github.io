// Les Fromages Jean-Paul — espace de Jean-Paul : gestion des produits et des prix
(function () {
  'use strict';
  window.FJP_VUES = window.FJP_VUES || {};

  var LAITS = { vache: 'Vache', chevre: 'Chèvre', brebis: 'Brebis', melange: 'Mélange', porc: 'Porc (charcuterie)', aucun: 'Aucun (plat)' };
  var MODES = { coupe: 'À la coupe (prix au kg)', piece: 'Pièce à prix fixe', poids_variable: 'Pièce à poids variable (prix au kg)' };
  // Morceaux à la coupe possibles : 300 g, 500 g, puis de 500 g en 500 g jusqu'à 2 kg
  var COUPES = [[300, '300 g'], [500, '500 g'], [1000, '1 kg'], [1500, '1,5 kg'], [2000, '2 kg']];
  function coupeValide(g) { return g === 300 || (g >= 500 && g <= 2000 && g % 500 === 0); }
  var ouvert = null;        // id du produit en cours de modification
  var nouveauOuvert = false;
  var fermesOuvert = false; // outil « Fermes » déplié
  var filtreFerme = 'toutes';

  function num(v) { var n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function coche(id) { var e = document.getElementById(id); return !!(e && e.checked); }
  function options(obj, choisi) {
    return Object.keys(obj).map(function (k) { return '<option value="' + k + '"' + (k === choisi ? ' selected' : '') + '>' + obj[k] + '</option>'; }).join('');
  }

  function vueProduits() {
    var F = window.FJP, api = F.api, esc = F.esc, prix = F.prix, toast = F.toast, app = F.app;
    var campagne = F.campagne();
    var cid = campagne ? campagne.id : null;
    var fermeCamp = campagne ? campagne.ferme_id : null;
    // Au changement de campagne, on montre d'abord les produits de sa ferme
    if (fermeCamp && vueProduits.derniere !== cid) { filtreFerme = String(fermeCamp); vueProduits.derniere = cid; }

    return Promise.all([
      api('categories?select=*&order=ordre,id'),
      api('produits?select=*&order=ordre,id'),
      cid ? api('offres?select=*,portions(*)&campagne_id=eq.' + cid) : Promise.resolve([]),
      api('reglages?id=eq.1&select=taux_transport_kg'),
      api('fermes?select=*&order=ordre,id')
    ]).then(function (r) {
      var cats = r[0], produits = r[1], offres = r[2], fermes = r[4];
      function fermesActives() { return fermes.filter(function (f) { return f.actif; }); }
      // Lait habituel d'une ferme (ex. chèvre pour la Ferme de la Treille) : pictogramme proposé pour ses nouveaux produits
      function laitDeFerme(id) {
        var f = fermes.filter(function (x) { return x.id === id; })[0];
        if (f && f.lait && LAITS[f.lait]) return f.lait;
        var compte = {};
        produits.forEach(function (p) { if (p.actif && p.ferme_id === id) compte[p.lait] = (compte[p.lait] || 0) + 1; });
        var mieux = Object.keys(compte).sort(function (a, b) { return compte[b] - compte[a]; })[0];
        return mieux || 'vache';
      }
      // Rubrique proposée : la plus utilisée par la ferme, sinon celle de son lait (ex. « Chèvre »)
      var MOTS_LAIT = { chevre: /ch[eè]vre/i, brebis: /brebis/i, porc: /cochon|charcut/i, aucun: /plat/i };
      function rubriqueDeFerme(id) {
        var compte = {};
        produits.forEach(function (p) { if (p.actif && p.ferme_id === id) compte[p.categorie_id] = (compte[p.categorie_id] || 0) + 1; });
        var mieux = Object.keys(compte).sort(function (a, b) { return compte[b] - compte[a]; })[0];
        if (mieux) return Number(mieux);
        var mot = MOTS_LAIT[laitDeFerme(id)];
        var c = mot && cats.filter(function (x) { return mot.test(x.nom); })[0];
        return c ? c.id : undefined;
      }
      function nomFerme(id) { var f = fermes.filter(function (x) { return x.id === id; })[0]; return f ? f.nom : ''; }
      // Fermes qui ont des produits (ou qui sont actives), dans l'ordre choisi
      function fermesAMontrer() {
        return fermes.filter(function (f) { return f.actif || produits.some(function (p) { return p.actif && p.ferme_id === f.id; }); });
      }
      var taux = campagne && campagne.taux_transport_kg != null ? Number(campagne.taux_transport_kg) : Number((r[3][0] || {}).taux_transport_kg || 0);
      var offreDe = {};
      offres.forEach(function (o) { o.portions.sort(function (a, b) { return (a.ordre - b.ordre) || (a.id - b.id); }); offreDe[o.produit_id] = o; });

      function prixFinal(pr, po) {
        var base = po.prix_piece != null ? Number(po.prix_piece) : Number(po.prix_kg || 0) * po.poids_g / 1000;
        if (pr.transport) base += taux * po.poids_g / 1000;
        return Math.round(base * 100) / 100;
      }
      function resume(pr, o) {
        if (!o || !o.portions.length) return 'Aucune portion';
        return o.portions.map(function (po) { return po.libelle + ' ' + prix(prixFinal(pr, po)); }).join(' · ');
      }
      // Coupes manquantes d'un produit (pour le bouton « Ajouter les coupes »)
      function coupesManquantes(o) {
        var deja = {};
        o.portions.forEach(function (po) { if (po.mode === 'coupe') deja[po.poids_g] = po; });
        return COUPES.filter(function (c) { return !deja[c[0]]; });
      }
      function prixKgCoupes(o) {
        var c = o.portions.filter(function (po) { return po.mode === 'coupe' && po.prix_kg != null; })[0];
        return c ? String(c.prix_kg).replace('.', ',') : '';
      }

      function formFiche(pr, pfx) {
        if (!pr) {
          var fid = filtreFerme !== 'toutes' ? Number(filtreFerme) : (fermeCamp || (fermesActives()[0] || {}).id);
          pr = { lait: laitDeFerme(fid), transport: true, ferme_id: fid, categorie_id: rubriqueDeFerme(fid) };
        }
        var choixFermes = fermes.filter(function (f) { return f.actif || f.id === pr.ferme_id; });
        return '<div class="champ"><label for="' + pfx + 'ferme">Ferme</label><select id="' + pfx + 'ferme">' +
          choixFermes.map(function (f) { return '<option value="' + f.id + '"' + (f.id === pr.ferme_id ? ' selected' : '') + '>' + esc(f.nom) + '</option>'; }).join('') + '</select></div>' +
          '<div class="grille2"><div class="champ"><label for="' + pfx + 'nom">Nom</label><input id="' + pfx + 'nom" value="' + esc(pr.nom || '') + '" required></div>' +
          '<div class="champ"><label for="' + pfx + 'cat">Rubrique</label><select id="' + pfx + 'cat">' +
          cats.map(function (c) { return '<option value="' + c.id + '"' + (c.id === pr.categorie_id ? ' selected' : '') + '>' + esc(c.nom) + '</option>'; }).join('') + '</select></div></div>' +
          '<div class="champ"><label for="' + pfx + 'desc">Description courte</label><input id="' + pfx + 'desc" value="' + esc(pr.description || '') + '" placeholder="Ex. : 2 mois d’affinage"></div>' +
          '<div class="grille2"><div class="champ"><label for="' + pfx + 'lait">Lait / type</label><select id="' + pfx + 'lait">' + options(LAITS, pr.lait) + '</select></div>' +
          '<div class="champ"><label for="' + pfx + 'cru">Lait cru ?</label><select id="' + pfx + 'cru">' +
          '<option value=""' + (pr.lait_cru == null ? ' selected' : '') + '>Non précisé</option><option value="oui"' + (pr.lait_cru === true ? ' selected' : '') + '>Lait cru</option>' +
          '<option value="non"' + (pr.lait_cru === false ? ' selected' : '') + '>Lait pasteurisé</option></select></div></div>' +
          '<div class="champ"><label for="' + pfx + 'aop">Appellation (facultatif)</label><input id="' + pfx + 'aop" value="' + esc(pr.aop || '') + '" placeholder="AOP, AOC…"></div>' +
          '<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" id="' + pfx + 'transport"' + (pr.transport ? ' checked' : '') + '> Supplément transport au poids (sinon « prix net livré »)</label>' +
          '<label style="display:flex;gap:8px;align-items:center;margin:6px 0 12px"><input type="checkbox" id="' + pfx + 'sidispo"' + (pr.si_disponible ? ' checked' : '') + '> Afficher « si disponible »</label>';
      }
      function lireFiche(pfx) {
        var cru = val(pfx + 'cru');
        return {
          nom: val(pfx + 'nom'), ferme_id: Number(val(pfx + 'ferme')) || null, categorie_id: Number(val(pfx + 'cat')), description: val(pfx + 'desc') || null,
          lait: val(pfx + 'lait'), aop: val(pfx + 'aop') || null, lait_cru: cru === 'oui' ? true : (cru === 'non' ? false : null),
          transport: coche(pfx + 'transport'), si_disponible: coche(pfx + 'sidispo')
        };
      }

      function ligneportion(pr, po) {
        var p = 'po' + po.id + '-';
        return '<div class="carte" style="margin:8px 0;padding:12px;box-shadow:none;border:1px solid #E2E8EA">' +
          '<div class="grille2"><div class="champ"><label for="' + p + 'lib">Libellé</label><input id="' + p + 'lib" value="' + esc(po.libelle) + '"></div>' +
          '<div class="champ"><label for="' + p + 'mode">Vente</label><select id="' + p + 'mode">' + options(MODES, po.mode) + '</select></div></div>' +
          '<div class="grille2" style="grid-template-columns:repeat(3,minmax(0,1fr))">' +
          '<div class="champ"><label for="' + p + 'poids">Poids (g)</label><input id="' + p + 'poids" type="number" min="1" value="' + po.poids_g + '"></div>' +
          '<div class="champ"><label for="' + p + 'pkg">Prix au kg</label><input id="' + p + 'pkg" inputmode="decimal" value="' + (po.prix_kg != null ? String(po.prix_kg).replace('.', ',') : '') + '"></div>' +
          '<div class="champ"><label for="' + p + 'ppc">Prix pièce</label><input id="' + p + 'ppc" inputmode="decimal" value="' + (po.prix_piece != null ? String(po.prix_piece).replace('.', ',') : '') + '"></div></div>' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="flex-grow:1;font-size:14px">Prix affiché aux gourmets : <b>' + prix(prixFinal(pr, po)) + '</b></span>' +
          '<button class="btn" type="button" data-po-enr="' + po.id + '">Enregistrer</button>' +
          '<button class="btn rouge" type="button" data-po-sup="' + po.id + '">Supprimer</button></div></div>';
      }

      // Fermes dont les produits sont dans la liste PDF de la campagne
      function fermesPdf() {
        var l = fermes.filter(function (f) { return produits.some(function (p) { var o = offreDe[p.id]; return p.actif && p.ferme_id === f.id && o && !o.retire && o.portions.length; }); });
        if (!l.length && fermeCamp) l = fermes.filter(function (f) { return f.id === fermeCamp; });
        return l;
      }
      function titrePdf() {
        var l = fermesPdf();
        return l.length === 1 ? 'Liste Produits — ' + l[0].nom + ' (PDF)' : 'Tous les produits (PDF)';
      }
      function dessiner() {
        var h = (cid ? '<div style="margin:16px 16px 0"><button class="bouton" type="button" data-pdf style="width:100%;font-size:18px;padding:16px;display:flex;align-items:center;justify-content:center;gap:10px">' +
            '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M12 12v6M9 15l3 3 3-3"/></svg>' +
            esc(titrePdf()) + '</button></div>' : '') +
          '<section class="carte"><h1 style="font-size:22px">Produits et prix</h1>' +
          (campagne ? '<p style="margin:0;color:var(--texte-doux);font-size:14px">Prix de la campagne « ' + esc(campagne.nom) + ' »' + (fermes.length > 1 ? ' (' + esc(nomFerme(fermeCamp)) + ')' : '') + '. Les commandes déjà passées gardent leur prix.</p>'
                    : '<p style="margin:0">Aucune campagne en cours : vous pouvez modifier les fiches des produits, les prix se règlent dans une campagne.</p>') +
          '<div class="actions" style="margin:12px 0 0"><button class="bouton second" type="button" data-nouveau>' + (nouveauOuvert ? 'Fermer' : '+ Nouveau produit') + '</button>' +
            '</div>' +
            (cid ? '<p style="margin:8px 0 0;font-size:13px;color:var(--texte-doux)">' + 'La liste PDF se met à jour toute seule à chaque changement de produit ou de prix : c’est elle qui est jointe aux mails, et les gourmets peuvent la télécharger depuis leur bon de commande. Le bouton « Liste Produits » la télécharge sur votre téléphone.' + '</p>' : '');
        if (nouveauOuvert) {
          h += '<div style="margin-top:12px">' + formFiche(null, 'nv-') +
            (cid ? '<label style="display:flex;gap:8px;align-items:center;margin:0 0 12px"><input type="checkbox" id="nv-proposer" checked> Le proposer tout de suite dans la campagne en cours de sa ferme</label>' : '') +
            '<button class="bouton" type="button" data-creer>Créer le produit</button></div>';
        }
        h += '</section>';

        // ---------- Les fermes (ajouter, renommer, ranger, mettre de côté) ----------
        h += '<details class="carte" id="zone-fermes"' + (fermesOuvert ? ' open' : '') + '><summary style="font-weight:800;font-size:17px;cursor:pointer">Les fermes (' + fermesActives().length + ')</summary>' +
          '<p style="margin:8px 0;font-size:14px;color:var(--texte-doux)">Chaque produit appartient à une ferme. Le bon des gourmets, les commandes et le bon de commande sont séparés ferme par ferme.</p>';
        fermes.forEach(function (f, i) {
          var nb = produits.filter(function (p) { return p.actif && p.ferme_id === f.id; }).length;
          h += '<div class="carte" style="margin:8px 0;padding:12px;box-shadow:none;border:1px solid #E2E8EA' + (f.actif ? '' : ';opacity:.6') + '">' +
            '<div class="champ"><label for="fe' + f.id + '-nom">Nom de la ferme' + (f.actif ? '' : ' (mise de côté)') + '</label><input id="fe' + f.id + '-nom" value="' + esc(f.nom) + '"></div>' +
            '<div class="champ"><label for="fe' + f.id + '-lait">Lait habituel (pictogramme des nouveaux produits)</label><select id="fe' + f.id + '-lait">' + options(LAITS, f.lait || laitDeFerme(f.id)) + '</select></div>' +
            '<div class="champ"><label for="fe' + f.id + '-contact">Coordonnées (facultatif, en haut de son bon)</label><textarea id="fe' + f.id + '-contact" rows="2" style="width:100%;font:inherit">' + esc(f.contact || '') + '</textarea></div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span style="flex-grow:1;font-size:14px;color:var(--texte-doux)">' + nb + ' produit' + (nb > 1 ? 's' : '') + '</span>' +
            (i > 0 ? '<button class="btn clair petit" type="button" data-fe-monter="' + f.id + '" aria-label="Monter ' + esc(f.nom) + '">↑</button>' : '') +
            (i < fermes.length - 1 ? '<button class="btn clair petit" type="button" data-fe-descendre="' + f.id + '" aria-label="Descendre ' + esc(f.nom) + '">↓</button>' : '') +
            '<button class="btn" type="button" data-fe-enr="' + f.id + '">Enregistrer</button>' +
            '<button class="btn ' + (f.actif ? 'rouge' : 'clair') + '" type="button" data-fe-actif="' + f.id + '">' + (f.actif ? 'Mettre de côté' : 'Reprendre') + '</button></div></div>';
        });
        h += '<div class="carte" style="margin:8px 0;padding:12px;box-shadow:none;background:var(--canard-clair)">' +
          '<div class="champ"><label for="fe-nouvelle">Ajouter une ferme</label><input id="fe-nouvelle" placeholder="Ex. : Ferme des Tilleuls"></div>' +
          '<button class="btn" type="button" data-fe-ajout>+ Ajouter la ferme</button></div></details>';

        var montrees = fermesAMontrer();
        if (montrees.length > 1) {
          h += '<div class="filtres"><button type="button" data-filtre-ferme="toutes" aria-pressed="' + (filtreFerme === 'toutes') + '">Toutes les fermes</button>' +
            montrees.map(function (f) { return '<button type="button" data-filtre-ferme="' + f.id + '" aria-pressed="' + (String(filtreFerme) === String(f.id)) + '">' + esc(f.nom) + '</button>'; }).join('') + '</div>';
        }

        montrees.forEach(function (fe) {
         if (filtreFerme !== 'toutes' && Number(filtreFerme) !== fe.id) return;
         var dansFerme = produits.filter(function (p) { return p.actif && p.ferme_id === fe.id; });
         if (montrees.length > 1) h += '<div class="ferme-tete" style="margin:22px 12px 4px;padding:10px 14px;border-radius:14px;background:var(--fromage-clair,#FFF1D6);border-left:6px solid var(--fromage,#F5A623)"><h2 style="margin:0;font-size:20px">' + esc(fe.nom) + '</h2></div>';
         if (!dansFerme.length) {
           h += '<p class="avis" style="margin:8px 16px">Aucun produit pour l’instant. Touchez « + Nouveau produit » et choisissez « ' + esc(fe.nom) + ' ».</p>';
           return;
         }
         cats.forEach(function (c) {
          var ps = dansFerme.filter(function (p) { return p.categorie_id === c.id; });
          if (!ps.length) return;
          h += '<section class="categorie"><h2>' + esc(c.nom) + '</h2><div class="liste">';
          ps.forEach(function (pr) {
            var o = offreDe[pr.id];
            var autreFerme = cid && pr.ferme_id !== fermeCamp && !o;
            var etat = !cid || autreFerme ? '' : (!o ? 'Pas proposé' : (o.retire ? 'Retiré' : 'Proposé'));
            h += '<div><div class="ligne" style="flex-wrap:wrap">' +
              (PICTOS[pr.lait] ? '<img src="../images/lait-' + PICTOS[pr.lait] + '.png" alt="" width="36" height="36" style="border-radius:9px;background:#E3F4F5;flex-shrink:0">' : '') +
              '<span class="txt"><b>' + esc(pr.nom) + '</b>' +
              '<small>' + esc(LAITS[pr.lait] || '') + (pr.transport ? '' : ' · prix net livré') + (cid && o ? '<br>' + esc(resume(pr, o)) : '') + '</small></span>' +
              (etat ? '<span class="pastille' + (etat === 'Proposé' ? ' discrete' : '') + '">' + etat + '</span>' : '') +
              '<span style="display:flex;gap:6px;width:100%;justify-content:flex-end">' +
              '<button class="btn clair" type="button" data-ouvrir-pr="' + pr.id + '">' + (ouvert === pr.id ? 'Fermer' : 'Modifier') + '</button>' +
              (cid && !autreFerme ? '<button class="btn' + (etat === 'Proposé' ? ' rouge' : '') + '" type="button" data-proposer="' + pr.id + '">' + (etat === 'Proposé' ? 'Ne plus proposer' : 'Proposer') + '</button>' : '') +
              '</span></div>';
            if (ouvert === pr.id) {
              var pfx = 'pr' + pr.id + '-';
              h += '<div class="detail" style="padding-top:12px">' + formFiche(pr, pfx) +
                '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" data-fiche-enr="' + pr.id + '">Enregistrer la fiche</button>' +
                '<button class="btn rouge" type="button" data-archiver="' + pr.id + '">Retirer de la liste</button></div>';
              if (cid && o) {
                h += '<h3 style="margin:18px 0 4px;font-size:16px">Portions et prix de cette campagne</h3>';
                o.portions.forEach(function (po) { h += ligneportion(pr, po); });
                var manque = coupesManquantes(o);
                var libs = manque.map(function (c) { return c[1]; }).join(' / ');
                h += '<div class="carte" style="margin:8px 0;padding:12px;box-shadow:none;background:var(--canard-clair)">' +
                  (manque.length
                    ? '<div class="champ"><label for="aj' + pr.id + '-pkg">Ajouter les coupes ' + esc(libs) + ' au prix au kg de</label>' +
                      '<input id="aj' + pr.id + '-pkg" inputmode="decimal" placeholder="Ex. : 16,00" value="' + esc(prixKgCoupes(o)) + '"></div>'
                    : '<p style="margin:0 0 8px;font-size:14px">Toutes les coupes sont proposées (300 g, 500 g, 1 kg, 1,5 kg, 2 kg).</p>') +
                  '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                  (manque.length ? '<button class="btn" type="button" data-ajout-coupes="' + pr.id + '">Ajouter ' + esc(libs) + '</button>' : '') +
                  '<button class="btn clair" type="button" data-ajout-portion="' + pr.id + '">Ajouter une autre portion</button></div></div>' +
                  '<h3 style="margin:18px 0 4px;font-size:16px">Limites (facultatif)</h3>' +
                  '<div class="grille2"><div class="champ"><label for="of' + o.id + '-stock">Stock maximum (kg)</label><input id="of' + o.id + '-stock" inputmode="decimal" value="' + (o.stock_g ? String(o.stock_g / 1000).replace('.', ',') : '') + '"></div>' +
                  '<div class="champ"><label for="of' + o.id + '-min">Minimum de la ferme (kg)</label><input id="of' + o.id + '-min" inputmode="decimal" value="' + (o.minimum_g ? String(o.minimum_g / 1000).replace('.', ',') : '') + '"></div></div>' +
                  '<button class="btn clair" type="button" data-offre-enr="' + o.id + '">Enregistrer les limites</button>';
              } else if (cid && pr.ferme_id !== fermeCamp) {
                h += '<p style="margin-top:14px">Ce produit vient de la ' + esc(nomFerme(pr.ferme_id)) + ' : ses prix se règlent dans une campagne de cette ferme (choisissez-la en haut de l’écran, ou créez-la dans « Campagnes »).</p>';
              } else if (cid) {
                h += '<p style="margin-top:14px">Pour régler les prix, proposez d’abord ce produit dans la campagne.</p>';
              }
              h += '</div>';
            }
            h += '</div>';
          });
          h += '</div></section>';
         });
        });
        app.innerHTML = h;
        // Nouveau produit : en changeant de ferme, le lait habituel de cette ferme est proposé
        var nvF = document.getElementById('nv-ferme'), nvL = document.getElementById('nv-lait');
        if (nvF && nvL) nvF.onchange = function () {
          nvL.value = laitDeFerme(Number(nvF.value));
          var rub = rubriqueDeFerme(Number(nvF.value)), nvC = document.getElementById('nv-cat');
          if (rub && nvC) nvC.value = String(rub);
        };
        var zf = document.getElementById('zone-fermes');
        if (zf) zf.ontoggle = function () { fermesOuvert = zf.open; };
      }

      function recharger(msg) {
        return Promise.all([
          api('produits?select=*&order=ordre,id'),
          cid ? api('offres?select=*,portions(*)&campagne_id=eq.' + cid) : Promise.resolve([]),
          api('fermes?select=*&order=ordre,id')
        ]).then(function (r2) {
          produits = r2[0]; offres = r2[1]; fermes = r2[2]; offreDe = {};
          offres.forEach(function (o) { o.portions.sort(function (a, b) { return (a.ordre - b.ordre) || (a.id - b.id); }); offreDe[o.produit_id] = o; });
          dessiner(); if (msg) toast(msg);
          pdfAuto();
        });
      }
      function echec(e) {
        var m = e.message || '';
        if (/foreign key|violates/i.test(m)) m = 'Impossible : cette portion a déjà été commandée. Modifiez-la plutôt que de la supprimer.';
        else if (/check constraint/i.test(m)) m = 'Valeur incorrecte : vérifiez le poids et le prix (prix au kg ou prix pièce obligatoire).';
        toast('Erreur : ' + esc(m));
      }
      function prDe(id) { return produits.filter(function (p) { return p.id === Number(id); })[0]; }
      function lirePortion(id) {
        var p = 'po' + id + '-';
        var mode = val(p + 'mode');
        var pkg = num(val(p + 'pkg') || 'x'), ppc = num(val(p + 'ppc') || 'x');
        return { libelle: val(p + 'lib'), mode: mode, poids_g: Math.round(num(val(p + 'poids')) || 0),
          prix_kg: val(p + 'pkg') ? pkg : null, prix_piece: mode === 'piece' && val(p + 'ppc') ? ppc : null };
      }

      // ---------- PDF de la liste des produits (joint au mail d'ouverture) ----------
      var PICTOS = { vache: 'vache', chevre: 'chevre', brebis: 'brebis', porc: 'porc', melange: 'vache', aucun: 'plat' };
      function dateFr(iso, heure) {
        if (!iso) return '';
        var o = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' };
        if (heure) { o.hour = 'numeric'; o.minute = '2-digit'; }
        return new Intl.DateTimeFormat('fr-FR', o).format(new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso));
      }
      function htmlPdf() {
        var h = '<div style="font-family:Nunito,Arial,sans-serif;color:#12313F;width:720px;padding:24px;background:#fff">' +
          '<div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #F5A623;padding-bottom:12px">' +
          '<img src="../images/logo.png" style="width:56px;height:56px"><div><div style="font-size:24px;font-weight:800;color:#0B6E78">Les Fromages Jean-Paul</div>' +
          '<div style="font-size:15px">' + esc(campagne.nom) + (fermesPdf().length === 1 ? ' · <b>' + esc(fermesPdf()[0].nom) + '</b>' : '') + '</div></div></div>' +
          '<p style="font-size:14px;margin:12px 0">Fin de commande : <b>' + esc(dateFr(campagne.cloture, true)) + '</b>' + (campagne.livraison ? ' · Livraison : <b>' + esc(dateFr(campagne.livraison)) + '</b>' : '') + '<br>' +
          'Prix transport compris. Fromages à la coupe : prix estimé, calculé au poids réel à l’arrivée. Sous réserve de disponibilité.</p>';
        var proposes = produits.filter(function (p) { var o = offreDe[p.id]; return p.actif && o && !o.retire && o.portions.length; });
        var fPdf = fermes.filter(function (f) { return proposes.some(function (p) { return p.ferme_id === f.id; }); });
        fPdf.forEach(function (fe) {
         if (fPdf.length > 1) h += '<div style="font-size:21px;font-weight:800;color:#12313F;margin:22px 0 4px;padding:6px 12px;background:#FDF0D5;border-radius:10px;page-break-after:avoid">' + esc(fe.nom) + '</div>';
         cats.forEach(function (c) {
          var ps = proposes.filter(function (p) { return p.ferme_id === fe.id && p.categorie_id === c.id; });
          if (!ps.length) return;
          h += '<div style="font-size:18px;font-weight:800;color:#0B6E78;margin:16px 0 6px;page-break-after:avoid">' + esc(c.nom) + '</div>';
          ps.forEach(function (pr) {
            var o = offreDe[pr.id];
            var img = PICTOS[pr.lait] ? '../images/lait-' + PICTOS[pr.lait] + '.png' : '';
            var infos = [pr.description, pr.aop, pr.lait_cru === true ? 'lait cru' : (pr.lait_cru === false ? 'lait pasteurisé' : '')].filter(Boolean).join(' · ');
            h += '<div style="display:flex;gap:12px;border:1px solid #E2E8EA;border-radius:12px;padding:10px;margin-bottom:8px;page-break-inside:avoid">' +
              (img ? '<img src="' + img + '" style="width:48px;height:48px;border-radius:10px;background:#E3F4F5">' : '<div style="width:48px"></div>') +
              '<div style="flex-grow:1"><div style="font-weight:800;font-size:15px">' + esc(pr.nom) + (pr.si_disponible ? ' <span style="font-weight:600;font-size:12px;color:#8A5A00">(si disponible)</span>' : '') + '</div>' +
              (infos ? '<div style="font-size:12px;color:#3D5560">' + esc(infos) + '</div>' : '') +
              '<table style="width:100%;font-size:13px;margin-top:4px;border-collapse:collapse">' +
              o.portions.map(function (po) {
                return '<tr><td style="padding:2px 0">' + esc(po.libelle) + (po.mode === 'coupe' && po.prix_kg ? ' <span style="color:#3D5560">(' + esc(prix(po.prix_kg)) + ' le kg)</span>' : '') + '</td>' +
                  '<td style="text-align:right;font-weight:700;white-space:nowrap">' + (po.mode === 'coupe' ? '≈ ' : '') + esc(prix(prixFinal(pr, po))) + '</td></tr>';
              }).join('') + '</table></div></div>';
          });
         });
        });
        h += '<p style="font-size:12px;color:#3D5560;margin-top:14px">Paiement par virement, quand Jean-Paul vous aura envoyé le montant exact.</p></div>';
        return h;
      }
      function chargerLib() {
        if (window.html2pdf) return Promise.resolve();
        return new Promise(function (ok, ko) {
          var sc = document.createElement('script');
          sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          sc.onload = ok; sc.onerror = function () { ko(new Error('outil PDF introuvable (Internet ?)')); };
          document.head.appendChild(sc);
        });
      }
      // silencieux = mise à jour automatique : pas de téléchargement, pas de message, l'écran ne bouge pas
      function creerPdf(silencieux) {
        var C = window.CONFIG, sess = {};
        try { sess = JSON.parse(localStorage.getItem('fjp_admin') || '{}'); } catch (e) {}
        var nom = 'liste-' + cid + '.pdf';
        var boite = document.createElement('div');
        boite.style.cssText = 'position:fixed;left:-10000px;top:0';
        boite.innerHTML = htmlPdf();
        document.body.appendChild(boite);
        return chargerLib().then(function () {
          return window.html2pdf().set({ margin: 8, filename: 'Liste des fromages.pdf', image: { type: 'jpeg', quality: 0.9 },
            html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4' }, pagebreak: { mode: ['css', 'legacy'] } })
            .from(boite.firstChild).outputPdf('blob');
        }).then(function (blob) {
          // Téléchargement immédiat sur l'appareil (sauf mise à jour automatique)
          if (!silencieux) {
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (fermesPdf().length === 1 ? 'Liste des fromages - ' + fermesPdf()[0].nom : 'Liste de tous les fromages') + '.pdf';
          document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
          }
          // (l'appel à la base renouvelle la connexion si besoin, avant l'envoi du fichier)
          return api('campagnes?id=eq.' + cid + '&select=id').then(function () {
            try { sess = JSON.parse(localStorage.getItem('fjp_admin') || '{}'); } catch (e) {}
            return fetch(C.supabaseUrl + '/storage/v1/object/documents/' + nom, {
              method: 'POST', headers: { 'apikey': C.supabaseKey, 'Authorization': 'Bearer ' + sess.access_token, 'Content-Type': 'application/pdf', 'x-upsert': 'true' }, body: blob
            });
          });
        }).then(function (r) {
          if (!r.ok) return r.text().then(function (t) { throw new Error('envoi du PDF refusé (' + r.status + ') ' + t.slice(0, 80)); });
          var url = C.supabaseUrl + '/storage/v1/object/public/documents/' + nom + '?v=' + Date.now();
          return api('campagnes?id=eq.' + cid, { method: 'PATCH', body: { pdf_url: url } }).then(function () {
            campagne.pdf_url = url;
            try { localStorage.setItem('fjp_pdf_' + cid, empreinte(htmlPdf())); } catch (e) {}
            if (!silencieux) { dessiner(); toast('Liste téléchargée (et jointe au mail d’ouverture)'); }
          });
        }).catch(function (e) { if (!silencieux) { toast('Erreur : ' + esc(e.message)); dessiner(); } })
          .then(function () { boite.remove(); });
      }

      // PDF automatique : dès que la liste (produits, portions, prix) change, la version jointe aux mails
      // est refaite en arrière-plan, pour les campagnes en préparation ou ouvertes.
      function empreinte(t) {
        var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
        return String(h);
      }
      var minuteurPdf = null, pdfEnCours = null;
      function pdfAuto() {
        if (!cid || !campagne || (campagne.statut !== 'preparation' && campagne.statut !== 'ouverte')) return;
        clearTimeout(minuteurPdf);
        minuteurPdf = setTimeout(function () {
          if (pdfEnCours) { pdfEnCours.then(pdfAuto); return; }
          var dernier = null;
          try { dernier = localStorage.getItem('fjp_pdf_' + cid); } catch (e) {}
          if (campagne.pdf_url && dernier === empreinte(htmlPdf())) return;
          pdfEnCours = creerPdf(true).then(function () { pdfEnCours = null; });
        }, 3000);
      }

      dessiner();
      pdfAuto();
      app.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        var d = b.dataset;
        if (d.nouveau !== undefined) { nouveauOuvert = !nouveauOuvert; dessiner(); return; }
        if (d.filtreFerme) { filtreFerme = d.filtreFerme; dessiner(); return; }
        if (d.feAjout !== undefined) {
          var nomF = val('fe-nouvelle');
          if (!nomF) { toast('Indiquez le nom de la ferme.'); return; }
          if (fermes.some(function (f) { return f.nom.toLowerCase() === nomF.toLowerCase(); })) { toast('Cette ferme existe déjà.'); return; }
          b.disabled = true;
          api('fermes', { method: 'POST', body: { nom: nomF, ordre: fermes.reduce(function (m, f) { return Math.max(m, f.ordre); }, 0) + 1 } })
            .then(function () { fermesOuvert = true; return recharger('Ferme ajoutée : « ' + esc(nomF) + ' »'); }).catch(function (er) { b.disabled = false; echec(er); });
          return;
        }
        if (d.feEnr) {
          var nomE = val('fe' + d.feEnr + '-nom');
          if (!nomE) { toast('Indiquez le nom de la ferme.'); return; }
          api('fermes?id=eq.' + d.feEnr, { method: 'PATCH', body: Object.assign({ nom: nomE, contact: val('fe' + d.feEnr + '-contact') || null }, ('lait' in (fermes.filter(function (f) { return f.id === Number(d.feEnr); })[0] || {})) ? { lait: val('fe' + d.feEnr + '-lait') || null } : {}) })
            .then(function () { return recharger('Ferme enregistrée'); }).catch(echec);
          return;
        }
        if (d.feActif) {
          var fa = fermes.filter(function (f) { return f.id === Number(d.feActif); })[0];
          if (fa.actif && fermesActives().length < 2) { toast('Il faut garder au moins une ferme.'); return; }
          var nbA = produits.filter(function (p) { return p.actif && p.ferme_id === fa.id; }).length;
          if (fa.actif && !window.confirm('Mettre de côté « ' + fa.nom + ' » ?' + (nbA ? ' Ses ' + nbA + ' produits restent dans la liste : ne les proposez plus si elle ne livre plus.' : '') + ' Vous pourrez la reprendre plus tard.')) return;
          api('fermes?id=eq.' + fa.id, { method: 'PATCH', body: { actif: !fa.actif } })
            .then(function () { return recharger(fa.actif ? 'Ferme mise de côté' : 'Ferme reprise'); }).catch(echec);
          return;
        }
        if (d.feMonter || d.feDescendre) {
          var idF = Number(d.feMonter || d.feDescendre), iF = fermes.map(function (f) { return f.id; }).indexOf(idF);
          var jF = d.feMonter ? iF - 1 : iF + 1;
          if (jF < 0 || jF >= fermes.length) return;
          var ord = fermes.map(function (f) { return f.id; });
          var t = ord[iF]; ord[iF] = ord[jF]; ord[jF] = t;
          Promise.all(ord.map(function (id, k) { return api('fermes?id=eq.' + id, { method: 'PATCH', body: { ordre: k + 1 } }); }))
            .then(function () { return recharger('Ordre des fermes enregistré'); }).catch(echec);
          return;
        }
        if (d.pdf !== undefined) { b.disabled = true; b.lastChild.textContent = 'Préparation du PDF…'; creerPdf(); return; }
        if (d.creer !== undefined) {
          var fiche = lireFiche('nv-');
          if (!fiche.nom) { toast('Indiquez le nom du produit.'); return; }
          fiche.ordre = (produits.reduce(function (m, p) { return Math.max(m, p.ordre); }, 0) || 0) + 1;
          b.disabled = true;
          // Campagne où le proposer : celle choisie si c'est la même ferme, sinon la campagne en cours de sa ferme
          var cible = null;
          if (cid && coche('nv-proposer')) {
            if (fiche.ferme_id === fermeCamp) cible = campagne;
            else cible = (F.campagnes ? F.campagnes() : []).filter(function (c) { return c.ferme_id === fiche.ferme_id; })[0] || null;
          }
          api('produits', { method: 'POST', body: fiche }).then(function (rp) {
            var pr = rp[0];
            if (cible) return api('offres', { method: 'POST', body: { campagne_id: cible.id, produit_id: pr.id, ordre: pr.ordre } }).then(function () { return pr; });
            return pr;
          }).then(function (pr) {
            nouveauOuvert = false; ouvert = pr.id;
            if (cible && cible.id !== cid) {
              // on passe sur la campagne de sa ferme pour régler tout de suite ses portions et ses prix
              try { localStorage.setItem('fjp_campagne', String(cible.id)); } catch (e2) {}
              vueProduits.derniere = null;
              F.aller('produits');
              toast('Produit créé et proposé dans « ' + esc(cible.nom) + ' » : ajoutez maintenant ses portions et ses prix.');
              return;
            }
            return recharger(cible ? 'Produit créé : ajoutez maintenant ses portions et ses prix.'
              : (cid && pr.ferme_id !== fermeCamp ? 'Produit créé. Pour le proposer, créez d’abord une campagne de la ' + esc(nomFerme(pr.ferme_id)) + ' dans « Campagnes ».' : 'Produit créé.'));
          })
            .catch(function (er) { b.disabled = false; echec(er); });
          return;
        }
        if (d.ouvrirPr) { ouvert = ouvert === Number(d.ouvrirPr) ? null : Number(d.ouvrirPr); dessiner(); return; }
        if (d.ficheEnr) {
          var f = lireFiche('pr' + d.ficheEnr + '-');
          if (!f.nom) { toast('Indiquez le nom du produit.'); return; }
          api('produits?id=eq.' + d.ficheEnr, { method: 'PATCH', body: f }).then(function () { return recharger('Fiche enregistrée'); }).catch(echec);
          return;
        }
        if (d.archiver) {
          var pa = prDe(d.archiver);
          if (!window.confirm('Retirer « ' + pa.nom + ' » de la liste des produits ? Il ne sera plus proposé, mais l’historique des commandes est conservé.')) return;
          var o0 = offreDe[pa.id];
          (o0 && !o0.retire ? api('offres?id=eq.' + o0.id, { method: 'PATCH', body: { retire: true } }) : Promise.resolve())
            .then(function () { return api('produits?id=eq.' + pa.id, { method: 'PATCH', body: { actif: false } }); })
            .then(function () { ouvert = null; return recharger('Produit retiré de la liste'); }).catch(echec);
          return;
        }
        if (d.proposer) {
          var pr2 = prDe(d.proposer), o = offreDe[pr2.id];
          if (!o) {
            api('offres', { method: 'POST', body: { campagne_id: cid, produit_id: pr2.id, ordre: pr2.ordre } })
              .then(function () { ouvert = pr2.id; return recharger('Produit proposé : vérifiez ses portions et ses prix.'); }).catch(echec);
          } else if (o.retire) {
            api('offres?id=eq.' + o.id, { method: 'PATCH', body: { retire: false } }).then(function () { return recharger('Produit de nouveau proposé'); }).catch(echec);
          } else {
            var ids = o.portions.map(function (p) { return p.id; });
            if (!window.confirm('Ne plus proposer « ' + pr2.nom + ' » ? Il disparaîtra du bon de commande, et il sera retiré des commandes déjà passées (leurs montants seront recalculés).')) return;
            api('offres?id=eq.' + o.id, { method: 'PATCH', body: { retire: true } })
              .then(function () { return ids.length ? api('lignes?portion_id=in.(' + ids.join(',') + ')', { method: 'PATCH', body: { retiree: true } }) : null; })
              .then(function () { return recharger('Produit retiré de la campagne'); }).catch(echec);
          }
          return;
        }
        if (d.poEnr) {
          var corps = lirePortion(d.poEnr);
          if (!corps.libelle || !corps.poids_g) { toast('Indiquez le libellé et le poids.'); return; }
          if (corps.mode === 'coupe' && !coupeValide(corps.poids_g)) {
            toast('À la coupe : 300 g, 500 g, puis de 500 g en 500 g jusqu’à 2 kg (1 000, 1 500 ou 2 000 g).'); return;
          }
          api('portions?id=eq.' + d.poEnr, { method: 'PATCH', body: corps }).then(function () { return recharger('Portion enregistrée'); }).catch(echec);
          return;
        }
        if (d.poSup) {
          if (!window.confirm('Supprimer cette portion ?')) return;
          api('portions?id=eq.' + d.poSup, { method: 'DELETE' }).then(function () { return recharger('Portion supprimée'); }).catch(echec);
          return;
        }
        if (d.ajoutCoupes) {
          var pk = num(val('aj' + d.ajoutCoupes + '-pkg') || 'x');
          if (!pk) { toast('Indiquez le prix au kg.'); return; }
          var of = offreDe[Number(d.ajoutCoupes)];
          var base = of.portions.reduce(function (m, po) { return Math.max(m, po.ordre || 0); }, 0);
          var nouvelles = coupesManquantes(of).map(function (c, i) {
            return { offre_id: of.id, libelle: c[1], mode: 'coupe', poids_g: c[0], prix_kg: pk, ordre: base + i + 1 };
          });
          if (!nouvelles.length) return;
          api('portions', { method: 'POST', body: nouvelles }).then(function () { return recharger('Coupes ajoutées'); }).catch(echec);
          return;
        }
        if (d.ajoutPortion) {
          var of2 = offreDe[Number(d.ajoutPortion)];
          api('portions', { method: 'POST', body: { offre_id: of2.id, libelle: 'La pièce', mode: 'piece', poids_g: 500, prix_piece: 0, ordre: of2.portions.length + 1 } })
            .then(function () { return recharger('Portion ajoutée : réglez son libellé, son poids et son prix.'); }).catch(echec);
          return;
        }
        if (d.offreEnr) {
          var s = val('of' + d.offreEnr + '-stock'), m = val('of' + d.offreEnr + '-min');
          api('offres?id=eq.' + d.offreEnr, { method: 'PATCH', body: {
            stock_g: s ? Math.round(num(s) * 1000) || null : null, minimum_g: m ? Math.round(num(m) * 1000) || null : null
          } }).then(function () { return recharger('Limites enregistrées'); }).catch(echec);
        }
      };
    });
  }

  window.FJP_VUES.produits = vueProduits;
})();
