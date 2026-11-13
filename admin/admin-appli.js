// Les Fromages Jean-Paul — espace de Jean-Paul : appli installable et notifications
(function () {
  'use strict';
  window.FJP_VUES = window.FJP_VUES || {};
  var C = window.CONFIG;

  var ua = navigator.userAgent;
  var IOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var ANDROID = /Android/.test(ua);
  var MOBILE = IOS || ANDROID;
  function installee() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function pushPossible() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function appareil() {
    var nav = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : 'Safari';
    return (IOS ? 'iPhone' : ANDROID ? 'Android' : 'Ordinateur') + ' · ' + (installee() ? 'appli' : nav);
  }
  function lire(c) { try { return localStorage.getItem(c); } catch (e) { return null; } }
  function stocker(c, v) { try { localStorage.setItem(c, v); } catch (e) {} }

  // ---------- Service worker ----------
  var enregistrement = null;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (r) { enregistrement = r; }).catch(function () {});
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.aller && window.FJP) window.FJP.aller(e.data.aller);
    });
  }
  function enreg() {
    if (enregistrement) return Promise.resolve(enregistrement);
    if (!('serviceWorker' in navigator)) return Promise.reject(new Error('non pris en charge'));
    return navigator.serviceWorker.getRegistration('./').then(function (r) {
      return r || navigator.serviceWorker.register('sw.js', { scope: './' });
    }).then(function (r) { enregistrement = r; return r; });
  }
  function abonnementActuel() {
    if (!pushPossible()) return Promise.resolve(null);
    return enreg().then(function (r) { return r.pushManager.getSubscription(); }).catch(function () { return null; });
  }

  // ---------- Installation ----------
  var invitation = null; // proposée par Chrome sur Android et ordinateur
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); invitation = e; bandeau(); });
  window.addEventListener('appinstalled', function () { invitation = null; bandeau(); });

  // Petit bandeau en haut tant que l'appli n'est pas installée sur le téléphone
  function bandeau() {
    var b = document.getElementById('bandeau-appli');
    var afficher = MOBILE && !installee() && lire('fjp_bandeau_appli') !== 'non' && window.FJP_CONNECTE;
    if (!afficher) { if (b) b.remove(); return; }
    if (b) return;
    b = document.createElement('div');
    b.id = 'bandeau-appli'; b.className = 'bandeau info'; b.setAttribute('role', 'note');
    b.style.cssText = 'display:flex;gap:10px;align-items:center;max-width:728px;margin:12px auto 0;';
    b.innerHTML = '<img src="../images/app-192.png" alt="" width="40" height="40" style="border-radius:9px">' +
      '<span style="flex-grow:1">Installez l’appli sur ce téléphone pour recevoir les notifications.</span>' +
      '<button class="btn" type="button" id="bandeau-voir" style="white-space:nowrap">Comment ?</button>' +
      '<button type="button" id="bandeau-fermer" aria-label="Fermer" style="background:none;border:none;font-size:22px;color:inherit;cursor:pointer;min-height:44px">×</button>';
    var main = document.getElementById('app');
    main.parentNode.insertBefore(b, main);
    document.getElementById('bandeau-voir').onclick = function () { window.FJP.aller('notifications'); };
    document.getElementById('bandeau-fermer').onclick = function () { stocker('fjp_bandeau_appli', 'non'); b.remove(); };
  }

  // ---------- Clé publique du service de notifications ----------
  function clePublique() {
    return fetch(C.supabaseUrl + '/functions/v1/push', { headers: { apikey: C.supabaseKey } })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (!j.cle) throw new Error('Le service des notifications ne répond pas encore (fonction « push » de Supabase).');
        return j.cle;
      });
  }
  function versOctets(b64) {
    var s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4));
    var o = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i);
    return o;
  }
  function enregistrer(sub) {
    var j = sub.toJSON();
    return window.FJP.api('rpc/push_abonner', { method: 'POST', body: { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_appareil: appareil() } });
  }
  function activer() {
    // La demande d'autorisation doit partir tout de suite après le toucher (exigence de l'iPhone)
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error('refus');
      return Promise.all([enreg(), clePublique()]);
    }).then(function (r) {
      var reg = r[0], cle = r[1];
      return reg.pushManager.getSubscription().then(function (ancien) {
        return ancien ? ancien.unsubscribe() : null;
      }).then(function () {
        var attente = new Promise(function (_, non) { setTimeout(function () { non(new Error('le téléphone ne répond pas, vérifiez Internet et réessayez')); }, 25000); });
        return Promise.race([reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(cle) }), attente]);
      });
    }).then(enregistrer);
  }
  function couper() {
    return abonnementActuel().then(function (sub) {
      if (!sub) return;
      var ep = sub.endpoint;
      return sub.unsubscribe().then(function () {
        return window.FJP.api('rpc/push_desabonner', { method: 'POST', body: { p_endpoint: ep } });
      });
    });
  }

  // À chaque ouverture : on redit à la base que ce téléphone est abonné (au cas où l'adresse aurait changé)
  window.addEventListener('fjp-connecte', function () {
    window.FJP_CONNECTE = true;
    bandeau();
    if (pushPossible() && Notification.permission === 'granted') {
      abonnementActuel().then(function (sub) { if (sub) return enregistrer(sub); }).catch(function () {});
    }
  });

  // Lien direct vers une rubrique (ex. …/admin/#commandes)
  window.addEventListener('hashchange', function () {
    var v = location.hash.slice(1);
    if (v && window.FJP) { history.replaceState(null, '', location.pathname); window.FJP.aller(v); }
  });

  // ---------- Rubrique « Notifications » ----------
  var CHOIX = [
    ['notif_commandes', 'Nouvelle commande', 'Le nom, le montant et la ville, à chaque commande validée.'],
    ['notif_modifs', 'Commande modifiée ou annulée', 'Avec l’ancien et le nouveau montant.'],
    ['notif_cloture', 'Fin de campagne', 'La veille de la clôture, puis à la clôture, avec une alerte si un minimum de la ferme n’est pas atteint.'],
    ['notif_resume', 'Résumé du soir', 'Vers 19 h, le bilan de la journée. Pratique si vous coupez « Nouvelle commande ».']
  ];

  function vueNotifications() {
    var FJP = window.FJP, esc = FJP.esc, app = FJP.app;
    return Promise.all([FJP.api('rpc/push_reglages', { method: 'POST', body: {} }), abonnementActuel()]).then(function (r) {
      var reglages = r[0], sub = r[1];
      function dessiner(msg) {
        var h = '<section class="carte"><h1 style="font-size:20px">Sur ce téléphone</h1>';
        // 1. Installation
        if (installee()) {
          h += '<p class="ok-ligne">✓ L’appli est installée.</p>';
        } else if (invitation) {
          h += '<p>Installez l’appli : elle aura son icône sur l’écran d’accueil, comme les autres.</p>' +
            '<button class="bouton" type="button" id="installer">Installer l’appli</button>';
        } else if (IOS) {
          h += '<p><b>Pour installer l’appli sur l’iPhone :</b></p><ol class="etapes">' +
            '<li>Ouvrez cette page dans <b>Safari</b>.</li>' +
            '<li>Touchez le bouton <b>Partager</b> (le carré avec une flèche vers le haut, en bas de l’écran).</li>' +
            '<li>Choisissez <b>« Sur l’écran d’accueil »</b>, puis <b>Ajouter</b>.</li>' +
            '<li>Ouvrez l’appli <b>JPFromages</b> depuis son icône, connectez-vous, et revenez ici.</li></ol>';
        } else if (ANDROID) {
          h += '<p><b>Pour installer l’appli :</b> dans le menu de Chrome (les trois points ⋮ en haut à droite), choisissez <b>« Installer l’application »</b> ou <b>« Ajouter à l’écran d’accueil »</b>.</p>';
        } else {
          h += '<p>Sur ordinateur, l’appli s’utilise très bien dans le navigateur. Pour l’installer, cherchez l’icône d’installation au bout de la barre d’adresse (Chrome ou Edge).</p>';
        }
        // 2. Notifications
        h += '<h2 class="sous-titre">Notifications</h2>';
        if (!pushPossible()) {
          if (IOS && !installee()) h += '<p>Sur iPhone, les notifications ne marchent que dans l’appli installée : installez-la d’abord (ci-dessus), puis ouvrez-la depuis son icône.</p>';
          else if (IOS) h += '<p>Cet iPhone est trop ancien pour les notifications : il faut iOS 16.4 ou plus récent (Réglages › Général › Mise à jour logicielle).</p>';
          else h += '<p>Ce navigateur ne permet pas les notifications. Utilisez Chrome.</p>';
        } else if (Notification.permission === 'denied') {
          h += '<p class="erreur-txt">Les notifications sont bloquées pour l’appli.</p><p>' +
            (IOS ? 'Pour les autoriser : Réglages de l’iPhone › Notifications › JPFromages › Autoriser les notifications.'
                 : 'Pour les autoriser : touchez le cadenas (ou ⋮ › Paramètres) › Notifications › Autoriser.') + ' Puis revenez ici.</p>';
        } else if (sub) {
          h += '<p class="ok-ligne">✓ Les notifications sont activées sur ce téléphone.</p>' +
            '<div class="actions" style="margin:0"><button class="bouton" type="button" id="essai">Envoyer une notification d’essai</button>' +
            '<button class="bouton second" type="button" id="couper">Couper les notifications sur ce téléphone</button></div>';
        } else {
          h += '<p>Recevez un message sur ce téléphone à chaque commande, même quand l’appli est fermée.</p>' +
            '<button class="bouton" type="button" id="activer">Activer les notifications</button>';
        }
        if (msg) h += '<p class="' + (msg.erreur ? 'erreur-txt' : 'avis-ok') + '" role="status" style="margin:12px 0 0">' + esc(msg.texte) + '</p>';
        h += '</section>';

        // 3. Choix (valables pour tous mes appareils)
        h += '<section class="carte"><h1 style="font-size:20px">Ce que je reçois</h1>' +
          '<p style="font-size:14px;color:var(--texte-doux)">Ces choix valent pour tous vos appareils' +
          (reglages.appareils ? ' (notifications activées sur ' + reglages.appareils + ' appareil' + (reglages.appareils > 1 ? 's' : '') + ')' : '') + '.</p>';
        CHOIX.forEach(function (c) {
          h += '<label class="choix"><input type="checkbox" data-choix="' + c[0] + '"' + (reglages[c[0]] ? ' checked' : '') + '>' +
            '<span><b>' + esc(c[1]) + '</b><small>' + esc(c[2]) + '</small></span></label>';
        });
        h += '</section>';
        app.innerHTML = h;
      }
      dessiner();

      app.onclick = function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.id === 'installer' && invitation) {
          invitation.prompt();
          invitation.userChoice.then(function () { invitation = null; dessiner(); bandeau(); });
        }
        if (b.id === 'activer') {
          b.disabled = true; b.textContent = 'Activation…';
          activer().then(function () { return abonnementActuel(); }).then(function (s) {
            sub = s; reglages.appareils = (reglages.appareils || 0) + 1;
            dessiner({ texte: 'C’est fait ! Touchez « Envoyer une notification d’essai » pour vérifier.' });
          }).catch(function (err) {
            dessiner(err.message === 'refus' ? { erreur: true, texte: 'Vous n’avez pas autorisé les notifications. Vous pouvez réessayer quand vous voulez.' }
              : { erreur: true, texte: 'Impossible d’activer les notifications : ' + err.message });
          });
        }
        if (b.id === 'essai') {
          b.disabled = true;
          FJP.api('rpc/push_tester', { method: 'POST', body: {} }).then(function () {
            dessiner({ texte: 'Notification envoyée : elle doit arriver dans quelques secondes. Rien ? Coupez puis réactivez les notifications.' });
          }).catch(function (err) { dessiner({ erreur: true, texte: 'Erreur : ' + err.message }); });
        }
        if (b.id === 'couper') {
          if (!window.confirm('Ne plus recevoir de notifications sur ce téléphone ?')) return;
          b.disabled = true;
          couper().then(function () {
            sub = null; reglages.appareils = Math.max(0, (reglages.appareils || 1) - 1);
            dessiner({ texte: 'Notifications coupées sur ce téléphone.' });
          }).catch(function (err) { dessiner({ erreur: true, texte: 'Erreur : ' + err.message }); });
        }
      };
      app.onchange = function (e) {
        var c = e.target.closest('[data-choix]'); if (!c) return;
        var corps = {}; corps[c.dataset.choix] = c.checked;
        FJP.api('rpc/push_reglages', { method: 'POST', body: { p_reglages: corps } }).then(function (n) {
          reglages = n; FJP.toast('Enregistré');
        }).catch(function (err) { c.checked = !c.checked; FJP.toast('Erreur : ' + FJP.esc(err.message)); });
      };
    });
  }
  window.FJP_VUES.notifications = vueNotifications;
})();
