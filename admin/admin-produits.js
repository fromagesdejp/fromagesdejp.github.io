// Les Fromages Jean-Paul — espace de Jean-Paul : gestion des produits et des prix
(function () {
  'use strict';
  window.FJP_VUES = window.FJP_VUES || {};

  var LAITS = { vache: 'Vache', chevre: 'Chèvre', brebis: 'Brebis', melange: 'Mélange', porc: 'Porc (charcuterie)', aucun: 'Aucun (plat)' };
  var MODES = { coupe: 'À la coupe (prix au kg)', piece: 'Pièce à prix fixe', poids_variable: 'Pièce à poids variable (prix au kg)' };
  var ouvert = null;        // id du produit en cours de modification
  var nouveauOuvert = false;

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

    return Promise.all([
      api('categories?select=*&order=ordre,id'),
      api('produits?select=*&order=ordre,id'),
      cid ? api('offres?select=*,portions(*)&campagne_id=eq.' + cid) : Promise.resolve([]),
      api('reglages?id=eq.1&select=taux_transport_kg')
    ]).then(function (r) {
      var cats = r[0], produits = r[1], offres = r[2];
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

      function formFiche(pr, pfx) {
        pr = pr || { lait: 'vache', transport: true };
        return '<div class="grille2"><div class="champ"><label for="' + pfx + 'nom">Nom</label><input id="' + pfx + 'nom" value="' + esc(pr.nom || '') + '" required></div>' +
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
          nom: val(pfx + 'nom'), categorie_id: Number(val(pfx + 'cat')), description: val(pfx + 'desc') || null,
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

      function dessiner() {
        var h = '<section class="carte"><h1 style="font-size:22px">Produits et prix</h1>' +
          (campagne ? '<p style="margin:0;color:var(--texte-doux);font-size:14px">Prix de la campagne « ' + esc(campagne.nom) + ' ». Les commandes déjà passées gardent leur prix.</p>'
                    : '<p style="margin:0">Aucune campagne en cours : vous pouvez modifier les fiches des produits, les prix se règlent dans une campagne.</p>') +
          '<div class="actions" style="margin:12px 0 0"><button class="bouton second" type="button" data-nouveau>' + (nouveauOuvert ? 'Fermer' : '+ Nouveau produit') + '</button></div>';
        if (nouveauOuvert) {
          h += '<div style="margin-top:12px">' + formFiche(null, 'nv-') +
            (cid ? '<label style="display:flex;gap:8px;align-items:center;margin:0 0 12px"><input type="checkbox" id="nv-proposer" checked> Le proposer dans la campagne en cours</label>' : '') +
            '<button class="bouton" type="button" data-creer>Créer le produit</button></div>';
        }
        h += '</section>';

        cats.forEach(function (c) {
          var ps = produits.filter(function (p) { return p.categorie_id === c.id && p.actif; });
          if (!ps.length) return;
          h += '<section class="categorie"><h2>' + esc(c.nom) + '</h2><div class="liste">';
          ps.forEach(function (pr) {
            var o = offreDe[pr.id];
            var etat = !cid ? '' : (!o ? 'Pas proposé' : (o.retire ? 'Retiré' : 'Proposé'));
            h += '<div><div class="ligne" style="flex-wrap:wrap"><span class="txt"><b>' + esc(pr.nom) + '</b>' +
              '<small>' + esc(LAITS[pr.lait] || '') + (pr.transport ? '' : ' · prix net livré') + (cid && o ? '<br>' + esc(resume(pr, o)) : '') + '</small></span>' +
              (etat ? '<span class="pastille' + (etat === 'Proposé' ? ' discrete' : '') + '">' + etat + '</span>' : '') +
              '<span style="display:flex;gap:6px;width:100%;justify-content:flex-end">' +
              '<button class="btn clair" type="button" data-ouvrir-pr="' + pr.id + '">' + (ouvert === pr.id ? 'Fermer' : 'Modifier') + '</button>' +
              (cid ? '<button class="btn' + (etat === 'Proposé' ? ' rouge' : '') + '" type="button" data-proposer="' + pr.id + '">' + (etat === 'Proposé' ? 'Ne plus proposer' : 'Proposer') + '</button>' : '') +
              '</span></div>';
            if (ouvert === pr.id) {
              var pfx = 'pr' + pr.id + '-';
              h += '<div class="detail" style="padding-top:12px">' + formFiche(pr, pfx) +
                '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" data-fiche-enr="' + pr.id + '">Enregistrer la fiche</button>' +
                '<button class="btn rouge" type="button" data-archiver="' + pr.id + '">Retirer de la liste</button></div>';
              if (cid && o) {
                h += '<h3 style="margin:18px 0 4px;font-size:16px">Portions et prix de cette campagne</h3>';
                o.portions.forEach(function (po) { h += ligneportion(pr, po); });
                h += '<div class="carte" style="margin:8px 0;padding:12px;box-shadow:none;background:var(--canard-clair)">' +
                  '<div class="champ"><label for="aj' + pr.id + '-pkg">Ajouter les trois coupes (300 g, 500 g, 1 kg) au prix au kg de</label>' +
                  '<input id="aj' + pr.id + '-pkg" inputmode="decimal" placeholder="Ex. : 16,00"></div>' +
                  '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" data-ajout-coupes="' + pr.id + '">Ajouter 300 g / 500 g / 1 kg</button>' +
                  '<button class="btn clair" type="button" data-ajout-portion="' + pr.id + '">Ajouter une autre portion</button></div></div>' +
                  '<h3 style="margin:18px 0 4px;font-size:16px">Limites (facultatif)</h3>' +
                  '<div class="grille2"><div class="champ"><label for="of' + o.id + '-stock">Stock maximum (kg)</label><input id="of' + o.id + '-stock" inputmode="decimal" value="' + (o.stock_g ? String(o.stock_g / 1000).replace('.', ',') : '') + '"></div>' +
                  '<div class="champ"><label for="of' + o.id + '-min">Minimum de la ferme (kg)</label><input id="of' + o.id + '-min" inputmode="decimal" value="' + (o.minimum_g ? String(o.minimum_g / 1000).replace('.', ',') : '') + '"></div></div>' +
                  '<button class="btn clair" type="button" data-offre-enr="' + o.id + '">Enregistrer les limites</button>';
              } else if (cid) {
                h += '<p style="margin-top:14px">Pour régler les prix, proposez d’abord ce produit dans la campagne.</p>';
              }
              h += '</div>';
            }
            h += '</div>';
          });
          h += '</div></section>';
        });
        app.innerHTML = h;
      }

      function recharger(msg) {
        return Promise.all([
          api('produits?select=*&order=ordre,id'),
          cid ? api('offres?select=*,portions(*)&campagne_id=eq.' + cid) : Promise.resolve([])
        ]).then(function (r2) {
          produits = r2[0]; offres = r2[1]; offreDe = {};
          offres.forEach(function (o) { o.portions.sort(function (a, b) { return (a.ordre - b.ordre) || (a.id - b.id); }); offreDe[o.produit_id] = o; });
          dessiner(); if (msg) toast(msg);
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

      dessiner();
      app.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        var d = b.dataset;
        if (d.nouveau !== undefined) { nouveauOuvert = !nouveauOuvert; dessiner(); return; }
        if (d.creer !== undefined) {
          var fiche = lireFiche('nv-');
          if (!fiche.nom) { toast('Indiquez le nom du produit.'); return; }
          fiche.ordre = (produits.reduce(function (m, p) { return Math.max(m, p.ordre); }, 0) || 0) + 1;
          b.disabled = true;
          api('produits', { method: 'POST', body: fiche }).then(function (rp) {
            var pr = rp[0];
            if (cid && coche('nv-proposer')) return api('offres', { method: 'POST', body: { campagne_id: cid, produit_id: pr.id, ordre: pr.ordre } }).then(function () { return pr; });
            return pr;
          }).then(function (pr) { nouveauOuvert = false; ouvert = pr.id; return recharger('Produit créé : ajoutez maintenant ses portions et ses prix.'); })
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
          var base = of.portions.length;
          api('portions', { method: 'POST', body: [
            { offre_id: of.id, libelle: '300 g', mode: 'coupe', poids_g: 300, prix_kg: pk, ordre: base + 1 },
            { offre_id: of.id, libelle: '500 g', mode: 'coupe', poids_g: 500, prix_kg: pk, ordre: base + 2 },
            { offre_id: of.id, libelle: '1 kg', mode: 'coupe', poids_g: 1000, prix_kg: pk, ordre: base + 3 }
          ] }).then(function () { return recharger('Coupes ajoutées'); }).catch(echec);
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
