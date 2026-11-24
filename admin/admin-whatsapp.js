// Les Fromages Jean-Paul — appli de JP : messages WhatsApp (gratuits)
// Un bouton ouvre WhatsApp sur le téléphone de JP avec le message déjà écrit ;
// JP n'a plus qu'à appuyer sur « Envoyer ». Rien ne passe par un service payant.
(function () {
  'use strict';
  var reglages = null;

  // 06 12 34 56 78 → 33612345678 (format attendu par WhatsApp)
  function numero(tel) {
    var n = String(tel || '').replace(/[^\d+]/g, '');
    if (!n) return null;
    if (n.charAt(0) === '+') n = n.slice(1);
    else if (n.slice(0, 2) === '00') n = n.slice(2);
    else if (n.charAt(0) === '0' && n.length === 10) n = '33' + n.slice(1);
    return n.length >= 9 ? n : null;
  }
  // Adresse qui ouvre WhatsApp avec le message (sans numéro : on choisit le contact ou le groupe)
  function lien(tel, texte) {
    var n = tel ? numero(tel) : '';
    if (tel && !n) return null;
    return 'https://wa.me/' + (n || '') + '?text=' + encodeURIComponent(texte);
  }
  function signature() { return (reglages && reglages.signature) || 'Amitié JP'; }
  function euros(n) { return Number(n || 0).toFixed(2).replace('.', ',') + ' €'; }
  function jour(iso, heure) {
    if (!iso) return '';
    var d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso);
    var t = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(d);
    if (!heure) return t;
    // « à 15 h » / « à 23 h 59 » (comme dans les mails)
    var hm = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', hour12: false, timeZone: 'Europe/Paris' }).format(d).split(':');
    return t + ' à ' + Number(hm[0]) + ' h' + (hm[1] && hm[1] !== '00' ? ' ' + hm[1] : '');
  }
  function virement(ref) {
    if (!reglages || !reglages.iban) return '';
    return '\nPar virement : IBAN ' + reglages.iban + (reglages.titulaire ? ' (' + reglages.titulaire + ')' : '') + (ref ? '\nLibellé : ' + ref : '');
  }
  function adresseSite() { return location.href.replace(/admin\/.*$/, ''); }

  var MESSAGES = {
    // Lien personnel (et la commande ouverte s'il y en a une)
    lien: function (g, campagne) {
      var url = adresseSite() + '?k=' + encodeURIComponent(g.jeton || '') + (campagne && campagne.statut === 'ouverte' ? '&c=' + campagne.id : '');
      return 'Bonjour ' + g.prenom + ' !\n' +
        (campagne && campagne.statut === 'ouverte'
          ? 'La commande « ' + campagne.nom + ' » est ouverte jusqu’au ' + jour(campagne.cloture, true) + '.\n'
          : '') +
        'Voici votre lien personnel pour commander les fromages :\n' + url +
        '\nGardez-le, il sert pour toutes les commandes.\n' + signature();
    },
    // Fromages arrivés, montant à payer
    arrivee: function (g, c, point, campagne) {
      var ou = point ? [point.ville, point.lieu, point.heure].filter(Boolean).join(', ') : '';
      var quand = point ? (point.date_livraison || (campagne && campagne.livraison)) : (campagne && campagne.livraison);
      return 'Bonjour ' + g.prenom + ' !\nVos fromages sont arrivés 🧀\n' +
        (ou ? 'Rendez-vous : ' + ou + (quand ? ', ' + jour(quand) : '') + '. Merci de respecter l’horaire.\n' : '') +
        'Montant à payer : ' + euros(c.montant) + (c.paye ? ' (déjà payé, merci !)' : virement(c.reference)) + '\n' + signature();
    },
    // Relance de paiement
    relance: function (g, c, campagne) {
      return 'Bonjour ' + g.prenom + ',\nPetit rappel pour le paiement de votre commande' + (campagne ? ' « ' + campagne.nom + ' »' : '') + ' : ' + euros(c.montant) + '.' +
        virement(c.reference) + '\nSi c’est déjà fait, merci de ne pas tenir compte de ce message.\n' + signature();
    },
    // Annonce pour un groupe WhatsApp (sans lien personnel)
    ouverture: function (campagne, ferme) {
      return 'Bonjour à tous !\nLes commandes « ' + campagne.nom + ' »' + (ferme ? ' (' + ferme + ')' : '') + ' sont ouvertes jusqu’au ' + jour(campagne.cloture, true) + '.' +
        (campagne.livraison ? '\nLivraison : ' + jour(campagne.livraison) + '.' : '') +
        (campagne.message ? '\n\n' + campagne.message + '\n' : '\n') +
        '\nPour commander, utilisez votre lien personnel (reçu par mail).\n' + signature();
    }
  };

  // Bouton (lien) WhatsApp ; sans téléphone valable : bouton grisé avec une explication
  function bouton(tel, texte, libelle, classe) {
    var url = lien(tel, texte), esc = window.FJP.esc;
    if (!url) return '<button class="btn clair ' + (classe || '') + '" type="button" disabled title="Pas de téléphone pour ce gourmet">' + esc(libelle) + ' (pas de téléphone)</button>';
    return '<a class="btn wa ' + (classe || '') + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + ICONE + esc(libelle) + '</a>';
  }
  var ICONE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="vertical-align:-3px;margin-right:6px"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z"/></svg>';

  window.FJP_WA = {
    // À appeler avant d'afficher une rubrique (une seule lecture des réglages : IBAN, signature)
    pret: function () {
      if (reglages) return Promise.resolve();
      return window.FJP.api('reglages?id=eq.1&select=iban,titulaire,signature').then(function (l) { reglages = l[0] || {}; }).catch(function () { reglages = {}; });
    },
    oublier: function () { reglages = null; },
    numero: numero, lien: lien, bouton: bouton, messages: MESSAGES
  };
})();
