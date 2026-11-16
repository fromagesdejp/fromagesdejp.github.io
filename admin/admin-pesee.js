// Les Fromages Jean-Paul — espace de Jean-Paul : pesée des fromages et validation des commandes
// Après la clôture, JP indique le poids réel de chaque morceau « à la coupe ».
// Quand toute la commande d'un gourmet est pesée, il la valide : le montant devient
// définitif et le gourmet reçoit un seul mail (fromages arrivés + lieu + montant + IBAN).
(function () {
  'use strict';
  window.FJP_VUES = window.FJP_VUES || {};

  var STYLE = [
    '.pe-ligne { padding: 10px 0; border-top: 1px solid #EEF1F2; }',
    '.pe-ligne:first-child { border-top: 0; }',
    '.pe-tete { display: flex; gap: 8px; align-items: baseline; }',
    '.pe-tete span { flex-grow: 1; }',
    '.pe-tete small { display: block; color: var(--texte-doux); font-size: 13px; }',
    '.pe-poids { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }',
    '.pe-poids label { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--texte-doux); }',
    '.pe-poids input { width: 92px; font-size: 18px; padding: 8px 10px; border: 1.5px solid var(--bord); border-radius: 10px; font-family: inherit; text-align: right; }',
    '.pe-poids input:focus { outline: none; border-color: var(--canard); box-shadow: 0 0 0 3px var(--canard-clair); }',
    '.pe-total { display: flex; justify-content: space-between; align-items: baseline; margin: 12px 0; padding-top: 10px; border-top: 2px solid #EEF1F2; font-size: 17px; }',
    '.pe-total b { font-size: 22px; }',
    '.pe-ok { color: #1E7A46; font-weight: 700; }',
    '.pe-fixe { font-size: 12px; color: var(--texte-doux); }'
  ].join(' ');
  if (!document.getElementById('style-pesee')) {
    var st = document.createElement('style'); st.id = 'style-pesee'; st.textContent = STYLE; document.head.appendChild(st);
  }

  var filtre = 'a_faire';   // 'a_faire' | 'validees' | 'toutes'
  var filtrePoint = 'tous';

  function grammes(g) { return g >= 1000 ? (g / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 }) + ' kg' : g + ' g'; }

  window.FJP_VUES.pesee = function () {
    var FJP = window.FJP, esc = FJP.esc, prix = FJP.prix, app = FJP.app, nomG = FJP.nomG;
    var campagne = FJP.campagne(), points = FJP.points();
    if (!campagne) { app.innerHTML = '<div class="carte"><h1>Aucune campagne en cours</h1></div>'; return; }

    return FJP.api('commandes?select=id,reference,montant,paye,prete_le,point_id,' +
      'gourmet:gourmets(prenom,nom),' +
      'lignes(id,quantite,prix_unitaire,poids_g,poids_reels,prix_final,retiree,portion:portions(libelle,mode,ordre,offre:offres(ordre,produit:produits(nom))))' +
      '&campagne_id=eq.' + campagne.id + '&statut=eq.validee').then(function (cmds) {
      var ouvert = null; // commande dépliée
      cmds.forEach(function (c) {
        c.lignes.sort(function (a, b) { return (a.portion.offre.ordre - b.portion.offre.ordre) || (a.portion.ordre - b.portion.ordre); });
      });
      cmds.sort(function (a, b) {
        return (a.point_id - b.point_id) || String(a.gourmet.nom).localeCompare(String(b.gourmet.nom));
      });
      function aPeser(c) { return c.lignes.filter(function (l) { return !l.retiree && l.portion.mode === 'coupe'; }); }
      function nbPesees(c) { return aPeser(c).filter(function (l) { return l.poids_reels && l.poids_reels.length; }).length; }
      function ville(id) { var p = points.filter(function (x) { return x.id === id; })[0]; return p ? p.ville : ''; }

      function etat(c) {
        if (c.prete_le) return '<span class="pastille" style="background:#DFF3E7;color:#1E7A46">Validée' + (c.paye ? ' · payée' : '') + '</span>';
        var n = aPeser(c).length, k = nbPesees(c);
        if (!n) return '<span class="pastille discrete">Prix fixes, à valider</span>';
        return '<span class="pastille' + (k ? '' : ' discrete') + '">' + (k ? 'Pesé ' + k + '/' + n : 'À peser') + '</span>';
      }

      function dessiner() {
        var restent = cmds.filter(function (c) { return !c.prete_le; }).length;
        var h = '';
        if (campagne.statut === 'ouverte' || campagne.statut === 'preparation') {
          h += '<p class="bandeau attention" style="margin:16px">La pesée se fait après la clôture, quand les fromages sont arrivés. Les commandes peuvent encore changer.</p>';
        }
        h += '<section class="carte"><h1 style="font-size:20px;margin:0 0 4px">Pesée et validation</h1>' +
          '<p style="margin:0;color:var(--texte-doux);font-size:14px">Indiquez le poids de chaque morceau à la coupe, puis validez la commande : le gourmet reçoit un mail avec le lieu, l’heure et le montant exact à payer.</p>' +
          '<p style="margin:10px 0 0;font-weight:700">' + (restent ? restent + ' commande' + (restent > 1 ? 's' : '') + ' à valider sur ' + cmds.length : (cmds.length ? 'Toutes les commandes sont validées !' : 'Aucune commande.')) + '</p></section>';

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
          h += '<div><button type="button" class="ligne" data-ouvrir="' + c.id + '" aria-expanded="' + (ouvert === c.id) + '" style="width:100%;background:none;border:none;text-align:left;cursor:pointer;color:inherit;font:inherit">' +
            '<span class="txt"><b>' + esc(nomG(c.gourmet)) + '</b><small>' + esc(ville(c.point_id)) + ' · ' + esc(c.reference || '') + '</small></span>' +
            etat(c) + '<span class="mt">' + prix(c.montant) + '</span></button>';
          if (ouvert === c.id) h += detail(c);
          h += '</div>';
        });
        h += '</div>';
        app.innerHTML = h;
        var premier = app.querySelector('.pe-poids input:not([disabled])');
        if (premier && !premier.value) premier.focus();
      }

      function detail(c) {
        var bloque = !!c.prete_le;
        var h = '<div class="detail">';
        c.lignes.forEach(function (l) {
          var nom = l.portion.offre.produit.nom + ', ' + l.portion.libelle;
          var estime = l.quantite * l.prix_unitaire;
          var coupe = l.portion.mode === 'coupe';
          h += '<div class="pe-ligne"' + (l.retiree ? ' style="opacity:.5;text-decoration:line-through"' : '') + '><div class="pe-tete"><span>' + l.quantite + ' × ' + esc(nom) +
            '<small>' + (coupe ? 'Estimé ' + prix(estime) : '<span class="pe-fixe">Prix fixe</span>') + (l.retiree ? ' · retiré' : '') + '</small></span>' +
            '<b id="prix-' + l.id + '">' + (coupe && l.prix_final != null ? prix(l.prix_final) : (coupe ? '—' : prix(estime))) + '</b></div>';
          if (coupe && !l.retiree) {
            h += '<div class="pe-poids">';
            for (var i = 0; i < l.quantite; i++) {
              var v = l.poids_reels && l.poids_reels[i] ? l.poids_reels[i] : '';
              h += '<label>' + (l.quantite > 1 ? 'Morceau ' + (i + 1) : 'Poids') +
                '<input type="number" inputmode="numeric" min="1" max="20000" step="1" data-ligne="' + l.id + '" data-i="' + i + '" value="' + v + '" placeholder="' + l.poids_g + '"' +
                (bloque ? ' disabled' : '') + ' aria-label="Poids en grammes : ' + esc(nom) + (l.quantite > 1 ? ', morceau ' + (i + 1) : '') + '"> g</label>';
            }
            h += '</div>';
          }
          h += '</div>';
        });
        h += '<div class="pe-total"><span>' + (c.prete_le ? 'Montant définitif' : 'Montant') + '</span><b id="total-' + c.id + '">' + prix(c.montant) + '</b></div>';
        if (c.prete_le) {
          h += '<p class="pe-ok" style="margin:0 0 10px">✓ Validée, mail envoyé au gourmet' + (c.paye ? ' · payée' : '') + '</p>';
          if (!c.paye) h += '<button class="btn clair" type="button" data-rouvrir="' + c.id + '">Corriger (annuler la validation)</button>';
        } else {
          var manque = aPeser(c).length - nbPesees(c);
          h += '<button class="bouton" type="button" data-valider="' + c.id + '"' + (manque ? ' disabled' : '') + '>' +
            (manque ? 'Encore ' + manque + ' produit' + (manque > 1 ? 's' : '') + ' à peser' : 'Valider et envoyer le montant à ' + esc(c.gourmet.prenom)) + '</button>';
        }
        h += '</div>';
        return h;
      }

      function trouverLigne(id) {
        for (var i = 0; i < cmds.length; i++) {
          for (var j = 0; j < cmds[i].lignes.length; j++) if (cmds[i].lignes[j].id === id) return { c: cmds[i], l: cmds[i].lignes[j] };
        }
        return null;
      }

      // Enregistre les poids d'une ligne quand tous ses morceaux sont remplis (ou tous vidés)
      function enregistrer(ligneId) {
        var t = trouverLigne(ligneId); if (!t) return;
        var champs = app.querySelectorAll('input[data-ligne="' + ligneId + '"]');
        var vals = Array.prototype.map.call(champs, function (x) { return Math.round(Number(x.value)) || 0; });
        var pleins = vals.filter(function (v) { return v > 0; }).length;
        if (pleins && pleins < vals.length) return; // on attend les autres morceaux
        var poids = pleins ? vals : null;
        if (JSON.stringify(poids) === JSON.stringify(t.l.poids_reels || null)) return;
        FJP.api('rpc/peser', { method: 'POST', body: { p_ligne_id: ligneId, p_poids: poids } }).then(function (r) {
          if (r.erreur) {
            FJP.toast({ poids_invalides: 'Poids incorrect (en grammes, entre 1 et 20 000).', deja_validee: 'Commande déjà validée.', prix_fixe: 'Ce produit a un prix fixe.' }[r.erreur] || 'Erreur');
            return;
          }
          t.l.poids_reels = poids; t.l.prix_final = r.prix_final; t.c.montant = r.montant;
          var p = document.getElementById('prix-' + ligneId); if (p) p.textContent = r.prix_final != null ? prix(r.prix_final) : '—';
          var tot = document.getElementById('total-' + t.c.id); if (tot) tot.textContent = prix(r.montant);
          var b = app.querySelector('[data-valider="' + t.c.id + '"]');
          var manque = aPeser(t.c).length - nbPesees(t.c);
          if (b) { b.disabled = !!manque; b.textContent = manque ? 'Encore ' + manque + ' produit' + (manque > 1 ? 's' : '') + ' à peser' : 'Valider et envoyer le montant à ' + t.c.gourmet.prenom; }
          var ligneBtn = app.querySelector('[data-ouvrir="' + t.c.id + '"]');
          if (ligneBtn) { ligneBtn.querySelector('.mt').textContent = prix(r.montant); var pa = ligneBtn.querySelector('.pastille'); if (pa) pa.outerHTML = etat(t.c); }
        }).catch(function (e) { FJP.toast('Erreur : ' + esc(e.message)); });
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
        var tous = Array.prototype.slice.call(app.querySelectorAll('.pe-poids input:not([disabled])'));
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
        var v = e.target.closest('[data-valider]');
        if (v) {
          var c = cmds.filter(function (x) { return x.id === Number(v.dataset.valider); })[0];
          if (!window.confirm('Valider la commande de ' + nomG(c.gourmet) + ' (' + prix(c.montant) + ') et lui envoyer le mail avec le montant à payer ?')) return;
          v.disabled = true;
          FJP.api('rpc/valider_pesee', { method: 'POST', body: { p_commande_id: c.id } }).then(function (r) {
            if (r.erreur) {
              v.disabled = false;
              FJP.toast({ campagne_ouverte: 'La campagne est encore ouverte : attendez la clôture.', pesee_incomplete: 'Il reste des produits à peser.', deja_validee: 'Déjà validée.' }[r.erreur] || 'Erreur');
              return;
            }
            c.prete_le = r.prete_le; c.montant = r.montant;
            // passe à la commande suivante à valider
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
          if (!window.confirm('Annuler la validation de la commande de ' + nomG(cr.gourmet) + ' pour corriger les poids ? Un nouveau mail partira quand vous la validerez à nouveau.')) return;
          FJP.api('rpc/rouvrir_pesee', { method: 'POST', body: { p_commande_id: cr.id } }).then(function (r) {
            if (r.erreur) { FJP.toast('Commande déjà payée : impossible de la corriger.'); return; }
            cr.prete_le = null; filtre = 'a_faire'; dessiner();
          }).catch(function (err) { FJP.toast('Erreur : ' + esc(err.message)); });
        }
      };
    });
  };
})();
