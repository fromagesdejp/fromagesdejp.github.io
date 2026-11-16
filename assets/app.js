// Les Fromages Jean-Paul — bon de commande en ligne des gourmets
(function () {
  'use strict';

  var C = window.CONFIG;
  var app = document.getElementById('app');
  var bonjour = document.getElementById('bonjour');

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
  function jourLong(d) {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(d);
  }
  function heure(d) {
    var p = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone: TZ, hourCycle: 'h23' }).formatToParts(d);
    var h = '', m = '';
    p.forEach(function (x) { if (x.type === 'hour') h = x.value; if (x.type === 'minute') m = x.value; });
    return Number(h) + ' h' + (m && m !== '00' ? ' ' + m : '');
  }
  function dateSimple(iso) { return iso ? jourLong(new Date(iso + 'T12:00:00Z')) : ''; }
  function resteAvant(d) {
    var ms = d - new Date();
    if (ms <= 0) return 'C’est terminé';
    var h = Math.floor(ms / 3600000);
    if (h < 1) return 'Il reste moins d’une heure';
    if (h < 24) return 'Il reste ' + h + ' h';
    var j = Math.floor(h / 24);
    return 'Il reste ' + j + ' jour' + (j > 1 ? 's' : '');
  }
  function poids(g) { return g >= 1000 ? (g / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' kg' : g + ' g'; }
  function poidsPrecis(g) { return g >= 1000 ? (g / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 }) + ' kg' : g + ' g'; }
  var PICTOS = { vache: 'vache', chevre: 'chevre', brebis: 'brebis', porc: 'porc', melange: 'vache' };

  // ---------- Appels à la base ----------
  function rpc(nom, params) {
    return fetch(C.supabaseUrl + '/rest/v1/rpc/' + nom, {
      method: 'POST',
      headers: { 'apikey': C.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.message) || 'Erreur ' + r.status);
        return j;
      });
    });
  }

  // ---------- État ----------
  var jeton = null;
  var data = null;          // réponse de bon_de_commande
  var derniere = null;      // dernière commande d'une campagne close (pesée, montant à payer)
  var qte = {};             // portion_id -> quantité
  var point = null;         // point de livraison choisi
  var commentaire = '';
  var vue = 'bon';          // 'bon' | 'confirmation'
  var alerte = null;        // { type, html }
  var envoiEnCours = false;
  var portionsParId = {};
  var grandsOuverts = {};   // offre_id -> grands morceaux dépliés

  // Lien personnel : dans l'adresse (?k=…), sinon mémorisé sur cet appareil
  (function () {
    var p = new URLSearchParams(location.search);
    var k = p.get('k');
    // ?appli=1 : bon ouvert depuis l'appli de JP (on ne le mémorise pas sur l'appareil)
    var dansAppli = p.has('appli');
    if (dansAppli) document.documentElement.classList.add('dans-appli');
    if (k) { jeton = k; if (!dansAppli) stocker('fjp_lien', k); }
    else { jeton = lire('fjp_lien'); }
  })();

  // mode : undefined = chargement normal, 'apres' = après validation, 'garder' = garder la saisie en cours
  function charger(mode) {
    if (!jeton) { afficherSansLien(); return; }
    return Promise.all([
      rpc('bon_de_commande', { p_jeton: jeton }),
      rpc('derniere_commande', { p_jeton: jeton }).catch(function () { return null; })
    ]).then(function (res) {
      var d = res[0];
      data = d; derniere = res[1] || null;
      if (d.erreur === 'lien_invalide') { stocker('fjp_lien', null); afficherLienInvalide(); return; }
      bonjour.textContent = 'Bonjour ' + d.gourmet.prenom;
      portionsParId = {};
      (d.categories || []).forEach(function (cat) {
        cat.produits.forEach(function (pr) {
          pr.portions.forEach(function (po) { portionsParId[po.id] = { portion: po, produit: pr }; });
        });
      });
      if (!d.campagne) { afficherFermee(); return; }
      if (mode === 'apres') {
        vue = 'confirmation';
      } else if (mode === 'garder') {
        vue = 'bon';
      } else {
        qte = {};
        if (d.commande) {
          d.commande.lignes.forEach(function (l) { if (!l.retiree) qte[l.portion_id] = l.quantite; });
          point = d.commande.point_id;
          commentaire = d.commande.commentaire || '';
          vue = 'confirmation';
        } else {
          var memo = Number(lire('fjp_point'));
          point = d.points.some(function (p) { return p.id === memo; }) ? memo : (d.points.length === 1 ? d.points[0].id : null);
          vue = 'bon';
        }
      }
      afficher();
    }).catch(function () {
      app.innerHTML = '<div class="carte"><h1>Oups…</h1><p>Le bon de commande n’a pas pu être chargé. Vérifiez votre connexion Internet, puis réessayez.</p>' +
        '<button class="bouton" type="button" id="reessayer">Réessayer</button></div>';
      document.getElementById('reessayer').onclick = function () { charger(); };
    });
  }

  // ---------- Écrans simples ----------
  function afficherSansLien() {
    app.innerHTML = '<div class="carte"><h1>Bienvenue !</h1>' +
      '<p>Pour commander, ouvrez le lien personnel que Jean-Paul vous a envoyé par mail.</p>' +
      '<p>Vous ne le retrouvez pas ? Demandez-le à Jean-Paul, il vous le renverra.</p></div>';
  }
  function afficherLienInvalide() {
    app.innerHTML = '<div class="carte"><h1>Ce lien ne fonctionne plus</h1>' +
      '<p>Votre lien a peut-être été remplacé par un nouveau. Utilisez le dernier lien reçu par mail, ou demandez-en un à Jean-Paul.</p></div>';
  }
  function afficherFermee() {
    var d = data;
    var h = derniere ? carteDerniere(derniere) : '';
    h += '<div class="carte"><h1' + (derniere ? ' style="font-size:19px"' : '') + '>Pas de commande en cours</h1>';
    if (d.prochaine_commande) h += '<p>Prochaine commande prévue : <b>' + esc(dateSimple(d.prochaine_commande)) + '</b>. Vous recevrez un mail à l’ouverture.</p>';
    else h += '<p>Vous recevrez un mail dès que la prochaine commande sera ouverte.</p>';
    h += '</div>';
    var hist = (d.historique || []).filter(function (x) { return !derniere || x.reference !== derniere.reference; });
    if (hist.length) {
      h += '<div class="carte"><h1 style="font-size:19px">Mes commandes</h1><ul class="historique">';
      hist.forEach(function (x) {
        h += '<li>' + esc(x.campagne) + ' : <b>' + prix(x.montant) + '</b>' + (x.paye ? ' — payée' : '') + '</li>';
      });
      h += '</ul></div>';
    }
    app.innerHTML = h;
  }

  // Commande d'une campagne close : en attente de pesée, puis montant exact à payer
  function carteDerniere(dc) {
    var h = '<section class="carte"><h1 style="font-size:20px">Ma commande « ' + esc(dc.campagne) + ' »</h1>';
    if (!dc.prete) {
      h += '<div class="bandeau info" style="margin:0 0 12px">Jean-Paul prépare votre commande et pèse les fromages à la coupe. Vous recevrez par mail le montant exact à payer : rien à régler pour l’instant.</div>';
    }
    dc.lignes.forEach(function (l) {
      var pese = dc.prete && l.poids_reels && l.poids_reels.length;
      h += '<div class="recap-ligne' + (l.retiree ? ' retiree' : '') + '"><span>' + l.quantite + ' × ' + esc(l.nom) +
        (pese ? '<small style="display:block;font-size:13px;color:var(--texte-doux)">pesé : ' + esc(l.poids_reels.map(poidsPrecis).join(' + ')) + '</small>' : '') +
        '</span><b>' + prix(dc.prete ? l.prix : l.estime) + '</b></div>';
    });
    h += '<div class="recap-total"><span>' + (dc.prete ? (dc.paye ? 'Montant payé' : 'Montant à payer') : 'Montant estimé') + '</span><b>' + prix(dc.montant) + '</b></div>';
    if (dc.point) {
      h += '<p style="margin-top:10px;font-size:14px;color:var(--texte-doux)">Livraison ' + esc(dateSimple(dc.point.date_livraison)) + ' · ' +
        esc([dc.point.ville, dc.point.lieu, dc.point.heure].filter(Boolean).join(', ')) + '</p>';
    }
    h += '</section>';
    if (dc.prete) {
      var r = (data && data.reglages) || {};
      h += '<section class="carte virement"><h2>' + (dc.paye ? 'Paiement reçu, merci !' : 'Pour payer par virement') + '</h2>';
      if (!dc.paye) {
        if (r.iban) {
          if (r.titulaire) h += '<div class="etiq">Titulaire</div><div class="val">' + esc(r.titulaire) + '</div>';
          h += '<div class="etiq">IBAN</div><div class="val">' + esc(r.iban) + '</div>';
        } else {
          h += '<p>Jean-Paul vous indiquera ses coordonnées bancaires.</p>';
        }
        h += '<div class="etiq">À écrire dans le libellé du virement</div><div class="ref"><div class="val" id="ref">' + esc(dc.reference) + '</div>' +
          '<button type="button" class="petit-bouton" id="copier">Copier</button></div>' +
          '<p style="margin:10px 0 0;font-size:13px;color:var(--texte-doux)">Vous pouvez aussi payer en espèces ou par chèque à la livraison.</p>';
      }
      h += '</section>';
    }
    return h;
  }

  // ---------- Calculs ----------
  function total() {
    var t = 0, n = 0;
    Object.keys(qte).forEach(function (id) {
      var q = qte[id] || 0, e = portionsParId[id];
      if (q > 0 && e) { t += q * e.portion.prix; n += q; }
    });
    return { montant: Math.round(t * 100) / 100, articles: n };
  }
  function modifie() {
    var c = data.commande;
    if (!c) return total().articles > 0;
    var avant = {};
    c.lignes.forEach(function (l) { if (!l.retiree) avant[l.portion_id] = l.quantite; });
    var ids = Object.keys(Object.assign({}, avant, qte));
    if (ids.some(function (id) { return (avant[id] || 0) !== (qte[id] || 0); })) return true;
    return point !== c.point_id || (commentaire || '') !== (c.commentaire || '');
  }

  // ---------- Bon de commande ----------
  function afficher() {
    if (vue === 'confirmation' && data.commande) { afficherConfirmation(); return; }
    var d = data, c = d.campagne, fin = new Date(c.cloture);
    var h = '';
    // Commande précédente pesée mais pas encore payée : on la rappelle en haut
    if (derniere && derniere.prete && !derniere.paye) h += carteDerniere(derniere);
    h += '<section class="carte"><h1>' + esc(c.nom) + '</h1>';
    if (c.message) h += '<p class="message">' + esc(c.message) + '</p>';
    if (d.reglages && d.reglages.signature) h += '<p class="message">' + esc(d.reglages.signature) + '</p>';
    h += '<div class="dates">' +
      '<div class="date fin"><span class="etiq">Fin de commande</span><b>' + esc(jourLong(fin)) + ', ' + esc(heure(fin)) + '</b><span>' + esc(resteAvant(fin)) + '</span></div>' +
      '<div class="date livr"><span class="etiq">Livraison</span><b>' + esc(dateSimple(c.livraison)) + '</b><span>Merci de respecter l’horaire</span></div>' +
      '</div>';
    if (d.points.length) {
      h += '<div class="points-titre" id="titre-points">Mon point de livraison</div><div role="group" aria-labelledby="titre-points">';
      d.points.forEach(function (p) {
        var detail = [p.lieu, p.heure].filter(Boolean).join(' · ');
        if (p.date_livraison && p.date_livraison !== c.livraison) detail += ' · ' + dateSimple(p.date_livraison);
        h += '<button type="button" class="point" data-point="' + p.id + '" aria-pressed="' + (point === p.id) + '">' +
          '<span class="rond" aria-hidden="true"></span><span><b>' + esc(p.ville) + '</b><small>' + esc(detail) + '</small></span></button>';
      });
      h += '</div>';
    }
    h += '</section>';
    h += '<p class="avis">Prix transport compris. Les fromages à la coupe (300 g, 500 g, 1 kg, jusqu’à 2 kg) ne tombent jamais au gramme près : leur prix est estimé ici, puis calculé au poids réel à l’arrivée. Vous paierez seulement quand Jean-Paul vous aura envoyé le montant exact. Produits sous réserve de disponibilité.</p>';

    if (alerte) h += '<div class="bandeau ' + alerte.type + '" role="alert">' + alerte.html + '</div>';
    if (d.commande) h += '<div class="bandeau info">Votre commande est déjà enregistrée. Modifiez les quantités puis validez à nouveau.</div>';

    d.categories.forEach(function (cat) {
      h += '<section class="categorie"><h2>' + esc(cat.nom) + '</h2><div class="liste">';
      cat.produits.forEach(function (pr) {
        var img = pr.photo_url || (PICTOS[pr.lait] ? 'images/lait-' + PICTOS[pr.lait] + '.png' : '');
        var infos = [];
        if (pr.aop) infos.push(pr.aop);
        if (pr.lait_cru === true) infos.push('lait cru'); else if (pr.lait_cru === false) infos.push('lait pasteurisé');
        var desc = [pr.description, infos.join(' · ')].filter(Boolean).join(' · ');
        h += '<article class="produit"><div class="produit-tete">';
        if (img) h += '<img src="' + esc(img) + '" alt="" loading="lazy">';
        h += '<div><div class="produit-nom">' + esc(pr.nom) + '</div>';
        if (desc) h += '<div class="produit-info">' + esc(desc) + '</div>';
        var past = '';
        if (pr.nouveau) past += '<span class="pastille">Nouveau</span>';
        if (pr.si_disponible) past += '<span class="pastille discrete">Si disponible</span>';
        if (past) h += '<div class="pastilles">' + past + '</div>';
        if (pr.minimum_g) {
          var pc = Math.min(100, Math.round(100 * (pr.reserve_g || 0) / pr.minimum_g));
          h += '<div class="jauge">' + esc(poids(pr.reserve_g || 0)) + ' commandés sur ' + esc(poids(pr.minimum_g)) + ' demandés par la ferme' +
            '<div class="jauge-barre" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pc + '"><div style="width:' + pc + '%"></div></div></div>';
        }
        h += '</div></div><div class="portions">';
        // Les grands morceaux (1 kg, 1,5 kg, 2 kg) sont repliés pour garder le bon court
        var grands = pr.portions.filter(function (po) { return po.mode === 'coupe' && po.poids_g >= 1000; });
        var montrerGrands = grandsOuverts[pr.offre_id] || grands.some(function (po) { return qte[po.id] > 0; });
        pr.portions.forEach(function (po) {
          if (grands.indexOf(po) >= 0 && !montrerGrands) return;
          var q = qte[po.id] || 0;
          var plusOff = !po.disponible;
          var sous = '';
          if (po.mode === 'coupe' && po.prix_kg) sous = esc(prix(po.prix_kg)) + ' le kg · prix au poids réel';
          else if (po.mode === 'poids_variable' && po.prix_kg) sous = 'au prix de ' + esc(poids(po.poids_g)) + ' à ' + esc(prix(po.prix_kg)) + ' le kg';
          h += '<div class="portion"><span class="portion-lib">' + esc(po.libelle) + (sous ? '<small>' + sous + '</small>' : '') +
            (plusOff ? '<span class="epuise">Plus assez de stock</span>' : '') + '</span>' +
            '<span class="portion-prix">' + (po.mode === 'coupe' ? '≈ ' : '') + prix(po.prix) + '</span>' +
            '<span class="compteur">' +
            '<button type="button" class="moins" data-moins="' + po.id + '" aria-label="Retirer : ' + esc(pr.nom + ', ' + po.libelle) + '"' + (q ? '' : ' disabled') + '>−</button>' +
            '<output aria-label="Quantité">' + q + '</output>' +
            '<button type="button" class="plus" data-plus="' + po.id + '" aria-label="Ajouter : ' + esc(pr.nom + ', ' + po.libelle) + '"' + (plusOff ? ' disabled' : '') + '>+</button>' +
            '</span></div>';
        });
        if (grands.length && !montrerGrands) {
          h += '<button type="button" class="petit-bouton" data-grands="' + pr.offre_id + '" style="margin:6px 0 0">Plus gros morceau : ' +
            esc(grands.map(function (po) { return po.libelle; }).join(', ').replace(/, ([^,]*)$/, ' ou $1')) + '</button>';
        }
        h += '</div></article>';
      });
      h += '</div></section>';
    });

    h += '<div class="commentaire"><label for="commentaire">Un mot pour Jean-Paul (facultatif)</label>' +
      '<textarea id="commentaire" maxlength="500" placeholder="Ex. : le Cantal est pour ma voisine">' + esc(commentaire) + '</textarea></div>';

    h += '<div class="pied"><div class="pied-ligne"><span id="nb-articles"></span><b id="total"></b></div>' +
      '<button type="button" class="bouton" id="valider">Valider ma commande</button>' +
      '<small>Modifiable jusqu’au ' + esc(jourLong(fin)) + ', ' + esc(heure(fin)) + '</small></div>';
    app.innerHTML = h;
    majPied();
  }

  function majPied() {
    var t = total();
    var nb = document.getElementById('nb-articles'), tot = document.getElementById('total'), b = document.getElementById('valider');
    if (!nb) return;
    nb.textContent = t.articles ? t.articles + ' article' + (t.articles > 1 ? 's' : '') + ' · total estimé' : 'Aucun article';
    tot.textContent = prix(t.montant);
    b.disabled = envoiEnCours || t.articles === 0 || (data.commande && !modifie());
    b.textContent = envoiEnCours ? 'Envoi…' : (data.commande ? 'Valider les modifications' : 'Valider ma commande');
  }

  function majPortion(id) {
    var q = qte[id] || 0;
    var m = app.querySelector('[data-moins="' + id + '"]');
    if (m) { m.disabled = !q; m.nextElementSibling.textContent = q; }
    majPied();
  }

  // ---------- Confirmation ----------
  function afficherConfirmation() {
    var d = data, c = d.campagne, cmd = d.commande, fin = new Date(c.cloture);
    var pt = d.points.filter(function (p) { return p.id === cmd.point_id; })[0];
    var h = '';
    if (alerte) h += '<div class="bandeau ' + alerte.type + '" role="alert">' + alerte.html + '</div>';
    if (derniere && derniere.prete && !derniere.paye) h += carteDerniere(derniere);
    h += '<section class="carte"><div class="coche" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<h1>Merci ' + esc(d.gourmet.prenom) + ' !</h1><p>Votre commande « ' + esc(c.nom) + ' » est bien enregistrée.</p>';
    cmd.lignes.forEach(function (l) {
      var e = portionsParId[l.portion_id];
      var nom = l.nom || (e ? e.produit.nom + ', ' + e.portion.libelle : 'Produit');
      h += '<div class="recap-ligne' + (l.retiree ? ' retiree' : '') + '"><span>' + l.quantite + ' × ' + esc(nom) + '</span><b>' + prix(l.quantite * l.prix_unitaire) + '</b></div>';
    });
    h += '<div class="recap-total"><span>Montant estimé</span><b>' + prix(cmd.montant) + '</b></div>';
    if (pt) h += '<p style="margin-top:10px;font-size:14px;color:var(--texte-doux)">Livraison ' + esc(dateSimple(pt.date_livraison)) + ' · ' + esc([pt.ville, pt.lieu, pt.heure].filter(Boolean).join(', ')) + '</p>';
    if (cmd.commentaire) h += '<p style="font-size:14px;color:var(--texte-doux)">Votre mot : « ' + esc(cmd.commentaire) + ' »</p>';
    h += '</section>';

    h += '<section class="carte virement"><h2>' + (cmd.paye ? 'Paiement reçu, merci !' : 'Rien à payer pour l’instant') + '</h2>';
    if (!cmd.paye) {
      h += '<p style="margin:0">À l’arrivée des fromages, Jean-Paul pèse chaque morceau à la coupe et vous envoie par mail le <b>montant exact</b>, avec ses coordonnées pour le virement. Vous pourrez aussi payer en espèces ou par chèque à la livraison.</p>';
    }
    h += '</section>';

    h += '<div class="actions"><button type="button" class="bouton second" id="modifier">Modifier ma commande</button>' +
      '<small style="text-align:center;color:var(--texte-doux);font-size:12px">Possible jusqu’au ' + esc(jourLong(fin)) + ', ' + esc(heure(fin)) + '</small>' +
      '<button type="button" class="bouton discret" id="annuler">Annuler ma commande</button></div>';
    app.innerHTML = h;
    window.scrollTo(0, 0);
  }

  // ---------- Actions ----------
  function valider() {
    if (!point) {
      alerte = { type: 'attention', html: 'Choisissez votre point de livraison en haut de la page.' };
      afficher(); window.scrollTo(0, 0); return;
    }
    var lignes = Object.keys(qte).filter(function (id) { return qte[id] > 0; })
      .map(function (id) { return { portion_id: Number(id), quantite: qte[id] }; });
    envoiEnCours = true; majPied();
    rpc('valider_commande', { p_jeton: jeton, p_point_id: point, p_lignes: lignes, p_commentaire: commentaire })
      .then(function (r) {
        envoiEnCours = false;
        if (r.ok) { stocker('fjp_point', String(point)); alerte = null; return charger('apres'); }
        var msg = {
          campagne_close: 'La commande est close : il n’est plus possible de commander. Contactez Jean-Paul si besoin.',
          produit_indisponible: 'Un des produits choisis n’est plus proposé. La liste a été mise à jour, vérifiez votre commande.',
          point_invalide: 'Choisissez à nouveau votre point de livraison.',
          commande_vide: 'Votre commande est vide.',
          lien_invalide: 'Votre lien ne fonctionne plus. Demandez-en un nouveau à Jean-Paul.'
        }[r.erreur];
        if (r.erreur === 'stock_insuffisant') {
          msg = 'Il n’y a plus assez de stock pour : ' + r.details.map(function (x) {
            return '<b>' + esc(x.produit) + '</b> (il reste ' + esc(poids(x.reste_g)) + ')';
          }).join(', ') + '. Ajustez les quantités puis validez à nouveau.';
        }
        alerte = { type: 'erreur', html: msg || 'La commande n’a pas pu être enregistrée.' };
        return charger('garder').then(function () { window.scrollTo(0, 0); });
      })
      .catch(function () {
        envoiEnCours = false;
        alerte = { type: 'erreur', html: 'La commande n’a pas pu être envoyée. Vérifiez votre connexion Internet, puis réessayez.' };
        afficher(); window.scrollTo(0, 0);
      });
  }

  app.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.grands) { grandsOuverts[t.dataset.grands] = true; var y = window.scrollY; afficher(); window.scrollTo(0, y); return; }
    if (t.dataset.plus) { qte[t.dataset.plus] = (qte[t.dataset.plus] || 0) + 1; majPortion(t.dataset.plus); return; }
    if (t.dataset.moins) { qte[t.dataset.moins] = Math.max(0, (qte[t.dataset.moins] || 0) - 1); majPortion(t.dataset.moins); return; }
    if (t.dataset.point) {
      point = Number(t.dataset.point);
      app.querySelectorAll('.point').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.point) === point)); });
      if (alerte && alerte.type === 'attention') alerte = null;
      majPied(); return;
    }
    if (t.id === 'valider') { valider(); return; }
    if (t.id === 'modifier') { vue = 'bon'; alerte = null; afficher(); window.scrollTo(0, 0); return; }
    if (t.id === 'copier') {
      var ref = document.getElementById('ref').textContent;
      var fait = function () { t.textContent = 'Copié !'; setTimeout(function () { t.textContent = 'Copier'; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(ref).then(fait, function () {});
      return;
    }
    if (t.id === 'annuler') {
      if (!window.confirm('Annuler votre commande ? Vous pourrez en refaire une tant que la commande est ouverte.')) return;
      rpc('annuler_commande', { p_jeton: jeton }).then(function () {
        alerte = { type: 'info', html: 'Votre commande a été annulée.' };
        return charger();
      }).then(function () { if (data && data.campagne) { vue = 'bon'; afficher(); } });
    }
  });

  app.addEventListener('input', function (e) {
    if (e.target.id === 'commentaire') { commentaire = e.target.value; majPied(); }
  });

  window.addEventListener('beforeunload', function (e) {
    if (data && data.campagne && vue === 'bon' && modifie()) { e.preventDefault(); e.returnValue = ''; }
  });

  charger();
})();
