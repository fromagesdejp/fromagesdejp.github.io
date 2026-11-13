// Les Fromages Jean-Paul — espace de Jean-Paul : page d'accueil
(function () {
  'use strict';
  window.FJP_VUES = window.FJP_VUES || {};

  var TZ = 'Europe/Paris';
  var STATUTS = { preparation: 'En préparation', ouverte: 'Ouverte', cloturee: 'Clôturée', terminee: 'Terminée' };
  var ICONES = {
    panier: '<path d="M4 10h16l-1.6 9.2a1 1 0 0 1-1 .8H6.6a1 1 0 0 1-1-.8z"/><path d="M8.5 10 12 4l3.5 6"/>',
    graphe: '<path d="M4 20h16"/><path d="M8 16v-5M12 16V7M16 16v-3"/>',
    euro: '<circle cx="12" cy="12" r="9"/><path d="M15 8.6a4 4 0 1 0 0 6.8M7.5 11h6M7.5 13.5h6"/>',
    gens: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    camion: '<path d="M1 4h14v12H1z"/><path d="M15 8h4l4 4v4h-8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    bon: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M8 12h8M8 16h5"/>',
    lien: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    fromage: '<path d="M2.5 11 16 4.5l5.5 6.5"/><path d="M2.5 11h19v7.5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M2.5 13.8a1.8 1.8 0 0 1 0 3.4"/><circle cx="9" cy="15.5" r="1.6"/><circle cx="16" cy="14.3" r="1"/><circle cx="17.6" cy="17.6" r=".5"/>',
    calendrier: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/>',
    ok: '<path d="M20 6 9 17l-5-5"/>',
    fleche: '<path d="m9 18 6-6-6-6"/>'
  };
  function ico(n) {
    return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONES[n] + '</svg>';
  }
  function fmt(iso, o) { return new Intl.DateTimeFormat('fr-FR', Object.assign({ timeZone: TZ }, o)).format(new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso)); }
  function majuscule(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function bonjour() {
    var h = Number(fmt(new Date().toISOString(), { hour: 'numeric', hour12: false }));
    return h >= 18 || h < 4 ? 'Bonsoir' : 'Bonjour';
  }
  // Temps restant avant la clôture : « 28 jours », « 5 heures »…
  function avantCloture(iso) {
    var ms = new Date(iso) - Date.now();
    if (!(ms > 0)) return null;
    var h = Math.ceil(ms / 3600000);
    if (h < 24) return h + (h > 1 ? ' heures' : ' heure');
    var j = Math.floor(h / 24);
    return j + (j > 1 ? ' jours' : ' jour');
  }
  function ligne(attr, icone, titre, sous, plein) {
    return '<button type="button" class="acc-ligne" ' + attr + '><span class="acc-ico' + (plein ? ' plein' : '') + '">' + ico(icone) + '</span>' +
      '<span class="acc-ligne-txt"><b>' + titre + '</b><small>' + sous + '</small></span>' + ico('fleche') + '</button>';
  }
  function stat(vue, icone, jaune, chiffre, libelle) {
    return '<button type="button" class="acc-stat' + (jaune ? ' jaune' : '') + '" data-aller="' + vue + '"><span class="acc-ico">' + ico(icone) + '</span>' +
      '<b>' + chiffre + '</b><span>' + libelle + '</span></button>';
  }
  var RACCOURCIS =
    '<h2 class="acc-titre">Raccourcis</h2><div class="acc-bloc">' +
    ligne('data-aller="ferme"', 'bon', 'Bon de commande pour la ferme', 'Les quantités à commander, prêtes à imprimer') +
    ligne('data-aller="gourmets"', 'lien', 'Mes gourmets et leurs liens', 'Ajouter un gourmet, envoyer son lien') +
    ligne('data-aller="produits"', 'fromage', 'Produits', 'Fromages, prix et portions') +
    ligne('data-aller="campagnes"', 'calendrier', 'Campagnes', 'Dates, villes de livraison') +
    '</div>';

  var STYLE = [
    '.ico { width: 20px; height: 20px; flex-shrink: 0; }',
    '.acc-bonjour { margin: 20px 16px 0; }',
    '.acc-bonjour h1 { margin: 0; font-size: 26px; font-weight: 800; color: var(--canard-fonce); line-height: 1.15; }',
    '.acc-bonjour p { margin: 2px 0 0; font-size: 14px; color: var(--texte-doux); }',
    /* Ma commande (carte remplie par admin-commande.js) */
    '.ma-commande { gap: 14px; background: var(--fromage-clair); border: 1.5px solid var(--fromage); padding: 14px 16px; box-shadow: 0 2px 8px rgba(245,166,35,.15); transition: transform .15s, box-shadow .15s; }',
    '.ma-commande::before { content: ""; width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; background: var(--fromage) center / 24px no-repeat url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2312313F%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M4 10h16l-1.6 9.2a1 1 0 0 1-1 .8H6.6a1 1 0 0 1-1-.8z%27/%3E%3Cpath d=%27M8.5 10 12 4l3.5 6%27/%3E%3C/svg%3E"); }',
    '.ma-commande .mc-txt::before { content: "Ma commande"; display: block; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--brun); }',
    '.ma-commande b { color: var(--texte); font-size: 18px; }',
    '.ma-commande small { color: #5C3800; font-size: 13px; }',
    '.ma-commande .mc-fleche { color: var(--brun); font-size: 30px; }',
    '.ma-commande:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(245,166,35,.25); }',
    /* Bandeau de la campagne */
    '.acc-hero { position: relative; overflow: hidden; margin: 16px; border-radius: 18px; padding: 18px 18px 16px; color: #fff;',
    '  background: radial-gradient(circle at 96% 4%, rgba(245,166,35,.28) 0 64px, transparent 65px), radial-gradient(circle at 74% 62%, rgba(245,166,35,.16) 0 30px, transparent 31px), linear-gradient(135deg, var(--canard) 0%, var(--canard-fonce) 100%);',
    '  box-shadow: 0 10px 24px rgba(8,82,90,.25); }',
    '.acc-hero-tete { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }',
    '.acc-statut { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,.16); border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 800; }',
    '.acc-statut::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #7EE0A1; }',
    '.acc-statut.ferme::before { background: var(--fromage); }',
    '.acc-livr { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; }',
    '.acc-livr .ico { width: 16px; height: 16px; }',
    '.acc-hero h1 { margin: 12px 0 8px; font-size: 26px; font-weight: 800; line-height: 1.15; }',
    '.acc-reste { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 600; }',
    '.acc-reste b { color: var(--fromage); font-weight: 800; }',
    '.acc-cloture { margin: 2px 0 0 28px; font-size: 13px; opacity: .85; }',
    '.acc-jauge { height: 7px; margin: 16px 0 8px; border-radius: 999px; background: rgba(255,255,255,.18); overflow: hidden; }',
    '.acc-jauge span { display: block; height: 100%; border-radius: 999px; background: var(--fromage); }',
    '.acc-partic { font-size: 13px; }',
    /* Chiffres */
    '.acc-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0 16px; }',
    '.acc-stat { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px; text-align: left; background: #fff; border: 0; border-radius: 14px; box-shadow: 0 1px 3px rgba(18,49,63,.08); color: var(--texte); font: inherit; cursor: pointer; transition: transform .15s, box-shadow .15s; }',
    '.acc-stat .acc-ico { margin-bottom: 8px; }',
    '.acc-stat b { font-size: 21px; font-weight: 800; line-height: 1.15; white-space: nowrap; }',
    '.acc-stat span:last-child { font-size: 12px; color: var(--texte-doux); line-height: 1.3; }',
    '.acc-stat:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(18,49,63,.12); }',
    '.acc-ico { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: var(--canard-clair); color: var(--canard); }',
    '.acc-ico .ico { width: 18px; height: 18px; }',
    '.acc-stat.jaune .acc-ico { background: var(--fromage-clair); color: var(--brun); }',
    '.acc-ico.plein { background: var(--canard); color: #fff; }',
    /* Listes */
    '.acc-titre { margin: 22px 20px 8px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--texte-doux); }',
    '.acc-bloc { margin: 0 16px; background: #fff; border-radius: 14px; box-shadow: 0 1px 3px rgba(18,49,63,.08); overflow: hidden; }',
    '.acc-ligne { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 64px; padding: 10px 14px; text-align: left; background: #fff; border: 0; color: var(--texte); font: inherit; cursor: pointer; }',
    '.acc-ligne + .acc-ligne { border-top: 1px solid #EEF1F2; }',
    '.acc-ligne:hover { background: #F7FAFA; }',
    '.acc-ligne:disabled { opacity: .55; cursor: default; }',
    '.acc-ligne > .ico:last-child { color: #9AABB1; }',
    '.acc-ligne-txt { flex-grow: 1; min-width: 0; }',
    '.acc-ligne-txt b { display: block; font-size: 15px; }',
    '.acc-ligne-txt small { display: block; font-size: 12px; color: var(--texte-doux); }',
    '.acc-auto { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 10px 16px 0; font-size: 12px; color: var(--texte-doux); }',
    '.acc-auto span { display: inline-flex; align-items: center; gap: 4px; background: #fff; border: 1px solid var(--bord); border-radius: 999px; padding: 3px 10px; }',
    '.acc-auto .ico { width: 12px; height: 12px; color: var(--canard); }',
    '.acc-stat:focus-visible, .acc-ligne:focus-visible, .ma-commande:focus-visible { outline: 3px solid var(--fromage); outline-offset: 2px; }',
    '@media (max-width: 600px) { .acc-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }',
    '@media (prefers-reduced-motion: reduce) { .acc-stat:hover, .ma-commande:hover { transform: none; } }'
  ].join(' ');
  if (!document.getElementById('style-accueil')) {
    var st = document.createElement('style'); st.id = 'style-accueil'; st.textContent = STYLE; document.head.appendChild(st);
  }

  window.FJP_VUES.accueil = function () {
    var FJP = window.FJP, esc = FJP.esc, prix = FJP.prix, app = FJP.app;
    var campagne = FJP.campagne();
    var tete = '<div class="acc-bonjour"><h1>' + bonjour() + ' !</h1><p>' + majuscule(fmt(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })) + '</p></div>' +
      '<div id="ma-commande"></div>';
    if (!campagne) {
      app.innerHTML = tete + '<section class="acc-hero"><h1>Aucune campagne en cours</h1><p class="acc-partic">Créez la prochaine dans la rubrique « Campagnes ».</p></section>' + RACCOURCIS;
      if (window.FJP_CARTE_MA_COMMANDE) window.FJP_CARTE_MA_COMMANDE();
      return;
    }
    return Promise.all([
      FJP.api('commandes?select=id,montant,paye&campagne_id=eq.' + campagne.id + '&statut=eq.validee'),
      FJP.api('gourmets?select=id&actif=eq.true')
    ]).then(function (r) {
      var cmds = r[0], nbG = r[1].length, n = cmds.length;
      var total = cmds.reduce(function (a, c) { return a + Number(c.montant); }, 0);
      var aPayer = cmds.filter(function (c) { return !c.paye; });
      var attendu = aPayer.reduce(function (a, c) { return a + Number(c.montant); }, 0);
      var sans = Math.max(0, nbG - n);
      var pct = nbG ? Math.min(100, Math.round(n / nbG * 100)) : 0;
      var reste = campagne.statut === 'ouverte' ? avantCloture(campagne.cloture) : null;

      var h = tete +
        '<section class="acc-hero"><div class="acc-hero-tete"><span class="acc-statut' + (campagne.statut === 'ouverte' ? '' : ' ferme') + '">' + esc(STATUTS[campagne.statut] || '') + '</span>' +
        (campagne.livraison ? '<span class="acc-livr">' + ico('camion') + 'Livraison ' + esc(fmt(campagne.livraison, { day: 'numeric', month: 'short' })) + '</span>' : '') + '</div>' +
        '<h1>' + esc(campagne.nom) + '</h1>' +
        '<div class="acc-reste">' + ico('horloge') + '<span>' + (reste ? 'Encore <b>' + reste + '</b> pour commander' : esc({ cloturee: 'Les commandes sont closes', preparation: 'Pas encore ouverte aux gourmets' }[campagne.statut] || 'La clôture est passée')) + '</span></div>' +
        '<p class="acc-cloture">Clôture ' + esc(fmt(campagne.cloture, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })) + '</p>' +
        '<div class="acc-jauge" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
        '<div class="acc-partic"><b>' + Math.min(n, nbG) + '</b> gourmet' + (n > 1 ? 's' : '') + ' sur ' + nbG + ' ' + (n > 1 ? 'ont' : 'a') + ' commandé</div></section>';

      h += '<div class="acc-stats">' +
        stat('commandes', 'panier', false, n, n > 1 ? 'commandes reçues' : 'commande reçue') +
        stat('commandes', 'graphe', false, esc(prix(total)), 'au total') +
        stat('paiements', 'euro', aPayer.length > 0, esc(prix(attendu)), aPayer.length ? aPayer.length + ' commande' + (aPayer.length > 1 ? 's' : '') + ' à payer' : 'tout est payé') +
        stat('gourmets', 'gens', sans > 0, sans, 'gourmet' + (sans > 1 ? 's' : '') + ' sans commande') +
        '</div>';

      h += RACCOURCIS;

      h += '<h2 class="acc-titre">Mails</h2><div class="acc-bloc">' +
        ligne('data-arrivee', 'camion', 'Les fromages sont arrivés', n ? 'Prévenir ' + (n > 1 ? 'les ' + n + ' gourmets' : 'le gourmet') + ' qui ' + (n > 1 ? 'ont' : 'a') + ' commandé' : 'Personne n’a encore commandé', true) +
        ligne('data-ouverture', 'mail', 'Envoyer le mail d’ouverture', 'Aux gourmets qui ne l’ont pas encore reçu') +
        '</div><p class="acc-auto">Envoyés tout seuls :' +
        ['confirmation de chaque commande', 'mail d’ouverture', 'rappel 3 jours avant', 'rappel la veille'].map(function (t) { return '<span>' + ico('ok') + t + '</span>'; }).join('') + '</p>';

      app.innerHTML = h;
      if (window.FJP_CARTE_MA_COMMANDE) window.FJP_CARTE_MA_COMMANDE();

      app.onclick = function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.arrivee !== undefined) {
          if (!n) { FJP.toast('Personne n’a encore commandé.'); return; }
          if (!window.confirm('Prévenir les ' + n + ' gourmets qui ont commandé que les fromages sont arrivés ?')) return;
          b.disabled = true;
          FJP.api('rpc/annoncer_arrivee', { method: 'POST', body: { p_campagne_id: campagne.id } }).then(function (k) { FJP.toast(k + ' mail(s) envoyé(s)'); })
            .catch(function (err) { b.disabled = false; FJP.toast('Erreur : ' + esc(err.message)); });
        }
        if (b.dataset.ouverture !== undefined) {
          b.disabled = true;
          FJP.api('rpc/annoncer_ouverture', { method: 'POST', body: { p_campagne_id: campagne.id } }).then(function (k) { FJP.toast(k + ' mail(s) envoyé(s)'); })
            .catch(function (err) { b.disabled = false; FJP.toast('Erreur : ' + esc(err.message)); });
        }
      };
    });
  };
})();
