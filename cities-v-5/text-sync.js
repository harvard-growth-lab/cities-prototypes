/* Shared editing for text-edit.js: one copy of the text edits that every
   editor reads and writes live, kept in a Firebase Realtime Database.
   Editors sign in with a one-time link sent to their email (a Harvard
   address), or with Google if their address is on the editors list. Loaded by text-edit.js (only with ?edit, and only when
   text-edit-config.js names a Firebase project).

   The database, under the root named in the config ("v5"):
     text/<key>      the current edit of one element: { before, after, by, name, at }
     history/<id>    every settled change, newest last: { key, before, after, by, name, at }
                     (after "" means the element went back to its source)
     presence/<uid>  who has edit mode open, and which element they are in: { name, email, key, at }
   Who may read and write is set by the database rules (firebase/database.rules.json),
   not here. */
const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
const [{ initializeApp }, A, D] = await Promise.all([
  import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-database.js")
]);

/* database keys cannot hold . # $ [ ] / */
const enc = (k) => encodeURIComponent(k).replace(/\./g, "%2E");
const dec = (k) => decodeURIComponent(k);

export function connect(cfg, h) {
  const app = initializeApp(cfg, "text-edit");
  const auth = A.getAuth(app);
  const db = D.getDatabase(app, cfg.databaseURL);
  if (cfg.emulator) {
    A.connectAuthEmulator(auth, cfg.emulator.auth, { disableWarnings: true });
    const [host, port] = cfg.emulator.database.split(":");
    D.connectDatabaseEmulator(db, host, +port);
  }
  const root = D.ref(db, cfg.root || "v5");
  let user = null, offs = [], presence = null, denied = false;
  /* each key as it is stored, so a key written in another form is updated
     and removed under the same name */
  const stored = {};

  function fail(e) {
    if (denied) return;
    denied = true;
    h.onDenied(user, e);
  }
  function listen() {
    const text = D.child(root, "text");
    const got = (s) => { stored[dec(s.key)] = s.key; h.onText(dec(s.key), s.val()); };
    offs.push(D.onChildAdded(text, got, fail));
    offs.push(D.onChildChanged(text, got, fail));
    offs.push(D.onChildRemoved(text, (s) => { delete stored[dec(s.key)]; h.onText(dec(s.key), null); }, fail));
    offs.push(D.onValue(D.child(root, "presence"), (s) => {
      const others = {};
      s.forEach((c) => { if (c.key !== user.uid) others[c.key] = c.val(); });
      h.onPresence(others);
    }, fail));
    offs.push(D.onValue(D.query(D.child(root, "history"), D.limitToLast(80)), (s) => {
      const list = [];
      s.forEach((c) => { list.push(Object.assign({ id: c.key }, c.val())); });
      h.onHistory(list.reverse());
    }, fail));
    /* presence goes when the tab closes or the connection drops, and comes back with it */
    presence = D.child(root, "presence/" + user.uid);
    offs.push(D.onValue(D.ref(db, ".info/connected"), (s) => {
      if (s.val() !== true) return;
      D.onDisconnect(presence).remove().then(() => D.set(presence, me(null))).catch(fail);
    }));
  }
  function me(key) {
    return { name: user.displayName || user.email, email: user.email, key: key || null, at: D.serverTimestamp() };
  }
  /* back from a sign-in link: finish signing in, then take the link's
     one-time code out of the address bar */
  if (A.isSignInWithEmailLink(auth, location.href)) {
    const email = h.linkEmail();
    const done = () => {
      const u = new URL(location.href);
      ["apiKey", "oobCode", "mode", "lang", "continueUrl", "tenantId"].forEach((p) => u.searchParams.delete(p));
      history.replaceState(history.state, "", u);
    };
    if (email) A.signInWithEmailLink(auth, email, location.href).then(done, (e) => { done(); h.onError("That sign-in link did not work (" + (e.code || e.message) + "). Links work once and expire; ask for a new one."); });
  }
  A.onAuthStateChanged(auth, (u) => {
    offs.forEach((off) => off());
    offs = []; presence = null; denied = false;
    user = u;
    h.onUser(u ? { uid: u.uid, name: u.displayName || u.email, email: u.email } : null);
    if (u) listen();
  });

  const stamp = () => ({ by: user.uid, name: user.displayName || user.email, at: D.serverTimestamp() });
  return {
    signIn() {
      return A.signInWithPopup(auth, new A.GoogleAuthProvider()).catch((e) => {
        if (e && e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") h.onError("Sign-in did not work: " + (e.code || e.message));
      });
    },
    /* the link comes back to this page, in edit mode */
    sendLink(email) {
      const u = new URL(location.href);
      u.searchParams.delete("te"); u.hash = "";
      return A.sendSignInLinkToEmail(auth, email, { url: u.toString(), handleCodeInApp: true });
    },
    async signOut() {
      if (presence) await D.remove(presence).catch(() => {});
      return A.signOut(auth);
    },
    /* entry null: the element goes back to its source */
    put(key, entry) {
      if (!user) return Promise.resolve();
      const r = D.child(D.child(root, "text"), stored[key] || enc(key));
      return (entry ? D.set(r, Object.assign({ before: entry.before, after: entry.after }, stamp())) : D.remove(r)).catch((e) => h.onError("Could not save: " + (e.code || e.message)));
    },
    log(key, before, after) {
      if (!user) return Promise.resolve();
      return D.push(D.child(root, "history"), Object.assign({ key, before, after: after || "" }, stamp())).catch(() => {});
    },
    here(key) {
      if (presence) D.set(presence, me(key)).catch(() => {});
    },
  };
}
