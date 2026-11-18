// Les Fromages Jean-Paul — espace de Jean-Paul : campagnes
(function () {
  'use strict';
  window.FJP_VUES = window.FJP_VUES || {};

  var STATUTS = { preparation: 'En préparation', ouverte: 'Ouverte', cloturee: 'Clôturée', terminee: 'Terminée' };
  var choisie = null;   // id de la campagne affichée
  var nouvelleOuverte = false;

  // ---- Dates à l'heure de Paris ----
  function partsParis(d) {
    var o = {};
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    return o;
  }
  function versChamp(iso) {          // ISO -> valeur d'un champ date et heure (heure de Paris)
    if (!iso) return '';
    var p = partsParis(new Date(iso));
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
  }
  function depuisChamp(v) {          // valeur d'un champ (heure de Paris) -> ISO
    if (!v) return null;
    var m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    var voulu = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
    var t = voulu;
    for (var i = 0; i < 2; i++) {
      var p = partsParis(new Date(t));
      var vu = Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute);
      t += voulu - vu;
    }
    return new Date(t).toISOString();
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  function vueCampagnes() {
    var F = window.FJP, api = F.api, esc = F.esc, toast = F.toast, app = F.app;

    return Promise.all([
      api('campagnes?select=*,points_livraison(*),commandes(count)&order=cloture.desc'),
      api('gourmets?select=id,prenom,nom&actif=eq.true&order=nom,prenom'),
      api('fermes?select=*&order=ordre,id')
    ]).then(function (rr) {
      var camps = rr[0], gourmets = rr[1], fermes = rr[2];
      function nomFerme(id) { var f = fermes.filter(function (x) { return x.id === id; })[0]; return f ? f.nom : ''; }
      var plusieursFermes = fermes.filter(function (f) { return f.actif; }).length > 1 || camps.some(function (c) { return c.ferme_id !== (camps[0] || {}).ferme_id; });
      var nvFerme = null; // ferme choisie pour la nouvelle campagne
      var choixOuvert = false;
      camps.forEach(function (c) { c.points_livraison.sort(function (a, b) { return (a.ordre - b.ordre) || (a.id - b.id); }); });
      var courante = F.campagne();
      if (!choisie || !camps.some(function (c) { return c.id === choisie; })) choisie = courante ? courante.id : (camps[0] && camps[0].id);

      function dessiner() {
        var c = camps.filter(function (x) { return x.id === choisie; })[0];
        var h = '<div class="filtres" style="margin-top:16px">';
        camps.forEach(function (x) {
          h += '<button type="button" data-choisir="' + x.id + '" aria-pressed="' + (x.id === choisie) + '">' + (plusieursFermes ? esc(nomFerme(x.ferme_id)) + ' — ' : '') + esc(x.nom) + ' · ' + esc(STATUTS[x.statut]) + '</button>';
        });
        h += '<button type="button" data-nouvelle>' + (nouvelleOuverte ? 'Fermer' : '+ Préparer une nouvelle campagne') + '</button></div>';

        if (nouvelleOuverte) {
          var cSel = camps.filter(function (x) { return x.id === choisie; })[0];
          if (!nvFerme) nvFerme = cSel ? cSel.ferme_id : (fermes[0] || {}).id;
          var sources = camps.filter(function (x) { return x.ferme_id === nvFerme; });
          var autres = camps.filter(function (x) { return x.ferme_id !== nvFerme; });
          h += '<section class="carte"><h1 style="font-size:20px">Nouvelle campagne</h1>' +
            '<p style="font-size:14px;color:var(--texte-doux)">Chaque ferme a ses propres campagnes (dates, livraison, produits). La nouvelle campagne reprend les points de livraison et le message de la campagne copiée, et ses produits et prix si elle est de la même ferme. Elle reste invisible pour les gourmets jusqu’à son ouverture.</p>' +
            '<div class="champ"><label for="nv-ferme">Ferme</label><select id="nv-ferme">' +
            fermes.filter(function (f) { return f.actif; }).map(function (f) { return '<option value="' + f.id + '"' + (f.id === nvFerme ? ' selected' : '') + '>' + esc(f.nom) + '</option>'; }).join('') + '</select></div>' +
            '<div class="champ"><label for="nv-source">Copier la campagne</label><select id="nv-source">' +
            sources.map(function (x, i) { return '<option value="' + x.id + '"' + (i === 0 ? ' selected' : '') + '>' + esc(x.nom) + ' (produits et prix repris)</option>'; }).join('') +
            autres.map(function (x) { return '<option value="' + x.id + '">' + esc(nomFerme(x.ferme_id)) + ' — ' + esc(x.nom) + ' (points et message seulement)</option>'; }).join('') +
            '<option value=""' + (sources.length ? '' : ' selected') + '>Aucune : partir de zéro</option></select></div>' +
            '<div class="champ"><label for="nv-nom">Nom</label><input id="nv-nom" placeholder="Ex. : Commande de printemps 2027"></div>' +
            '<div class="grille2"><div class="champ"><label for="nv-ouv">Ouverture automatique</label><input id="nv-ouv" type="datetime-local"></div>' +
            '<div class="champ"><label for="nv-clo">Fin de commande</label><input id="nv-clo" type="datetime-local"></div></div>' +
            '<div class="champ"><label for="nv-livr">Livraison</label><input id="nv-livr" type="date"></div>' +
            '<button class="bouton" type="button" data-creer-camp>Préparer cette campagne</button></section>';
        }

        if (!c) { app.innerHTML = h + '<div class="carte"><p>Aucune campagne.</p></div>'; return; }
        var nb = (c.commandes && c.commandes[0] && c.commandes[0].count) || 0;
        h += '<section class="carte"><div style="display:flex;gap:8px;align-items:center"><h1 style="flex-grow:1;font-size:22px">' + esc(c.nom) + '</h1>' +
          '<span class="pastille discrete">' + esc(STATUTS[c.statut]) + '</span></div>' +
          (plusieursFermes ? '<p style="margin:0;font-weight:800;color:var(--canard)">' + esc(nomFerme(c.ferme_id)) + '</p>' : '') +
          '<p style="margin:0 0 12px;font-size:14px;color:var(--texte-doux)">' + nb + ' commande(s) enregistrée(s)</p>' +
          '<div class="champ"><label for="c-nom">Nom</label><input id="c-nom" value="' + esc(c.nom) + '"></div>' +
          '<div class="champ"><label for="c-msg">Message d’accueil (affiché en haut du bon de commande)</label><textarea id="c-msg" rows="4">' + esc(c.message || '') + '</textarea></div>' +
          '<div class="grille2"><div class="champ"><label for="c-ouv">Ouverture automatique</label><input id="c-ouv" type="datetime-local" value="' + versChamp(c.ouverture) + '"></div>' +
          '<div class="champ"><label for="c-clo">Fin de commande</label><input id="c-clo" type="datetime-local" value="' + versChamp(c.cloture) + '"></div></div>' +
          '<div class="grille2"><div class="champ"><label for="c-livr">Livraison</label><input id="c-livr" type="date" value="' + esc(c.livraison || '') + '"></div>' +
          '<div class="champ"><label for="c-proch">Prochaine commande (facultatif)</label><input id="c-proch" type="date" value="' + esc(c.prochaine_commande || '') + '"></div></div>' +
          '<button class="bouton" type="button" data-enr-camp="' + c.id + '">Enregistrer</button>' +
          '<p style="font-size:13px;color:var(--texte-doux);margin:8px 0 0">Heures de Paris. La campagne s’ouvre et se ferme toute seule à ces heures.</p></section>';

        // Points de livraison
        h += '<section class="carte"><h2 style="margin:0 0 10px;font-size:18px">Points de livraison</h2>';
        c.points_livraison.forEach(function (p) {
          var x = 'pt' + p.id + '-';
          h += '<div class="carte" style="margin:8px 0;padding:12px;box-shadow:none;border:1px solid #E2E8EA">' +
            '<div class="grille2"><div class="champ"><label for="' + x + 'ville">Ville</label><input id="' + x + 'ville" value="' + esc(p.ville) + '"></div>' +
            '<div class="champ"><label for="' + x + 'heure">Heure</label><input id="' + x + 'heure" value="' + esc(p.heure || '') + '" placeholder="Ex. : 18 h"></div></div>' +
            '<div class="champ"><label for="' + x + 'lieu">Lieu</label><input id="' + x + 'lieu" value="' + esc(p.lieu || '') + '"></div>' +
            '<div class="champ"><label for="' + x + 'date">Date, si différente de la livraison</label><input id="' + x + 'date" type="date" value="' + esc(p.date_livraison || '') + '"></div>' +
            '<div style="display:flex;gap:8px"><button class="btn" type="button" data-enr-pt="' + p.id + '">Enregistrer</button>' +
            '<button class="btn rouge" type="button" data-sup-pt="' + p.id + '">Supprimer</button></div></div>';
        });
        h += '<button class="btn clair" type="button" data-ajout-pt="' + c.id + '">+ Ajouter un point de livraison</button></section>';

        // Destinataires des mails (ouverture et rappels)
        var exclus = c.exclus || [];
        var nbInvites = gourmets.filter(function (g) { return exclus.indexOf(g.id) < 0; }).length;
        var tous = nbInvites === gourmets.length;
        h += '<section class="carte"><h2 style="margin:0 0 6px;font-size:18px">Gourmets qui reçoivent les mails</h2>' +
          '<p style="margin:0 0 10px;font-size:14px;color:var(--texte-doux)">Mail d’ouverture et rappels de cette campagne : <b style="color:var(--texte)">' + nbInvites + ' gourmet' + (nbInvites > 1 ? 's' : '') + ' sur ' + gourmets.length + '</b>.</p>' +
          '<label style="display:flex;gap:10px;align-items:center;font-weight:700;font-size:16px;padding:8px 0;cursor:pointer"><input type="checkbox" id="dest-tous" style="width:22px;height:22px"' + (tous ? ' checked' : '') + '> Envoyer à tout le monde</label>' +
          '<details id="dest-choix"' + (choixOuvert || !tous ? ' open' : '') + '><summary style="cursor:pointer;color:var(--canard);font-weight:700;padding:6px 0">Choisir les gourmets (décocher ceux qui ne doivent pas recevoir les mails)</summary>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:2px 12px;margin-top:6px">' +
          gourmets.map(function (g) {
            return '<label style="display:flex;gap:8px;align-items:center;padding:6px 0;cursor:pointer"><input type="checkbox" data-dest="' + g.id + '" style="width:20px;height:20px"' + (exclus.indexOf(g.id) < 0 ? ' checked' : '') + '> ' + esc(g.prenom + ' ' + String(g.nom || '').toUpperCase()) + '</label>';
          }).join('') + '</div></details></section>';

        // Statut
        h += '<section class="carte"><h2 style="margin:0 0 10px;font-size:18px">Statut</h2><div class="actions" style="margin:0">';
        if (c.statut === 'preparation') h += '<button class="bouton" type="button" data-statut="ouverte">Ouvrir maintenant</button>';
        if (c.statut === 'ouverte') h += '<button class="bouton second" type="button" data-statut="cloturee">Clôturer maintenant</button>';
        if (c.statut === 'cloturee') h += '<button class="bouton second" type="button" data-statut="ouverte">Rouvrir (penser à repousser la fin de commande)</button>' +
          '<button class="bouton" type="button" data-statut="terminee">Terminer (tout est livré et payé)</button>';
        if (c.statut === 'terminee') h += '<p style="margin:0">Campagne archivée.</p>';
        h += '</div></section>';
        app.innerHTML = h;
      }

      function recharger(msg) {
        return F.recharger ? F.recharger(msg) : Promise.resolve();
      }
      function echec(e) {
        var m = e.message || '';
        if (/une_campagne_ouverte_par_ferme|une_seule_campagne_ouverte|duplicate/i.test(m)) m = 'Une autre campagne de cette ferme est déjà ouverte : clôturez-la d’abord.';
        else if (/foreign key/i.test(m)) m = 'Impossible : des commandes utilisent ce point de livraison.';
        else if (/check/i.test(m)) m = 'Vérifiez les dates : l’ouverture doit être avant la fin de commande.';
        toast('Erreur : ' + esc(m));
      }

      dessiner();
      // Cocher / décocher les destinataires : enregistré tout de suite
      app.onchange = function (e) {
        if (e.target.id === 'nv-ferme') {
          var garde = { nom: val('nv-nom'), ouv: val('nv-ouv'), clo: val('nv-clo'), livr: val('nv-livr') };
          nvFerme = Number(e.target.value); dessiner();
          document.getElementById('nv-nom').value = garde.nom; document.getElementById('nv-ouv').value = garde.ouv;
          document.getElementById('nv-clo').value = garde.clo; document.getElementById('nv-livr').value = garde.livr;
          return;
        }
        var c3 = camps.filter(function (y) { return y.id === choisie; })[0];
        if (!c3) return;
        var nouv = null;
        if (e.target.id === 'dest-tous') {
          nouv = e.target.checked ? [] : gourmets.map(function (g) { return g.id; });
          choixOuvert = !e.target.checked;
        } else if (e.target.dataset && e.target.dataset.dest) {
          nouv = Array.prototype.filter.call(app.querySelectorAll('[data-dest]'), function (x) { return !x.checked; }).map(function (x) { return x.dataset.dest; });
          choixOuvert = true;
        }
        if (!nouv) return;
        api('campagnes?id=eq.' + c3.id, { method: 'PATCH', body: { exclus: nouv } }).then(function () {
          c3.exclus = nouv; var y = window.scrollY; dessiner(); window.scrollTo(0, y); toast('Destinataires enregistrés');
        }).catch(echec);
      };
      app.onclick = function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var d = b.dataset;
        if (d.choisir) { choisie = Number(d.choisir); nouvelleOuverte = false; dessiner(); return; }
        if (d.nouvelle !== undefined) { nouvelleOuverte = !nouvelleOuverte; dessiner(); return; }
        if (d.creerCamp !== undefined) {
          var nom = val('nv-nom'), clo = depuisChamp(val('nv-clo'));
          if (!nom || !clo) { toast('Indiquez au moins le nom et la fin de commande.'); return; }
          b.disabled = true;
          api('rpc/dupliquer_campagne', { method: 'POST', body: {
            p_source: val('nv-source') ? Number(val('nv-source')) : null, p_ferme_id: Number(val('nv-ferme')) || null, p_nom: nom, p_ouverture: depuisChamp(val('nv-ouv')), p_cloture: clo, p_livraison: val('nv-livr') || null
          } }).then(function (id) { choisie = id; nouvelleOuverte = false; nvFerme = null; try { localStorage.setItem('fjp_campagne', String(id)); } catch (e2) {} return recharger('Campagne préparée : vérifiez les produits et les prix dans « Produits ».'); })
            .catch(function (er) { b.disabled = false; echec(er); });
          return;
        }
        if (d.enrCamp) {
          var corps = { nom: val('c-nom'), message: val('c-msg') || null, ouverture: depuisChamp(val('c-ouv')), cloture: depuisChamp(val('c-clo')),
            livraison: val('c-livr') || null, prochaine_commande: val('c-proch') || null };
          if (!corps.nom || !corps.cloture) { toast('Le nom et la fin de commande sont obligatoires.'); return; }
          api('campagnes?id=eq.' + d.enrCamp, { method: 'PATCH', body: corps }).then(function () { return recharger('Campagne enregistrée'); }).catch(echec);
          return;
        }
        if (d.enrPt) {
          var x = 'pt' + d.enrPt + '-';
          api('points_livraison?id=eq.' + d.enrPt, { method: 'PATCH', body: { ville: val(x + 'ville'), lieu: val(x + 'lieu') || null, heure: val(x + 'heure') || null, date_livraison: val(x + 'date') || null } })
            .then(function () { return recharger('Point de livraison enregistré'); }).catch(echec);
          return;
        }
        if (d.supPt) {
          if (!window.confirm('Supprimer ce point de livraison ?')) return;
          api('points_livraison?id=eq.' + d.supPt, { method: 'DELETE' }).then(function () { return recharger('Point supprimé'); }).catch(echec);
          return;
        }
        if (d.ajoutPt) {
          var c = camps.filter(function (y) { return y.id === Number(d.ajoutPt); })[0];
          api('points_livraison', { method: 'POST', body: { campagne_id: c.id, ville: 'Nouvelle ville', ordre: c.points_livraison.length + 1 } })
            .then(function () { return recharger('Point ajouté : indiquez la ville, le lieu et l’heure.'); }).catch(echec);
          return;
        }
        if (d.statut) {
          var c2 = camps.filter(function (y) { return y.id === choisie; })[0];
          var textes = { ouverte: 'Ouvrir « ' + c2.nom + ' » ? Les gourmets pourront commander.', cloturee: 'Clôturer « ' + c2.nom + ' » maintenant ? Les gourmets ne pourront plus commander.',
            terminee: 'Terminer « ' + c2.nom + ' » ? Elle sera archivée.' };
          if (!window.confirm(textes[d.statut])) return;
          var corps2 = { statut: d.statut };
          if (d.statut === 'cloturee') corps2.cloture = new Date().toISOString();
          if (d.statut === 'ouverte' && new Date(c2.cloture) <= new Date()) { toast('Repoussez d’abord la fin de commande, puis enregistrez.'); return; }
          if (d.statut === 'ouverte' && (!c2.ouverture || new Date(c2.ouverture) > new Date())) corps2.ouverture = new Date().toISOString();
          api('campagnes?id=eq.' + c2.id, { method: 'PATCH', body: corps2 }).then(function () { return recharger('Statut mis à jour'); }).catch(echec);
        }
      };
    });
  }

  window.FJP_VUES.campagnes = vueCampagnes;
})();
