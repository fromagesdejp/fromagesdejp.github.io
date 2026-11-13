// Les Fromages Jean-Paul — espace de Jean-Paul : « Ma commande »
// L'admin commande pour lui-même (ou pour un gourmet) sans quitter l'appli :
// le bon de commande s'ouvre dans l'appli, avec son lien personnel.
(function () {
  'use strict';
  window.FJP_VUES = window.FJP_VUES || {};
  var aOuvrir = null; // { jeton, titre } : bon d'un gourmet à ouvrir

  // Carte « Ma commande » en haut de l'accueil
  window.FJP_CARTE_MA_COMMANDE = function () {
    var FJP = window.FJP, esc = FJP.esc;
    var place = document.getElementById('ma-commande');
    if (!place) return;
    FJP.api('rpc/ma_commande', { method: 'POST', body: {} }).then(function (r) {
      if (!document.body.contains(place) || !r.campagne) return;
      var c = r.commande;
      place.innerHTML = '<button type="button" class="carte ma-commande" id="ouvrir-ma-commande">' +
        '<span class="mc-txt"><b>' + (c ? 'Ma commande : ' + esc(FJP.prix(c.montant)) : 'Passer ma commande') + '</b>' +
        '<small>' + (c ? 'Toucher pour la voir ou la modifier' + (c.paye ? ' · payée' : '') : 'Je commande moi aussi pour « ' + esc(r.campagne) + ' »') + '</small></span>' +
        '<span class="mc-fleche" aria-hidden="true">›</span></button>';
      document.getElementById('ouvrir-ma-commande').onclick = function () { FJP.aller('macommande'); };
    }).catch(function () {});
  };

  function afficherBon(jeton, titre, retour) {
    var FJP = window.FJP, esc = FJP.esc;
    FJP.app.innerHTML = '<div class="barre-bon"><button type="button" class="btn clair" id="retour-bon">‹ Retour</button>' +
      '<span>' + esc(titre) + '</span></div>' +
      '<iframe class="bon-dans-appli" title="Bon de commande" src="../?k=' + encodeURIComponent(jeton) + '&appli=1"></iframe>';
    document.getElementById('retour-bon').onclick = function () { FJP.aller(retour || 'accueil'); };
  }

  // Mon bon de commande
  window.FJP_VUES.macommande = function () {
    var FJP = window.FJP, esc = FJP.esc;
    return FJP.api('rpc/ma_commande', { method: 'POST', body: {} }).then(function (r) {
      if (!r.a_completer) { afficherBon(r.jeton, 'Ma commande'); return; }
      // Première fois : on crée sa fiche de gourmet
      FJP.app.innerHTML = '<form class="carte" id="form-moi"><h1 style="font-size:20px">Ma commande</h1>' +
        '<p>Pour commander vous aussi, il suffit d’une fiche de gourmet à votre nom (une seule fois). Les mails de confirmation iront à <b>' + esc(r.email) + '</b>.</p>' +
        '<div class="grille2"><div class="champ"><label for="moi-prenom">Prénom</label><input id="moi-prenom" required></div>' +
        '<div class="champ"><label for="moi-nom">Nom</label><input id="moi-nom" required style="text-transform:uppercase"></div></div>' +
        '<button class="bouton" type="submit">Continuer vers mon bon de commande</button></form>';
      document.getElementById('form-moi').onsubmit = function (e) {
        e.preventDefault();
        var b = e.target.querySelector('button'); b.disabled = true;
        FJP.api('rpc/ma_commande', { method: 'POST', body: { p_prenom: document.getElementById('moi-prenom').value, p_nom: document.getElementById('moi-nom').value } })
          .then(function (r2) { afficherBon(r2.jeton, 'Ma commande'); })
          .catch(function (err) { b.disabled = false; FJP.toast('Erreur : ' + esc(err.message)); });
      };
    });
  };

  // Bon d'un autre gourmet (ex. il a envoyé sa commande par mail)
  window.FJP_OUVRIR_BON = function (jeton, titre) { aOuvrir = { jeton: jeton, titre: titre }; window.FJP.aller('bon'); };
  window.FJP_VUES.bon = function () {
    if (!aOuvrir) { window.FJP.aller('gourmets'); return; }
    afficherBon(aOuvrir.jeton, aOuvrir.titre, 'gourmets');
  };
})();
